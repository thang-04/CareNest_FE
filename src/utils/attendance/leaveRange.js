import { monthRangeOf } from '@/utils/format';

/** Khoảng lọc mặc định của danh sách đơn nghỉ: gồm cả đơn xin nghỉ sắp tới trong năm học đang chọn. */
export const leaveDefaultRange = (today, year) => {
  const month = monthRangeOf(today);
  if (!year?.startDate || !year?.endDate) return month;
  if (today < year.startDate) return { from: year.startDate, to: year.endDate };
  if (today > year.endDate) return monthRangeOf(year.endDate);
  return { from: month.from, to: year.endDate };
};
