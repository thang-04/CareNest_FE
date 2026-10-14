import { ROLES } from '@/models/User';
import {
  AREA_SCOPE_ALL,
  PERMISSION_ACCESS,
  PERMISSION_LEVEL,
  PERMISSION_SCOPE,
  VP_AREAS,
  YEAR_STATUS,
  defaultVpAreas,
  parseAreaGrant,
} from '@/models/school-config/schoolConfigConstants';

/*
 * Who may do what in school configuration – SRS 4.4 Permission Matrix + UC 2.1–2.7 (GBR-CFG-01).
 * Used to hide buttons AND re-checked by the mock repository (403). The backend owns the real check.
 */

const is = (user, ...roles) => !!user && roles.includes(user.role);
export const isPrincipal = (user) => is(user, ROLES.PRINCIPAL);
export const isVicePrincipal = (user) => is(user, ROLES.VICE_PRINCIPAL);

/** "School year, age group & class – Configure": Principal only. */
export const canConfigureSchool = isPrincipal;

/** "School year, age group & class – View": Principal full; VP / Teacher / Team leader within their scope. */
export const canViewSchoolStructure = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.TEAM_LEADER);

export const canEditYear = (year, user) => isPrincipal(user) && !!year && year.status !== YEAR_STATUS.CLOSED;
export const canActivateYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.PLANNED;
export const canCloseYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.ACTIVE;
/** Only a planned year can be deleted (the repository also checks it has no classes – MSG53). */
export const canDeleteYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.PLANNED;

/** Classes and age groups of a closed year are history: read only. */
export const canManageClasses = (year, user) => isPrincipal(user) && !!year && year.status !== YEAR_STATUS.CLOSED;
export const canManageAgeGroups = isPrincipal;

/** Rooms (PROPOSED, outside SRS): Principal manages; a Vice Principal views the rooms of the assigned campus. */
/** Phòng ban: Hiệu trưởng toàn quyền; PHT theo quyền "Quản lý phòng ban" được giao (mặc định chỉ xem campus mình). */
// action: 'create' thêm phòng, 'update' sửa, 'delete' ngừng dùng / dùng lại / xóa; true = có ít nhất 1 thao tác ghi
export const canManageRooms = (user, campusId, action = true) => areaAllows(user, 'rooms', campusId, action);
export const canViewRooms = (user) =>
  isPrincipal(user) || (isVicePrincipal(user) && areaAccess(user, 'rooms').access !== PERMISSION_ACCESS.NONE);
/** Điểm trường có phòng mà người dùng xem / sửa được. */
export const roomCampusIds = (user, campuses, need = false) =>
  campuses.filter((c) => areaAllows(user, 'rooms', c.id, need)).map((c) => c.id);

/** UC 2.7 / GBR-CFG-03. */
export const canConfigureCutoff = isPrincipal;

/** "Campus – Create / Edit": Principal only. */
export const canManageCampus = isPrincipal;
/** Campus view is not in the matrix: assumed Principal (all) and Vice Principal (own campus). */
export const canViewCampus = (campus, user) => isPrincipal(user) || (isVicePrincipal(user) && campus?.id === user.campusId);
export const canListCampuses = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL);

/** "Permission – Assign to Vice Principal": Principal only. */
export const canAssignVicePrincipal = isPrincipal;

/**
 * Level of one permission for the signed-in user. Principal always FULL; a Vice Principal's own area of responsibility
 * (Vice Principal Assignment) wins over the role grant (Role & Permission screen).
 */
export const permissionLevel = (user, code) => {
  if (!user) return 'NONE';
  if (isPrincipal(user)) return 'FULL';
  const area = VP_AREAS.find((a) => a.code === code);
  if (area && user.areas?.[area.key]) return user.areas[area.key];
  return user.permissions?.[code] || 'NONE';
};

/** { access, scope } of a Vice Principal's area (menu, teacherAssignment, facility). Principal: EDIT whole school. */
export const areaAccess = (user, key) => {
  if (isPrincipal(user)) return parseAreaGrant(`EDIT@${AREA_SCOPE_ALL}`);
  if (!isVicePrincipal(user)) return parseAreaGrant(PERMISSION_LEVEL.NONE);
  const value = user.areas ? user.areas[key] : defaultVpAreas({ sharedService: user.sharedService }, user.permissions)[key];
  return parseAreaGrant(value, user.campusId);
};
/**
 * Area usable on the campus. need: false = Xem; true = có ít nhất 1 thao tác Thêm / Sửa / Xóa;
 * 'create' | 'update' | 'delete' = đúng thao tác đó.
 */
export const areaAllows = (user, key, campusId, need = false) => {
  const a = areaAccess(user, key);
  if (a.access === PERMISSION_ACCESS.NONE) return false;
  if (need === true && a.access !== PERMISSION_ACCESS.EDIT) return false;
  if (typeof need === 'string' && !a.actions[need]) return false;
  return a.scope === PERMISSION_SCOPE.ALL || !campusId || campusId === a.campusId;
};

/** { access: NONE | VIEW | EDIT, scope: ALL | CAMPUS } of one permission for the signed-in user. */
export const permissionAccess = (user, code) => {
  const area = VP_AREAS.find((a) => a.code === code);
  if (area && isVicePrincipal(user) && user.areas) return areaAccess(user, area.key);
  return parseAreaGrant(permissionLevel(user, code), user?.campusId);
};

const inScope = ({ scope, campusId: granted }, campusId, user) =>
  !!campusId && (scope === PERMISSION_SCOPE.ALL || (granted || user.campusId) === campusId);

/**
 * "Phân công giáo viên" follows the Role & Permission screen (tổ trưởng: quyền riêng bên dưới):
 * NONE = no menu / page; VIEW = see assignments read only; EDIT = assign. Scope ALL = every campus, CAMPUS = own campus.
 */
export const ASSIGN_TEACHER = 'permission.assignTeacher';
/** Màn "Phân công giáo viên" mở khi có quyền phân công giáo viên hoặc phân công tổ trưởng (mỗi phần hiện theo quyền riêng). */
export const canOpenTeacherAssignment = (user) =>
  permissionAccess(user, ASSIGN_TEACHER).access !== PERMISSION_ACCESS.NONE || canViewTeamLeaders(user);
export const canViewTeacherAssignments = (campusId, user) => {
  const p = permissionAccess(user, ASSIGN_TEACHER);
  return p.access !== PERMISSION_ACCESS.NONE && inScope(p, campusId, user);
};
/** action: 'create' phân công mới, 'update' đổi, 'delete' gỡ tổ trưởng; true = có ít nhất 1 thao tác ghi. */
export const canAssignTeachers = (campusId, user, action = true) => {
  const p = permissionAccess(user, ASSIGN_TEACHER);
  const ok = action === true ? p.access === PERMISSION_ACCESS.EDIT : !!p.actions?.[action];
  return ok && inScope(p, campusId, user);
};

/**
 * Tổ trưởng nhóm tuổi: 1 người cho cả trường mỗi năm học (người dùng chốt 14/10/2026).
 * Hiệu trưởng luôn được; PHT theo quyền riêng "Phân công tổ trưởng nhóm tuổi" (tách khỏi phân công giáo viên, chốt 14/10/2026).
 */
export function canViewTeamLeaders(user) {
  return areaAccess(user, 'teamLeaders').access !== PERMISSION_ACCESS.NONE;
}
export const teamLeaderActions = (user) => {
  const p = areaAccess(user, 'teamLeaders');
  return Object.fromEntries(['create', 'update', 'delete'].map((k) => [k, !!p.actions?.[k]]));
};

/** Thao tác phân công được làm ở điểm trường: { create, update, delete }. */
export const teacherAssignActions = (campusId, user) =>
  Object.fromEntries(['create', 'update', 'delete'].map((k) => [k, canAssignTeachers(campusId, user, k)]));
/** Lớp chưa có giáo viên cần Thêm; đã có cần Sửa. */
export const canAssignClass = (cls, user) => !!cls && canAssignTeachers(cls.campusId, user, cls.teacherIds?.length ? 'update' : 'create');
/** Tổ trưởng: chọn người khi nhóm chưa có cần Thêm; đổi người cần Sửa; bỏ trống (gỡ) cần Xóa. */
export const leaderOptionAllowed = (acts, current, userId) => {
  if ((userId || '') === (current || '')) return true;
  if (!userId) return acts.delete;
  return current ? acts.update : acts.create;
};

/** Staff accounts (SRS 4.4 "User account – Create / Edit / Deactivate", footnote 8: Principal, to confirm). */
export const canManageStaff = isPrincipal;
/** Hồ sơ nhân sự: Hiệu trưởng toàn quyền; PHT theo quyền "Hồ sơ nhân sự" được giao (Chỉ xem / Được sửa, theo điểm trường). */
export const canViewStaff = (user) =>
  isPrincipal(user) || (isVicePrincipal(user) && areaAccess(user, 'staff').access !== PERMISSION_ACCESS.NONE);
/** Nhân sự PHT được sửa hồ sơ: giáo viên, tổ trưởng, nhân viên bếp của điểm trường trong phạm vi (không gồm BGH). */
export const STAFF_PROFILE_ROLES = [ROLES.TEACHER, ROLES.TEAM_LEADER, ROLES.KITCHEN_STAFF];
export const canEditStaffProfile = (target, user) =>
  isPrincipal(user) ||
  (isVicePrincipal(user) && !!target && STAFF_PROFILE_ROLES.includes(target.role) && areaAllows(user, 'staff', target.campusId, 'update'));

/** UC 2.4 Manage Permission: Principal only. */
export const canManageRolePermissions = isPrincipal;
