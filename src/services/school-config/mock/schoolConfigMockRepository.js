import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded, visibleClasses } from '@/mocks/schoolMockRepository';
import { AGE_GROUP_EXTRA, buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { ROLES, ROLE_LABELS } from '@/models/User';
import {
  YEAR_STATUS,
  CONFIG_ROLES,
  PERMISSION_LEVEL,
  CONFIG_ROLE_LABELS,
  CLASS_FILL,
  TEACHERS_PER_CLASS,
  MEAL_SESSION_OPTIONS,
  mealSessionsLabel,
  PERMISSION_ACCESS,
  parseGrant,
  vpAreasOf,
} from '@/models/school-config/schoolConfigConstants';
import { PERMISSION_CATALOG, defaultGrants, grantsOf, isLockedGrant } from '@/models/school-config/permissionCatalog';
import { uid } from '@/utils/id';
import { formatDate, normalizeText } from '@/utils/format';
import {
  canAssignTeachers,
  canViewTeacherAssignments,
  canAssignVicePrincipal,
  canConfigureCutoff,
  canConfigureSchool,
  canListCampuses,
  canManageCampus,
  canManageRolePermissions,
  canManageStaff,
  canViewCampus,
  canViewSchoolStructure,
  isPrincipal,
} from '@/utils/school-config/schoolConfigPermissions';
import {
  firstError,
  hasErrors,
  validateAgeGroup,
  validateCampus,
  validateClass,
  validateClassTeachers,
  validateCutoff,
  validatePermissionChange,
  validateSchoolYear,
  validateStaffAccount,
  validateVpAssignment,
} from '@/utils/school-config/schoolConfigValidation';

/*
 * Fake backend of school configuration. Business rules live here (backend must repeat them):
 * - one ACTIVE school year; years do not overlap; closed years are read only (Academic Year entity, GBR-GEN-03);
 * - class names unique per school year + campus (SRS says per year: OPEN); records in use (children, attendance, assessments) are never deleted (MSG53);
 * - exactly one main campus; VP / teacher / team-leader assignments are per school year (GBR-GEN-03);
 * - one VP holds the shared-service responsibility (GBR-GEN-10);
 * - cutoff and permission changes keep editor, time and previous value (GBR-CFG-03, GBR-GEN-06).
 */

const COLLECTIONS = ['schoolYears', 'ageGroups', 'cutoffSettings', 'vpAssignments', 'teamLeaderAssignments', 'rolePermissions'];
const TEACHING_ROLES = [ROLES.TEACHER, ROLES.TEAM_LEADER];

const forbid = () => new ApiError(403, 'Bạn không có quyền thực hiện thao tác này');
const invalid = (errors) => new ApiError(422, firstError(errors), errors);
const notFound = (what) => new ApiError(404, `Không tìm thấy ${what}`);
const inUse = (why) => new ApiError(409, `Không thể xóa vì bản ghi đang được dữ liệu khác sử dụng: ${why}.`);
const now = () => new Date().toISOString();

const ensure = (db) => {
  const seed = buildSeedSchoolConfig();
  COLLECTIONS.forEach((key) => {
    db[key] ||= clone(seed[key]);
  });
  // Seed campuses have no main flag yet: the first campus is the main campus.
  if (db.campuses?.length && !db.campuses.some((c) => c.isMain)) db.campuses[0].isMain = true;
  // Dữ liệu cũ trong localStorage chưa có độ tuổi theo tháng / sĩ số tối đa của nhóm tuổi (SRS 4.1.4)
  db.ageGroups.forEach((g) => {
    if (g.ageFromMonths == null) Object.assign(g, { ageFromMonths: null, ageToMonths: null, maxClassSize: 50, ...AGE_GROUP_EXTRA[g.id] });
    delete g.ageRange;
    g.history ||= [];
    // Trước đây chỉ lưu số bữa: 3 = phụ sáng + trưa + chiều, 2 = trưa + chiều
    g.mealSessions ||= g.mealsPerDay === 3 ? ['MORNING', 'LUNCH', 'AFTERNOON'] : ['LUNCH', 'AFTERNOON'];
    g.mealsPerDay = g.mealSessions.length;
  });
  return db;
};

const needsMigration = (db) => db.ageGroups?.some((g) => g.ageFromMonths == null || !g.history || !g.mealSessions);

const seeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (COLLECTIONS.some((k) => !db[k]) || (db.campuses?.length && !db.campuses.some((c) => c.isMain)) || needsMigration(db)) writeDb(ensure);
  return readDb();
};

const findYear = (db, id) => {
  const year = db.schoolYears.find((y) => y.id === id);
  if (!year) throw notFound('năm học');
  return year;
};

const assertOpenYear = (year) => {
  if (year.status === YEAR_STATUS.CLOSED) throw new ApiError(409, `Năm học ${year.name} đã kết thúc, không thể thay đổi`);
};

const sortYears = (list) => [...list].sort((a, b) => b.startDate.localeCompare(a.startDate));
const childCountOf = (db, classId) => (db.children || []).filter((ch) => ch.classId === classId && ch.status !== 'LEFT').length;
const userName = (db, id) => db.users.find((u) => u.id === id)?.fullName || '';
const sameName = (a, b) => normalizeText((a || '').trim()) === normalizeText((b || '').trim());
/** A class with attendance, meal or assessment records is history and is never deleted (SRS 4.1.3). */
const HISTORY_COLLECTIONS = ['attendance', 'dailyAssessments', 'periodicEvaluations', 'yearEndEvaluations'];
const classHasHistory = (db, classId) => HISTORY_COLLECTIONS.some((k) => (db[k] || []).some((r) => r.classId === classId));

/** Apply the assignments of the active year to the user accounts (what the system "grants"). */
const syncAssignments = (db, yearId) => {
  const year = db.schoolYears.find((y) => y.id === yearId);
  if (year?.status !== YEAR_STATUS.ACTIVE) return;
  db.vpAssignments
    .filter((a) => a.schoolYear === yearId)
    .forEach((a) => {
      const u = db.users.find((x) => x.id === a.userId);
      if (u) u.campusId = a.campusId;
    });
  const leaders = db.teamLeaderAssignments.filter((a) => a.schoolYear === yearId);
  db.users
    .filter((u) => TEACHING_ROLES.includes(u.role))
    .forEach((u) => {
      const lead = leaders.find((a) => a.userId === u.id);
      if (lead) {
        u.role = ROLES.TEAM_LEADER;
        u.ageGroupId = lead.ageGroupId;
      } else if (u.role === ROLES.TEAM_LEADER) {
        u.role = ROLES.TEACHER;
      }
    });
};

/** Grants of the actor read again from the database (the client copy may be stale). */
const actor = (db, user) => {
  const permissions = grantsOf(db.rolePermissions, user.role);
  if (user.role !== ROLES.VICE_PRINCIPAL) return { ...user, permissions };
  const active = db.schoolYears.find((y) => y.status === YEAR_STATUS.ACTIVE);
  const a = db.vpAssignments.find((x) => x.userId === user.id && x.schoolYear === active?.id);
  return { ...user, permissions, areas: vpAreasOf(a, permissions) };
};
const noAssignRight = (db, user, campusId) =>
  new ApiError(
    403,
    canViewTeacherAssignments(campusId, actor(db, user))
      ? 'Bạn chỉ có quyền xem phân công giáo viên / tổ trưởng, không sửa được. Liên hệ Hiệu trưởng.'
      : 'Vai trò của bạn chưa được bật quyền "Phân công giáo viên / tổ trưởng" cho điểm trường này. Liên hệ Hiệu trưởng.',
  );

const notify = (db, userId, title, message, link = '/') => pushNotification(db, { userId, type: 'ASSIGNMENT', title, message, link });

/* ---------- Staff accounts: what a role / campus / status change ends ---------- */
const openYearIds = (db) => new Set(db.schoolYears.filter((y) => y.status !== YEAR_STATUS.CLOSED).map((y) => y.id));
const isTeaching = (role) => TEACHING_ROLES.includes(role);
// Tổ trưởng là giáo viên được giao nhóm tuổi, không phải vai trò riêng khi đổi vai trò
const sameRole = (role) => (role === ROLES.TEAM_LEADER ? ROLES.TEACHER : role);
const campusName = (db, id) => db.campuses.find((c) => c.id === id)?.shortName || '—';

/** Lists the assignments of open school years that the change would end. */
const staffImpact = (db, u, next) => {
  const open = openYearIds(db);
  const leaving = next.status === 'INACTIVE';
  const items = [];
  const keepsVp = !leaving && next.role === ROLES.VICE_PRINCIPAL && (next.campusId || '') === (u.campusId || '');
  if (u.role === ROLES.VICE_PRINCIPAL && !keepsVp)
    db.vpAssignments
      .filter((a) => a.userId === u.id && open.has(a.schoolYear))
      .forEach((a) => {
        items.push({ kind: 'VP', text: `Phụ trách ${campusName(db, a.campusId)} năm học ${a.schoolYear}` });
        if (a.sharedService)
          items.push({
            kind: 'WARN',
            text: `Đang giữ dịch vụ chung (sửa thực đơn) năm ${a.schoolYear}: sẽ chưa có Phó HT nào giữ cho tới khi phân công lại`,
          });
      });
  const keepsTeaching = !leaving && isTeaching(next.role) && (next.campusId || '') === (u.campusId || '');
  if (isTeaching(u.role) && !keepsTeaching) {
    db.classes
      .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
      .forEach((c) =>
        items.push({
          kind: 'CLASS',
          text: `Dạy ${c.name} (${campusName(db, c.campusId)}, ${c.schoolYear})${c.homeroomTeacherId === u.id ? ' – chủ nhiệm' : ''}: lớp sẽ thiếu giáo viên`,
        }),
      );
    db.teamLeaderAssignments
      .filter((a) => a.userId === u.id && open.has(a.schoolYear))
      .forEach((a) =>
        items.push({
          kind: 'LEADER',
          text: `Tổ trưởng ${db.ageGroups.find((g) => g.id === a.ageGroupId)?.shortName || a.ageGroupId} (${campusName(db, a.campusId)}, ${a.schoolYear})`,
        }),
      );
  }
  return items;
};

/** Ends (archives) the assignments listed by staffImpact; history is kept in db.endedAssignments. */
const endAssignments = (db, u, next, user, reason) => {
  const open = openYearIds(db);
  const endedAt = now();
  const archive = (kind, record) =>
    (db.endedAssignments ||= []).push({ kind, record: clone(record), endedAt, endedBy: user.id, reason: (reason || '').trim() });
  const leaving = next.status === 'INACTIVE';
  const keepsVp = !leaving && next.role === ROLES.VICE_PRINCIPAL && (next.campusId || '') === (u.campusId || '');
  if (u.role === ROLES.VICE_PRINCIPAL && !keepsVp) {
    db.vpAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)).forEach((a) => archive('VP', a));
    db.vpAssignments = db.vpAssignments.filter((a) => !(a.userId === u.id && open.has(a.schoolYear)));
  }
  const keepsTeaching = !leaving && isTeaching(next.role) && (next.campusId || '') === (u.campusId || '');
  if (isTeaching(u.role) && !keepsTeaching) {
    db.classes
      .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
      .forEach((c) => {
        archive('CLASS_TEACHER', { classId: c.id, userId: u.id, homeroom: c.homeroomTeacherId === u.id });
        c.teacherIds = c.teacherIds.filter((t) => t !== u.id);
        if (c.homeroomTeacherId === u.id) c.homeroomTeacherId = c.teacherIds[0] || null;
      });
    db.teamLeaderAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)).forEach((a) => archive('TEAM_LEADER', a));
    db.teamLeaderAssignments = db.teamLeaderAssignments.filter((a) => !(a.userId === u.id && open.has(a.schoolYear)));
  }
};

/** New Vice Principal with a campus: assignment of the active year with the role default areas. */
const assignVp = (db, u, campusId, user) => {
  const active = db.schoolYears.find((y) => y.status === YEAR_STATUS.ACTIVE);
  if (!active || db.vpAssignments.some((a) => a.userId === u.id && a.schoolYear === active.id)) return;
  db.vpAssignments.push({
    id: uid('vpa'),
    schoolYear: active.id,
    userId: u.id,
    campusId,
    sharedService: false,
    assignedBy: user.id,
    assignedAt: now(),
  });
};

export const schoolConfigMockRepository = {
  /* ---------------- School years (#16, #17) ---------------- */
  async getSchoolYears(user) {
    await delay(120);
    if (!canViewSchoolStructure(user)) throw forbid();
    const db = seeded();
    return sortYears(db.schoolYears).map((y) => ({
      ...clone(y),
      classCount: db.classes.filter((c) => c.schoolYear === y.id).length,
    }));
  },

  async getSchoolYearById(id, user) {
    await delay(80);
    if (!canViewSchoolStructure(user)) throw forbid();
    return clone(findYear(seeded(), id));
  },

  async saveSchoolYear(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const current = id ? findYear(db, id) : null;
      if (current) assertOpenYear(current);
      const others = db.schoolYears.filter((y) => y.id !== id);
      const name = (form.name || '').trim();
      const errors = validateSchoolYear({ ...form, name }, others);
      if (hasErrors(errors)) throw invalid(errors);
      // The year id is used by classes and the header selector: it can change only before anything uses it.
      if (current && current.name !== name && current.status !== YEAR_STATUS.PLANNED)
        throw invalid({ name: 'Chỉ đổi được tên năm học khi năm học chưa bắt đầu' });
      if (current && current.name !== name && db.classes.some((c) => c.schoolYear === current.id))
        throw invalid({ name: 'Năm học đã có lớp, không thể đổi tên' });
      if (current) {
        const previous = `${current.name}: ${formatDate(current.startDate)} – ${formatDate(current.endDate)}`;
        Object.assign(current, { id: name, name, startDate: form.startDate, endDate: form.endDate });
        current.history.push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(current);
      }
      const year = {
        id: name,
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        status: YEAR_STATUS.PLANNED,
        history: [{ action: 'CREATED', userId: user.id, at: now() }],
      };
      db.schoolYears.push(year);
      return clone(year);
    });
  },

  /** Only one active year: activating closes the current one in the same transaction. */
  async activateSchoolYear(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ kích hoạt được năm học sắp diễn ra');
      db.schoolYears
        .filter((y) => y.status === YEAR_STATUS.ACTIVE)
        .forEach((y) => {
          y.status = YEAR_STATUS.CLOSED;
          y.history.push({ action: 'CLOSED', userId: user.id, at: now(), note: `Khi kích hoạt năm học ${year.name}` });
          db.classes.filter((c) => c.schoolYear === y.id).forEach((c) => (c.status = 'CLOSED'));
        });
      year.status = YEAR_STATUS.ACTIVE;
      year.history.push({ action: 'ACTIVATED', userId: user.id, at: now() });
      syncAssignments(db, year.id);
      return clone(year);
    });
  },

  async closeSchoolYear(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.ACTIVE) throw new ApiError(409, 'Chỉ kết thúc được năm học đang hoạt động');
      year.status = YEAR_STATUS.CLOSED;
      year.history.push({ action: 'CLOSED', userId: user.id, at: now() });
      // Classes close with their academic year (Class entity lifecycle).
      db.classes.filter((c) => c.schoolYear === id).forEach((c) => (c.status = 'CLOSED'));
      return clone(year);
    });
  },

  async deleteSchoolYear(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const year = findYear(db, id);
      if (year.status !== YEAR_STATUS.PLANNED) throw new ApiError(409, 'Chỉ xóa được năm học chưa bắt đầu');
      if (db.classes.some((c) => c.schoolYear === id)) throw inUse('năm học đã có lớp');
      db.schoolYears = db.schoolYears.filter((y) => y.id !== id);
      db.vpAssignments = db.vpAssignments.filter((a) => a.schoolYear !== id);
      db.teamLeaderAssignments = db.teamLeaderAssignments.filter((a) => a.schoolYear !== id);
      db.cutoffSettings = db.cutoffSettings.filter((s) => s.schoolYear !== id);
    });
  },

  /* ---------------- Age groups & classes (#18) ---------------- */
  async getStructure({ schoolYear, campusId } = {}, user) {
    await delay(140);
    if (!canViewSchoolStructure(user)) throw forbid();
    const db = seeded();
    const year = findYear(db, schoolYear);
    const scope = isPrincipal(user) ? db.classes : visibleClasses(db, user);
    const classes = scope
      .filter((c) => c.schoolYear === schoolYear && (!campusId || c.campusId === campusId))
      .map((c) => {
        const childCount = childCountOf(db, c.id);
        // Trạng thái hiển thị do "BE" tính: mức đầy lớp, thiếu giáo viên (mỗi lớp 2 GV), chưa có phòng
        const fill = childCount >= c.capacity ? CLASS_FILL.FULL : childCount >= c.capacity * 0.9 ? CLASS_FILL.NEAR : CLASS_FILL.OPEN;
        return { ...c, childCount, fill, missingTeachers: Math.max(0, TEACHERS_PER_CLASS - c.teacherIds.length), noRoom: !c.locationId };
      });
    // Tổ trưởng theo nhóm tuổi VÀ điểm trường (mỗi điểm trường một tổ trưởng cho một nhóm tuổi)
    const teamLeaders = db.teamLeaderAssignments
      .filter((a) => a.schoolYear === schoolYear && (!campusId || a.campusId === campusId))
      // Vai trò khác Hiệu trưởng chỉ thấy tổ trưởng của điểm trường mình
      .filter((a) => isPrincipal(user) || a.campusId === user.campusId)
      .map((a) => ({ ageGroupId: a.ageGroupId, campusId: a.campusId, userId: a.userId }));
    const groupStats = Object.fromEntries(
      db.ageGroups.map((g) => {
        const list = classes.filter((c) => c.ageGroupId === g.id);
        return [
          g.id,
          {
            classCount: list.length,
            enrolled: list.reduce((s, c) => s + c.childCount, 0),
            capacity: list.reduce((s, c) => s + c.capacity, 0),
          },
        ];
      }),
    );
    return { year: clone(year), ageGroups: clone(db.ageGroups), classes: clone(classes), teamLeaders, groupStats };
  },

  async getAgeGroups() {
    await delay(60);
    return clone(seeded().ageGroups);
  },

  async saveAgeGroup(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const open = openYearIds(db);
      const usedClasses = id
        ? db.classes.filter((c) => c.ageGroupId === id && open.has(c.schoolYear)).map((c) => ({ ...c, childCount: childCountOf(db, c.id) }))
        : [];
      const errors = validateAgeGroup(
        form,
        db.ageGroups.filter((g) => g.id !== id),
        { blockingClasses: usedClasses },
      );
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        ageFromMonths: Number(form.ageFromMonths),
        ageToMonths: Number(form.ageToMonths),
        mealSessions: MEAL_SESSION_OPTIONS.filter((x) => form.mealSessions.includes(x)),
        mealsPerDay: form.mealSessions.length,
        maxClassSize: Number(form.maxClassSize),
        nutritionNote: (form.nutritionNote || '').trim(),
      };
      if (id) {
        const group = db.ageGroups.find((g) => g.id === id);
        if (!group) throw notFound('nhóm tuổi');
        const previous = `${group.name}: ${group.ageFromMonths}–${group.ageToMonths} tháng, bữa ${mealSessionsLabel(group)}, tối đa ${group.maxClassSize} trẻ/lớp`;
        Object.assign(group, data);
        (group.history ||= []).push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(group);
      }
      const group = { id: uid('ag'), ...data, history: [{ action: 'CREATED', userId: user.id, at: now() }] };
      db.ageGroups.push(group);
      return clone(group);
    });
  },

  async deleteAgeGroup(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      if (db.classes.some((c) => c.ageGroupId === id)) throw inUse('nhóm tuổi đã có lớp');
      if (db.teamLeaderAssignments.some((a) => a.ageGroupId === id)) throw inUse('nhóm tuổi đã có tổ trưởng');
      db.ageGroups = db.ageGroups.filter((g) => g.id !== id);
    });
  },

  async saveClass(id, form, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, form.schoolYear);
      assertOpenYear(year);
      const cls = id ? db.classes.find((c) => c.id === id) : null;
      if (id && !cls) throw notFound('lớp');
      if (cls) assertOpenYear(findYear(db, cls.schoolYear));
      const enrolled = cls ? childCountOf(db, id) : 0;
      const ageGroup = db.ageGroups.find((g) => g.id === form.ageGroupId) || null;
      const room = (db.locations || []).find((l) => l.id === form.locationId);
      const errors = validateClass(
        form,
        db.classes.filter((c) => c.id !== id),
        { ageGroup, room, enrolled },
      );
      if (!db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (!ageGroup) errors.ageGroupId = 'Nhóm tuổi không tồn tại';
      if (form.locationId && room?.campusId !== form.campusId) errors.locationId = 'Phòng học không thuộc điểm trường đã chọn';
      else if (room && room.id !== cls?.locationId && room.status && room.status !== 'ACTIVE') errors.locationId = 'Phòng đã ngừng sử dụng';
      else if (room) {
        const other = db.classes.find((c) => c.id !== id && c.schoolYear === form.schoolYear && c.locationId === room.id);
        if (other) errors.locationId = `Phòng đang là phòng của ${other.name} trong năm học này`;
      }
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        campusId: form.campusId,
        ageGroupId: form.ageGroupId,
        schoolYear: form.schoolYear,
        capacity: Number(form.capacity),
        locationId: form.locationId,
      };
      if (cls) {
        // Lớp đã có trẻ: không đổi nhóm tuổi / điểm trường (SRS 4.1.5); lưu lớp không bao giờ xếp hay chuyển trẻ
        if (enrolled && cls.ageGroupId !== data.ageGroupId) throw invalid({ ageGroupId: 'Lớp đã có trẻ, không đổi được nhóm tuổi' });
        if (cls.campusId !== data.campusId && (enrolled || cls.teacherIds.length))
          throw invalid({ campusId: 'Lớp đã có trẻ hoặc giáo viên, không thể chuyển sang điểm trường khác' });
        const previous = `${cls.name}: sĩ số tối đa ${cls.capacity}`;
        Object.assign(cls, data);
        (cls.history ||= []).push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(cls);
      }
      const created = {
        id: uid('cls'),
        ...data,
        homeroomTeacherId: null,
        teacherIds: [],
        status: 'ACTIVE',
        history: [{ action: 'CREATED', userId: user.id, at: now() }],
      };
      db.classes.push(created);
      return clone(created);
    });
  },

  async deleteClass(id, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const cls = db.classes.find((c) => c.id === id);
      if (!cls) throw notFound('lớp');
      assertOpenYear(findYear(db, cls.schoolYear));
      if ((db.children || []).some((ch) => ch.classId === id)) throw inUse('lớp đã có trẻ');
      if (classHasHistory(db, id)) throw inUse('lớp đã có dữ liệu điểm danh, suất ăn hoặc đánh giá');
      db.classes = db.classes.filter((c) => c.id !== id);
    });
  },

  /**
   * Reuse the classes of an earlier school year (SRS 4.1.3 "Copy from Previous Year", extended to any other year).
   * Copies name, age group, campus, room and capacity only – never teachers or children; names already in the target year are skipped.
   */
  async copyClasses(targetYearId, { sourceYearId, classIds } = {}, user) {
    await delay();
    if (!canConfigureSchool(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const target = findYear(db, targetYearId);
      assertOpenYear(target);
      const source = findYear(db, sourceYearId);
      if (source.id === target.id) throw invalid({ sourceYearId: 'Chọn một năm học khác để sao chép' });
      const picked = db.classes.filter((c) => c.schoolYear === source.id && (!classIds || classIds.includes(c.id)));
      const copied = [];
      const skipped = [];
      const withoutRoom = [];
      // Phòng ngừng sử dụng hoặc đã có lớp khác trong năm đích thì để trống phòng, Hiệu trưởng xếp lại sau
      const roomFree = (locId) => {
        const loc = (db.locations || []).find((l) => l.id === locId);
        return (
          !!loc && (!loc.status || loc.status === 'ACTIVE') && !db.classes.some((x) => x.schoolYear === target.id && x.locationId === locId)
        );
      };
      picked.forEach((c) => {
        const group = db.ageGroups.find((g) => g.id === c.ageGroupId);
        if (db.classes.some((x) => x.schoolYear === target.id && x.campusId === c.campusId && sameName(x.name, c.name)))
          return skipped.push({ name: c.name, reason: 'Điểm trường đã có lớp cùng tên trong năm học' });
        if (!group) return skipped.push({ name: c.name, reason: 'Nhóm tuổi không còn tồn tại' });
        const locationId = c.locationId && roomFree(c.locationId) ? c.locationId : null;
        if (c.locationId && !locationId) withoutRoom.push(c.name);
        // Sĩ số không vượt sức chứa phòng giữ lại
        const roomCap = (db.locations || []).find((l) => l.id === locationId)?.capacity || c.capacity;
        db.classes.push({
          id: uid('cls'),
          name: c.name,
          campusId: c.campusId,
          ageGroupId: c.ageGroupId,
          schoolYear: target.id,
          // Năm đích: không vượt sĩ số tối đa của nhóm tuổi và sức chứa phòng giữ lại
          capacity: Math.min(c.capacity, roomCap, group.maxClassSize || c.capacity),
          locationId,
          homeroomTeacherId: null,
          teacherIds: [],
          status: 'ACTIVE',
          history: [{ action: 'COPIED', userId: user.id, at: now(), note: `Sao chép từ năm học ${source.name}` }],
        });
        return copied.push(c.name);
      });
      return { copied, skipped, withoutRoom };
    });
  },

  /* ---------------- Cutoff (#19) ---------------- */
  /** Readable by every signed-in user: attendance and meal modules need the active cutoff. */
  async getCutoffSetting(schoolYear) {
    await delay(80);
    const db = seeded();
    const year = findYear(db, schoolYear);
    const setting = db.cutoffSettings.find((s) => s.schoolYear === schoolYear) || null;
    return { year: clone(year), setting: clone(setting) };
  },

  async saveCutoffSetting(schoolYear, form, user) {
    await delay();
    if (!canConfigureCutoff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      const errors = validateCutoff(form, year);
      if (hasErrors(errors)) throw invalid(errors);
      let setting = db.cutoffSettings.find((s) => s.schoolYear === schoolYear);
      const previousTime = setting?.time || null;
      if (setting && setting.time === form.time && setting.effectiveFrom === form.effectiveFrom)
        throw invalid({ time: 'Giờ chốt và ngày áp dụng chưa thay đổi' });
      if (!setting) {
        setting = { schoolYear, history: [] };
        db.cutoffSettings.push(setting);
      }
      Object.assign(setting, { time: form.time, effectiveFrom: form.effectiveFrom, updatedBy: user.id, updatedAt: now() });
      setting.history.unshift({
        time: form.time,
        effectiveFrom: form.effectiveFrom,
        previousTime,
        userId: user.id,
        at: now(),
        note: (form.note || '').trim(),
      });
      db.users
        .filter((u) => u.role === ROLES.VICE_PRINCIPAL)
        .forEach((u) =>
          notify(
            db,
            u.id,
            'Giờ chốt điểm danh thay đổi',
            `Từ ${form.effectiveFrom}, điểm danh và suất ăn khóa lúc ${form.time} (năm học ${year.name}).`,
          ),
        );
      return clone(setting);
    });
  },

  /* ---------------- Campuses (#20, #21, #22) ---------------- */
  async getCampuses(schoolYear, user) {
    await delay(120);
    if (!canListCampuses(user)) throw forbid();
    const db = seeded();
    return clone(
      db.campuses
        .filter((c) => canViewCampus(c, user))
        .map((c) => {
          const classes = db.classes.filter((cl) => cl.campusId === c.id && cl.schoolYear === schoolYear);
          return {
            ...c,
            classCount: classes.length,
            childCount: classes.reduce((s, cl) => s + childCountOf(db, cl.id), 0),
            vicePrincipals: db.users
              .filter((u) => u.role === ROLES.VICE_PRINCIPAL && u.campusId === c.id)
              .map((u) => ({ id: u.id, fullName: u.fullName })),
          };
        }),
    );
  },

  async getCampusDetail(id, schoolYear, user) {
    await delay(120);
    const db = seeded();
    const campus = db.campuses.find((c) => c.id === id);
    if (!campus) throw notFound('điểm trường');
    if (!canViewCampus(campus, user)) throw forbid();
    const classes = db.classes
      .filter((c) => c.campusId === id && c.schoolYear === schoolYear)
      .map((c) => ({ ...c, childCount: childCountOf(db, c.id) }));
    const staffOf = (role) => db.users.filter((u) => u.role === role && u.campusId === id);
    return clone({
      campus,
      classes,
      ageGroups: db.ageGroups,
      vicePrincipals: staffOf(ROLES.VICE_PRINCIPAL),
      teachers: db.users.filter((u) => TEACHING_ROLES.includes(u.role) && u.campusId === id),
      kitchen: {
        locations: db.locations.filter((l) => l.campusId === id && l.type === 'KITCHEN'),
        staff: staffOf(ROLES.KITCHEN_STAFF),
      },
    });
  },

  async saveCampus(id, form, user) {
    await delay();
    if (!canManageCampus(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const errors = validateCampus(
        form,
        db.campuses.filter((c) => c.id !== id),
      );
      if (hasErrors(errors)) throw invalid(errors);
      const current = id ? db.campuses.find((c) => c.id === id) : null;
      if (id && !current) throw notFound('điểm trường');
      if (current?.isMain && !form.isMain)
        throw invalid({ isMain: 'Trường phải có đúng một điểm trường chính. Hãy chọn điểm trường chính khác trước.' });
      const data = {
        code: form.code.trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        address: form.address.trim(),
        phone: (form.phone || '').trim(),
        isMain: !!form.isMain,
      };
      // Exactly one main campus (Campus entity).
      if (data.isMain) db.campuses.forEach((c) => (c.isMain = false));
      if (current) {
        Object.assign(current, data, { updatedBy: user.id, updatedAt: now() });
        return clone(current);
      }
      const campus = { id: uid('c'), ...data, createdBy: user.id, createdAt: now() };
      if (!db.campuses.some((c) => c.isMain)) campus.isMain = true;
      db.campuses.push(campus);
      return clone(campus);
    });
  },

  async deleteCampus(id, user) {
    await delay();
    if (!canManageCampus(user)) throw forbid();
    seeded();
    writeDb((db) => {
      const campus = db.campuses.find((c) => c.id === id);
      if (!campus) throw notFound('điểm trường');
      if (campus.isMain) throw inUse('đây là điểm trường chính');
      if (db.classes.some((c) => c.campusId === id)) throw inUse('điểm trường đã có lớp');
      if (db.users.some((u) => u.campusId === id)) throw inUse('điểm trường đã có nhân sự');
      if (db.locations.some((l) => l.campusId === id)) throw inUse('điểm trường đã có phòng, bếp');
      if ((db.children || []).some((ch) => ch.campusId === id)) throw inUse('điểm trường đã có trẻ');
      db.campuses = db.campuses.filter((c) => c.id !== id);
    });
  },

  /* ---------------- Staff accounts (PROPOSED 10/10/2026: SRS 4.4 "User account – Create / Edit / Deactivate", footnote 8) ---------------- */
  async getStaffAccounts(user) {
    await delay(120);
    if (!canManageStaff(user)) throw forbid();
    const db = seeded();
    const open = openYearIds(db);
    return clone(
      db.users.map((u) => ({
        ...u,
        status: u.status || 'ACTIVE',
        vpAssignments: db.vpAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)),
        classes: db.classes
          .filter((c) => open.has(c.schoolYear) && c.teacherIds.includes(u.id))
          .map((c) => ({ id: c.id, name: c.name, schoolYear: c.schoolYear })),
        leads: db.teamLeaderAssignments.filter((a) => a.userId === u.id && open.has(a.schoolYear)),
      })),
    );
  },

  /** What a role / campus / status change ends (shown before confirming). */
  async getStaffImpact(id, form, user) {
    await delay(80);
    if (!canManageStaff(user)) throw forbid();
    const db = seeded();
    const u = db.users.find((x) => x.id === id);
    if (!u) throw notFound('tài khoản');
    return clone(staffImpact(db, u, form));
  },

  async saveStaffAccount(id, form, user) {
    await delay();
    if (!canManageStaff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const current = id ? db.users.find((x) => x.id === id) : null;
      if (id && !current) throw notFound('tài khoản');
      if (current?.role === ROLES.PRINCIPAL) throw new ApiError(409, 'Không đổi được tài khoản Hiệu trưởng ở màn này');
      const errors = validateStaffAccount(
        form,
        db.users.filter((x) => x.id !== id),
      );
      if (form.campusId && !db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (hasErrors(errors)) throw invalid(errors);
      const data = { fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: (form.phone || '').trim() };
      if (!current) {
        const created = {
          id: uid('u'),
          ...data,
          role: form.role,
          campusId: form.campusId || null,
          locationIds: [],
          status: 'ACTIVE',
          roleHistory: [{ at: now(), userId: user.id, from: null, to: form.role, campusId: form.campusId || null, note: 'Tạo tài khoản' }],
        };
        db.users.push(created);
        if (form.role === ROLES.VICE_PRINCIPAL && form.campusId) assignVp(db, created, form.campusId, user);
        notify(
          db,
          created.id,
          'Tài khoản CareNest đã được tạo',
          `Vai trò: ${ROLE_LABELS[form.role]}. Hãy đăng nhập và đổi mật khẩu.`,
          '/account/profile',
        );
        return clone(created);
      }
      const roleChanged = sameRole(current.role) !== form.role;
      const campusChanged = (current.campusId || '') !== (form.campusId || '');
      if (roleChanged || campusChanged) {
        if (!(form.reason || '').trim()) throw invalid({ reason: 'Nhập lý do đổi vai trò / điểm trường' });
        endAssignments(db, current, { role: form.role, campusId: form.campusId, status: current.status || 'ACTIVE' }, user, form.reason);
        (current.roleHistory ||= []).push({
          at: now(),
          userId: user.id,
          from: current.role,
          to: form.role,
          fromCampusId: current.campusId || null,
          campusId: form.campusId || null,
          note: form.reason.trim(),
        });
        // Giữ "Tổ trưởng" nếu vẫn là giáo viên cùng điểm trường; ngược lại nhận vai trò mới
        current.role = form.role === ROLES.TEACHER && current.role === ROLES.TEAM_LEADER && !campusChanged ? ROLES.TEAM_LEADER : form.role;
        current.campusId = form.campusId || null;
        if (form.role === ROLES.VICE_PRINCIPAL && form.campusId) assignVp(db, current, form.campusId, user);
        notify(
          db,
          current.id,
          'Vai trò của bạn đã thay đổi',
          `Vai trò mới: ${ROLE_LABELS[form.role]}${form.campusId ? ` · ${db.campuses.find((c) => c.id === form.campusId)?.shortName}` : ''}. Có hiệu lực từ lần đăng nhập tiếp theo.`,
          '/account/profile',
        );
      }
      Object.assign(current, data);
      return clone(current);
    });
  },

  async setStaffStatus(id, status, reason, user) {
    await delay();
    if (!canManageStaff(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) throw notFound('tài khoản');
      if (u.role === ROLES.PRINCIPAL || u.id === user.id) throw new ApiError(409, 'Không vô hiệu hóa được tài khoản Hiệu trưởng');
      if (!(reason || '').trim()) throw invalid({ reason: 'Nhập lý do' });
      if (status === 'INACTIVE') endAssignments(db, u, { role: u.role, campusId: u.campusId, status }, user, reason);
      u.status = status;
      (u.roleHistory ||= []).push({ at: now(), userId: user.id, from: u.role, to: u.role, status, note: reason.trim() });
      return clone(u);
    });
  },

  /* ---------------- Vice principal assignment (#23) ---------------- */
  async getViceAssignments(schoolYear, user) {
    await delay(120);
    if (!canAssignVicePrincipal(user)) throw forbid();
    const db = seeded();
    const year = findYear(db, schoolYear);
    const roleGrants = grantsOf(db.rolePermissions, ROLES.VICE_PRINCIPAL);
    const rows = db.users
      .filter((u) => u.role === ROLES.VICE_PRINCIPAL)
      .map((u) => {
        const assignment = db.vpAssignments.find((a) => a.schoolYear === schoolYear && a.userId === u.id) || null;
        return { user: u, assignment: assignment && { ...assignment, areas: vpAreasOf(assignment, roleGrants) } };
      });
    return clone({ year, rows });
  },

  async saveViceAssignment(schoolYear, userId, form, user) {
    await delay();
    if (!canAssignVicePrincipal(user)) throw forbid();
    seeded();
    return writeDb((db) => {
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      const vp = db.users.find((u) => u.id === userId && u.role === ROLES.VICE_PRINCIPAL);
      if (!vp) throw notFound('Phó hiệu trưởng');
      const errors = validateVpAssignment(form);
      if (form.campusId && !db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (hasErrors(errors)) throw invalid(errors);
      const roleGrants = grantsOf(db.rolePermissions, ROLES.VICE_PRINCIPAL);
      const current = db.vpAssignments.find((x) => x.schoolYear === schoolYear && x.userId === userId);
      const areas = { ...vpAreasOf(current, roleGrants), ...(form.areas || {}) };
      // Sửa thực đơn = giữ dịch vụ chung: chỉ một Phó hiệu trưởng mỗi năm (GBR-GEN-10), người cũ về chỉ xem
      const sharedService = parseGrant(areas.menu).access === PERMISSION_ACCESS.EDIT;
      if (sharedService)
        db.vpAssignments
          .filter((a) => a.schoolYear === schoolYear && a.userId !== userId)
          .forEach((a) => {
            if (a.sharedService || parseGrant(a.areas?.menu).access === PERMISSION_ACCESS.EDIT)
              Object.assign(a, { sharedService: false, areas: { ...vpAreasOf(a, roleGrants), menu: 'VIEW_FULL' } });
          });
      let a = db.vpAssignments.find((x) => x.schoolYear === schoolYear && x.userId === userId);
      const before = a ? { campusId: a.campusId, sharedService: a.sharedService, areas: a.areas } : null;
      if (!a) {
        a = { id: uid('vpa'), schoolYear, userId };
        db.vpAssignments.push(a);
      }
      Object.assign(a, { campusId: form.campusId, sharedService, areas, assignedBy: user.id, assignedAt: now() });
      a.history = [...(a.history || []), { before, userId: user.id, at: now(), note: (form.note || '').trim() }];
      syncAssignments(db, schoolYear);
      const campus = db.campuses.find((c) => c.id === form.campusId);
      notify(
        db,
        userId,
        'Bạn được phân công phụ trách điểm trường',
        `Năm học ${year.name}: phụ trách ${campus.shortName || campus.name}${a.sharedService ? ', kèm dịch vụ chung (bán trú toàn trường)' : ''}.`,
      );
      return clone(a);
    });
  },

  /* ---------------- Teacher assignment (#26) ---------------- */
  async getTeacherAssignments({ schoolYear, campusId }, user) {
    await delay(140);
    const db = seeded();
    if (!canViewTeacherAssignments(campusId, actor(db, user))) throw noAssignRight(db, user, campusId);
    const year = findYear(db, schoolYear);
    return clone({
      year,
      ageGroups: db.ageGroups,
      classes: db.classes
        .filter((c) => c.campusId === campusId && c.schoolYear === schoolYear)
        .map((c) => ({ ...c, childCount: childCountOf(db, c.id) })),
      teachers: db.users.filter((u) => TEACHING_ROLES.includes(u.role) && u.campusId === campusId),
      teamLeaders: db.teamLeaderAssignments.filter((a) => a.schoolYear === schoolYear && a.campusId === campusId),
    });
  },

  async saveClassTeachers(classId, form, user) {
    await delay();
    seeded();
    return writeDb((db) => {
      const cls = db.classes.find((c) => c.id === classId);
      if (!cls) throw notFound('lớp');
      if (!canAssignTeachers(cls.campusId, actor(db, user))) throw noAssignRight(db, user, cls.campusId);
      const year = findYear(db, cls.schoolYear);
      assertOpenYear(year);
      const errors = validateClassTeachers(form);
      const allowed = new Set(db.users.filter((u) => TEACHING_ROLES.includes(u.role) && u.campusId === cls.campusId).map((u) => u.id));
      if ((form.teacherIds || []).some((t) => !allowed.has(t))) errors.teacherIds = 'Chỉ phân công giáo viên thuộc điểm trường của lớp';
      if (hasErrors(errors)) throw invalid(errors);
      const added = form.teacherIds.filter((t) => !cls.teacherIds.includes(t));
      cls.teacherIds = [...form.teacherIds];
      cls.homeroomTeacherId = form.homeroomTeacherId || null;
      cls.assignmentHistory = [...(cls.assignmentHistory || []), { teacherIds: cls.teacherIds, userId: user.id, at: now() }];
      added.forEach((t) =>
        notify(
          db,
          t,
          'Bạn được phân công lớp mới',
          `Năm học ${year.name}: bạn phụ trách ${cls.name}${t === cls.homeroomTeacherId ? ' (chủ nhiệm)' : ''}.`,
        ),
      );
      return clone(cls);
    });
  },

  async saveTeamLeader({ schoolYear, campusId, ageGroupId, userId }, user) {
    await delay();
    seeded();
    return writeDb((db) => {
      if (!canAssignTeachers(campusId, actor(db, user))) throw noAssignRight(db, user, campusId);
      const year = findYear(db, schoolYear);
      assertOpenYear(year);
      if (!db.ageGroups.some((g) => g.id === ageGroupId)) throw notFound('nhóm tuổi');
      if (userId && !db.users.some((u) => u.id === userId && TEACHING_ROLES.includes(u.role) && u.campusId === campusId))
        throw invalid({ userId: 'Tổ trưởng phải là giáo viên của điểm trường' });
      // One leader per age group and campus; a teacher leads at most one age group per year.
      db.teamLeaderAssignments = db.teamLeaderAssignments.filter(
        (a) =>
          a.schoolYear !== schoolYear || !((a.campusId === campusId && a.ageGroupId === ageGroupId) || (userId && a.userId === userId)),
      );
      let created = null;
      if (userId) {
        created = { id: uid('tla'), schoolYear, campusId, ageGroupId, userId, assignedBy: user.id, assignedAt: now() };
        db.teamLeaderAssignments.push(created);
        const group = db.ageGroups.find((g) => g.id === ageGroupId);
        notify(db, userId, 'Bạn được phân công tổ trưởng nhóm tuổi', `Năm học ${year.name}: tổ trưởng ${group.name}.`);
      }
      syncAssignments(db, schoolYear);
      return clone(created);
    });
  },

  /* ---------------- Roles & permissions (#24, #25) ---------------- */
  async getRolePermissions(user) {
    await delay(100);
    if (!canManageRolePermissions(user)) throw forbid();
    const db = seeded();
    return clone(
      CONFIG_ROLES.map((role) => {
        const entry = db.rolePermissions.find((r) => r.role === role) || { role, grants: defaultGrants(role), history: [] };
        const userCount = db.users.filter((u) => u.role === role).length;
        return { ...entry, userCount, history: entry.history.map((h) => ({ ...h, userName: userName(db, h.userId) })) };
      }),
    );
  },

  async saveRolePermissions(role, { grants, reason }, user) {
    await delay();
    if (!canManageRolePermissions(user)) throw forbid();
    if (!CONFIG_ROLES.includes(role)) throw notFound('vai trò');
    seeded();
    return writeDb((db) => {
      const errors = validatePermissionChange({ reason });
      if (hasErrors(errors)) throw invalid(errors);
      let entry = db.rolePermissions.find((r) => r.role === role);
      if (!entry) {
        entry = { role, grants: defaultGrants(role), history: [] };
        db.rolePermissions.push(entry);
      }
      const levels = Object.values(PERMISSION_LEVEL);
      const changes = PERMISSION_CATALOG.filter((p) => grants[p.code] && grants[p.code] !== entry.grants[p.code]).map((p) => ({
        code: p.code,
        from: entry.grants[p.code] || PERMISSION_LEVEL.NONE,
        to: grants[p.code],
      }));
      if (changes.some((c) => !levels.includes(c.to))) throw new ApiError(422, 'Mức quyền không hợp lệ');
      if (changes.some((c) => isLockedGrant(role, c.code)))
        throw new ApiError(422, `${CONFIG_ROLE_LABELS[role]} phải giữ quyền quản lý phân quyền`);
      if (!changes.length) throw new ApiError(422, 'Chưa có thay đổi nào để lưu');
      changes.forEach((c) => (entry.grants[c.code] = c.to));
      entry.history.unshift({ userId: user.id, at: now(), reason: reason.trim(), changes });
      return clone(entry);
    });
  },
};
