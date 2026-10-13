import { ROLES } from '@/models/User';
import { CHILD_STATUS } from '@/models/School';
import { PERMISSION_ACCESS, PERMISSION_SCOPE } from '@/models/school-config/schoolConfigConstants';
import { areaAccess, areaAllows } from '@/utils/school-config/schoolConfigPermissions';

/*
 * Who may do what with child records (SRS 4.4 Permission Matrix, rows "Child enrollment & health declaration",
 * "Children list & child profile", "Child health measurement", "Child health record & trend").
 * Used to hide buttons AND re-checked in the mock repository. Teacher / Team Leader acting as a teacher:
 * only children of a class they are assigned to (footnote ²); Vice Principal: per-VP "Hồ sơ trẻ" right
 * (Không có / Chỉ xem / Sửa, campus mình hoặc toàn trường; mặc định sửa campus mình) set by the Principal.
 */

export const isPrincipal = (user) => user?.role === ROLES.PRINCIPAL;
export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;
export const isTeacherRole = (user) => [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role);

export const teachesClass = (cls, user) => !!cls && isTeacherRole(user) && (cls.teacherIds || []).includes(user.id);

/** Routes / menu: roles that may open the children list at all. */
export const CHILDREN_VIEW_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.TEAM_LEADER];

export const canViewChildren = (user) =>
  isVicePrincipal(user) ? areaAccess(user, 'children').access !== PERMISSION_ACCESS.NONE : CHILDREN_VIEW_ROLES.includes(user?.role);
/** VP được giao "Hồ sơ trẻ" toàn trường: hiện bộ lọc / cột điểm trường như Hiệu trưởng. */
export const seesAllCampusChildren = (user) =>
  isPrincipal(user) || (isVicePrincipal(user) && areaAccess(user, 'children').scope === PERMISSION_SCOPE.ALL);

/** Profile, health record and health trend share the same view scope. */
export const canViewChild = (child, user, cls) => {
  if (!child || !user) return false;
  if (isPrincipal(user)) return true;
  if (isVicePrincipal(user)) return areaAllows(user, 'children', child.campusId);
  return teachesClass(cls, user);
};

export const canViewHealth = canViewChild;

/** Account details (username, SMS) are only for the enrolling management roles. */
export const canViewParentAccounts = (user) => isPrincipal(user) || isVicePrincipal(user);

/* ---- Vice Principal of the child's campus (UC 3.8, 3.9, 3.10, 5.2) ---- */
// Thêm = tiếp nhận trẻ mới; Sửa = sửa hồ sơ, xếp lớp, khai báo sức khỏe, kích hoạt phụ huynh
export const canEnrollChild = (user) => isVicePrincipal(user) && !!areaAccess(user, 'children').actions?.create;

const vpOfCampus = (child, user) => isVicePrincipal(user) && !!child && areaAllows(user, 'children', child.campusId, 'update');

export const canEditChild = (child, user) => vpOfCampus(child, user) && child.status !== CHILD_STATUS.LEFT;
export const canPlaceChild = canEditChild;
export const canDeclareHealth = canEditChild;
export const canActivateParent = canEditChild;

/** Food allergies are confirmed only by the Principal (GBR-HLT-03, data rule "Allergies are confirmed by the Principal"). */
export const canConfirmAllergies = (child, user) => isPrincipal(user) && !!child && child.status !== CHILD_STATUS.LEFT;

/* ---- Class teacher (UC 5.3; Principal and VP have "No" for Record / Edit in the matrix) ---- */
export const canRecordMeasurement = (child, user, cls) =>
  !!child && child.status === CHILD_STATUS.ACTIVE && child.classId === cls?.id && teachesClass(cls, user);

export const canEditMeasurement = canRecordMeasurement;
export const canPublishMeasurement = canRecordMeasurement;
