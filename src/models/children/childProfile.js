import { formatDate } from '@/utils/format';
import { DECLARATION_STATE } from './childrenConstants';

/**
 * Hành chính và tiền sử của trẻ, hỏi khi tiếp nhận (user chốt 2026-10-17, PROPOSED — chờ BE).
 * Phiếu khám Phụ lục II luôn điền sẵn từ đây; lưu kết luận thì cập nhật ngược, có ghi lịch sử. Không bắt buộc khi tiếp nhận.
 *
 * @typedef {Object} ChildProfile          child.profile
 * @property {string} idNumber              số CC/CCCD/hộ chiếu/mã định danh
 * @property {'YES'|'NO'|''} premature      '' = chưa cung cấp
 * @property {number|null} gestationWeeks
 * @property {string} ethnicity
 * @property {string} beneficiary           "Đối tượng"
 * @property {string} paymentSource
 * @property {string} bloodType
 * @property {{ province: string, ward: string, street: string }} address
 *
 * @typedef {Object} MedicalHistory        declaration.medicalHistory
 * @property {{ state: string, text: string }} self
 * @property {{ state: string, text: string }} family
 * @property {{ state: string, contactDate: string }} tbContact   contactDate: ngày tiếp xúc gần nhất YYYY-MM-DD, chỉ khi REPORTED
 */

const S = DECLARATION_STATE;

export const emptyChildProfile = () => ({
  idNumber: '',
  premature: '',
  gestationWeeks: '',
  ethnicity: '',
  beneficiary: '',
  paymentSource: '',
  bloodType: '',
  address: { province: '', ward: '', street: '' },
});

export const emptyMedicalHistory = () => ({
  self: { state: S.NOT_PROVIDED, text: '' },
  family: { state: S.NOT_PROVIDED, text: '' },
  tbContact: { state: S.NOT_PROVIDED, contactDate: '' },
});

export const MEDICAL_HISTORY_ITEMS = [
  { key: 'self', label: 'Tiền sử bản thân', textLabel: 'Tên bệnh của trẻ', withText: true },
  { key: 'family', label: 'Tiền sử gia đình', textLabel: 'Tên bệnh trong gia đình', withText: true },
  // "Có" thì kèm ngày tiếp xúc gần nhất (user chốt 2026-10-21).
  { key: 'tbContact', label: 'Tiền sử tiếp xúc với người bệnh lao', withText: false, dateLabel: 'Ngày tiếp xúc gần nhất' },
];

export const MEDICAL_HISTORY_STATE_LABELS = { REPORTED: 'Có', NONE_REPORTED: 'Không', NOT_PROVIDED: 'Chưa cung cấp' };

export const PREMATURE_LABELS = { YES: 'Có', NO: 'Không', '': 'Chưa cung cấp' };

export const PROFILE_FIELD_LABELS = {
  idNumber: 'Số CC/CCCD/Hộ chiếu/Mã định danh',
  premature: 'Sinh non',
  gestationWeeks: 'Tuần thai khi sinh',
  ethnicity: 'Dân tộc',
  beneficiary: 'Đối tượng',
  paymentSource: 'Nguồn chi trả',
  bloodType: 'Nhóm máu',
  address: 'Nơi ở hiện tại',
};

export const PROFILE_FIELDS = Object.keys(PROFILE_FIELD_LABELS);

export const formatAddress = (a) => [a?.street, a?.ward, a?.province].filter((x) => x && String(x).trim()).join(', ');

/** Hồ sơ trẻ có ít nhất 1 ô hành chính đã nhập. */
export const hasProfileData = (p) =>
  !!p && PROFILE_FIELDS.some((k) => (k === 'address' ? !!formatAddress(p.address) : p[k] !== '' && p[k] != null));

/* ---------- Ánh xạ với phiếu khám Phụ lục II (measurement.exam.admin / exam.history) ---------- */
const blank = (v) => v === '' || v == null;

export const profileToExamAdmin = (p = emptyChildProfile()) => ({
  childIdNumber: p.idNumber || '',
  premature: p.premature || '',
  gestationWeeks: blank(p.gestationWeeks) ? '' : p.gestationWeeks,
  ethnicity: p.ethnicity || '',
  beneficiary: p.beneficiary || '',
  paymentSource: p.paymentSource || '',
  bloodType: p.bloodType || '',
  address: { province: p.address?.province || '', ward: p.address?.ward || '', street: p.address?.street || '' },
});

export const examAdminToProfile = (a) => ({
  idNumber: a.childIdNumber || '',
  premature: a.premature || '',
  gestationWeeks: blank(a.gestationWeeks) ? null : Number(a.gestationWeeks),
  ethnicity: a.ethnicity || '',
  beneficiary: a.beneficiary || '',
  paymentSource: a.paymentSource || '',
  bloodType: a.bloodType || '',
  address: { province: a.address?.province || '', ward: a.address?.ward || '', street: a.address?.street || '' },
});

const toYesNo = (state) => (state === S.REPORTED ? 'YES' : state === S.NONE_REPORTED ? 'NO' : '');
const fromYesNo = (v) => (v === 'YES' ? S.REPORTED : v === 'NO' ? S.NONE_REPORTED : S.NOT_PROVIDED);

/** Tiền sử trong khai báo ⇒ phần tiền sử của phiếu ("Chưa cung cấp" ⇒ để trống, giáo viên hỏi lại). */
export const historyToExam = (mh = emptyMedicalHistory()) => ({
  self: toYesNo(mh.self?.state),
  selfText: mh.self?.state === S.REPORTED ? mh.self.text || '' : '',
  family: toYesNo(mh.family?.state),
  familyText: mh.family?.state === S.REPORTED ? mh.family.text || '' : '',
  tbContact: toYesNo(mh.tbContact?.state),
  tbContactDate: mh.tbContact?.state === S.REPORTED ? mh.tbContact.contactDate || '' : '',
});

export const examToHistory = (h) => ({
  self: { state: fromYesNo(h.self), text: h.self === 'YES' ? h.selfText || '' : '' },
  family: { state: fromYesNo(h.family), text: h.family === 'YES' ? h.familyText || '' : '' },
  tbContact: { state: fromYesNo(h.tbContact), contactDate: h.tbContact === 'YES' ? h.tbContactDate || '' : '' },
});

/** Mô tả 1 mục tiền sử để hiển thị. */
export const historyItemText = (item, mh) => {
  const v = mh?.[item.key];
  if (!v) return MEDICAL_HISTORY_STATE_LABELS.NOT_PROVIDED;
  if (v.state === S.REPORTED && item.withText && v.text) return `Có — ${v.text}`;
  if (v.state === S.REPORTED && item.dateLabel && v.contactDate) return `Có — gần nhất ngày ${formatDate(v.contactDate)}`;
  return MEDICAL_HISTORY_STATE_LABELS[v.state];
};
