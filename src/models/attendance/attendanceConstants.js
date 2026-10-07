/**
 * Attendance & meal reporting (SRS screens #64–#68, UC 6.10, 6.13–6.16, 6.26, BF-04, BF-09).
 *
 * @typedef {Object} AttendanceRecord   one per child per school day (GBR-ATT-01)
 * @property {string} id
 * @property {string} date               yyyy-mm-dd
 * @property {string} childId
 * @property {string} classId
 * @property {string} campusId
 * @property {'PRESENT'|'EXCUSED'|'UNEXCUSED'} status
 * @property {Record<string, boolean>} meals   participation per meal session (stored separately by the backend)
 * @property {string} recordedBy
 * @property {string} recordedAt
 * @property {{ at: string, userId: string, action: string, note?: string }[]} history
 *
 * @typedef {Object} MealCount           one per campus, date and meal session
 * @property {string} id
 * @property {string} campusId
 * @property {string} date
 * @property {string} session
 * @property {'PENDING_CONFIRMATION'|'CONFIRMED'} status
 * @property {{ classId: string, className: string, present: number, absent: number, missing: number, normal: number, substitute: number }[]} classes
 * @property {{ at: string, userId: string, classId: string, childId: string, normal: number, substitute: number, note: string }[]} adjustments
 *
 * @typedef {Object} MealHandover        one per class, date and meal session (UC 6.26)
 * @property {string} id
 * @property {'READY'|'SHORTAGE_REPORTED'|'SUPPLEMENTED'|'CONFIRMED'} status
 */

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  EXCUSED: 'EXCUSED',
  UNEXCUSED: 'UNEXCUSED',
};

// GBR-ATT-01: fixed list, no "late" status.
export const ATTENDANCE_STATUS_LABELS = {
  PRESENT: 'Có mặt',
  EXCUSED: 'Vắng có phép',
  UNEXCUSED: 'Vắng không phép',
};

export const ATTENDANCE_STATUS_SHORT = { PRESENT: 'Có mặt', EXCUSED: 'Có phép', UNEXCUSED: 'Không phép' };

export const isAbsent = (status) => status === ATTENDANCE_STATUS.EXCUSED || status === ATTENDANCE_STATUS.UNEXCUSED;

/* The SRS does not name the meal sessions; assumed: lunch and afternoon meal (to confirm with the school). */
export const MEAL_SESSION = { LUNCH: 'LUNCH', AFTERNOON: 'AFTERNOON' };
export const MEAL_SESSIONS = [MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON];
export const MEAL_SESSION_LABELS = { LUNCH: 'Bữa trưa', AFTERNOON: 'Bữa chiều' };

export const allMeals = (value) => Object.fromEntries(MEAL_SESSIONS.map((s) => [s, value]));

/*
 * Default cut-off. School configuration (#19, UC 2.7, GBR-CFG-02) owns the real value;
 * the repository reads db.cutoffSettings when it exists and falls back to this constant.
 */
export const DEFAULT_CUTOFF_TIME = '08:45';
export const SCHOOL_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export const MEAL_COUNT_STATUS = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
};

export const MEAL_COUNT_STATUS_LABELS = {
  OPEN: 'Đang nhận báo ăn',
  PENDING_CONFIRMATION: 'Chờ Phó hiệu trưởng xác nhận',
  CONFIRMED: 'Đã xác nhận',
};

export const HANDOVER_STATUS = {
  WAITING_KITCHEN: 'WAITING_KITCHEN',
  READY: 'READY',
  SHORTAGE_REPORTED: 'SHORTAGE_REPORTED',
  SUPPLEMENTED: 'SUPPLEMENTED',
  CONFIRMED: 'CONFIRMED',
};

export const HANDOVER_STATUS_LABELS = {
  WAITING_KITCHEN: 'Chờ bếp chuẩn bị',
  READY: 'Chờ lớp nhận suất',
  SHORTAGE_REPORTED: 'Thiếu suất – chờ bếp bổ sung',
  SUPPLEMENTED: 'Bếp đã bổ sung – chờ kiểm lại',
  CONFIRMED: 'Đã nhận đủ',
};

export const SUMMARY_MAX_DAYS = 31;

/** A child with a recorded allergy gets a substitute serving (GBR-MEAL-03, GBR-CP-02). */
export const needsSubstitute = (child) => (child?.allergies || []).length > 0;
