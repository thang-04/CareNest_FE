// G94-180/CHD-14 (BE:docs/business/BUSINESS_RULES.md): ngày bắt đầu đi học, ngày vào lớp, ngày chuyển lớp phải là
// ngày học. Ở UI chỉ để chọn ngày mặc định và báo lỗi sớm; BE kiểm lại và trả lỗi theo ô. Ngày dạng 'YYYY-MM-DD'.
import { addDays, formatDate } from '@/utils/format';

const ddmmyyyy = formatDate;

export const SCHOOL_DAY_HINT = 'thứ 2 tới thứ 6, không trùng ngày nghỉ của trường';

export const isWeekend = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
};

/** Đợt nghỉ chứa ngày `iso` ({ startDate, endDate, name }), không có ⇒ null. */
export const holidayOf = (iso, holidays = []) => (holidays || []).find((h) => h.startDate <= iso && iso <= h.endDate) || null;

export const isSchoolDay = (iso, holidays = []) => !!iso && !isWeekend(iso) && !holidayOf(iso, holidays);

/** Ngày học đầu tiên từ `from` (không quá `max` nếu có); không có ⇒ `from`. */
export function firstSchoolDay(from, holidays = [], max) {
  if (!from) return '';
  let day = from;
  for (let i = 0; i < 400 && (!max || day <= max); i += 1) {
    if (isSchoolDay(day, holidays)) return day;
    day = addDays(day, 1);
  }
  return from;
}

/** Mặc định: năm đang học = ngày học gần nhất từ hôm nay; năm sau = ngày học đầu tiên từ ngày bắt đầu năm HT cấu hình. */
export const defaultStartDate = (year, today, holidays = []) =>
  year ? firstSchoolDay(year.status === 'PLANNED' ? year.startDate : today, holidays, year.endDate) : '';

/** Câu lỗi ô "Ngày bắt đầu đi học" (tiếp nhận, mở lại hồ sơ, nhập Excel), cùng câu BE; '' khi hợp lệ. */
export function startDateError(value, year, today, holidays = []) {
  if (!value) return 'Chọn ngày bắt đầu đi học';
  if (year?.status === 'PLANNED') {
    if ((year.startDate && value < year.startDate) || (year.endDate && value > year.endDate)) {
      return 'Ngày bắt đầu phải nằm trong thời gian năm học đã chọn';
    }
  } else {
    if (value < today) return 'Ngày bắt đầu đi học không được trước hôm nay';
    if (year?.endDate && value > year.endDate) {
      return `Ngày bắt đầu đi học không được sau ngày kết thúc năm học (${ddmmyyyy(year.endDate)})`;
    }
  }
  if (!isSchoolDay(value, holidays)) return `Ngày bắt đầu đi học phải là ngày học (${SCHOOL_DAY_HINT})`;
  return '';
}

/**
 * Câu lỗi ô ngày ở hộp Xếp lớp / Chuyển lớp (BE `ChildRecordServiceImpl.effectiveDateProblem`): không trước `earliest`
 * (hôm nay, hoặc ngày bắt đầu đi học khi xếp lần đầu), không sau ngày kết thúc năm, là ngày học; '' khi hợp lệ.
 */
export function placementDateError(value, { earliest, today, yearEnd, holidays = [], transfer = false }) {
  const label = transfer ? 'Ngày chuyển lớp' : 'Ngày vào lớp';
  if (!value) return `Chọn ${label.toLowerCase()}`;
  if (earliest && value < earliest) {
    return earliest === today
      ? `${label} không được trước hôm nay`
      : `${label} không được trước ngày bắt đầu đi học (${ddmmyyyy(earliest)})`;
  }
  if (yearEnd && value > yearEnd) return `${label} không được sau ngày kết thúc năm học (${ddmmyyyy(yearEnd)})`;
  if (!isSchoolDay(value, holidays)) return `${label} phải là ngày học (${SCHOOL_DAY_HINT})`;
  return '';
}

/** Mốc sớm nhất của ngày vào lớp: xếp lần đầu không trước ngày bắt đầu đi học; chuyển lớp từ hôm nay. */
export const earliestPlacementDate = (child, today) =>
  !child?.classId || isNotStarted(child) ? (child?.startDate && child.startDate > today ? child.startDate : today) : today;

/** Lớp hiển thị chưa bắt đầu (trẻ mới tiếp nhận / mới xếp vào lớp từ ngày tương lai). */
export const isNotStarted = (child) => !!child?.nextClass && child.nextClass.classId === child.classId;

/** Đang có lịch chuyển sang lớp khác (trẻ vẫn ở lớp hiện tại tới hết ngày trước `nextClass.from`). */
export const hasScheduledTransfer = (child) => !!child?.nextClass && child.nextClass.classId !== child.classId;

export const scheduledTransferLabel = (child) =>
  hasScheduledTransfer(child) ? `Sẽ chuyển sang ${child.nextClass.className} từ ${ddmmyyyy(child.nextClass.from)}` : '';

export const notStartedLabel = (child) => (isNotStarted(child) ? `từ ${ddmmyyyy(child.nextClass.from)}` : '');
