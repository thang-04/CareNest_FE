import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { buildSeedChildRecords } from '@/mocks/childrenSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { CHILD_STATUS } from '@/models/School';
import { ROLES } from '@/models/User';
import {
  AI_TREND_STATUS,
  DECLARATION_STATE,
  MEASUREMENT_FIELD_LABELS,
  PARENT_ACCOUNT_STATUS,
  SMS_STATUS,
} from '@/models/children/childrenConstants';
import { normalizeText, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import {
  hasErrors,
  normalizePhone,
  validateChildInfo,
  validateDeclaration,
  validateMeasurement,
  validatePlacement,
} from '@/utils/children/childrenValidation';
import {
  canActivateParent,
  canConfirmAllergies,
  canDeclareHealth,
  canEditChild,
  canEnrollChild,
  canPlaceChild,
  canRecordMeasurement,
  canViewChild,
  canViewChildren,
  canViewHealth,
  canViewParentAccounts,
  isPrincipal,
  isVicePrincipal,
} from '@/utils/children/childrenPermissions';
import { classifyMeasurement } from './nutritionRule';
import { readEnrollmentCsv } from './enrollmentImport';

/*
 * Fake backend of child records & child health. Owns: scope checks (GBR-GEN-01, GBR-GEN-09), enrollment and
 * placement (GBR-CP-01), declarations (GBR-CP-02), allergy confirmation (GBR-HLT-03), parent accounts (UC 3.9),
 * measurements with the rule-based nutrition status and edit log (GBR-HLT-01..03), and the AI trend draft (GBR-AI-*).
 * Collections: reads/writes db.children; owns db.healthMeasurements, db.healthDeclarations, db.parentAccounts,
 * db.childPlacements, db.healthTrendDrafts.
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const MAX_IMPORT_ROWS = 500;

const nowIso = () => new Date().toISOString();

const ensureSeeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (db.healthMeasurements && db.healthDeclarations && db.parentAccounts && db.childPlacements && db.healthTrendDrafts) return db;
  writeDb((d) => {
    const seed = buildSeedChildRecords({ children: d.children, classes: d.classes });
    const childById = Object.fromEntries(d.children.map((c) => [c.id, c]));
    d.healthMeasurements ||= seed.healthMeasurements.map((m) => ({ ...m, ...classifyMeasurement(m, childById[m.childId].dateOfBirth) }));
    d.healthDeclarations ||= seed.healthDeclarations;
    d.parentAccounts ||= seed.parentAccounts;
    d.childPlacements ||= seed.childPlacements;
    d.healthTrendDrafts ||= [];
  });
  return readDb();
};

const forbid = () => {
  throw new ApiError(403, FORBIDDEN);
};

const invalid = (errors, message = 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.') => {
  throw new ApiError(422, message, errors);
};

const userName = (db, id) => db.users?.find((u) => u.id === id)?.fullName || '';
const classOf = (db, child) => (child?.classId ? db.classes.find((c) => c.id === child.classId) || null : null);
const declarationOf = (db, childId) => db.healthDeclarations.find((d) => d.childId === childId) || null;
const activeCount = (db, classId) => db.children.filter((c) => c.classId === classId && c.status === CHILD_STATUS.ACTIVE).length;

const findChild = (db, id) => {
  const child = db.children.find((c) => c.id === id);
  if (!child) throw new ApiError(404, 'Không tìm thấy hồ sơ trẻ.');
  return child;
};

/** Child as returned to the UI: account internals only for Principal / VP. */
const toView = (db, child, user) => {
  const cls = classOf(db, child);
  const decl = declarationOf(db, child.id);
  const showAccounts = canViewParentAccounts(user);
  return {
    ...clone(child),
    guardians: (child.guardians || []).map((g) => {
      const { smsStatus, smsAt, ...rest } = g;
      return showAccounts ? { ...rest, smsStatus, smsAt } : { fullName: g.fullName, relation: g.relation, phone: g.phone, email: g.email };
    }),
    className: cls?.name || '',
    ageGroupId: cls?.ageGroupId || '',
    schoolYear: cls?.schoolYear || '',
    hasDeclaration: !!decl,
    allergyPending: !!decl && decl.allergies.state === DECLARATION_STATE.REPORTED && !decl.allergyConfirmation,
  };
};

const assertView = (db, childId, user, check = canViewChild) => {
  const child = findChild(db, childId);
  if (!check(child, user, classOf(db, child))) forbid();
  return child;
};

const isDuplicate = (db, data, excludeId) => {
  const name = normalizeText(data.fullName).trim();
  return (
    db.children.find(
      (c) =>
        c.id !== excludeId &&
        c.status !== CHILD_STATUS.LEFT &&
        normalizeText(c.fullName).trim() === name &&
        c.dateOfBirth === data.dateOfBirth,
    ) || null
  );
};

const nextCode = (db) => {
  const prefix = `HS${new Date().getFullYear().toString().slice(2)}`;
  const used = new Set(db.children.map((c) => c.code));
  let n = db.children.length + 1;
  while (used.has(`${prefix}${String(n).padStart(3, '0')}`)) n += 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
};

const cleanGuardians = (guardians, previous = []) =>
  guardians.map((g) => {
    const old = previous.find((p) => normalizePhone(p.phone) === normalizePhone(g.phone));
    return {
      fullName: g.fullName.trim(),
      relation: g.relation,
      phone: g.phone.trim(),
      email: (g.email || '').trim(),
      accountStatus: old?.accountStatus || PARENT_ACCOUNT_STATUS.NOT_ACTIVATED,
      ...(old?.smsStatus ? { smsStatus: old.smsStatus, smsAt: old.smsAt } : {}),
    };
  });

const cleanDeclaration = (d) => ({
  allergies: {
    state: d.allergies.state,
    items: d.allergies.state === DECLARATION_STATE.REPORTED ? d.allergies.items.map((x) => x.trim()).filter(Boolean) : [],
  },
  diet: { state: d.diet.state, text: d.diet.state === DECLARATION_STATE.REPORTED ? d.diet.text.trim() : '' },
  otherNotes: {
    state: d.otherNotes?.state || DECLARATION_STATE.NOT_PROVIDED,
    text: d.otherNotes?.state === DECLARATION_STATE.REPORTED ? d.otherNotes.text.trim() : '',
  },
});

/** Placement checks (UC 3.10 step 4): class of the VP's campus, active, not full. */
const assertClassAvailable = (db, classId, user) => {
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls || cls.status === 'INACTIVE') invalid({ classId: 'Lớp không tồn tại hoặc đã ngừng hoạt động' });
  if (cls.campusId !== user.campusId) invalid({ classId: 'Chỉ xếp được vào lớp thuộc điểm trường của bạn' });
  if (activeCount(db, cls.id) >= cls.capacity) invalid({ classId: `${cls.name} đã đủ ${cls.capacity} trẻ. Chọn lớp khác.` });
  return cls;
};

const notifyClassTeachers = (db, cls, child) =>
  (cls?.teacherIds || []).forEach((teacherId) =>
    pushNotification(db, {
      userId: teacherId,
      type: 'CHILD_PLACED',
      title: 'Lớp có trẻ mới',
      message: `${child.fullName} đã được xếp vào ${cls.name}.`,
      link: `/children/${child.id}`,
    }),
  );

const notifyAllergyToConfirm = (db, child) =>
  db.users
    .filter((u) => u.role === ROLES.PRINCIPAL)
    .forEach((u) =>
      pushNotification(db, {
        userId: u.id,
        type: 'ALLERGY_TO_CONFIRM',
        title: 'Cần xác nhận dị ứng thực phẩm',
        message: `Hồ sơ ${child.fullName} (${child.code}) có khai báo dị ứng chờ Hiệu trưởng xác nhận.`,
        link: `/children/${child.id}/health-declaration`,
      }),
    );

const validateEnrollment = (db, { child, declaration }, excludeId) => {
  const errors = { ...validateChildInfo(child), ...prefix('declaration', validateDeclaration(declaration)) };
  const dup = !errors.fullName && !errors.dateOfBirth ? isDuplicate(db, child, excludeId) : null;
  return { errors, dup };
};

const prefix = (p, errors) => Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${p}.${k}`, v]));

const createChild = (db, { child, declaration }, { classId, user }) => {
  const record = {
    id: uid('ch'),
    code: nextCode(db),
    fullName: child.fullName.trim(),
    gender: child.gender,
    dateOfBirth: child.dateOfBirth,
    classId: classId || null,
    campusId: user.campusId,
    status: classId ? CHILD_STATUS.ACTIVE : CHILD_STATUS.PENDING_PLACEMENT,
    enrolledAt: todayInput(),
    // Official allergy list stays empty until the Principal confirms the declaration (GBR-HLT-03).
    allergies: [],
    guardians: cleanGuardians(child.guardians),
    history: [{ action: 'ENROLLED', userId: user.id, at: nowIso() }],
  };
  db.children.push(record);
  db.healthDeclarations.push({
    childId: record.id,
    ...cleanDeclaration(declaration),
    allergyConfirmation: null,
    declaredBy: user.id,
    declaredAt: nowIso(),
    history: [{ action: 'DECLARED', userId: user.id, at: nowIso() }],
  });
  if (classId)
    db.childPlacements.push({ id: uid('pl'), childId: record.id, fromClassId: null, toClassId: classId, userId: user.id, at: nowIso() });
  if (declaration.allergies.state === DECLARATION_STATE.REPORTED) notifyAllergyToConfirm(db, record);
  return record;
};

const smsWouldFail = (account) => /99$/.test(account.phone) && account.sms.length === 0;

const sendCredentials = (account) => {
  // Demo SMS gateway: numbers ending in 99 fail on the first attempt so the resend path can be tried.
  const status = smsWouldFail(account) ? SMS_STATUS.FAILED : SMS_STATUS.SENT;
  account.sms.push({ at: nowIso(), status });
  return status;
};

const toMeasurementView = (db, m) => ({
  ...clone(m),
  measuredByName: userName(db, m.measuredBy),
  edits: (m.edits || []).map((e) => ({ ...e, userName: userName(db, e.userId) })),
});

export const childrenMockRepository = {
  /* ------------------------------ #27 Children list ------------------------------ */
  async listChildren(filters = {}, user) {
    await delay(150);
    if (!canViewChildren(user)) forbid();
    const db = ensureSeeded();
    const kw = normalizeText(filters.keyword).trim();
    const list = db.children
      .filter((c) => canViewChild(c, user, classOf(db, c)))
      .map((c) => toView(db, c, user))
      .filter((c) => !filters.schoolYear || !c.classId || c.schoolYear === filters.schoolYear)
      .filter((c) => !filters.campusId || c.campusId === filters.campusId)
      .filter((c) => !filters.classId || c.classId === filters.classId)
      .filter((c) => !filters.status || c.status === filters.status)
      .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw));
    return list.sort((a, b) => a.className.localeCompare(b.className, 'vi') || a.fullName.localeCompare(b.fullName, 'vi'));
  },

  /* ------------------------------ #32 Child profile ------------------------------ */
  async getChildDetail(id, user) {
    await delay(120);
    const db = ensureSeeded();
    const child = assertView(db, id, user);
    const placements = db.childPlacements
      .filter((p) => p.childId === id)
      .map((p) => ({
        ...p,
        userName: userName(db, p.userId),
        fromClassName: db.classes.find((c) => c.id === p.fromClassId)?.name || '',
        toClassName: db.classes.find((c) => c.id === p.toClassId)?.name || '',
      }))
      .reverse();
    const decl = declarationOf(db, id);
    return {
      child: toView(db, child, user),
      cls: clone(classOf(db, child)),
      declaration: decl
        ? { ...clone(decl), declaredByName: userName(db, decl.declaredBy), confirmedByName: userName(db, decl.allergyConfirmation?.by) }
        : null,
      placements,
    };
  },

  /* ------------------------------ #28 Enrollment form ------------------------------ */
  async checkDuplicate(data, user, excludeId) {
    await delay(100);
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    const dup = isDuplicate(db, data, excludeId);
    if (!dup) return null;
    // Another campus: say it exists without exposing the record (GBR-GEN-01).
    return dup.campusId === user.campusId
      ? { id: dup.id, code: dup.code, fullName: dup.fullName, sameCampus: true }
      : { sameCampus: false };
  },

  async getPlacementClasses({ schoolYear } = {}, user) {
    await delay(100);
    if (!isVicePrincipal(user) && !isPrincipal(user)) forbid();
    const db = ensureSeeded();
    return db.classes
      .filter((c) => (isPrincipal(user) || c.campusId === user.campusId) && c.status !== 'INACTIVE')
      .filter((c) => !schoolYear || c.schoolYear === schoolYear)
      .map((c) => ({ ...clone(c), enrolledCount: activeCount(db, c.id) }));
  },

  async enrollChild(payload, user) {
    await delay();
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    const { errors, dup } = validateEnrollment(db, payload);
    Object.assign(errors, validatePlacement(payload));
    if (hasErrors(errors)) invalid(errors);
    if (dup) throw new ApiError(409, 'Hồ sơ trẻ này đã tồn tại (trùng họ tên và ngày sinh). Xem lại hồ sơ đã có.');
    return writeDb((d) => {
      const cls = assertClassAvailable(d, payload.classId, user);
      const record = createChild(d, payload, { classId: cls.id, user });
      notifyClassTeachers(d, cls, record);
      return toView(d, record, user);
    });
  },

  async updateChild(id, { child, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const current = findChild(db, id);
    if (!canEditChild(current, user)) forbid();
    const errors = validateChildInfo(child);
    if (!reason?.trim()) errors.reason = 'Nhập lý do chỉnh sửa hồ sơ';
    if (hasErrors(errors)) invalid(errors);
    if (isDuplicate(db, child, id)) throw new ApiError(409, 'Đã có hồ sơ khác trùng họ tên và ngày sinh. Xem lại hồ sơ đã có.');
    return writeDb((d) => {
      const target = findChild(d, id);
      const changes = [];
      const set = (field, value) => {
        if (JSON.stringify(target[field]) !== JSON.stringify(value)) changes.push({ field, from: target[field], to: value });
        target[field] = value;
      };
      set('fullName', child.fullName.trim());
      set('dateOfBirth', child.dateOfBirth);
      set('gender', child.gender);
      set('guardians', cleanGuardians(child.guardians, target.guardians));
      target.history = [...(target.history || []), { action: 'UPDATED', userId: user.id, at: nowIso(), note: reason.trim(), changes }];
      return toView(d, target, user);
    });
  },

  /* ------------------------------ #28 Excel / CSV import ------------------------------ */
  async previewImport(file, user) {
    await delay(300);
    if (!canEnrollChild(user)) forbid();
    const name = file?.name || '';
    if (/\.xlsx?$/i.test(name)) {
      return {
        supported: false,
        fileName: name,
        message:
          'Bản chạy thử chỉ đọc được file .csv. File Excel (.xlsx) sẽ do máy chủ đọc khi nối backend. Hãy lưu file Excel dưới dạng "CSV UTF-8" rồi tải lên lại.',
        rows: [],
      };
    }
    if (!/\.csv$/i.test(name)) invalid({ file: 'Chỉ nhận file .xlsx hoặc .csv theo mẫu của trường' }, 'Định dạng file không được hỗ trợ.');
    const text = await file.text();
    const { missingColumns, rows } = readEnrollmentCsv(text);
    if (missingColumns.length) invalid({ file: `Thiếu cột: ${missingColumns.join(', ')}` }, 'File không đúng mẫu tiếp nhận trẻ.');
    if (rows.length === 0) invalid({ file: 'File không có dòng dữ liệu nào' }, 'File không có dữ liệu.');
    if (rows.length > MAX_IMPORT_ROWS) invalid({ file: `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} trẻ` }, 'File quá lớn.');
    const db = ensureSeeded();
    const seen = new Map();
    const checked = rows.map((r) => {
      const { errors, dup } = validateEnrollment(db, r.payload);
      const messages = [...new Set(Object.values(errors))];
      if (dup) messages.push('Trẻ đã có hồ sơ trong hệ thống (trùng họ tên và ngày sinh)');
      const key = `${normalizeText(r.payload.child.fullName).trim()}|${r.payload.child.dateOfBirth}`;
      if (r.payload.child.fullName && seen.has(key)) messages.push(`Trùng với dòng ${seen.get(key)} trong file`);
      else seen.set(key, r.rowNo);
      return { ...r, errors: messages };
    });
    return { supported: true, fileName: name, rows: checked };
  },

  /** Valid rows become children waiting for placement; their declaration is saved as entered (UC 3.8 alt flow). */
  async importChildren(rows, user) {
    await delay();
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    if (!rows?.length) invalid({ file: 'Không có dòng hợp lệ để nhập' });
    const keys = new Set();
    rows.forEach((r) => {
      const { errors, dup } = validateEnrollment(db, r);
      const key = `${normalizeText(r.child.fullName).trim()}|${r.child.dateOfBirth}`;
      if (hasErrors(errors) || dup || keys.has(key)) invalid({ file: 'File có dòng lỗi. Kiểm tra lại trước khi nhập.' });
      keys.add(key);
    });
    return writeDb((d) => {
      const created = rows.map((r) => createChild(d, r, { classId: null, user }));
      return { created: created.length, ids: created.map((c) => c.id) };
    });
  },

  /* ------------------------------ #29 Class placement ------------------------------ */
  async placeChild(childId, { classId, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canPlaceChild(child, user)) forbid();
    if (!classId) invalid({ classId: 'Chọn lớp cho trẻ' });
    if (child.classId === classId) invalid({ classId: 'Trẻ đang học lớp này. Chọn lớp khác.' });
    if (child.classId && !reason?.trim()) invalid({ reason: 'Nhập lý do chuyển lớp' });
    if (!declarationOf(db, childId)) invalid({ classId: 'Trẻ chưa có khai báo sức khỏe. Khai báo trước khi xếp lớp.' });
    return writeDb((d) => {
      const target = findChild(d, childId);
      const cls = assertClassAvailable(d, classId, user);
      // One class per child at a time: the transfer closes the old placement (data rule).
      d.childPlacements.push({
        id: uid('pl'),
        childId,
        fromClassId: target.classId,
        toClassId: cls.id,
        userId: user.id,
        at: nowIso(),
        reason: reason?.trim() || '',
      });
      target.classId = cls.id;
      target.status = CHILD_STATUS.ACTIVE;
      notifyClassTeachers(d, cls, target);
      return toView(d, target, user);
    });
  },

  /* ------------------------------ #30 Health declaration ------------------------------ */
  async saveDeclaration(childId, { declaration, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canDeclareHealth(child, user)) forbid();
    const errors = validateDeclaration(declaration);
    const current = declarationOf(db, childId);
    if (current?.allergyConfirmation && !reason?.trim()) errors.reason = 'Nhập lý do thay đổi khai báo đã được xác nhận';
    if (hasErrors(errors)) invalid(errors);
    return writeDb((d) => {
      const clean = cleanDeclaration(declaration);
      let decl = declarationOf(d, childId);
      if (!decl) {
        decl = { childId, allergyConfirmation: null, history: [] };
        d.healthDeclarations.push(decl);
      }
      const allergyChanged = JSON.stringify(decl.allergies) !== JSON.stringify(clean.allergies);
      Object.assign(decl, clean, { declaredBy: user.id, declaredAt: nowIso() });
      decl.history.push({ action: 'UPDATED', userId: user.id, at: nowIso(), note: reason?.trim() || '' });
      // Changed allergy data needs a new Principal confirmation before kitchen warnings use it (GBR-CP-02).
      if (allergyChanged) {
        decl.allergyConfirmation = null;
        if (clean.allergies.state === DECLARATION_STATE.REPORTED) notifyAllergyToConfirm(d, findChild(d, childId));
      }
      return clone(decl);
    });
  },

  async confirmAllergies(childId, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canConfirmAllergies(child, user)) forbid();
    const decl = declarationOf(db, childId);
    if (!decl || decl.allergies.state === DECLARATION_STATE.NOT_PROVIDED)
      throw new ApiError(422, 'Chưa có thông tin dị ứng do phụ huynh cung cấp để xác nhận.');
    return writeDb((d) => {
      const target = findChild(d, childId);
      const dd = declarationOf(d, childId);
      target.allergies = [...dd.allergies.items];
      dd.allergyConfirmation = { by: user.id, at: nowIso() };
      dd.history.push({ action: 'ALLERGY_CONFIRMED', userId: user.id, at: nowIso() });
      return clone(dd);
    });
  },

  /* ------------------------------ #31 Parent account activation ------------------------------ */
  async listParentAccounts(filters = {}, user) {
    await delay(150);
    if (!canViewParentAccounts(user)) forbid();
    const db = ensureSeeded();
    const kw = normalizeText(filters.keyword).trim();
    return db.children
      .filter((c) => c.status !== CHILD_STATUS.LEFT && canViewChild(c, user, classOf(db, c)))
      .flatMap((c) =>
        (c.guardians || []).map((g, index) => ({
          key: `${c.id}_${index}`,
          childId: c.id,
          childCode: c.code,
          childName: c.fullName,
          campusId: c.campusId,
          className: classOf(db, c)?.name || '',
          guardianIndex: index,
          guardian: clone(g),
          username: db.parentAccounts.find((a) => a.phone === normalizePhone(g.phone))?.username || '',
        })),
      )
      .filter((r) => !filters.status || r.guardian.accountStatus === filters.status)
      .filter((r) => !kw || normalizeText(`${r.childName} ${r.childCode} ${r.guardian.fullName} ${r.guardian.phone}`).includes(kw));
  },

  async activateParentAccount(childId, guardianIndex, user) {
    await delay(400);
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canActivateParent(child, user)) forbid();
    const guardian = child.guardians?.[guardianIndex];
    if (!guardian) throw new ApiError(404, 'Không tìm thấy phụ huynh.');
    if (guardian.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED)
      throw new ApiError(409, 'Phụ huynh này đã có tài khoản liên kết với trẻ.');
    const phone = normalizePhone(guardian.phone);
    const email = (guardian.email || '').trim().toLowerCase();
    const byPhone = db.parentAccounts.find((a) => a.phone === phone);
    const byEmail = email ? db.parentAccounts.find((a) => a.email.toLowerCase() === email) : null;
    if (byPhone && byEmail && byPhone.id !== byEmail.id)
      throw new ApiError(409, 'Số điện thoại và email thuộc hai tài khoản phụ huynh khác nhau. Kiểm tra lại thông tin liên hệ.');
    // Sign-in phone / email are unique across every account, staff included (data rule).
    const staffClash = db.users.some((u) => normalizePhone(u.phone) === phone || (email && u.email?.toLowerCase() === email));
    if (staffClash)
      throw new ApiError(409, 'Số điện thoại hoặc email đã được dùng cho tài khoản nhân viên. Không tạo được tài khoản phụ huynh.');
    return writeDb((d) => {
      const target = findChild(d, childId).guardians[guardianIndex];
      const existing = d.parentAccounts.find((a) => a.id === (byPhone || byEmail)?.id);
      if (existing) {
        // Existing account: link only, no new password (UC 3.9 alt flow step 2).
        if (!existing.childIds.includes(childId)) existing.childIds.push(childId);
        target.accountStatus = existing.status;
        return { mode: 'LINKED', username: existing.username, accountStatus: existing.status };
      }
      const account = {
        id: uid('pa'),
        username: phone,
        phone,
        email,
        fullName: target.fullName,
        status: PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION,
        childIds: [childId],
        createdAt: nowIso(),
        mustChangePassword: true,
        sms: [],
      };
      d.parentAccounts.push(account);
      // The issued password goes only to the SMS gateway; it is never returned to the web client.
      const smsStatus = sendCredentials(account);
      target.accountStatus = PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION;
      target.smsStatus = smsStatus;
      target.smsAt = nowIso();
      return { mode: 'CREATED', username: account.username, accountStatus: account.status, smsStatus };
    });
  },

  async resendParentSms(childId, guardianIndex, user) {
    await delay(400);
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canActivateParent(child, user)) forbid();
    const guardian = child.guardians?.[guardianIndex];
    if (!guardian) throw new ApiError(404, 'Không tìm thấy phụ huynh.');
    if (guardian.accountStatus !== PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION)
      throw new ApiError(409, 'Chỉ gửi lại được cho tài khoản chưa đổi mật khẩu lần đầu.');
    return writeDb((d) => {
      const target = findChild(d, childId).guardians[guardianIndex];
      const account = d.parentAccounts.find((a) => a.phone === normalizePhone(target.phone));
      if (!account) throw new ApiError(404, 'Không tìm thấy tài khoản phụ huynh.');
      const smsStatus = sendCredentials(account);
      target.smsStatus = smsStatus;
      target.smsAt = nowIso();
      return { smsStatus };
    });
  },

  /* ------------------------------ #33 Child health record ------------------------------ */
  async getHealthRecord(childId, user) {
    await delay(150);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    const measurements = db.healthMeasurements
      .filter((m) => m.childId === childId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => toMeasurementView(db, m));
    const decl = declarationOf(db, childId);
    return { child: toView(db, child, user), cls: clone(classOf(db, child)), declaration: clone(decl), measurements };
  },

  /* ------------------------------ #34 Health measurement form ------------------------------ */
  async saveMeasurement(childId, measurementId, payload, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canRecordMeasurement(child, user, classOf(db, child))) forbid();
    const existing = measurementId ? db.healthMeasurements.find((m) => m.id === measurementId && m.childId === childId) : null;
    if (measurementId && !existing) throw new ApiError(404, 'Không tìm thấy lần đo này.');
    // GBR-GEN-06: a published (confirmed) result needs a reason to change.
    const errors = validateMeasurement(payload, { dateOfBirth: child.dateOfBirth, requireReason: !!existing?.published });
    if (hasErrors(errors)) invalid(errors);
    if (db.healthMeasurements.some((m) => m.childId === childId && m.date === payload.date && m.id !== measurementId))
      invalid({ date: 'Ngày này đã có kết quả đo. Sửa lần đo đã có thay vì tạo mới.' });
    return writeDb((d) => {
      const values = {
        date: payload.date,
        heightCm: Math.round(Number(payload.heightCm) * 10) / 10,
        weightKg: Math.round(Number(payload.weightKg) * 10) / 10,
        note: (payload.note || '').trim(),
      };
      const computed = classifyMeasurement(values, child.dateOfBirth);
      if (!existing) {
        const created = {
          id: uid('hm'),
          childId,
          ...values,
          ...computed,
          measuredBy: user.id,
          published: false,
          publishedAt: null,
          createdAt: nowIso(),
          edits: [],
        };
        d.healthMeasurements.push(created);
        return toMeasurementView(d, created);
      }
      const target = d.healthMeasurements.find((m) => m.id === measurementId);
      const changes = Object.keys(values)
        .filter((k) => target[k] !== values[k])
        .map((k) => ({ field: k, label: MEASUREMENT_FIELD_LABELS[k], from: target[k], to: values[k] }));
      if (changes.length === 0) return toMeasurementView(d, target);
      // GBR-HLT-03: keep who, when, old and new value. Teacher review precedes a new publication.
      target.edits = [...(target.edits || []), { at: nowIso(), userId: user.id, reason: (payload.reason || '').trim(), changes }];
      Object.assign(target, values, computed, { published: false, publishedAt: null });
      return toMeasurementView(d, target);
    });
  },

  async publishMeasurement(childId, measurementId, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canRecordMeasurement(child, user, classOf(db, child))) forbid();
    return writeDb((d) => {
      const target = d.healthMeasurements.find((m) => m.id === measurementId && m.childId === childId);
      if (!target) throw new ApiError(404, 'Không tìm thấy lần đo này.');
      if (target.published) throw new ApiError(409, 'Kết quả này đã được công bố.');
      target.published = true;
      target.publishedAt = nowIso();
      target.publishedBy = user.id;
      // Linked parents are notified through the mobile app backend (no parent users on the web demo).
      return toMeasurementView(d, target);
    });
  },

  /* ------------------------------ #35 Health trend (AI) ------------------------------ */
  async analyzeHealthTrend(childId, user) {
    await delay(900);
    const db = ensureSeeded();
    const child = assertView(db, childId, user, canViewHealth);
    const history = db.healthMeasurements.filter((m) => m.childId === childId).sort((a, b) => a.date.localeCompare(b.date));
    if (history.length < 2) return { status: AI_TREND_STATUS.NOT_ENOUGH_DATA, warnings: [], summary: '' };
    // Demo: children whose code ends in 5 simulate an AI outage (MSG30 path).
    if (/5$/.test(child.code)) throw new ApiError(503, 'Không dùng được trợ lý AI. Bạn vẫn xem được số đo và tình trạng dinh dưỡng.');
    // GBR-AI-05: only the internal code and numbers leave the system, never names or contacts.
    const aiInput = {
      ref: child.code,
      sex: child.gender,
      points: history.map(({ date, heightCm, weightKg, nutritionStatus }) => ({ date, heightCm, weightKg, nutritionStatus })),
    };
    const result = fakeTrendModel(aiInput);
    writeDb((d) => {
      d.healthTrendDrafts.push({
        id: uid('ai'),
        childId,
        sourceMeasurementIds: history.map((m) => m.id),
        ...result,
        createdAt: nowIso(),
        requestedBy: user.id,
      });
    });
    return { status: AI_TREND_STATUS.OK, draft: true, generatedAt: nowIso(), ...result };
  },
};

/** Fake AI: describes recorded changes only – no diagnosis, no treatment advice (GBR-AI-03). */
const fakeTrendModel = ({ points }) => {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const num = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const months = Math.max(1, Math.round((new Date(last.date) - new Date(prev.date)) / (30.4 * 86400000)));
  const dw = Math.round((last.weightKg - prev.weightKg) * 10) / 10;
  const dh = Math.round((last.heightCm - prev.heightCm) * 10) / 10;
  const warnings = [];
  if (dw < 0)
    warnings.push({
      level: 'warning',
      text: `Cân nặng giảm ${num(Math.abs(dw))} kg so với lần đo trước (${months} tháng). Nên đo lại ở lần khám tiếp theo.`,
    });
  else if (dw / months < 0.1)
    warnings.push({ level: 'warning', text: `Cân nặng tăng chậm: +${num(dw)} kg trong ${months} tháng. Nên tiếp tục theo dõi.` });
  if (dh <= 0) warnings.push({ level: 'info', text: 'Chiều cao không thay đổi so với lần đo trước. Có thể kiểm tra lại cách đo.' });
  if (last.nutritionStatus !== prev.nutritionStatus)
    warnings.push({ level: 'info', text: 'Tình trạng dinh dưỡng theo quy tắc đã thay đổi so với lần đo trước.' });
  else if (['MALNOURISHED', 'OBESE'].includes(last.nutritionStatus))
    warnings.push({
      level: 'info',
      text: 'Các lần đo gần đây vẫn được quy tắc của hệ thống xếp ngoài mức bình thường. Nên tiếp tục theo dõi và trao đổi với phụ huynh.',
    });
  const summary =
    warnings.length === 0
      ? `Chiều cao (+${num(dh)} cm) và cân nặng (+${num(dw)} kg) tăng đều qua ${points.length} lần đo, không thấy thay đổi bất thường.`
      : `Có ${warnings.length} điểm cần chú ý trong ${points.length} lần đo gần đây.`;
  return { summary, warnings };
};
