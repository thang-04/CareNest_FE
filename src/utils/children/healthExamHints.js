/*
 * So số đo với khoảng tham khảo BE trả (exam view: reference). Form dùng để chọn sẵn trạng thái khi nhập số;
 * backend giả dùng để lập "Điểm cần bác sĩ xem lại". Chỉ là gợi ý, bác sĩ quyết định (user chốt 2026-10-17).
 */

const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/** Trạng thái gợi ý của 1 dấu hiệu sinh tồn; null khi chưa có số. below: thấp hơn khoảng (mạch không có ô "chậm"). */
export const vitalStatusFor = (key, value, vitals) => {
  const n = toNumber(value);
  if (n == null || !vitals) return null;
  if (key === 'temperatureC') {
    if (n >= vitals.temperature.feverFrom) return { status: 'FEVER' };
    if (n < vitals.temperature.hypothermiaBelow) return { status: 'HYPOTHERMIA' };
    return { status: 'NORMAL' };
  }
  const range = key === 'pulse' ? vitals.pulse : vitals.respiratoryRate;
  if (n > range.max) return { status: 'FAST' };
  if (n < range.min) return key === 'pulse' ? { status: 'NORMAL', below: true } : { status: 'SLOW' };
  return { status: 'NORMAL' };
};

/** Trạng thái vòng đầu gợi ý theo khoảng tạm BE trả; null khi chưa có số hoặc không đo. */
export const headStatusFor = (value, head) => {
  const n = toNumber(value);
  if (n == null || !head) return null;
  if (n < head.low) return 'SMALL';
  if (n > head.high) return 'LARGE';
  return 'NORMAL';
};

export const formatDecimal = (n, digits = 1) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: digits });
