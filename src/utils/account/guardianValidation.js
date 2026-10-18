import { GUARDIAN_RELATIONSHIPS } from '@/models/account/guardianConstants';

/** Giống BE PhoneNumbers: bỏ dấu phân cách, +84/84 → 0; trả null nếu không phải SĐT 10 số bắt đầu 0. */
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
  if (!GUARDIAN_RELATIONSHIPS.includes(form.relationship)) e.relationship = 'Chọn quan hệ với trẻ';
  return e;
};
