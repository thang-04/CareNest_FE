import { DECLARATION_STATE } from '@/models/children/childrenConstants';

/*
 * Input checks shared by the forms (instant feedback) and the mock repository (422).
 * They only support data entry; the backend stays the owner of the rules (GBR-CP-01, GBR-HLT-01).
 */

const PHONE_RE = /^(0|\+84)\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const normalizePhone = (phone) => String(phone || '').replace(/[\s.-]/g, '');

export const isValidPhone = (phone) => PHONE_RE.test(normalizePhone(phone));

export const isValidEmail = (email) => EMAIL_RE.test(String(email || '').trim());

const today = () => new Date().toISOString().slice(0, 10);

/** Child + guardians block of the enrollment form. */
export const validateChildInfo = (data) => {
  const errors = {};
  if (!data.fullName?.trim()) errors.fullName = 'Nhập họ tên trẻ';
  else if (data.fullName.trim().length > 100) errors.fullName = 'Họ tên tối đa 100 ký tự';
  if (!data.dateOfBirth || !DATE_RE.test(data.dateOfBirth)) errors.dateOfBirth = 'Chọn ngày sinh của trẻ';
  else if (data.dateOfBirth > today()) errors.dateOfBirth = 'Ngày sinh không được ở tương lai';
  else if (data.dateOfBirth < '2018-01-01') errors.dateOfBirth = 'Nhập ngày sinh hợp lệ cho trẻ mầm non';
  if (!data.gender) errors.gender = 'Chọn giới tính';
  const guardians = data.guardians || [];
  if (guardians.length === 0) errors.guardians = 'Thêm ít nhất một phụ huynh';
  guardians.forEach((g, i) => {
    if (!g.fullName?.trim()) errors[`guardians.${i}.fullName`] = 'Nhập họ tên phụ huynh';
    if (!g.relation) errors[`guardians.${i}.relation`] = 'Chọn quan hệ với trẻ';
    if (!g.phone?.trim()) errors[`guardians.${i}.phone`] = 'Nhập số điện thoại để gửi tài khoản';
    else if (!isValidPhone(g.phone)) errors[`guardians.${i}.phone`] = 'Nhập số điện thoại hợp lệ, ví dụ 0912 345 678';
    if (g.email?.trim() && !isValidEmail(g.email)) errors[`guardians.${i}.email`] = 'Nhập email hợp lệ, ví dụ ten@example.com';
  });
  const phones = guardians.map((g) => normalizePhone(g.phone)).filter(Boolean);
  if (new Set(phones).size !== phones.length) errors.guardians = 'Hai phụ huynh không được dùng chung số điện thoại';
  return errors;
};

export const validatePlacement = ({ classId }) => (classId ? {} : { classId: 'Chọn lớp cho trẻ' });

/** Declaration: "Reported" needs content; the other states record absence or "not provided" (UC 5.2). */
export const validateDeclaration = (d) => {
  const errors = {};
  if (!d) return { allergies: 'Khai báo sức khỏe còn thiếu' };
  if (!Object.values(DECLARATION_STATE).includes(d.allergies?.state)) errors.allergies = 'Chọn tình trạng dị ứng';
  else if (d.allergies.state === DECLARATION_STATE.REPORTED && !(d.allergies.items || []).some((x) => x.trim()))
    errors.allergies = 'Nhập ít nhất một thực phẩm/chất gây dị ứng';
  if (!Object.values(DECLARATION_STATE).includes(d.diet?.state)) errors.diet = 'Chọn chế độ ăn';
  else if (d.diet.state === DECLARATION_STATE.REPORTED && !d.diet.text?.trim()) errors.diet = 'Mô tả chế độ ăn riêng của trẻ';
  if (d.otherNotes?.state === DECLARATION_STATE.REPORTED && !d.otherNotes.text?.trim()) errors.otherNotes = 'Nhập thông tin sức khỏe khác';
  if ((d.diet?.text || '').length > 500 || (d.otherNotes?.text || '').length > 500) errors.otherNotes = 'Nội dung tối đa 500 ký tự';
  return errors;
};

/** Measurement (GBR-HLT-01 + data rule "Measurement date is valid"). */
export const validateMeasurement = (m, { dateOfBirth, requireReason } = {}) => {
  const errors = {};
  if (!m.date || !DATE_RE.test(m.date)) errors.date = 'Chọn ngày đo';
  else if (m.date > today()) errors.date = 'Ngày đo không được ở tương lai';
  else if (dateOfBirth && m.date < dateOfBirth) errors.date = 'Ngày đo không được trước ngày sinh của trẻ';
  const h = Number(m.heightCm);
  if (m.heightCm === '' || m.heightCm == null || Number.isNaN(h)) errors.heightCm = 'Nhập chiều cao (cm)';
  else if (h < 40 || h > 150) errors.heightCm = 'Nhập chiều cao từ 40 đến 150 cm';
  const w = Number(m.weightKg);
  if (m.weightKg === '' || m.weightKg == null || Number.isNaN(w)) errors.weightKg = 'Nhập cân nặng (kg)';
  else if (w < 3 || w > 60) errors.weightKg = 'Nhập cân nặng từ 3 đến 60 kg';
  if ((m.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự';
  if (requireReason && !m.reason?.trim()) errors.reason = 'Nhập lý do sửa kết quả đã công bố';
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;
