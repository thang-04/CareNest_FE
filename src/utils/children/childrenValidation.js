import { recipientError } from './accountRecipient';
import { DECLARATION_STATE, GUARDIAN_RELATIONS, MAX_GUARDIANS } from '@/models/children/childrenConstants';
import { citizenIdError, normalizeCitizenId } from '@/utils/citizenId';
import { formatDate, isIsoDate, todayInput } from '@/utils/format';

/*
 * Input checks shared by the forms (instant feedback) and the mock repository (422).
 * They only support data entry; the backend stays the owner of the rules (GBR-CP-01, GBR-HLT-01).
 */

const PHONE_RE = /^(0|\+84)\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Như tên đăng nhập phụ huynh (SĐT chuẩn hóa 10 số bắt đầu 0, AUTH-18): "+84 912…" và "0912…" là một số.
export const normalizePhone = (phone) =>
  String(phone || '')
    .replace(/[\s.\-()]/g, '')
    .replace(/^\+84/, '0');

export const isValidPhone = (phone) => PHONE_RE.test(normalizePhone(phone));

export const isValidEmail = (email) => EMAIL_RE.test(String(email || '').trim());

// Ngày theo giờ máy (như ô chọn ngày); ngày UTC lệch 1 ngày từ 0h tới 7h sáng giờ Việt Nam.
const today = todayInput;

/** Số CC/CCCD/mã định danh: 12 chữ số; số hộ chiếu: chữ và số, 6–12 ký tự (user chốt có lưu 2026-10-17). */
export const isValidIdNumber = (v) => {
  const s = String(v ?? '')
    .trim()
    .replace(/\s/g, '');
  return /^\d+$/.test(s) ? s.length === 12 : /^[A-Za-z0-9]{6,12}$/.test(s);
};

export const ID_NUMBER_MESSAGE = 'Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự';

const PROFILE_REQUIRED_TEXT = [
  ['ethnicity', 'Nhập dân tộc'],
  ['beneficiary', 'Nhập đối tượng'],
  ['address.province', 'Nhập tỉnh/thành nơi ở'],
  ['address.ward', 'Nhập phường/xã nơi ở'],
  ['address.street', 'Nhập số nhà/thôn/xóm nơi ở'],
];

// Dưới 37 tuần là sinh non: tuần thai phải khớp ô Sinh non (CHD-05, user chốt 2026-11-04).
const PRETERM_BEFORE_WEEKS = 37;

/** Tuần thai khi sinh, bắt buộc mọi trẻ (user chốt 2026-11-04); câu lỗi như BE. Trả câu lỗi hoặc null. */
const gestationWeeksError = (w, premature) => {
  if (w === '' || w == null || String(w).trim() === '') return 'Nhập tuần thai khi sinh';
  const n = Number(w);
  if (Number.isNaN(n) || n < 20 || n > 42) return 'Nhập tuần thai từ 20 đến 42';
  if (!Number.isInteger(n)) return 'Nhập số tuần nguyên, ví dụ 38';
  if (premature === 'YES' && n >= PRETERM_BEFORE_WEEKS) return 'Trẻ sinh non có tuần thai dưới 37';
  if (premature === 'NO' && n < PRETERM_BEFORE_WEEKS) return 'Dưới 37 tuần là sinh non: chọn Sinh non là Có hoặc sửa tuần thai';
  return null;
};

/**
 * Phần hành chính khi tiếp nhận, sửa hồ sơ: bắt buộc trừ CCCD trẻ và nhóm máu (user chốt 2026-10-22, thay 1a); tuần thai bắt
 * buộc mọi trẻ (2026-11-04). Phiếu khám chỉ đọc phần này nên phải đủ từ lúc nhập học. Khóa lỗi 'profile.x'.
 */
export const validateChildProfile = (p = {}) => {
  const errors = {};
  const value = (path) => path.split('.').reduce((o, k) => o?.[k], p);
  const tooLong = (v, max) => String(v ?? '').trim().length > max;
  if (String(p.idNumber ?? '').trim() && !isValidIdNumber(p.idNumber)) errors['profile.idNumber'] = ID_NUMBER_MESSAGE;
  if (!['YES', 'NO'].includes(p.premature)) errors['profile.premature'] = 'Chọn trẻ có sinh non hay không';
  const weeksError = gestationWeeksError(p.gestationWeeks, p.premature);
  if (weeksError) errors['profile.gestationWeeks'] = weeksError;
  PROFILE_REQUIRED_TEXT.forEach(([path, message]) => {
    if (!String(value(path) ?? '').trim()) errors[`profile.${path}`] = message;
  });
  ['ethnicity', 'beneficiary', 'bloodType'].forEach((k) => {
    if (tooLong(p[k], 100)) errors[`profile.${k}`] = 'Tối đa 100 ký tự';
  });
  if (tooLong(p.address?.province, 100)) errors['profile.address.province'] = 'Tối đa 100 ký tự';
  if (tooLong(p.address?.ward, 100)) errors['profile.address.ward'] = 'Tối đa 100 ký tự';
  if (tooLong(p.address?.street, 300)) errors['profile.address.street'] = 'Tối đa 300 ký tự';
  return errors;
};

/** Child + guardians block of the enrollment form (kèm phần hành chính). */
export const validateChildInfo = (data, { requireRecipient = true } = {}) => {
  const errors = { ...validateChildProfile(data.profile) };
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
    // Bằng giới hạn khi kích hoạt tài khoản (BE AddGuardianRequest ≤150): tiếp nhận được thì kích hoạt được.
    else if (g.fullName.trim().length > 150) errors[`guardians.${i}.fullName`] = 'Họ tên tối đa 150 ký tự';
    if (!g.relation) errors[`guardians.${i}.relation`] = 'Chọn quan hệ với trẻ';
    // Tài khoản phụ huynh dùng cùng 6 loại quan hệ (user chốt 2026-10-28, D-5a B) ⇒ giá trị khác (vd. chữ tự do từ Excel) không nhận.
    else if (!GUARDIAN_RELATIONS.includes(g.relation))
      errors[`guardians.${i}.relation`] = `Quan hệ chỉ nhận: ${GUARDIAN_RELATIONS.join(', ')}`;
    if (!g.phone?.trim()) errors[`guardians.${i}.phone`] = 'Nhập số điện thoại để gửi tài khoản';
    else if (!isValidPhone(g.phone)) errors[`guardians.${i}.phone`] = 'Nhập số điện thoại hợp lệ, ví dụ 0912 345 678';
    if (g.email?.trim() && !isValidEmail(g.email)) errors[`guardians.${i}.email`] = 'Nhập email hợp lệ, ví dụ ten@example.com';
    const idError = citizenIdError(g.idNumber);
    if (idError) errors[`guardians.${i}.idNumber`] = idError;
  });
  const phones = guardians.map((g) => normalizePhone(g.phone)).filter(Boolean);
  if (new Set(phones).size !== phones.length) errors.guardians = 'Hai phụ huynh không được dùng chung số điện thoại';
  const ids = guardians.map((g) => normalizeCitizenId(g.idNumber)).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.guardians = 'Hai phụ huynh không được dùng chung số CCCD';
  const selectionError = recipientError(guardians);
  if (requireRecipient && selectionError) errors.accountRecipient = selectionError;
  if (guardians.length > MAX_GUARDIANS) errors.guardians = `Mỗi trẻ tối đa ${MAX_GUARDIANS} phụ huynh`;
  return errors;
};

export const validatePlacement = ({ classId }) => (classId ? {} : { classId: 'Chọn lớp cho trẻ' });

/**
 * Ngày tiếp xúc người bệnh lao gần nhất (user chốt 2026-10-21): bắt buộc khi khai "Có"; không ở tương lai, không trước ngày
 * sinh; ở phiếu khám không sau ngày khám (notAfter). Trả câu lỗi hoặc null.
 */
export const tbContactDateError = (value, { dateOfBirth, notAfter } = {}) => {
  if (!isIsoDate(value)) return 'Chọn ngày tiếp xúc gần nhất';
  if (value > today()) return 'Ngày tiếp xúc không được ở tương lai';
  if (notAfter && value > notAfter) return `Ngày tiếp xúc không được sau ngày khám ${formatDate(notAfter)}`;
  if (dateOfBirth && value < dateOfBirth) return 'Ngày tiếp xúc không được trước ngày sinh của trẻ';
  return null;
};

/** Declaration: "Reported" needs content; the other states record absence or "not provided" (UC 5.2). */
export const validateDeclaration = (d, { dateOfBirth } = {}) => {
  const errors = {};
  if (!d) return { allergies: 'Khai báo sức khỏe còn thiếu' };
  if (!Object.values(DECLARATION_STATE).includes(d.allergies?.state)) errors.allergies = 'Chọn tình trạng dị ứng';
  else if (d.allergies.state === DECLARATION_STATE.REPORTED && !(d.allergies.items || []).some((x) => x.trim()))
    errors.allergies = 'Nhập ít nhất một thực phẩm/chất gây dị ứng';
  if (!Object.values(DECLARATION_STATE).includes(d.diet?.state)) errors.diet = 'Chọn chế độ ăn';
  else if (d.diet.state === DECLARATION_STATE.REPORTED && !d.diet.text?.trim()) errors.diet = 'Mô tả chế độ ăn riêng của trẻ';
  if (d.otherNotes?.state === DECLARATION_STATE.REPORTED && !d.otherNotes.text?.trim()) errors.otherNotes = 'Nhập thông tin sức khỏe khác';
  if ((d.diet?.text || '').length > 500 || (d.otherNotes?.text || '').length > 500) errors.otherNotes = 'Nội dung tối đa 500 ký tự';
  // Tiền sử bắt buộc Có/Không, không còn "Chưa cung cấp" (user chốt 2026-10-22, thay 1a); "Có" thì ghi rõ tên bệnh.
  const mh = d.medicalHistory || {};
  const answered = [DECLARATION_STATE.REPORTED, DECLARATION_STATE.NONE_REPORTED];
  [
    ['self', 'tiền sử bản thân'],
    ['family', 'tiền sử gia đình'],
  ].forEach(([k, label]) => {
    if (!answered.includes(mh[k]?.state)) errors[`medicalHistory.${k}`] = `Chọn Có hoặc Không cho ${label}`;
    else if (mh[k].state === DECLARATION_STATE.REPORTED && !mh[k].text?.trim()) errors[`medicalHistory.${k}`] = 'Ghi rõ tên bệnh';
    else if ((mh[k].text || '').length > 300) errors[`medicalHistory.${k}`] = 'Tối đa 300 ký tự';
  });
  if (!answered.includes(mh.tbContact?.state)) errors['medicalHistory.tbContact'] = 'Tiếp xúc người bệnh lao chọn Có hoặc Không';
  else if (mh.tbContact.state === DECLARATION_STATE.REPORTED) {
    const dateError = tbContactDateError(mh.tbContact.contactDate, { dateOfBirth });
    if (dateError) errors['medicalHistory.tbContactDate'] = dateError;
  }
  return errors;
};

const isBlank = (v) => v === '' || v == null;

/**
 * Số đo của kỳ cân đo (HLT-01): chỉ chiều cao, cân nặng, ghi chú; không kết luận. Từ 2026-11-04 không còn vòng đầu, ngày đo do BE
 * ghi (số đo mới = hôm nay, sửa giữ ngày) nên không kiểm ngày ở đây.
 */
// BE nhận tối đa 1 chữ số thập phân (HealthMeasurementRequest @Digits fraction = 1); mock trước đây tự làm tròn
const moreThanOneDecimal = (value) => /[.,]\d{2,}$/.test(String(value).trim());

export const validateMeasurement = (m, { requireReason } = {}) => {
  const errors = {};
  const h = Number(m.heightCm);
  if (isBlank(m.heightCm) || Number.isNaN(h)) errors.heightCm = 'Nhập chiều cao (cm)';
  else if (h < 40 || h > 150) errors.heightCm = 'Nhập chiều cao từ 40 đến 150 cm';
  else if (moreThanOneDecimal(m.heightCm)) errors.heightCm = 'Chiều cao lấy tối đa 1 chữ số thập phân';
  const w = Number(m.weightKg);
  if (isBlank(m.weightKg) || Number.isNaN(w)) errors.weightKg = 'Nhập cân nặng (kg)';
  else if (w < 3 || w > 60) errors.weightKg = 'Nhập cân nặng từ 3 đến 60 kg';
  else if (moreThanOneDecimal(m.weightKg)) errors.weightKg = 'Cân nặng lấy tối đa 1 chữ số thập phân';
  if ((m.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự';
  if (requireReason && !m.reason?.trim()) errors.reason = 'Nhập lý do sửa kết quả đã công bố';
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

/** Đợt khám: chỉ hỗ trợ nhập liệu; luật 1 đợt chưa đóng mỗi điểm trường do BE kiểm. */
export const validateHealthCheck = (c, { creating = false } = {}) => {
  const errors = {};
  const minDate = creating ? today() : undefined;
  if (!c.name?.trim()) errors.name = 'Nhập tên đợt khám';
  else if (c.name.trim().length > 150) errors.name = 'Tên đợt tối đa 150 ký tự';
  if (!c.campusId) errors.campusId = 'Chọn điểm trường';
  if (!isIsoDate(c.startDate)) errors.startDate = 'Nhập ngày bắt đầu hợp lệ theo dd/mm/yyyy';
  else if (minDate && c.startDate < minDate) errors.startDate = 'Ngày bắt đầu không được trước hôm nay';
  if (!isIsoDate(c.endDate)) errors.endDate = 'Nhập ngày kết thúc hợp lệ theo dd/mm/yyyy';
  else if (minDate && c.endDate < minDate) errors.endDate = 'Ngày kết thúc không được trước hôm nay';
  else if (isIsoDate(c.startDate) && c.endDate < c.startDate) errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu';
  if ((c.examiner || '').length > 150) errors.examiner = 'Tối đa 150 ký tự';
  if ((c.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự';
  return errors;
};
