import { ROLES } from '@/models/User';
import { MEAL_COUNT_STATUS, HANDOVER_STATUS } from '@/models/attendance/attendanceConstants';

/*
 * Follows SRS 4.4 Permission Matrix:
 *  - Attendance & meal participation, Record/Edit: Teacher and Team Leader acting as teacher, own class only, before the cut-off (²,⁶).
 *  - Attendance & meal participation, View: Principal full, Vice Principal own campus (¹), Teacher/Team Leader own class (²).
 *  - Meal count by class, View: Principal full, Vice Principal own campus, Kitchen Staff own campus read-only (⁵).
 *  - Confirm meal count: Vice Principal of the campus (UC 6.10, GBR-ATT-06).
 *  - Meal handover: Teacher of the class confirms, Kitchen Staff of the campus supplements (UC 6.26).
 */

export const isClassTeacher = (cls, user) =>
  !!cls && [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role) && (cls.teacherIds || []).includes(user.id);

export const canRecordAttendance = (cls, user) => isClassTeacher(cls, user);

export const canViewAttendance = (cls, user) => {
  if (!cls || !user) return false;
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

export const canConfirmMealCount = (count, user) =>
  user?.role === ROLES.VICE_PRINCIPAL && count?.campusId === user.campusId && count?.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION;

/** After the lock, a teacher may only cancel a meal of today (child sent home); never add one (GBR-ATT-08). */
export const canCorrectMealAfterLock = (cls, user) => isClassTeacher(cls, user);

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
