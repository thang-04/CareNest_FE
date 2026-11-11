import { ROLES } from '@/models/User';
import { CHILD_STATUS } from '@/models/School';
import { PERMISSION_ACCESS, PERMISSION_SCOPE } from '@/models/school-config/schoolConfigConstants';
import { areaAccess, areaAllows } from '@/utils/school-config/schoolConfigPermissions';
import { PERMISSIONS } from '@/models/bePermissions';

/*
 * Who may do what with child records (SRS 4.4 Permission Matrix, rows "Child enrollment & health declaration",
 * "Children list & child profile", "Child health measurement", "Child health record & trend").
 * Used to hide buttons AND re-checked in the mock repository. Teacher / Team Leader acting as a teacher:
 * only children of a class they are assigned to (footnote ²); Vice Principal: per-VP "Hồ sơ trẻ" right
 * (Không có / Chỉ xem / Sửa, campus mình hoặc toàn trường; mặc định sửa campus mình) set by the Principal.
 * Principal: như PHT được Thêm + Sửa toàn trường (areaAccess) — tiếp nhận trẻ như PHT (user chốt 2026-10-27, PROPOSED — chờ BE).
 */

export const isPrincipal = (user) => user?.role === ROLES.PRINCIPAL;
export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;
export const isTeacherRole = (user) => [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role);

// Người dùng BE: mỗi việc theo đúng mã quyền, sửa chỉ ở điểm trường phụ trách (HT mọi điểm trường); bản demo theo mảng
const BE_CHILD_CODES = {
  create: [PERMISSIONS.CHILD_ENROLL],
  update: [PERMISSIONS.CHILD_PROFILE_EDIT],
  place: [PERMISSIONS.CHILD_PLACEMENT],
  parent: [PERMISSIONS.PARENT_ACCOUNT_MANAGE],
};
const isBeUser = (user) => Array.isArray(user?.bePermissions);
const ownsCampus = (user, campusId) => (user.locationIds || []).map(String).includes(String(campusId));
const childCan = (user, task, campusId) => {
  if (!isBeUser(user)) return areaAllows(user, 'children', campusId, task === 'create' ? 'create' : 'update');
  if (!isPrincipal(user) && !isVicePrincipal(user)) return false;
  if (!BE_CHILD_CODES[task].some((code) => user.bePermissions.includes(code))) return false;
  return isPrincipal(user) || !campusId || ownsCampus(user, campusId);
};

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
  if (isVicePrincipal(user)) return isBeUser(user) || areaAllows(user, 'children', child.campusId);
  return teachesClass(cls, user);
};

export const canViewHealth = canViewChild;

/** Account details (username, SMS) are only for the enrolling management roles. */
export const canViewParentAccounts = (user) => isPrincipal(user) || isVicePrincipal(user);

/* ---- Hiệu trưởng, Phó hiệu trưởng của điểm trường của trẻ (UC 3.8, 3.9, 3.10, 5.2) ---- */
// Thêm = tiếp nhận trẻ mới; Sửa = sửa hồ sơ, xếp lớp, khai báo sức khỏe, kích hoạt phụ huynh
export const canEnrollChild = (user) => (isBeUser(user) ? childCan(user, 'create') : !!areaAccess(user, 'children').actions?.create);

const managesChild = (child, user, task = 'update') => !!child && childCan(user, task, child.campusId);

// Sửa hồ sơ, cho nghỉ học (quyết định user 2026-10-14), xếp lớp: Phó hiệu trưởng điểm trường của trẻ hoặc Hiệu trưởng.
export const canEditChild = (child, user) => managesChild(child, user) && child.status !== CHILD_STATUS.LEFT;
export const canWithdrawChild = (child, user) => managesChild(child, user, 'place') && child.status !== CHILD_STATUS.LEFT;
export const canPlaceChild = canWithdrawChild;
/** Màn Xếp lớp; từng trẻ theo canPlaceChild. */
export const canOpenPlacement = (user) => isPrincipal(user) || isVicePrincipal(user);
// Mở lại hồ sơ trẻ đã nghỉ học: quyền tiếp nhận (Thêm) ở điểm trường của trẻ — Hiệu trưởng hoặc PHT điểm trường đó
// (user chốt 2026-10-23, 2026-10-27; CHD-01, L-01 A: cùng nhóm tiếp nhận, không cần quyền Sửa).
export const canReadmitChild = (child, user) => !!child && child.status === CHILD_STATUS.LEFT && childCan(user, 'create', child.campusId);
/** Điểm trường được tiếp nhận ('create') / xếp lớp ('update') trẻ vào: Hiệu trưởng mọi điểm trường, PHT theo "Hồ sơ trẻ". */
export const childCampusesOf = (user, campuses = [], action = 'create') =>
  campuses.filter((c) => c.status !== 'INACTIVE' && childCan(user, action === 'create' ? 'create' : 'place', c.id));
// Tiền sử nằm ở khai báo nên sửa cùng quyền với Sửa hồ sơ: Hiệu trưởng hoặc Phó hiệu trưởng điểm trường (user chốt 2026-10-22).
export const canDeclareHealth = canEditChild;
// Kích hoạt tài khoản phụ huynh (gửi mật khẩu tạm qua SMS): Hiệu trưởng toàn trường hoặc Phó hiệu trưởng điểm trường của trẻ
// (user chốt 2026-10-23, PROPOSED — chờ BE).
export const canActivateParent = (child, user) => managesChild(child, user, 'parent') && child.status !== CHILD_STATUS.LEFT;
/** Như canActivateParent cho trẻ chưa có hồ sơ (bước Xem lại khi tiếp nhận): lưu form tiếp nhận sẽ kích hoạt phụ huynh. */
export const canActivateParentsAt = (campusId, user) => childCan(user, 'parent', campusId);
/** Tra tài khoản phụ huynh theo CCCD: ai tiếp nhận (Thêm) hoặc sửa hồ sơ trẻ (Sửa) — cả hai form đều hiện tài khoản trùng CCCD. */
export const canLookupParentAccounts = (user) => {
  if (isBeUser(user)) return childCan(user, 'create') || childCan(user, 'update') || childCan(user, 'parent');
  const { actions } = areaAccess(user, 'children');
  return !!(actions?.create || actions?.update);
};

/* ---- Class teacher (UC 5.3; Principal and VP have "No" for Record / Edit in the matrix) ---- */
export const canRecordMeasurement = (child, user, cls) =>
  !!child && child.status === CHILD_STATUS.ACTIVE && child.classId === cls?.id && teachesClass(cls, user);

export const canEditMeasurement = canRecordMeasurement;

/*
 * Đợt khám, kỳ cân đo (user chốt 2026-10-31, PROPOSED): Hiệu trưởng mọi điểm trường, PHT điểm trường của mình; giáo viên xem.
 * Không nêu campusId ⇒ có điểm trường nào quản lý được không (ẩn/hiện nút Tạo).
 */
export const canManageHealthCheck = (user, campusId) =>
  isPrincipal(user) || (isVicePrincipal(user) && !!user.campusId && (!campusId || user.campusId === campusId));

export const canViewHealthChecks = (user) => isPrincipal(user) || isVicePrincipal(user) || isTeacherRole(user);
