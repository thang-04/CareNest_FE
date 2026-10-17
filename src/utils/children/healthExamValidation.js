import {
  BEHAVIOR_NOTE_TRIGGERS,
  CLINICAL_ITEMS,
  COMPANION_RELATIONS,
  CONCLUSION_ACTION,
  DEVELOPMENT_ITEMS,
  EXAM_FIELD_LIMITS,
  HEAD_STATUS_OPTIONS,
  HISTORY_ITEMS,
  IMMUNIZATION_ITEMS,
  NUTRITION_STATUS,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
  YES_NO,
} from '@/models/children/healthExamForm';
import { todayInput } from '@/utils/format';
import { isValidPhone } from './childrenValidation';

/*
 * Kiểm tra nhập liệu của phiếu Phụ lục II khi lưu kết luận (form báo ngay, backend giả trả 422 cùng khóa).
 * Chỉ hỗ trợ nhập liệu; phiếu nháp không bắt buộc ô nào. BE vẫn là chủ rule.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YES_NO_VALUES = Object.values(YES_NO);

const isBlank = (v) => v === '' || v == null;
const text = (v) => String(v ?? '').trim();

/** Số CC/CCCD/mã định danh: 12 chữ số; số hộ chiếu: chữ và số, 6–12 ký tự (user chốt có lưu 2026-10-17). */
export const isValidIdNumber = (v) => {
  const s = text(v).replace(/\s/g, '');
  return /^\d+$/.test(s) ? s.length === 12 : /^[A-Za-z0-9]{6,12}$/.test(s);
};

const ID_MESSAGE = 'Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự';

const checkNumber = (errors, key, value, { min, max, required, label, unit }) => {
  if (isBlank(value)) {
    if (required) errors[key] = `Nhập ${label}`;
    return;
  }
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) errors[key] = `Nhập ${label} từ ${min} đến ${max}${unit ? ` ${unit}` : ''}`;
};

const checkChoice = (errors, key, value, options, message) => {
  if (!options.some((o) => o.value === value)) errors[key] = message;
};

const checkLength = (errors, key, value, max) => {
  if (text(value).length > max) errors[key] = `Tối đa ${max} ký tự`;
};

/**
 * payload: { date, heightCm, weightKg, headCircumferenceCm, exam, reason }.
 * ctx: { dateOfBirth, campaign: { startDate, endDate }, reference (BE trả: headApplies, autismQuestion), requireReason }.
 */
export const validateHealthExam = (payload, { dateOfBirth, campaign, reference, requireReason } = {}) => {
  const errors = {};
  const exam = payload.exam || {};
  const a = exam.admin || {};
  const L = EXAM_FIELD_LIMITS;

  if (!payload.date || !DATE_RE.test(payload.date)) errors.date = 'Chọn ngày khám';
  else if (payload.date > todayInput()) errors.date = 'Ngày khám không được ở tương lai';
  else if (dateOfBirth && payload.date < dateOfBirth) errors.date = 'Ngày khám không được trước ngày sinh của trẻ';
  else if (campaign && (payload.date < campaign.startDate || payload.date > campaign.endDate))
    errors.date = 'Chọn ngày khám trong khoảng ngày khám của đợt';

  // I. Hành chính
  if (!isBlank(a.childIdNumber) && !isValidIdNumber(a.childIdNumber)) errors['exam.admin.childIdNumber'] = ID_MESSAGE;
  if (!YES_NO_VALUES.includes(a.premature)) errors['exam.admin.premature'] = 'Chọn trẻ có sinh non hay không';
  checkNumber(errors, 'exam.admin.gestationWeeks', a.gestationWeeks, {
    min: 20,
    max: 42,
    required: a.premature === YES_NO.YES,
    label: 'tuần thai khi sinh',
    unit: 'tuần',
  });
  ['ethnicity', 'beneficiary', 'paymentSource', 'bloodType'].forEach((k) => checkLength(errors, `exam.admin.${k}`, a[k], L.short));
  checkLength(errors, 'exam.admin.address.province', a.address?.province, L.short);
  checkLength(errors, 'exam.admin.address.ward', a.address?.ward, L.short);
  checkLength(errors, 'exam.admin.address.street', a.address?.street, L.text);
  if (!YES_NO_VALUES.includes(a.hasCompanion)) errors['exam.admin.hasCompanion'] = 'Chọn có người đi cùng trẻ hay không';
  if (a.hasCompanion === YES_NO.YES) {
    const c = a.companion || {};
    if (!text(c.fullName)) errors['exam.admin.companion.fullName'] = 'Nhập họ tên người đi cùng trẻ';
    else checkLength(errors, 'exam.admin.companion.fullName', c.fullName, L.short);
    if (!COMPANION_RELATIONS.includes(c.relation)) errors['exam.admin.companion.relation'] = 'Chọn mối quan hệ với trẻ';
    if (!isBlank(c.phone) && !isValidPhone(c.phone)) errors['exam.admin.companion.phone'] = 'Nhập số điện thoại hợp lệ, ví dụ 0912 345 678';
    if (!isBlank(c.idNumber) && !isValidIdNumber(c.idNumber)) errors['exam.admin.companion.idNumber'] = ID_MESSAGE;
  }
  HISTORY_ITEMS.forEach((item) => {
    const v = exam.history?.[item.key];
    checkChoice(errors, `exam.history.${item.key}`, v, item.options, `Chọn ${item.label.toLowerCase()}`);
    if (item.textKey && v === YES_NO.YES && !text(exam.history[item.textKey])) errors[`exam.history.${item.textKey}`] = 'Ghi rõ tên bệnh';
    if (item.textKey) checkLength(errors, `exam.history.${item.textKey}`, exam.history?.[item.textKey], L.text);
  });

  // II. Sinh tồn
  VITAL_ITEMS.forEach((item) => {
    checkNumber(errors, `exam.vitals.${item.key}`, exam.vitals?.[item.key], {
      min: item.min,
      max: item.max,
      required: true,
      label: item.label.replace(/ \(.*\)$/, '').toLowerCase(),
      unit: item.unit,
    });
    checkChoice(errors, `exam.vitals.${item.statusKey}`, exam.vitals?.[item.statusKey], item.options, 'Chọn trạng thái');
  });

  // III. Dinh dưỡng
  checkNumber(errors, 'heightCm', payload.heightCm, { min: 40, max: 150, required: true, label: 'chiều cao/chiều dài', unit: 'cm' });
  checkNumber(errors, 'weightKg', payload.weightKg, { min: 3, max: 60, required: true, label: 'cân nặng', unit: 'kg' });
  const n = exam.nutrition || {};
  if (reference?.headApplies !== false) {
    checkNumber(errors, 'headCircumferenceCm', payload.headCircumferenceCm, {
      min: 30,
      max: 60,
      required: true,
      label: 'vòng đầu',
      unit: 'cm',
    });
    checkChoice(errors, 'exam.nutrition.headStatus', n.headStatus, HEAD_STATUS_OPTIONS, 'Chọn trạng thái vòng đầu');
  }
  checkNumber(errors, 'exam.nutrition.lengthForAgeSd', n.lengthForAgeSd, { min: -6, max: 6, label: 'chiều dài/tuổi (SD)' });
  checkNumber(errors, 'exam.nutrition.weightForAgeSd', n.weightForAgeSd, { min: -6, max: 6, label: 'cân nặng/tuổi (SD)' });
  checkNumber(errors, 'exam.nutrition.armCircumferenceMm', n.armCircumferenceMm, {
    min: 50,
    max: 300,
    label: 'chu vi vòng cánh tay',
    unit: 'mm',
  });
  const statuses = n.statuses || [];
  if (statuses.length === 0) errors['exam.nutrition.statuses'] = 'Chọn tình trạng dinh dưỡng';
  else if (statuses.some((s) => !NUTRITION_STATUS_OPTIONS.some((o) => o.value === s)))
    errors['exam.nutrition.statuses'] = 'Chọn tình trạng dinh dưỡng hợp lệ';
  else if (statuses.includes(NUTRITION_STATUS.NORMAL) && statuses.length > 1)
    errors['exam.nutrition.statuses'] = '"Bình thường" không chọn cùng các mục khác';

  // IV–V. Phát triển, tiêm chủng
  DEVELOPMENT_ITEMS.forEach((item) => {
    if (item.ageMonths && !reference?.autismQuestion) return;
    checkChoice(errors, `exam.development.${item.key}`, exam.development?.[item.key], item.options, 'Chọn Có hoặc Không');
  });
  IMMUNIZATION_ITEMS.forEach((item) =>
    checkChoice(errors, `exam.immunization.${item.key}`, exam.immunization?.[item.key], item.options, 'Chọn Có hoặc Không'),
  );

  // VI. Khám lâm sàng
  CLINICAL_ITEMS.forEach((item) =>
    checkChoice(errors, `exam.clinical.${item.key}`, exam.clinical?.[item.key], item.options, 'Chọn một kết quả'),
  );
  if (BEHAVIOR_NOTE_TRIGGERS.some((k) => exam.clinical?.[k] === YES_NO.YES) && !text(exam.clinical?.behaviorNote))
    errors['exam.clinical.behaviorNote'] = 'Ghi rõ biểu hiện bác sĩ ghi nhận';
  checkLength(errors, 'exam.clinical.behaviorNote', exam.clinical?.behaviorNote, L.text);

  // Kết luận và tư vấn
  const c = exam.conclusion || {};
  if (!c.normal && !c.tbRisk && !c.healthIssue) errors['exam.conclusion.flags'] = 'Chọn kết luận của bác sĩ';
  else if (c.normal && (c.tbRisk || c.healthIssue)) errors['exam.conclusion.flags'] = '"Bình thường" không chọn cùng các kết luận khác';
  if (c.healthIssue && !text(c.issueText)) errors['exam.conclusion.issueText'] = 'Ghi rõ vấn đề sức khỏe bác sĩ kết luận';
  checkLength(errors, 'exam.conclusion.issueText', c.issueText, L.note);
  if (!Object.values(CONCLUSION_ACTION).includes(c.action)) errors['exam.conclusion.action'] = 'Chọn hướng xử lý bác sĩ đề nghị';
  if (c.action === CONCLUSION_ACTION.ADVICE && !text(c.adviceText)) errors['exam.conclusion.adviceText'] = 'Ghi lời tư vấn của bác sĩ';
  checkLength(errors, 'exam.conclusion.adviceText', c.adviceText, L.note);
  if (c.action === CONCLUSION_ACTION.REFERRAL && !text(c.specialty))
    errors['exam.conclusion.specialty'] = 'Ghi chuyên khoa bác sĩ đề nghị, ví dụ Mắt';
  checkLength(errors, 'exam.conclusion.specialty', c.specialty, 150);
  if (!text(c.doctorName)) errors['exam.conclusion.doctorName'] = 'Nhập họ tên bác sĩ kết luận';
  else checkLength(errors, 'exam.conclusion.doctorName', c.doctorName, L.short);

  if (requireReason && !text(payload.reason)) errors.reason = 'Nhập lý do sửa phiếu đã có kết luận';
  else checkLength(errors, 'reason', payload.reason, L.text);
  return errors;
};
