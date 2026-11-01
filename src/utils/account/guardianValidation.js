import { GUARDIAN_RELATIONSHIPS } from '@/models/account/guardianConstants';

// Chuẩn hóa số điện thoại cho dữ liệu demo; BE vẫn kiểm tra lại.
export const normalizePhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw)
    .trim()
    .replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
};

/** Kiểm nhập liệu thêm phụ huynh (hỗ trợ người dùng); BE kiểm lại. */
export const validateGuardian = (form) => {
  const e = {};
  if (!normalizePhone(form.phone)) e.phone = 'Số điện thoại gồm 10 số, bắt đầu bằng 0 (hoặc +84)';
  if (!form.fullName?.trim()) e.fullName = 'Nhập họ tên phụ huynh';
  if (form.fullName?.trim().length > 150) e.fullName = 'Họ tên tối đa 150 ký tự';
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email không hợp lệ';
  if (!GUARDIAN_RELATIONSHIPS.includes(form.relationship)) e.relationship = 'Chọn quan hệ với trẻ';
  return e;
};
