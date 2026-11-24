/*
 * So số đo với khoảng tham khảo BE trả (exam view: reference). Form dùng để chọn sẵn trạng thái khi nhập số;
 * backend giả dùng để lập "Điểm cần bác sĩ xem lại". Chỉ là gợi ý, bác sĩ quyết định (user chốt 2026-10-17).
 */

const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export const TEMPERATURE_FORMAT_MESSAGE = 'Nhập nhiệt độ gồm 2 chữ số, tối đa 2 chữ số sau dấu phẩy (vd 36,5)';
// Dạng BE nhận (khớp luật BE): đúng 2 chữ số nguyên, tối đa 2 chữ số thập phân; dấu thập phân là "," hoặc ".".
const TEMPERATURE_FORMAT = /^\d{2}([.,]\d{1,2})?$/;

/** Lỗi định dạng ô nhiệt độ ('' khi hợp lệ hoặc còn trống). Chỉ nhắc nhập liệu; BE kiểm lại. */
export const temperatureFormatError = (value) => {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  return TEMPERATURE_FORMAT.test(text) ? '' : TEMPERATURE_FORMAT_MESSAGE;
};

// Đang gõ dở vẫn có thể thành đúng dạng (vd "3", "36,"): chưa báo lỗi.
const TEMPERATURE_PREFIX = /^\d{0,2}([.,]\d{0,2})?$/;

/** Lỗi hiện ngay khi gõ: chỉ báo khi chuỗi không thể trở thành nhiệt độ hợp lệ nữa; đủ luật kiểm lúc lưu. */
export const temperatureTypingError = (value) => {
  const text = String(value ?? '').trim();
  return TEMPERATURE_PREFIX.test(text) ? '' : TEMPERATURE_FORMAT_MESSAGE;
};

/** Nhiệt độ gửi BE: số khi đúng dạng (đổi "," thành "."); sai dạng giữ nguyên chuỗi để BE báo đúng ô. */
export const temperatureForBe = (value) => {
  const text = String(value ?? '').trim();
  if (text === '' || temperatureFormatError(text)) return value;
  return Number(text.replace(',', '.'));
};

/** Trạng thái gợi ý của 1 dấu hiệu sinh tồn; null khi chưa có số. below: thấp hơn khoảng (mạch không có ô "chậm"). */
export const vitalStatusFor = (key, value, vitals) => {
  if (key === 'temperatureC') {
    if (temperatureFormatError(value) || String(value ?? '').trim() === '' || !vitals) return null;
    const t = Number(String(value).trim().replace(',', '.'));
    if (t >= vitals.temperature.feverFrom) return { status: 'FEVER' };
    if (t < vitals.temperature.hypothermiaBelow) return { status: 'HYPOTHERMIA' };
    return { status: 'NORMAL' };
  }
  const n = toNumber(value);
  if (n == null || !vitals) return null;
  const range = key === 'pulse' ? vitals.pulse : vitals.respiratoryRate;
  if (n > range.max) return { status: 'FAST' };
  if (n < range.min) return key === 'pulse' ? { status: 'NORMAL', below: true } : { status: 'SLOW' };
  return { status: 'NORMAL' };
};

/** Trạng thái vòng đầu gợi ý theo khoảng WHO (−2SD..+2SD) BE trả; null khi chưa có số, không đo hoặc thiếu khoảng. */
export const headStatusFor = (value, head) => {
  const n = toNumber(value);
  if (n == null || !head) return null;
  if (n < head.low) return 'SMALL';
  if (n > head.high) return 'LARGE';
  return 'NORMAL';
};

export const formatDecimal = (n, digits = 1) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: digits });
