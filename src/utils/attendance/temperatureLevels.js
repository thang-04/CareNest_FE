/*
 * Mức thân nhiệt đo nách của trẻ mầm non theo hướng dẫn nhi khoa Bộ Y tế (Cần chốt 31/10/2026): sốt khi ≥ 37,5 °C;
 * nhẹ / vừa / cao / rất cao tách ở 38 / 39 / 40 °C. Khớp BE TemperatureLevel. Chỉ tô màu khoảng số đo; hệ thống không tự
 * chọn "Có dấu hiệu" hay tự tích biểu hiện.
 */
export const TEMPERATURE_LEVELS = [
  { key: 'VERY_HIGH', min: 40.0, label: 'Sốt rất cao', chip: 'chip--critical', attention: true },
  { key: 'HIGH', min: 39.0, label: 'Sốt cao', chip: 'chip--red', attention: true },
  { key: 'MODERATE', min: 38.0, label: 'Sốt vừa', chip: 'chip--orange', attention: true },
  { key: 'MILD', min: 37.5, label: 'Sốt nhẹ', chip: 'chip--purple', attention: true },
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
