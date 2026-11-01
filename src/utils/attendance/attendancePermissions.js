import { ROLES } from '@/models/User';
import { MEAL_COUNT_STATUS, HANDOVER_STATUS } from '@/models/attendance/attendanceConstants';

/*
 * Follows SRS 4.4 Permission Matrix:
 *  - Attendance & meal participation, Record/Edit: Teacher and Team Leader acting as teacher, own class only, before the cut-off (²,⁶).
 *  - Attendance & meal participation, View: Principal full, Vice Principal own campus (¹), Teacher/Team Leader own class (²).
 *  - Meal count by class, View: Principal full, Vice Principal own campus, Kitchen Staff own campus read-only (⁵).
 *  - Confirm meal count: Vice Principal of the campus (UC 6.10, GBR-ATT-06). Adjust substitute servings only, with reason: VP of the campus (NUT-02).
 *  - Meal handover: Teacher of the class confirms, Kitchen Staff of the campus supplements (UC 6.26).
 */

// Lớp từ BE (điểm danh đợt 1) có cờ teaches / canRecord / canUnlock: dùng cờ thay cho so id người dùng.
// teaches = được phân công lớp (cả năm đã kết thúc, chỉ xem); ghi được hay không theo canRecord của sổ điểm danh
export const isClassTeacher = (cls, user) =>
  !!cls &&
  [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role) &&
  (typeof cls.teaches === 'boolean' ? cls.teaches : (cls.teacherIds || []).includes(user.id));

export const canRecordAttendance = (cls, user) => isClassTeacher(cls, user);

// BA: Hiệu trưởng cấu hình giờ chốt và thời hạn mở lại; chỉ Phó hiệu trưởng của campus thực hiện mở lại
// Cần chốt 21/10/2026: Hiệu trưởng mở lại được lớp ở cả 2 điểm trường; PHT chỉ lớp điểm trường mình
export const canUnlockAttendanceDay = (cls, user) =>
  typeof cls?.canUnlock === 'boolean'
    ? cls.canUnlock
    : !!cls && (user?.role === ROLES.PRINCIPAL || (user?.role === ROLES.VICE_PRINCIPAL && cls.campusId === user.campusId));

export const canViewAttendance = (cls, user) => {
  if (!cls || !user) return false;
  // BE chỉ trả lớp trong phạm vi người dùng
  if (typeof cls.canRecord === 'boolean') return true;
  if (user.role === ROLES.PRINCIPAL) return true;
  if (user.role === ROLES.VICE_PRINCIPAL) return cls.campusId === user.campusId;
  return isClassTeacher(cls, user);
};

/** Roles that can open the class attendance summary (#66). */
export const canOpenAttendanceSummary = (user) =>
  [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role);

export const canViewMealCounts = (user) => [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF].includes(user?.role);

export const canViewMealCount = (count, user) => {
  if (!count || !canViewMealCounts(user)) return false;
  if (user.role === ROLES.PRINCIPAL) return true;
  if (count.campusId !== user.campusId) return false;
  // Kitchen Staff only work from confirmed figures (GBR-ATT-06, GBR-MEAL-01).
  return user.role !== ROLES.KITCHEN_STAFF || count.status === MEAL_COUNT_STATUS.CONFIRMED;
};

// NUT-02 (Cần chốt 27/10/2026): HT xác nhận mọi điểm trường, PHT điểm trường mình; chỉ PHT điểm trường sửa số suất
const leadsCampus = (campusId, user) => user?.role === ROLES.VICE_PRINCIPAL && campusId === user.campusId;
const confirmsCampus = (campusId, user) => user?.role === ROLES.PRINCIPAL || leadsCampus(campusId, user);

// BE trả cờ canConfirm / canAdjust (theo phân công + năm học); mock không có cờ thì xét theo vai trò
export const canConfirmMealCount = (count, user) =>
  count?.canConfirm ?? (confirmsCampus(count?.campusId, user) && count?.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION);

/** Cảnh báo "cần xác nhận lại" chỉ cho người duyệt; bếp chỉ thấy số đã xác nhận. */
export const canSeeMealReconfirmNotice = (user) => !!user && user.role !== ROLES.KITCHEN_STAFF;

/** NUT-02: điều chỉnh suất thay thế từng lớp (ghi lý do): sau giờ khóa, cả khi đã xác nhận (chuyển sang chờ xác nhận lại). */
export const canAdjustMealCount = (count, user) =>
  (count?.canAdjust ?? true) &&
  !!count?.id &&
  leadsCampus(count.campusId, user) &&
  [MEAL_COUNT_STATUS.PENDING_CONFIRMATION, MEAL_COUNT_STATUS.CONFIRMED].includes(count.status);

export const canOpenMealHandover = (user) => [ROLES.TEACHER, ROLES.TEAM_LEADER, ROLES.KITCHEN_STAFF].includes(user?.role);

export const canViewHandover = (handover, cls, user) => {
  if (!handover || !user) return false;
  if (user.role === ROLES.KITCHEN_STAFF) return handover.campusId === user.campusId;
  return isClassTeacher(cls, user);
};

export const canReceiveHandover = (handover, cls, user) =>
  isClassTeacher(cls, user) && [HANDOVER_STATUS.READY, HANDOVER_STATUS.SUPPLEMENTED].includes(handover?.status);

export const canSupplementHandover = (handover, user) =>
  user?.role === ROLES.KITCHEN_STAFF && handover?.campusId === user.campusId && handover?.status === HANDOVER_STATUS.SHORTAGE_REPORTED;
