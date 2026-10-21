import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { FOLLOW_UP_CLOSE_OUTCOME, FOLLOW_UP_FIELD_LIMITS } from '@/models/children/healthCheckConstants';
import { formatDate, todayInput } from '@/utils/format';

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

/** Phần hành chính hỏi khi tiếp nhận: không bắt buộc, chỉ kiểm định dạng (user chốt 2026-10-17). Khóa lỗi 'profile.x'. */
export const validateChildProfile = (p = {}) => {
  const errors = {};
  const tooLong = (v, max) => String(v ?? '').trim().length > max;
  if (String(p.idNumber ?? '').trim() && !isValidIdNumber(p.idNumber)) errors['profile.idNumber'] = ID_NUMBER_MESSAGE;
  if (!['', 'YES', 'NO', undefined, null].includes(p.premature)) errors['profile.premature'] = 'Sinh non chọn Có hoặc Không';
  const w = p.gestationWeeks;
  if (w !== '' && w != null && (Number.isNaN(Number(w)) || Number(w) < 20 || Number(w) > 42))
    errors['profile.gestationWeeks'] = 'Nhập tuần thai từ 20 đến 42';
  ['ethnicity', 'beneficiary', 'paymentSource', 'bloodType'].forEach((k) => {
    if (tooLong(p[k], 100)) errors[`profile.${k}`] = 'Tối đa 100 ký tự';
  });
  if (tooLong(p.address?.province, 100)) errors['profile.address.province'] = 'Tối đa 100 ký tự';
  if (tooLong(p.address?.ward, 100)) errors['profile.address.ward'] = 'Tối đa 100 ký tự';
  if (tooLong(p.address?.street, 300)) errors['profile.address.street'] = 'Tối đa 300 ký tự';
  return errors;
};

/** Child + guardians block of the enrollment form (kèm phần hành chính). */
export const validateChildInfo = (data) => {
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
  // Tiền sử (user chốt 2026-10-17): không bắt buộc ("Chưa cung cấp"); "Có" thì ghi rõ tên bệnh.
  const mh = d.medicalHistory;
  if (mh) {
    const states = Object.values(DECLARATION_STATE);
    ['self', 'family'].forEach((k) => {
      if (!states.includes(mh[k]?.state)) errors[`medicalHistory.${k}`] = 'Chọn Có, Không hoặc Chưa cung cấp';
      else if (mh[k].state === DECLARATION_STATE.REPORTED && !mh[k].text?.trim()) errors[`medicalHistory.${k}`] = 'Ghi rõ tên bệnh';
      else if ((mh[k].text || '').length > 300) errors[`medicalHistory.${k}`] = 'Tối đa 300 ký tự';
    });
    if (!states.includes(mh.tbContact?.state))
      errors['medicalHistory.tbContact'] = 'Tiếp xúc người bệnh lao chọn Có, Không hoặc Chưa cung cấp';
  }
  return errors;
};

const isBlank = (v) => v === '' || v == null;

/**
 * Cân đo ngoài đợt khám (GBR-HLT-01; user chốt 2026-10-17: chỉ chiều cao, cân nặng, vòng đầu, ghi chú; không kết luận).
 * headCircumferenceUntil: ngày cuối còn đo vòng đầu, BE trả trong sổ sức khỏe. Vòng đầu không bắt buộc khi cân đo tại lớp.
 */
export const validateMeasurement = (m, { dateOfBirth, requireReason, headCircumferenceUntil } = {}) => {
  const errors = {};
  if (!m.date || !DATE_RE.test(m.date)) errors.date = 'Chọn ngày đo';
  else if (m.date > today()) errors.date = 'Ngày đo không được ở tương lai';
  else if (dateOfBirth && m.date < dateOfBirth) errors.date = 'Ngày đo không được trước ngày sinh của trẻ';
  const h = Number(m.heightCm);
  if (isBlank(m.heightCm) || Number.isNaN(h)) errors.heightCm = 'Nhập chiều cao (cm)';
  else if (h < 40 || h > 150) errors.heightCm = 'Nhập chiều cao từ 40 đến 150 cm';
  const w = Number(m.weightKg);
  if (isBlank(m.weightKg) || Number.isNaN(w)) errors.weightKg = 'Nhập cân nặng (kg)';
  else if (w < 3 || w > 60) errors.weightKg = 'Nhập cân nặng từ 3 đến 60 kg';
  const headApplies = !headCircumferenceUntil || !m.date || m.date <= headCircumferenceUntil;
  const hc = Number(m.headCircumferenceCm);
  if (headApplies && !isBlank(m.headCircumferenceCm) && (Number.isNaN(hc) || hc < 30 || hc > 60))
    errors.headCircumferenceCm = 'Nhập vòng đầu từ 30 đến 60 cm';
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
/** kind: 'contact' | 'external' | 'close'. contactFrom: ngày khám của kết quả mở vòng theo dõi (BE trả). */
export const validateFollowUpAction = (kind, b = {}, { contactFrom } = {}) => {
  const errors = {};
  if (kind === 'close') {
    // Đóng phiếu chọn kết quả theo lời bác sĩ, không chọn sẵn (user chốt 2026-10-21).
    if (!Object.values(FOLLOW_UP_CLOSE_OUTCOME).includes(b.outcome)) errors.outcome = 'Chọn kết quả theo lời bác sĩ';
    if (b.outcome === FOLLOW_UP_CLOSE_OUTCOME.KNOWN_CONDITION) {
      if (!b.conditionText?.trim()) errors.conditionText = 'Nhập tên vấn đề, ví dụ Cận thị – đeo kính';
      else if (b.conditionText.trim().length > FOLLOW_UP_FIELD_LIMITS.condition)
        errors.conditionText = `Tên vấn đề tối đa ${FOLLOW_UP_FIELD_LIMITS.condition} ký tự`;
    }
    if (!b.reason?.trim()) errors.reason = 'Nhập lý do đóng phiếu';
    else if (b.reason.trim().length > 300) errors.reason = 'Lý do tối đa 300 ký tự';
    return errors;
  }
  const dateField = kind === 'contact' ? 'contactedOn' : 'resultOn';
  if (!b[dateField] || !DATE_RE.test(b[dateField])) errors[dateField] = kind === 'contact' ? 'Chọn ngày trao đổi' : 'Chọn ngày khám';
  else if (b[dateField] > today()) errors[dateField] = 'Ngày không được ở tương lai';
  else if (kind === 'contact' && contactFrom && b.contactedOn < contactFrom)
    errors.contactedOn = `Ngày trao đổi không được trước ngày khám ${formatDate(contactFrom)}`;
  if (!b.note?.trim())
    errors.note = kind === 'contact' ? 'Nhập nội dung đã trao đổi với phụ huynh' : 'Nhập kết quả bác sĩ chuyên khoa đã báo lại';
  else if (b.note.trim().length > 500) errors.note = 'Nội dung tối đa 500 ký tự';
  // Kết quả chuyên khoa ghi chữ tự do, kèm chuyên khoa / nơi khám và ảnh giấy kết quả (user chốt 2026-10-17).
  if (kind === 'external') {
    if (!b.facility?.trim()) errors.facility = 'Nhập chuyên khoa / nơi khám, ví dụ Mắt — Bệnh viện Nhi';
    else if (b.facility.trim().length > 150) errors.facility = 'Tối đa 150 ký tự';
    if ((b.images || []).length > 3) errors.images = 'Tối đa 3 ảnh';
  }
  if (kind === 'external' && b.nextVisitOn) {
    if (!DATE_RE.test(b.nextVisitOn)) errors.nextVisitOn = 'Chọn ngày hẹn khám lại hợp lệ';
    else if (DATE_RE.test(b.resultOn || '') && b.nextVisitOn <= b.resultOn) errors.nextVisitOn = 'Ngày hẹn khám lại phải sau ngày khám';
  }
  return errors;
};
