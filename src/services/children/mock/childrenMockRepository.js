import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { buildSeedChildRecords } from '@/mocks/childrenSeed';
import { buildSeedFollowUps, buildSeedHealthChecks } from '@/mocks/healthCheckSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { CHILD_STATUS } from '@/models/School';
import {
  AI_TREND_STATUS,
  DECLARATION_STATE,
  MEASUREMENT_FIELD_LABELS,
  PARENT_ACCOUNT_STATUS,
  SMS_STATUS,
} from '@/models/children/childrenConstants';
import { CAMPAIGN_STATUS, FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate, normalizeText, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import {
  hasErrors,
  normalizePhone,
  validateChildInfo,
  validateDeclaration,
  validateMeasurement,
} from '@/utils/children/childrenValidation';
import {
  canActivateParent,
  canDeclareHealth,
  canEditChild,
  canEnrollChild,
  canPlaceChild,
  canWithdrawChild,
  canRecordMeasurement,
  canViewChild,
  canViewChildren,
  canViewHealth,
  canViewParentAccounts,
  isPrincipal,
  isVicePrincipal,
} from '@/utils/children/childrenPermissions';
import { headCircumferenceUntil, screenMeasurement } from './healthScreeningRule';
import { campaignStatusOf, isOpenForEntry, trackFollowUp } from './healthCheckRule';
import { readEnrollmentCsv } from './enrollmentImport';

/*
 * Fake backend of child records & child health. Owns: scope checks (GBR-GEN-01, GBR-GEN-09), enrollment and
 * placement (GBR-CP-01), declarations (GBR-CP-02), allergy confirmation (GBR-HLT-03), parent accounts (UC 3.9),
 * measurements with the rule-based screening (BMI, follow-up level) and edit log (GBR-HLT-01..03), and the AI trend draft (GBR-AI-*).
 * Collections: reads/writes db.children; owns db.healthMeasurements, db.healthDeclarations, db.parentAccounts,
 * db.childPlacements, db.healthTrendDrafts; reads db.healthCheckCampaigns and opens db.healthFollowUps (healthCheckMockRepository).
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const MAX_IMPORT_ROWS = 500;

const nowIso = () => new Date().toISOString();

// v3: đợt khám tháng 3, dữ liệu đầy đủ cho các đợt đã đóng, cân đo tại lớp tháng 12/2025, phiếu theo dõi đợt cũ.
const HEALTH_SEED_VERSION = 3;
const SEED_MANAGED_FIELDS = ['headCircumferenceCm', 'grossMotor', 'fineMotor', 'campaignId', 'note'];

// Dữ liệu demo lưu bằng seed cũ: cập nhật bản ghi seed chưa bị sửa, thêm bản ghi seed còn thiếu; không xóa gì.
const upgradeSeedMeasurements = (d, seedMeasurements) => {
  const byId = new Map(d.healthMeasurements.map((m) => [m.id, m]));
  const has = new Set(d.healthMeasurements.map((m) => `${m.childId}|${m.date}`));
  seedMeasurements.forEach((s) => {
    const m = byId.get(s.id);
    if (m) {
      if (!(m.edits || []).length && m.date === s.date) SEED_MANAGED_FIELDS.forEach((f) => (m[f] = s[f] ?? null));
    } else if (!has.has(`${s.childId}|${s.date}`) && d.children.some((c) => c.id === s.childId)) d.healthMeasurements.push(s);
  });
};

// Đợt seed còn thiếu được thêm; đợt seed đã đóng mà người dùng chưa sửa/mở lại thì nhận thông tin seed mới.
const upgradeSeedCampaigns = (d, seedCampaigns) => {
  seedCampaigns.forEach((s) => {
    const cur = d.healthCheckCampaigns.find((c) => c.id === s.id);
    if (!cur) d.healthCheckCampaigns.push(s);
    else if (cur.closedAt && s.closedAt && !(cur.history || []).some((h) => ['UPDATED', 'REOPENED'].includes(h.action)))
      Object.assign(cur, { examiner: s.examiner, note: s.note, absentChildIds: s.absentChildIds });
  });
};

const upgradeSeedFollowUps = (d, seedFollowUps) => {
  const ids = new Set(d.healthFollowUps.map((f) => f.id));
  seedFollowUps.filter((f) => !ids.has(f.id)).forEach((f) => d.healthFollowUps.push(f));
};

/** Seed mọi collection sức khỏe (đo, khai báo, đợt khám, phiếu theo dõi). Dùng chung cho repository đợt khám. */
export const ensureChildRecordsSeeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  const ready =
    db.healthMeasurements &&
    db.healthDeclarations &&
    db.parentAccounts &&
    db.childPlacements &&
    db.healthTrendDrafts &&
    db.healthCheckCampaigns &&
    db.healthFollowUps;
  if (ready && db.healthSeedVersion === HEALTH_SEED_VERSION) return db;
  writeDb((d) => {
    const seed = buildSeedChildRecords({ children: d.children, classes: d.classes });
    const upgrading = d.healthSeedVersion !== HEALTH_SEED_VERSION;
    if (d.healthMeasurements && upgrading) upgradeSeedMeasurements(d, seed.healthMeasurements);
    d.healthMeasurements ||= seed.healthMeasurements;
    // Vắng khám của đợt seed tính trên kết quả đang có trong DB (sau khi nâng cấp).
    const seedCampaigns = buildSeedHealthChecks({ measurements: d.healthMeasurements, children: d.children });
    const seedFollowUps = buildSeedFollowUps(d.healthMeasurements);
    if (d.healthCheckCampaigns && upgrading) upgradeSeedCampaigns(d, seedCampaigns);
    if (d.healthFollowUps && upgrading) upgradeSeedFollowUps(d, seedFollowUps);
    d.healthSeedVersion = HEALTH_SEED_VERSION;
    d.healthDeclarations ||= seed.healthDeclarations;
    d.parentAccounts ||= seed.parentAccounts;
    d.childPlacements ||= seed.childPlacements;
    d.healthTrendDrafts ||= [];
    d.healthCheckCampaigns ||= seedCampaigns;
    d.healthFollowUps ||= seedFollowUps;
  });
  return readDb();
};

const ensureSeeded = ensureChildRecordsSeeded;

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

const validateEnrollment = (db, { child, declaration }, excludeId) => {
  const errors = { ...validateChildInfo(child), ...prefix('declaration', validateDeclaration(declaration)) };
  const dup = !errors.fullName && !errors.dateOfBirth ? isDuplicate(db, child, excludeId) : null;
  return { errors, dup };
};

const prefix = (p, errors) => Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${p}.${k}`, v]));

const createChild = (db, { child, declaration }, { classId, user }) => {
  const decl = cleanDeclaration(declaration);
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
    // Phó hiệu trưởng chốt dị ứng ngay khi tiếp nhận, không chờ Hiệu trưởng (quyết định user 2026-10-14).
    allergies: [...decl.allergies.items],
    guardians: cleanGuardians(child.guardians),
    history: [{ action: 'ENROLLED', userId: user.id, at: nowIso() }],
  };
  db.children.push(record);
  db.healthDeclarations.push({
    childId: record.id,
    ...decl,
    declaredBy: user.id,
    declaredAt: nowIso(),
    history: [{ action: 'DECLARED', userId: user.id, at: nowIso() }],
  });
  if (classId)
    db.childPlacements.push({ id: uid('pl'), childId: record.id, fromClassId: null, toClassId: classId, userId: user.id, at: nowIso() });
  return record;
};

/** Parent accounts having at least one current child in the user's campus, with those children only. */
const campusAccounts = (db, user) => {
  const inCampus = db.children.filter((c) => c.campusId === user.campusId && c.status !== CHILD_STATUS.LEFT);
  return db.parentAccounts
    .map((a) => ({ ...a, children: inCampus.filter((c) => a.childIds.includes(c.id)) }))
    .filter((a) => a.children.length > 0)
    .map((a) => ({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      email: a.email || '',
      status: a.status,
      // Quan hệ ghi trên hồ sơ anh/chị, chỉ để gợi ý mặc định khi liên kết trẻ mới.
      relation: a.children.flatMap((c) => c.guardians || []).find((g) => normalizePhone(g.phone) === a.phone)?.relation || '',
      children: a.children.map((c) => ({ id: c.id, code: c.code, fullName: c.fullName, className: classOf(db, c)?.name || '' })),
    }));
};

const smsWouldFail = (account) => /99$/.test(account.phone) && account.sms.length === 0;

const sendCredentials = (account) => {
  // Demo SMS gateway: numbers ending in 99 fail on the first attempt so the resend path can be tried.
  const status = smsWouldFail(account) ? SMS_STATUS.FAILED : SMS_STATUS.SENT;
  account.sms.push({ at: nowIso(), status });
  return status;
};

// Kết quả sàng lọc tính lại mỗi lần đọc (như BE trả giá trị dẫn xuất) nên dữ liệu demo cũ vẫn theo rule mới.
const toMeasurementView = (db, m) => {
  const { nutritionStatus: _legacyStatus, ...stored } = clone(m);
  const child = db.children.find((c) => c.id === m.childId);
  const fields = {
    ...stored,
    campaignId: stored.campaignId ?? null,
    headCircumferenceCm: stored.headCircumferenceCm ?? null,
    grossMotor: stored.grossMotor ?? null,
    fineMotor: stored.fineMotor ?? null,
  };
  const campaign = fields.campaignId ? (db.healthCheckCampaigns || []).find((c) => c.id === fields.campaignId) : null;
  return {
    ...fields,
    ...screenMeasurement(fields, child.dateOfBirth),
    campaignName: campaign?.name || null,
    followUpId: (db.healthFollowUps || []).find((f) => f.measurementIds.includes(m.id))?.id || null,
    // Kết quả của đợt đã đóng/hủy bị khóa tới khi Hiệu trưởng mở lại đợt.
    locked: !!campaign && !isOpenForEntry(campaign),
    measuredByName: userName(db, m.measuredBy),
    edits: (m.edits || []).map((e) => ({ ...e, userName: userName(db, e.userId) })),
  };
};

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
      declaration: decl ? { ...clone(decl), declaredByName: userName(db, decl.declaredBy) } : null,
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
    // Phụ huynh chọn từ tài khoản có sẵn: lấy họ tên/SĐT/email từ tài khoản, không tin dữ liệu client gửi lên.
    const options = campusAccounts(db, user);
    const accountErrors = {};
    const guardians = (payload.child?.guardians || []).map((g, i) => {
      if (!g.accountId) return g;
      const acc = options.find((a) => a.id === g.accountId);
      if (!acc) {
        accountErrors[`guardians.${i}.accountId`] = 'Tài khoản phụ huynh không tồn tại hoặc không thuộc điểm trường của bạn';
        return g;
      }
      return { accountId: acc.id, relation: g.relation, fullName: acc.fullName, phone: acc.phone, email: acc.email || '' };
    });
    const accountIds = guardians.map((g) => g.accountId).filter(Boolean);
    if (new Set(accountIds).size !== accountIds.length) accountErrors.guardians = 'Mỗi tài khoản phụ huynh chỉ chọn một lần';
    const resolved = { ...payload, child: { ...payload.child, guardians } };
    const { errors, dup } = validateEnrollment(db, resolved);
    Object.assign(errors, accountErrors);
    if (hasErrors(errors)) invalid(errors);
    if (dup) throw new ApiError(409, 'Hồ sơ trẻ này đã tồn tại (trùng họ tên và ngày sinh). Xem lại hồ sơ đã có.');
    return writeDb((d) => {
      // Lớp không bắt buộc khi tiếp nhận; có lớp thì vẫn kiểm sức chứa và campus.
      const cls = payload.classId ? assertClassAvailable(d, payload.classId, user) : null;
      const record = createChild(d, resolved, { classId: cls?.id || null, user });
      // Tài khoản có sẵn: liên kết ngay khi lưu, không tạo tài khoản mới, không gửi mật khẩu (UC 3.9 nhánh đã có tài khoản).
      guardians.forEach((g, i) => {
        const acc = g.accountId && d.parentAccounts.find((a) => a.id === g.accountId);
        if (!acc) return;
        if (!acc.childIds.includes(record.id)) acc.childIds.push(record.id);
        record.guardians[i].accountStatus = acc.status;
      });
      if (cls) notifyClassTeachers(d, cls, record);
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

  /** Cho nghỉ học: không xóa dữ liệu, chỉ chuyển trạng thái Đã nghỉ và giữ lớp cuối cùng để tra lịch sử. */
  async withdrawChild(childId, { leftAt, reason }, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canWithdrawChild(child, user)) forbid();
    const errors = {};
    if (!leftAt || !/^\d{4}-\d{2}-\d{2}$/.test(leftAt)) errors.leftAt = 'Chọn ngày nghỉ học';
    else if (leftAt > todayInput()) errors.leftAt = 'Ngày nghỉ học không được ở tương lai';
    else if (child.enrolledAt && leftAt < child.enrolledAt) errors.leftAt = 'Ngày nghỉ học không được trước ngày tiếp nhận';
    if (!reason?.trim()) errors.reason = 'Nhập lý do cho trẻ nghỉ học';
    else if (reason.trim().length > 300) errors.reason = 'Lý do tối đa 300 ký tự';
    if (hasErrors(errors)) invalid(errors);
    return writeDb((d) => {
      const target = findChild(d, childId);
      target.status = CHILD_STATUS.LEFT;
      target.leftAt = leftAt;
      target.leftReason = reason.trim();
      target.history = [...(target.history || []), { action: 'WITHDRAWN', userId: user.id, at: nowIso(), note: reason.trim() }];
      const cls = classOf(d, target);
      (cls?.teacherIds || []).forEach((teacherId) =>
        pushNotification(d, {
          userId: teacherId,
          type: 'CHILD_WITHDRAWN',
          title: 'Trẻ nghỉ học',
          message: `${target.fullName} nghỉ học từ ngày ${formatDate(leftAt)}.`,
          link: `/children/${target.id}`,
        }),
      );
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
    if (current && !reason?.trim()) errors.reason = 'Nhập lý do thay đổi khai báo';
    if (hasErrors(errors)) invalid(errors);
    return writeDb((d) => {
      const clean = cleanDeclaration(declaration);
      let decl = declarationOf(d, childId);
      if (!decl) {
        decl = { childId, history: [] };
        d.healthDeclarations.push(decl);
      }
      const allergyChanged = JSON.stringify(decl.allergies) !== JSON.stringify(clean.allergies);
      const entry = { action: 'UPDATED', userId: user.id, at: nowIso(), note: reason?.trim() || '' };
      if (allergyChanged) entry.allergyChange = { from: decl.allergies ? clone(decl.allergies) : null, to: clone(clean.allergies) };
      Object.assign(decl, clean, { declaredBy: user.id, declaredAt: nowIso() });
      decl.history.push(entry);
      // Khai báo của Phó hiệu trưởng có hiệu lực ngay: bếp và điểm danh đọc danh sách mới.
      findChild(d, childId).allergies = [...clean.allergies.items];
      return clone(decl);
    });
  },

  /* ------------------------------ #31 Parent account activation ------------------------------ */
  /** #28: existing parent accounts the VP can link a new child to (campus scope), filtered by phone / email. */
  async listParentAccountOptions({ keyword } = {}, user) {
    await delay(150);
    if (!canEnrollChild(user)) forbid();
    const db = ensureSeeded();
    const kw = String(keyword || '')
      .trim()
      .toLowerCase();
    const phoneKw = normalizePhone(kw);
    return campusAccounts(db, user)
      .filter((a) => !kw || (phoneKw && a.phone.includes(phoneKw)) || a.email.toLowerCase().includes(kw))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  },

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
    const open = db.healthCheckCampaigns.find((c) => c.campusId === child.campusId && isOpenForEntry(c));
    const followUp = db.healthFollowUps.find((f) => f.childId === childId && f.status !== FOLLOW_UP_STATUS.CLOSED);
    return {
      child: toView(db, child, user),
      cls: clone(classOf(db, child)),
      declaration: clone(decl),
      measurements,
      rules: { headCircumferenceUntil: headCircumferenceUntil(child.dateOfBirth) },
      openCampaign: open
        ? {
            id: open.id,
            name: open.name,
            startDate: open.startDate,
            endDate: open.endDate,
            resultMeasurementId: measurements.find((m) => m.campaignId === open.id)?.id || null,
          }
        : null,
      openFollowUp: followUp ? { id: followUp.id, status: followUp.status, openedAt: followUp.openedAt } : null,
    };
  },

  /* ------------------------------ #34 Health measurement form ------------------------------ */
  async saveMeasurement(childId, measurementId, payload, user) {
    await delay();
    const db = ensureSeeded();
    const child = findChild(db, childId);
    if (!canRecordMeasurement(child, user, classOf(db, child))) forbid();
    const existing = measurementId ? db.healthMeasurements.find((m) => m.id === measurementId && m.childId === childId) : null;
    if (measurementId && !existing) throw new ApiError(404, 'Không tìm thấy lần đo này.');
    // Kết quả trong đợt khám: đợt đang diễn ra, cùng điểm trường, mỗi trẻ 1 kết quả/đợt (user chốt 2026-10-15).
    const campaignId = existing ? (existing.campaignId ?? null) : payload.campaignId || null;
    const campaign = campaignId ? db.healthCheckCampaigns.find((c) => c.id === campaignId) : null;
    if (campaignId && !campaign) throw new ApiError(404, 'Không tìm thấy đợt khám.');
    if (campaign && campaign.campusId !== child.campusId) forbid();
    if (campaign && !isOpenForEntry(campaign))
      throw new ApiError(
        409,
        campaignStatusOf(campaign) === CAMPAIGN_STATUS.CLOSED
          ? 'Đợt khám đã đóng. Hiệu trưởng mở lại đợt nếu cần sửa kết quả.'
          : 'Đợt khám chưa bắt đầu hoặc đã hủy, chưa nhập được kết quả.',
      );
    const until = headCircumferenceUntil(child.dateOfBirth);
    // GBR-GEN-06: a published (confirmed) result needs a reason to change.
    const errors = validateMeasurement(payload, {
      dateOfBirth: child.dateOfBirth,
      requireReason: !!existing?.published,
      headCircumferenceUntil: until,
      legacy: !!existing && existing.grossMotor == null,
      campaign: campaign ? { startDate: campaign.startDate, endDate: campaign.endDate } : undefined,
    });
    if (hasErrors(errors)) invalid(errors);
    if (campaign && db.healthMeasurements.some((m) => m.childId === childId && m.campaignId === campaignId && m.id !== measurementId))
      invalid({ date: 'Trẻ đã có kết quả trong đợt này. Sửa kết quả đã có thay vì nhập mới.' });
    if (db.healthMeasurements.some((m) => m.childId === childId && m.date === payload.date && m.id !== measurementId))
      invalid({ date: 'Ngày này đã có kết quả đo. Sửa lần đo đã có thay vì tạo mới.' });
    return writeDb((d) => {
      const round1 = (v) => Math.round(Number(v) * 10) / 10;
      const hasHead = payload.date <= until && payload.headCircumferenceCm !== '' && payload.headCircumferenceCm != null;
      const values = {
        date: payload.date,
        heightCm: round1(payload.heightCm),
        weightKg: round1(payload.weightKg),
        headCircumferenceCm: hasHead ? round1(payload.headCircumferenceCm) : null,
        grossMotor: payload.grossMotor || null,
        fineMotor: payload.fineMotor || null,
        note: (payload.note || '').trim(),
      };
      if (!existing) {
        const created = {
          id: uid('hm'),
          childId,
          ...values,
          campaignId,
          measuredBy: user.id,
          published: false,
          publishedAt: null,
          createdAt: nowIso(),
          edits: [],
        };
        d.healthMeasurements.push(created);
        trackFollowUp(d, child, created, toMeasurementView(d, created).followUpLevel, user);
        return toMeasurementView(d, created);
      }
      const target = d.healthMeasurements.find((m) => m.id === measurementId);
      const changes = Object.keys(values)
        .filter((k) => (target[k] ?? null) !== values[k])
        .map((k) => ({ field: k, label: MEASUREMENT_FIELD_LABELS[k], from: target[k] ?? null, to: values[k] }));
      if (changes.length === 0) return toMeasurementView(d, target);
      // GBR-HLT-03: keep who, when, old and new value. Teacher review precedes a new publication.
      target.edits = [...(target.edits || []), { at: nowIso(), userId: user.id, reason: (payload.reason || '').trim(), changes }];
      Object.assign(target, values, { published: false, publishedAt: null });
      trackFollowUp(d, child, target, toMeasurementView(d, target).followUpLevel, user);
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
    const history = db.healthMeasurements
      .filter((m) => m.childId === childId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => toMeasurementView(db, m));
    if (history.length < 2) return { status: AI_TREND_STATUS.NOT_ENOUGH_DATA, warnings: [], summary: '' };
    // Demo: children whose code ends in 5 simulate an AI outage (MSG30 path).
    if (/5$/.test(child.code)) throw new ApiError(503, 'Không dùng được trợ lý AI. Bạn vẫn xem được số đo và kết quả phân loại.');
    // GBR-AI-05: chỉ gửi mã nội bộ và số đo, không gửi tên/liên hệ; không gửi đánh giá vận động để AI không viết lời chẩn đoán phát triển.
    const aiInput = {
      ref: child.code,
      sex: child.gender,
      points: history.map(({ date, heightCm, weightKg, headCircumferenceCm, bmiStatus }) => ({
        date,
        heightCm,
        weightKg,
        headCircumferenceCm,
        bmiStatus,
      })),
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
  if (last.headCircumferenceCm != null && prev.headCircumferenceCm != null && last.headCircumferenceCm < prev.headCircumferenceCm)
    warnings.push({ level: 'info', text: 'Vòng đầu nhỏ hơn lần đo trước. Có thể kiểm tra lại cách đo ở lần khám tiếp theo.' });
  if (last.bmiStatus !== prev.bmiStatus)
    warnings.push({ level: 'info', text: 'Phân loại BMI theo quy tắc đã thay đổi so với lần đo trước.' });
  else if (['LOW', 'HIGH'].includes(last.bmiStatus))
    warnings.push({
      level: 'info',
      text: 'Các lần đo gần đây vẫn có BMI ngoài khoảng bình thường theo quy tắc của hệ thống. Nên tiếp tục theo dõi và trao đổi với phụ huynh.',
    });
  const summary =
    warnings.length === 0
      ? `Chiều cao (+${num(dh)} cm) và cân nặng (+${num(dw)} kg) tăng đều qua ${points.length} lần đo, không thấy thay đổi bất thường.`
      : `Có ${warnings.length} điểm cần chú ý trong ${points.length} lần đo gần đây.`;
  return { summary, warnings };
};
