/*
 * Số CCCD của phụ huynh: bắt buộc, đúng 12 chữ số, không nhận hộ chiếu (user chốt 2026-10-21, PROPOSED — chờ BE).
 * Dùng chung cho form tiếp nhận / hồ sơ trẻ và form tài khoản phụ huynh; chỉ hỗ trợ nhập liệu, BE kiểm lại.
 */

export const normalizeCitizenId = (value) => String(value ?? '').replace(/\s/g, '');

export const isValidCitizenId = (value) => /^\d{12}$/.test(normalizeCitizenId(value));

/** Câu lỗi của ô CCCD, hoặc null khi hợp lệ. */
export const citizenIdError = (value) => {
  if (!normalizeCitizenId(value)) return 'Nhập số CCCD của phụ huynh';
  return isValidCitizenId(value) ? null : 'Số CCCD gồm đúng 12 chữ số';
};
