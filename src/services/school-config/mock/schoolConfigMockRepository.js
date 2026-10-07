import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded, visibleClasses } from '@/mocks/schoolMockRepository';
import { buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { ROLES } from '@/models/User';
import { YEAR_STATUS, CONFIG_ROLES, PERMISSION_LEVEL, CONFIG_ROLE_LABELS } from '@/models/school-config/schoolConfigConstants';
import { PERMISSION_CATALOG, defaultGrants, isLockedGrant } from '@/models/school-config/permissionCatalog';
import { uid } from '@/utils/id';
import {
  canAssignTeachers,
  canAssignVicePrincipal,
  canConfigureCutoff,
  canConfigureSchool,
  canListCampuses,
  canManageCampus,
  canManageRolePermissions,
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
  validateVpAssignment,
} from '@/utils/school-config/schoolConfigValidation';

/*
 * Fake backend of school configuration. Business rules live here (backend must repeat them):
 * - one ACTIVE school year; years do not overlap; closed years are read only (Academic Year entity, GBR-GEN-03);
 * - class names unique per year + campus; records in use are never deleted (MSG53);
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
  return db;
};

const seeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (COLLECTIONS.some((k) => !db[k]) || (db.campuses?.length && !db.campuses.some((c) => c.isMain))) writeDb(ensure);
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

const notify = (db, userId, title, message, link = '/') => pushNotification(db, { userId, type: 'ASSIGNMENT', title, message, link });

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
        const previous = `${current.name}: ${current.startDate} – ${current.endDate}`;
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
      .map((c) => ({ ...c, childCount: childCountOf(db, c.id) }));
    return { year: clone(year), ageGroups: clone(db.ageGroups), classes: clone(classes) };
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
      const errors = validateAgeGroup(
        form,
        db.ageGroups.filter((g) => g.id !== id),
      );
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        ageRange: form.ageRange.trim(),
        mealsPerDay: Number(form.mealsPerDay),
        nutritionNote: (form.nutritionNote || '').trim(),
      };
      if (id) {
        const group = db.ageGroups.find((g) => g.id === id);
        if (!group) throw notFound('nhóm tuổi');
        Object.assign(group, data);
        return clone(group);
      }
      const group = { id: uid('ag'), ...data };
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
      const errors = validateClass(
        form,
        db.classes.filter((c) => c.id !== id),
      );
      if (!db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (!db.ageGroups.some((g) => g.id === form.ageGroupId)) errors.ageGroupId = 'Nhóm tuổi không tồn tại';
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        name: form.name.trim(),
        campusId: form.campusId,
        ageGroupId: form.ageGroupId,
        schoolYear: form.schoolYear,
        capacity: Number(form.capacity),
        locationId: form.locationId || null,
      };
      if (id) {
        const cls = db.classes.find((c) => c.id === id);
        if (!cls) throw notFound('lớp');
        assertOpenYear(findYear(db, cls.schoolYear));
        const children = childCountOf(db, id);
        if (cls.campusId !== data.campusId && (children || cls.teacherIds.length))
          throw invalid({ campusId: 'Lớp đã có trẻ hoặc giáo viên, không thể chuyển sang điểm trường khác' });
        if (data.capacity < children) throw invalid({ capacity: `Lớp đang có ${children} trẻ, sĩ số tối đa không được nhỏ hơn` });
        Object.assign(cls, data);
        return clone(cls);
      }
      const cls = { id: uid('cls'), ...data, homeroomTeacherId: null, teacherIds: [], status: 'ACTIVE' };
      db.classes.push(cls);
      return clone(cls);
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
      db.classes = db.classes.filter((c) => c.id !== id);
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

  /* ---------------- Vice principal assignment (#23) ---------------- */
  async getViceAssignments(schoolYear, user) {
    await delay(120);
    if (!canAssignVicePrincipal(user)) throw forbid();
    const db = seeded();
    const year = findYear(db, schoolYear);
    const rows = db.users
      .filter((u) => u.role === ROLES.VICE_PRINCIPAL)
      .map((u) => ({ user: u, assignment: db.vpAssignments.find((a) => a.schoolYear === schoolYear && a.userId === u.id) || null }));
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
      // Shared-service responsibility is held by one VP per year (GBR-GEN-10).
      if (form.sharedService) db.vpAssignments.filter((a) => a.schoolYear === schoolYear).forEach((a) => (a.sharedService = false));
      let a = db.vpAssignments.find((x) => x.schoolYear === schoolYear && x.userId === userId);
      const before = a ? { campusId: a.campusId, sharedService: a.sharedService } : null;
      if (!a) {
        a = { id: uid('vpa'), schoolYear, userId };
        db.vpAssignments.push(a);
      }
      Object.assign(a, { campusId: form.campusId, sharedService: !!form.sharedService, assignedBy: user.id, assignedAt: now() });
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
    if (!canAssignTeachers(campusId, user)) throw forbid();
    const db = seeded();
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
      if (!canAssignTeachers(cls.campusId, user)) throw forbid();
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
    if (!canAssignTeachers(campusId, user)) throw forbid();
    seeded();
    return writeDb((db) => {
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
