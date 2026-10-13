import { ATTENDANCE_STATUS, MEAL_SESSIONS, isAbsent } from '@/models/attendance/attendanceConstants';
import { isIsoDate } from '@/utils/format';
import { schoolToday } from '@/utils/attendance/attendanceTime';

/**
 * One child's entry: { status, meals }. `sessions` = meal sessions of the class's age group.
 * Returns { field: message }.
 */
export const validateAttendanceEntry = (entry, { sessions = MEAL_SESSIONS } = {}) => {
  const errors = {};
  if (!Object.values(ATTENDANCE_STATUS).includes(entry?.status)) {
    errors.status = 'Chọn trạng thái điểm danh.';
    return errors;
  }
  const taken = Object.keys(entry.meals || {}).filter((s) => entry.meals[s]);
  if (taken.some((s) => !sessions.includes(s))) errors.meals = 'Bữa ăn không thuộc nhóm tuổi của lớp. Chọn lại bữa ăn.';
  // GBR-ATT-03 / MSG26: an absent child cannot take a meal.
  else if (isAbsent(entry.status) && taken.length) errors.meals = 'Trẻ vắng mặt không thể đăng ký suất ăn.';
  return errors;
};

/** Validates every entry; returns { [childId]: { field: message } } for the invalid ones only. */
export const validateClassAttendance = (entries, { sessions } = {}) =>
  Object.fromEntries(
    entries.map((e) => [e.childId, validateAttendanceEntry(e, { sessions })]).filter(([, errs]) => Object.keys(errs).length > 0),
  );

export const validateMealCorrection = ({ session, note } = {}) => {
  const errors = {};
  if (!MEAL_SESSIONS.includes(session)) errors.session = 'Chọn bữa ăn cần hủy.';
  if (!String(note || '').trim()) errors.note = 'Nhập lý do điều chỉnh (ví dụ: trẻ về sớm vì mệt).';
  return errors;
};

const isCount = (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && String(v).trim() !== '';

/** Teacher's check of servings received from the kitchen (UC 6.26). */
export const validateHandoverCheck = ({ normal, substitute, note } = {}, expected = {}, { shortage = false } = {}) => {
  const errors = {};
  if (!isCount(normal)) errors.normal = 'Nhập số suất thường đã nhận (số nguyên ≥ 0).';
  if (!isCount(substitute)) errors.substitute = 'Nhập số suất thay thế đã nhận (số nguyên ≥ 0).';
  if (Object.keys(errors).length) return errors;
  const short = Number(normal) < expected.normal || Number(substitute) < expected.substitute;
  if (shortage) {
    if (!short) errors.normal = 'Số suất nhận đủ – hãy xác nhận nhận suất thay vì báo thiếu.';
    if (!String(note || '').trim()) errors.note = 'Nhập ghi chú về số suất bị thiếu.';
  } else if (short) {
    errors.normal = 'Số suất nhận ít hơn số cần nhận. Hãy báo thiếu suất để bếp bổ sung.';
  }
  return errors;
};

export const validateSummaryRange = ({ from, to }) => {
  const errors = {};
  if (!from) errors.from = 'Chọn ngày bắt đầu.';
  if (!to) errors.to = 'Chọn ngày kết thúc.';
  if (from && !isIsoDate(from)) errors.from = 'Nhập ngày bắt đầu hợp lệ theo dd/mm/yyyy.';
  if (to && !isIsoDate(to)) errors.to = 'Nhập ngày kết thúc hợp lệ theo dd/mm/yyyy.';
  if (!errors.from && !errors.to) {
    if (from > to) errors.to = 'Ngày kết thúc phải từ ngày bắt đầu trở đi.';
    else if (to > schoolToday()) errors.to = 'Không chọn ngày trong tương lai.';
  }
  return errors;
};
