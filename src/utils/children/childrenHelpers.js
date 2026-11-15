import { AGE_GROUPS, CHILD_STATUS } from '@/models/School';
import { MOTOR_RESULT_LABELS } from '@/models/children/childrenConstants';
import { emptyChildProfile, emptyMedicalHistory } from '@/models/children/childProfile';
import { formatDate } from '@/utils/format';

/**
 * Display hint only: the age group a child normally joins in a school year (by birth year).
 * The service validates the placement; this just preselects the age group in the form.
 * yearStart: ngày bắt đầu năm học (BE, "2026-09-01") hoặc id năm mock ("2026-2027"); ageGroups: nhóm tuổi có
 * ageFromMonths/ageToMonths (BE hoặc AGE_GROUPS). Tuổi theo năm sinh; ngoài khoảng ⇒ nhóm nhỏ nhất/lớn nhất.
 */
export const suggestAgeGroupId = (dateOfBirth, yearStart, ageGroups = AGE_GROUPS) => {
  if (!dateOfBirth || !yearStart || !ageGroups.length) return '';
  const months = (Number(String(yearStart).slice(0, 4)) - Number(dateOfBirth.slice(0, 4))) * 12;
  const sorted = [...ageGroups].sort((a, b) => a.ageFromMonths - b.ageFromMonths);
  const match = sorted.find((g) => g.ageFromMonths <= months && months < g.ageToMonths);
  return (match || (months < sorted[0].ageFromMonths ? sorted[0] : sorted[sorted.length - 1])).id;
};

/**
 * Danh sách trẻ theo trạng thái đang lọc: chưa chọn ⇒ chỉ trẻ đang học, chờ xếp lớp; trẻ đã nghỉ chỉ hiện khi chọn
 * "Đã nghỉ" (user chốt 2026-11-11, G94-180/CHD-09 giữ nguyên, chỉ đổi mặc định hiển thị).
 */
export const childrenOfStatus = (children, status) =>
  status ? children.filter((c) => c.status === status) : children.filter((c) => c.status !== CHILD_STATUS.LEFT);

/** Nhóm tuổi theo id trong danh sách (BE id số/chuỗi, mock 'ag-*'); không có ⇒ null. */
export const ageGroupIn = (ageGroups, id) => ageGroups.find((g) => id != null && String(g.id) === String(id)) || null;

/** Masks a phone number for list views: 0912 *** 678. */
export const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return phone || '';
  return `${digits.slice(0, 4)} *** ${digits.slice(-3)}`;
};

export const formatNumber = (value, digits = 1) =>
  value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });

/** Tuổi lúc đo theo tháng BE trả: dưới 36 tháng ghi tháng, từ 36 tháng ghi năm + tháng. */
export const formatAgeMonths = (months) =>
  months == null ? '—' : months < 36 ? `${months} tháng` : `${Math.floor(months / 12)} tuổi ${months % 12} tháng`;

/** Mức theo dõi theo bác sĩ được tính là cảnh báo ở Sổ sức khỏe (bộ lọc "Chỉ lần có cảnh báo"), cùng mức BMI khác Bình thường. */
const WARNING_FOLLOW_UP_LEVELS = ['WATCH', 'CLOSE_WATCH', 'KNOWN_STABLE'];

/** Lần đo có cảnh báo, theo trường BE trả (chỉ để lọc hiển thị, không tính lại mức). */
export const hasHealthWarning = (m) => (!!m.bmiStatus && m.bmiStatus !== 'NORMAL') || WARNING_FOLLOW_UP_LEVELS.includes(m.followUpLevel);

/** Điểm trường chọn sẵn khi tiếp nhận / nhập Excel: chỉ 1 thì chọn luôn; nhiều thì điểm trường của tài khoản nếu có trong danh sách. */
export const defaultCampusId = (campuses, user) =>
  campuses.length === 1 ? campuses[0].id : campuses.some((c) => c.id === user?.campusId) ? user.campusId : '';

export const emptyGuardian = () => ({ fullName: '', relation: 'Mẹ', phone: '', idNumber: '', email: '' });

/**
 * Phụ huynh có CCCD trùng tài khoản (accountOf, BE trả): họ tên, SĐT, email theo tài khoản để hiển thị, kiểm nhập và gửi đi.
 * accountOnly: người lưu không có quyền kích hoạt tài khoản phụ huynh ⇒ luôn theo tài khoản, không sửa được (P-18 A).
 */
export const withGuardianAccounts = (guardians, accountOf, { accountOnly = false } = {}) =>
  guardians.map((g) => {
    const acc = accountOf(g.idNumber);
    if (!acc) return g;
    if (accountOnly) return { ...g, fullName: acc.fullName, phone: acc.phone, email: acc.email || '' };
    // Chỉ điền ô còn trống; số người dùng đã gõ giữ nguyên — sửa ở hồ sơ thì tài khoản đổi theo (user chốt 2026-10-28).
    return { ...g, fullName: g.fullName || acc.fullName, phone: g.phone || acc.phone, email: g.email || acc.email || '' };
  });

/** Bước 1 của form tiếp nhận: thông tin trẻ, phụ huynh và phần hành chính (dùng cho phiếu khám). */
export const emptyChildInfo = () => ({
  fullName: '',
  dateOfBirth: '',
  gender: '',
  guardians: [emptyGuardian()],
  profile: emptyChildProfile(),
});

export const emptyDeclaration = () => ({
  allergies: { state: 'NOT_PROVIDED', items: [] },
  diet: { state: 'NOT_PROVIDED', text: '' },
  otherNotes: { state: 'NOT_PROVIDED', text: '' },
  medicalHistory: emptyMedicalHistory(),
});

/** Tông điểm biểu đồ theo kết quả BE trả (chỉ ánh xạ hiển thị, không tính lại). */
export const screeningTone = (status) =>
  status === 'NORMAL' ? 'normal' : !status || status === 'UNAVAILABLE' || status === 'NOT_MEASURED' ? 'unavailable' : 'alert';

/** Giá trị cũ/mới trong lịch sử sửa số đo. */
export const formatMeasurementChange = (field, value) => {
  if (value == null || value === '') return '(trống)';
  if (field === 'date') return formatDate(value);
  if (field === 'grossMotor' || field === 'fineMotor') return MOTOR_RESULT_LABELS[value] || String(value);
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
};
