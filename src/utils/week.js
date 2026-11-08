/* Ngày và tuần dạng yyyy-mm-dd theo giờ địa phương, không lệch múi giờ; dùng chung cho thực đơn, bếp, ô chọn tuần. */
const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, n) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

/** Monday of the week containing the date. */
export const mondayOf = (iso) => {
  const d = parse(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toIso(d);
};

/** Tuần học đang chạy: thứ Bảy, Chủ nhật tính sang tuần sắp tới (thực đơn và dự trù tuần đó đã lập trước). */
export const schoolWeekStart = (iso) => {
  const day = parse(iso).getDay();
  return mondayOf(day === 0 || day === 6 ? addDays(iso, 2) : iso);
};

export const isMonday = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && parse(iso).getDay() === 1;

/** Monday to Friday dates of a week. */
export const weekDates = (weekStart) => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));

export const weekLabel = (weekStart) => {
  if (!weekStart) return '—';
  const [y1, m1, d1] = weekStart.split('-');
  const [y2, m2, d2] = addDays(weekStart, 4).split('-');
  return `${d1}/${m1}${y1 !== y2 ? `/${y1}` : ''} – ${d2}/${m2}/${y2}`;
};

/** Một nhãn tuần ngắn không kèm năm, cho nút chọn nhanh: "09/11 – 13/11". */
export const weekShortLabel = (weekStart) => {
  const [, m1, d1] = weekStart.split('-');
  const [, m2, d2] = addDays(weekStart, 4).split('-');
  return `${d1}/${m1} – ${d2}/${m2}`;
};

/** Các tuần để chọn từ danh sách: cả năm học, nhóm theo tháng; thiếu ngày năm học thì lấy nửa năm quanh tuần đang xem. */
export const weekOptions = ({ start, end, value, thisWeek }) => {
  const first = [mondayOf(start || addDays(value, -91)), value].sort()[0];
  const last = [mondayOf(end || addDays(value, 91)), value].sort()[1];
  const weeks = [];
  for (let week = first; week <= last; week = addDays(week, 7)) {
    const [y, m] = week.split('-');
    weeks.push({
      value: week,
      label: weekLabel(week),
      group: `Tháng ${Number(m)}/${y}`,
      hint: week === thisWeek ? 'Tuần này' : undefined,
    });
  }
  return weeks;
};
