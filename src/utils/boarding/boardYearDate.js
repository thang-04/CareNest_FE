/**
 * Ngày xem trên "Bán trú hôm nay" phải thuộc năm học đang chọn ở header (CFG-YR-01: mọi màn theo năm ở header).
 * Ngày đã chọn còn trong năm thì giữ; ngoài năm thì lấy hôm nay, kẹp về ngày đầu/cuối năm học.
 */
export const boardDateInYear = (date, year, today) => {
  const start = year?.startDate;
  const end = year?.endDate;
  const inYear = (d) => (!start || d >= start) && (!end || d <= end);
  if (date && inYear(date)) return date;
  if (start && today < start) return start;
  if (end && today > end) return end;
  return today;
};
