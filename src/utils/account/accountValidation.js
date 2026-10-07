import { OTP_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, GENDER } from '@/models/account/accountConstants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^0\d{9}$/;

export const normalizePhone = (phone) => String(phone || '').replace(/[\s.-]/g, '');

/** Each policy rule, for the live checklist under the new-password field. */
export const passwordRules = (password = '') => [
  {
    key: 'length',
    label: `Từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
    ok: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  { key: 'letter', label: 'Có ít nhất 1 chữ cái', ok: /[A-Za-z]/.test(password) },
  { key: 'digit', label: 'Có ít nhất 1 chữ số', ok: /\d/.test(password) },
  { key: 'space', label: 'Không chứa khoảng trắng', ok: password.length > 0 && !/\s/.test(password) },
];

export const validateEmailForm = ({ email }) => {
  const e = {};
  const value = String(email || '').trim();
  if (!value) e.email = 'Vui lòng nhập email đã đăng ký';
  else if (!EMAIL_RE.test(value)) e.email = 'Email chưa đúng định dạng (ví dụ: ten@carenest.edu.vn)';
  return e;
};

export const validateOtp = ({ otp }) => {
  const e = {};
  const value = String(otp || '').trim();
  if (!value) e.otp = 'Vui lòng nhập mã xác thực';
  else if (value.length !== OTP_LENGTH || !/^\d+$/.test(value)) e.otp = `Mã xác thực gồm ${OTP_LENGTH} chữ số`;
  return e;
};

/** New password + confirmation; `requireCurrent` for the signed-in change form (SRS 1.2). */
export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }, { requireCurrent = false } = {}) => {
  const e = {};
  if (requireCurrent && !currentPassword) e.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
  if (!newPassword) e.newPassword = 'Vui lòng nhập mật khẩu mới';
  else if (passwordRules(newPassword).some((r) => !r.ok)) e.newPassword = 'Mật khẩu mới chưa đạt yêu cầu bên dưới';
  else if (requireCurrent && currentPassword && newPassword === currentPassword) e.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
  if (!confirmPassword) e.confirmPassword = 'Vui lòng nhập lại mật khẩu mới';
  else if (newPassword && confirmPassword !== newPassword) e.confirmPassword = 'Mật khẩu nhập lại không khớp';
  return e;
};

export const validateProfile = ({ phone, dateOfBirth, gender, address }) => {
  const e = {};
  const p = normalizePhone(phone);
  if (!p) e.phone = 'Vui lòng nhập số điện thoại';
  else if (!PHONE_RE.test(p)) e.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0 (ví dụ: 0912 345 678)';
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (Number.isNaN(d.getTime())) e.dateOfBirth = 'Ngày sinh không hợp lệ';
    else if (age < 18 || age > 80) e.dateOfBirth = 'Ngày sinh chưa hợp lệ, vui lòng kiểm tra lại năm sinh';
  }
  if (gender && !Object.values(GENDER).includes(gender)) e.gender = 'Giới tính không hợp lệ';
  if (address && String(address).length > 255) e.address = 'Địa chỉ tối đa 255 ký tự';
  return e;
};
