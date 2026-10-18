import { readDb, writeDb, clone, delay, ApiError, applyMockSeedMigration, needsMockSeedMigration } from '@/mocks/mockDatabase';
import { seedUsers } from '@/mocks/seed';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { credentialOf } from '@/mocks/authMockRepository';
import { hasPermission } from '@/utils/account/permissionManagementPermissions';
import { assignmentTargetOf, hasErrors, validateStaffAccount, validateTemporaryPassword } from '@/utils/account/staffValidation';
import { PERMISSIONS } from '@/models/account/permissionConstants';
import { uid } from '@/utils/id';

/*
 * Fake backend quản lý nhân sự — chép luật BE (AUTH-15..17, StaffAccessPolicy):
 * - HT tạo PHT/GV/bếp; PHT (có ACCOUNT_MANAGE) chỉ tạo GV/bếp kèm phân công campus mình;
 * - HT quản lý PHT/GV/bếp toàn trường; PHT chỉ GV/bếp đang phân công trong campus mình; không ai đụng chính mình;
 * - phân công kết thúc bằng ngày cuối, không xóa; trùng phân công còn mở cùng phạm vi ⇒ 409.
 * Mock không có Admin nên phần Admin tạo Hiệu trưởng không có ở đây.
 */

const SCHOOL_YEAR_START = '2026-09-01';
const STAFF_ROLES = ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];
const STAFF_ACCOUNT_ROLES = ['PRINCIPAL', ...STAFF_ROLES];
const CAMPUS_MANAGED_ROLES = ['TEACHER', 'KITCHEN_STAFF'];

const forbid = (message = 'Bạn không có quyền thực hiện thao tác này') => new ApiError(403, message);
const badRequest = (message, details) => new ApiError(400, message, details);
const today = () => new Date().toISOString().slice(0, 10);
const isActive = (a, date = today()) => a.validFrom <= date && (!a.validTo || a.validTo >= date);
// Tổ trưởng (chỉ có ở mock) là giáo viên theo role BE
const roleOf = (u) => (u?.role === 'TEAM_LEADER' ? 'TEACHER' : u?.role);
const usernameOf = (u) => u.username || (u.email ? u.email.split('@')[0] : u.id);

const ensure = (db) => {
  const users = db.users?.length ? db.users : seedUsers;
  const assignments = users.flatMap((u) => {
    const role = roleOf(u);
    const base = { userId: u.id, validFrom: SCHOOL_YEAR_START, validTo: null };
    if (role === 'PRINCIPAL') return [{ ...base, id: uid(), staffRole: 'PRINCIPAL', campusId: null, classroomId: null }];
    if (role === 'VICE_PRINCIPAL' || role === 'KITCHEN_STAFF')
      return u.campusId ? [{ ...base, id: uid(), staffRole: role, campusId: u.campusId, classroomId: null }] : [];
    if (role === 'TEACHER')
      return (db.classes || [])
        .filter((c) => (c.teacherIds || []).includes(u.id))
        .map((c) => ({ ...base, id: uid(), staffRole: 'TEACHER', campusId: null, classroomId: c.id }));
    return [];
  });
  return applyMockSeedMigration(db, 'staff-assignments', 1, { users: seedUsers, staffAssignments: assignments });
};

// Ghi phân công dựng từ seed ngay lần đầu để id ổn định giữa các lần đọc
const seeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (needsMockSeedMigration(db, 'staff-assignments', 1, ['users', 'staffAssignments'])) writeDb(ensure);
  return readDb();
};

const campusOfAssignment = (db, a) => (a.staffRole === 'TEACHER' ? db.classes.find((c) => c.id === a.classroomId)?.campusId : a.campusId);

const activeCampusesOf = (db, userId, staffRole) =>
  new Set(
    db.staffAssignments
      .filter((a) => a.userId === userId && a.staffRole === staffRole && isActive(a))
      .map((a) => campusOfAssignment(db, a))
      .filter(Boolean),
  );

const wholeSchool = (actor) => roleOf(actor) === 'PRINCIPAL';
const managedCampuses = (db, actor) => (roleOf(actor) === 'VICE_PRINCIPAL' ? activeCampusesOf(db, actor.id, 'VICE_PRINCIPAL') : new Set());

const canManage = (db, actor, target) => {
  const role = roleOf(target);
  if (wholeSchool(actor)) return STAFF_ROLES.includes(role);
  if (!CAMPUS_MANAGED_ROLES.includes(role)) return false;
  const managed = managedCampuses(db, actor);
  return [...activeCampusesOf(db, target.id, role)].some((c) => managed.has(c));
};

const canAssign = (db, actor, staffRole, campusId) =>
  (wholeSchool(actor) && STAFF_ROLES.includes(staffRole)) ||
  (CAMPUS_MANAGED_ROLES.includes(staffRole) && managedCampuses(db, actor).has(campusId));

const requirePermission = (actor, ...codes) => {
  if (!codes.some((code) => hasPermission(actor, code))) throw forbid();
};

const resolveCampus = (db, staffRole, campusId, classroomId) => {
  if (staffRole === 'TEACHER') {
    if (!classroomId || campusId) throw badRequest('Giáo viên phải được phân công vào một lớp');
    const room = db.classes.find((c) => c.id === classroomId);
    if (!room) throw new ApiError(404, 'Không tìm thấy lớp');
    return room.campusId;
  }
  if (!campusId || classroomId) throw badRequest('Vai trò này phải được phân công vào một điểm trường');
  if (!(db.campuses || []).some((c) => c.id === campusId)) throw new ApiError(404, 'Không tìm thấy điểm trường');
  return campusId;
};

const loadManageable = (db, actor, userId) => {
  const target = db.users.find((u) => u.id === userId);
  if (!target) throw wholeSchool(actor) ? new ApiError(404, 'Không tìm thấy tài khoản') : forbid('Bạn không quản lý tài khoản này');
  if (!canManage(db, actor, target)) throw forbid('Bạn không quản lý tài khoản này');
  return target;
};

const summary = (db, u) => ({
  userId: u.id,
  username: usernameOf(u),
  fullName: u.fullName,
  email: u.email || null,
  role: roleOf(u),
  status: u.status === 'INACTIVE' || u.status === 'LOCKED' ? 'INACTIVE' : 'ACTIVE',
  activeAssignments: db.staffAssignments
    .filter((a) => a.userId === u.id && isActive(a))
    .map(({ staffRole, campusId, classroomId, validFrom, validTo }) => ({ staffRole, campusId, classroomId, validFrom, validTo })),
});

const createAssignmentIn = (db, { userId, staffRole, campusId, classroomId, validFrom, validTo }) => {
  const from = validFrom || today();
  if (validTo && validTo < from) throw badRequest('Ngày kết thúc phải sau ngày bắt đầu');
  const overlap = db.staffAssignments.some(
    (a) =>
      a.userId === userId &&
      a.staffRole === staffRole &&
      (a.campusId || null) === (campusId || null) &&
      (a.classroomId || null) === (classroomId || null) &&
      (!a.validTo || a.validTo >= from),
  );
  if (overlap) throw new ApiError(409, 'Nhân sự đã có phân công còn hiệu lực cho phạm vi này');
  const created = {
    id: uid(),
    userId,
    staffRole,
    campusId: campusId || null,
    classroomId: classroomId || null,
    validFrom: from,
    validTo: validTo || null,
  };
  db.staffAssignments.push(created);
  return created;
};

/** Phạm vi quản lý của người dùng mock (giống StaffAccessPolicy): HT toàn trường, PHT campus đang phụ trách. */
export const staffScopeOf = (actor) => {
  const db = seeded();
  return { wholeSchool: wholeSchool(actor), campuses: managedCampuses(db, actor) };
};

export const staffMockRepository = {
  async searchAccounts({ role, status, campusId, q, staffOnly = false, page = 0, size = 20 } = {}, actor) {
    await delay(100);
    requirePermission(
      actor,
      PERMISSIONS.ACCOUNT_MANAGE,
      PERMISSIONS.ACCOUNT_STATUS_MANAGE,
      PERMISSIONS.STAFF_ASSIGNMENT_MANAGE,
      PERMISSIONS.PERMISSION_MANAGE,
    );
    const db = seeded();
    let campuses = null;
    if (!wholeSchool(actor)) {
      const managed = managedCampuses(db, actor);
      if (campusId && !managed.has(campusId)) throw forbid('Bạn không phụ trách điểm trường này');
      campuses = campusId ? new Set([campusId]) : managed;
    } else if (campusId) campuses = new Set([campusId]);

    const keyword = (q || '').trim().toLowerCase();
    const rows = db.users
      .map((u) => summary(db, u))
      .filter((s) => !campuses || s.activeAssignments.some((a) => campuses.has(campusOfAssignment(db, a))))
      .filter((s) => wholeSchool(actor) || CAMPUS_MANAGED_ROLES.includes(s.role))
      .filter((s) => !staffOnly || STAFF_ACCOUNT_ROLES.includes(s.role))
      .filter((s) => !role || s.role === role)
      .filter((s) => !status || s.status === status)
      .filter((s) => !keyword || `${s.username} ${s.fullName}`.toLowerCase().includes(keyword))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    return clone({
      items: rows.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / size)),
    });
  },

  async getRoster(campusId, actor) {
    await delay(80);
    requirePermission(
      actor,
      PERMISSIONS.ACCOUNT_MANAGE,
      PERMISSIONS.ACCOUNT_STATUS_MANAGE,
      PERMISSIONS.STAFF_ASSIGNMENT_MANAGE,
      PERMISSIONS.PERMISSION_MANAGE,
    );
    const db = seeded();
    const campus = (db.campuses || []).find((c) => String(c.id) === String(campusId));
    if (!campus) throw wholeSchool(actor) ? new ApiError(404, 'Không tìm thấy điểm trường') : forbid();
    if (!wholeSchool(actor) && !managedCampuses(db, actor).has(campus.id)) throw forbid('Bạn không phụ trách điểm trường này');

    const personOf = (assignment) => {
      const user = db.users.find((u) => u.id === assignment.userId);
      if (!user) return null;
      return {
        assignmentId: assignment.id,
        userId: user.id,
        fullName: user.fullName,
        status: user.status === 'INACTIVE' || user.status === 'LOCKED' ? 'INACTIVE' : 'ACTIVE',
        validFrom: assignment.validFrom,
        validTo: assignment.validTo,
      };
    };
    const active = db.staffAssignments.filter((a) => isActive(a));
    const people = (assignments) => assignments.map(personOf).filter(Boolean);
    const campusAssignments = active.filter((a) => a.campusId === campus.id);
    return clone({
      campusId: campus.id,
      asOf: today(),
      vicePrincipals: wholeSchool(actor) ? people(campusAssignments.filter((a) => a.staffRole === 'VICE_PRINCIPAL')) : [],
      kitchenStaff: people(campusAssignments.filter((a) => a.staffRole === 'KITCHEN_STAFF')),
      classrooms: db.classes
        .filter((room) => room.campusId === campus.id)
        .map((room) => ({
          classroomId: room.id,
          name: room.name,
          teachers: people(active.filter((a) => a.staffRole === 'TEACHER' && a.classroomId === room.id)),
        })),
    });
  },

  async getAccount(userId, actor) {
    await delay(80);
    requirePermission(
      actor,
      PERMISSIONS.ACCOUNT_MANAGE,
      PERMISSIONS.ACCOUNT_STATUS_MANAGE,
      PERMISSIONS.STAFF_ASSIGNMENT_MANAGE,
      PERMISSIONS.PERMISSION_MANAGE,
    );
    const db = seeded();
    const target = loadManageable(db, actor, userId);
    const { activeAssignments: _active, ...account } = summary(db, target);
    return clone({
      ...account,
      assignments: db.staffAssignments.filter((a) => a.userId === userId).sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
    });
  },

  async createAccount(form, actor) {
    await delay();
    requirePermission(actor, PERMISSIONS.ACCOUNT_MANAGE);
    const errors = validateStaffAccount(form, { assignmentRequired: !wholeSchool(actor) });
    if (hasErrors(errors)) throw badRequest('Dữ liệu chưa hợp lệ', errors);
    return writeDb((db) => {
      ensure(db);
      const target = assignmentTargetOf(form.role);
      const withAssignment = target === 'campus' ? !!form.campusId : target === 'classroom' ? !!form.classroomId : false;
      const campusId = withAssignment ? resolveCampus(db, form.role, form.campusId, form.classroomId) : null;
      const allowed =
        (wholeSchool(actor) && STAFF_ROLES.includes(form.role)) ||
        (CAMPUS_MANAGED_ROLES.includes(form.role) && campusId && managedCampuses(db, actor).has(campusId));
      if (!allowed) throw forbid('Bạn không tạo được tài khoản với vai trò này');
      const username = form.username.trim().toLowerCase();
      if (db.users.some((u) => usernameOf(u).toLowerCase() === username)) throw new ApiError(409, 'Tên đăng nhập đã tồn tại');

      const user = {
        id: uid(),
        username,
        fullName: form.fullName.trim(),
        email: form.email?.trim() || null,
        role: form.role,
        status: 'ACTIVE',
        campusId,
      };
      db.users.push(user);
      if (form.temporaryPassword) Object.assign(credentialOf(db, user.id), { password: form.temporaryPassword, mustChange: true }); // carenest:allow-secret
      const assignment = withAssignment
        ? createAssignmentIn(db, {
            userId: user.id,
            staffRole: form.role,
            campusId: target === 'campus' ? form.campusId : null,
            classroomId: target === 'classroom' ? form.classroomId : null,
            validFrom: form.validFrom,
          })
        : null;
      return clone({ ...summary(db, user), setupEmailSent: false, assignment });
    });
  },

  async updateAccountStatus(userId, status, actor) {
    await delay();
    requirePermission(actor, PERMISSIONS.ACCOUNT_STATUS_MANAGE);
    if (userId === actor.id) throw badRequest('Không thể tự khóa / mở tài khoản của chính mình');
    return writeDb((db) => {
      ensure(db);
      const target = loadManageable(db, actor, userId);
      target.status = status;
      return clone(summary(db, target));
    });
  },

  async resetTemporaryPassword(userId, temporaryPassword, actor) {
    await delay();
    requirePermission(actor, PERMISSIONS.ACCOUNT_MANAGE);
    if (userId === actor.id) throw badRequest('Dùng chức năng đổi mật khẩu cho tài khoản của chính mình');
    const message = validateTemporaryPassword(temporaryPassword);
    if (message) throw badRequest(message);
    return writeDb((db) => {
      ensure(db);
      const target = loadManageable(db, actor, userId);
      Object.assign(credentialOf(db, userId), { password: temporaryPassword, mustChange: true }); // carenest:allow-secret
      return clone(summary(db, target));
    });
  },

  async assignStaff({ userId, campusId, classroomId, validFrom, validTo }, actor) {
    await delay();
    requirePermission(actor, PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
    if (userId === actor.id) throw badRequest('Không thể tự phân công cho chính mình');
    return writeDb((db) => {
      ensure(db);
      const target = db.users.find((u) => u.id === userId);
      if (!target) throw wholeSchool(actor) ? new ApiError(404, 'Không tìm thấy tài khoản') : forbid();
      const staffRole = roleOf(target);
      if (!STAFF_ROLES.includes(staffRole)) throw badRequest('Tài khoản này không phân công được');
      const campus = resolveCampus(db, staffRole, campusId, classroomId);
      if (!canAssign(db, actor, staffRole, campus)) throw forbid('Bạn không phân công được cho phạm vi này');
      return clone(createAssignmentIn(db, { userId, staffRole, campusId, classroomId, validFrom, validTo }));
    });
  },

  async endAssignment(assignmentId, validTo, actor) {
    await delay();
    requirePermission(actor, PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
    return writeDb((db) => {
      ensure(db);
      const assignment = db.staffAssignments.find((a) => a.id === assignmentId);
      if (!assignment) throw wholeSchool(actor) ? new ApiError(404, 'Không tìm thấy phân công') : forbid();
      if (assignment.userId === actor.id) throw badRequest('Không thể tự kết thúc phân công của chính mình');
      if (!canAssign(db, actor, assignment.staffRole, campusOfAssignment(db, assignment)))
        throw forbid('Bạn không phân công được cho phạm vi này');
      if (validTo < assignment.validFrom) throw badRequest('Ngày kết thúc phải sau ngày bắt đầu');
      if (assignment.validTo && assignment.validTo < validTo) throw new ApiError(409, 'Phân công đã kết thúc');
      assignment.validTo = validTo;
      return clone(assignment);
    });
  },

  async getCampuses(actor) {
    await delay(60);
    requirePermission(actor, PERMISSIONS.ACCOUNT_MANAGE, PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
    const db = seeded();
    const managed = wholeSchool(actor) ? null : managedCampuses(db, actor);
    return clone((db.campuses || []).filter((c) => !managed || managed.has(c.id)).map((c) => ({ id: c.id, code: c.code, name: c.name })));
  },

  async getClassrooms(campusId, actor) {
    await delay(60);
    requirePermission(actor, PERMISSIONS.ACCOUNT_MANAGE, PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
    const db = seeded();
    if (!wholeSchool(actor) && !managedCampuses(db, actor).has(campusId)) throw forbid('Bạn không phụ trách điểm trường này');
    return clone(db.classes.filter((c) => c.campusId === campusId).map((c) => ({ id: c.id, campusId: c.campusId, name: c.name })));
  },
};
