import { isIsoDate } from '@/utils/format';

// Đợt nghỉ dài nhất BE cho phép (SCH-05, SchoolYearServiceImpl.HOLIDAY_MAX_DAYS)
export const HOLIDAY_MAX_DAYS = 31;

const dayCount = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

/** Số ngày thứ 2–6 trong đợt nghỉ (ngày học được nghỉ), chỉ để hiển thị. */
export const holidayDays = ({ startDate, endDate }) => {
  let n = 0;
  // Đếm theo UTC để không lệch ngày vì múi giờ
  for (let t = Date.parse(startDate); t <= Date.parse(endDate); t += 86400000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
};

/** Hỗ trợ nhập liệu đợt nghỉ (BE kiểm lại): đủ ô, từ ≤ đến, trong năm học, không quá dài, không chồng đợt đã có. */
export function validateHoliday(draft, year, existing = []) {
  const e = {};
  if (!isIsoDate(draft.startDate)) e.startDate = 'Chọn ngày bắt đầu';
  if (!isIsoDate(draft.endDate)) e.endDate = 'Chọn ngày kết thúc';
  if (!draft.name?.trim()) e.name = 'Nhập tên đợt nghỉ';
  if (e.startDate || e.endDate) return e;
  if (draft.endDate < draft.startDate) e.endDate = 'Ngày kết thúc không được trước ngày bắt đầu';
  else if (draft.startDate < year.startDate || draft.endDate > year.endDate) e.startDate = 'Đợt nghỉ phải nằm trong năm học';
  else if (dayCount(draft.startDate, draft.endDate) > HOLIDAY_MAX_DAYS) e.endDate = `Một đợt nghỉ tối đa ${HOLIDAY_MAX_DAYS} ngày`;
  else {
    const clash = existing.find((h) => draft.startDate <= h.endDate && draft.endDate >= h.startDate);
    if (clash) e.startDate = `Trùng ngày với đợt "${clash.name}"`;
  }
  return e;
}
