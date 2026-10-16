import { DECLARATION_STATE, MOTOR_RESULT } from '@/models/children/childrenConstants';

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

const isBlank = (v) => v === '' || v == null;

/**
 * Kết quả khám (GBR-HLT-01). headCircumferenceUntil: ngày cuối còn đo vòng đầu, BE trả trong sổ sức khỏe.
 * legacy: sửa lần đo cũ chưa có vòng đầu/vận động ⇒ các ô mới không bắt buộc. campaign: { startDate, endDate } của đợt khám.
 */
export const validateMeasurement = (m, { dateOfBirth, requireReason, headCircumferenceUntil, legacy, campaign } = {}) => {
  const errors = {};
  if (!m.date || !DATE_RE.test(m.date)) errors.date = 'Chọn ngày đo';
  else if (m.date > today()) errors.date = 'Ngày đo không được ở tương lai';
  else if (dateOfBirth && m.date < dateOfBirth) errors.date = 'Ngày đo không được trước ngày sinh của trẻ';
  else if (campaign && (m.date < campaign.startDate || m.date > campaign.endDate))
    errors.date = 'Chọn ngày đo trong khoảng ngày khám của đợt';
  const h = Number(m.heightCm);
  if (isBlank(m.heightCm) || Number.isNaN(h)) errors.heightCm = 'Nhập chiều cao (cm)';
  else if (h < 40 || h > 150) errors.heightCm = 'Nhập chiều cao từ 40 đến 150 cm';
  const w = Number(m.weightKg);
  if (isBlank(m.weightKg) || Number.isNaN(w)) errors.weightKg = 'Nhập cân nặng (kg)';
  else if (w < 3 || w > 60) errors.weightKg = 'Nhập cân nặng từ 3 đến 60 kg';
  const headApplies = !headCircumferenceUntil || !m.date || m.date <= headCircumferenceUntil;
  const hc = Number(m.headCircumferenceCm);
  if (headApplies) {
    if (isBlank(m.headCircumferenceCm)) {
      if (!legacy) errors.headCircumferenceCm = 'Nhập vòng đầu (cm)';
    } else if (Number.isNaN(hc) || hc < 30 || hc > 60) errors.headCircumferenceCm = 'Nhập vòng đầu từ 30 đến 60 cm';
  }
  ['grossMotor', 'fineMotor'].forEach((field) => {
    if (isBlank(m[field])) {
      if (!legacy) errors[field] = field === 'grossMotor' ? 'Chọn kết quả vận động thô' : 'Chọn kết quả vận động tinh';
    } else if (!Object.values(MOTOR_RESULT).includes(m[field])) errors[field] = 'Chọn một trong hai kết quả';
  });
  if ((m.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự';
  if (requireReason && !m.reason?.trim()) errors.reason = 'Nhập lý do sửa kết quả đã công bố';
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

/** Đợt khám: chỉ hỗ trợ nhập liệu; luật 1 đợt chưa đóng mỗi điểm trường do BE kiểm. */
export const validateHealthCheck = (c) => {
  const errors = {};
  if (!c.name?.trim()) errors.name = 'Nhập tên đợt khám';
  else if (c.name.trim().length > 150) errors.name = 'Tên đợt tối đa 150 ký tự';
  if (!c.campusId) errors.campusId = 'Chọn điểm trường';
  if (!c.startDate || !DATE_RE.test(c.startDate)) errors.startDate = 'Chọn ngày bắt đầu khám';
  if (!c.endDate || !DATE_RE.test(c.endDate)) errors.endDate = 'Chọn ngày kết thúc khám';
  else if (c.startDate && c.endDate < c.startDate) errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu';
  if ((c.examiner || '').length > 150) errors.examiner = 'Tối đa 150 ký tự';
  if ((c.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự';
  return errors;
};

/** Cập nhật phiếu theo dõi. kind: 'contact' | 'external' | 'close'. */
export const validateFollowUpAction = (kind, b = {}) => {
  const errors = {};
  if (kind === 'close') {
    if (!b.reason?.trim()) errors.reason = 'Nhập lý do đóng phiếu';
    else if (b.reason.trim().length > 300) errors.reason = 'Lý do tối đa 300 ký tự';
    return errors;
  }
  const dateField = kind === 'contact' ? 'contactedOn' : 'resultOn';
  if (!b[dateField] || !DATE_RE.test(b[dateField])) errors[dateField] = kind === 'contact' ? 'Chọn ngày trao đổi' : 'Chọn ngày khám';
  else if (b[dateField] > today()) errors[dateField] = 'Ngày không được ở tương lai';
  if (!b.note?.trim())
    errors.note = kind === 'contact' ? 'Nhập nội dung đã trao đổi với phụ huynh' : 'Nhập kết quả bác sĩ chuyên khoa đã báo lại';
  else if (b.note.trim().length > 500) errors.note = 'Nội dung tối đa 500 ký tự';
  return errors;
};
