/*
 * Mức thân nhiệt (đo ở nách), cố định cho mọi nhóm tuổi — người dùng chốt 14/10/2026.
 * Chỉ tô màu khoảng số đo; hệ thống không tự chọn "Có dấu hiệu" hay tự tích biểu hiện.
 * PENDING BE: BE nên tính và trả `level` cùng lần ghi nhận; FE chỉ hiển thị theo mức.
 */
export const TEMPERATURE_LEVELS = [
  { key: 'VERY_HIGH', min: 39.0, label: 'Sốt rất cao', chip: 'chip--critical', attention: true },
  { key: 'HIGH', min: 38.5, label: 'Sốt cao', chip: 'chip--red', attention: true },
  { key: 'FEVER', min: 38.0, label: 'Sốt', chip: 'chip--orange', attention: true },
  { key: 'WATCH', min: 37.5, label: 'Sốt nhẹ', chip: 'chip--purple', attention: true },
  { key: 'NORMAL', min: 35.5, label: 'Bình thường', chip: '', attention: false },
  { key: 'LOW', min: -Infinity, label: 'Thân nhiệt thấp', chip: 'chip--blue', attention: false },
];

/** Mức của một số đo; null khi chưa đo. */
export const temperatureLevel = (value) => {
  const t = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (value === '' || value === null || value === undefined || !Number.isFinite(t)) return null;
  return TEMPERATURE_LEVELS.find((level) => t >= level.min);
};

/** Mức cần chú ý ("Sốt nhẹ" trở lên) — tính vào lọc / đếm "Có dấu hiệu cần lưu ý". */
export const needsAttention = (value) => !!temperatureLevel(value)?.attention;
