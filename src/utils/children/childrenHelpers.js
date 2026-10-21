import { AGE_GROUPS } from '@/models/School';
import { MOTOR_RESULT_LABELS } from '@/models/children/childrenConstants';
import { emptyChildProfile, emptyMedicalHistory } from '@/models/children/childProfile';
import { formatDate } from '@/utils/format';

/**
 * Display hint only: the age group a child normally joins in a school year (by birth year).
 * The service validates the placement; this just preselects the age group in the form.
 */
export const suggestAgeGroupId = (dateOfBirth, schoolYear) => {
  if (!dateOfBirth || !schoolYear) return '';
  const startYear = Number(String(schoolYear).slice(0, 4));
  const age = startYear - Number(dateOfBirth.slice(0, 4));
  const map = { 2: 'ag-2', 3: 'ag-3', 4: 'ag-4', 5: 'ag-5' };
  return map[age] || (age < 2 ? AGE_GROUPS[0].id : AGE_GROUPS[AGE_GROUPS.length - 1].id);
};

/** Masks a phone number for list views: 0912 *** 678. */
export const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return phone || '';
  return `${digits.slice(0, 4)} *** ${digits.slice(-3)}`;
};

export const formatNumber = (value, digits = 1) =>
  value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });

export const emptyGuardian = () => ({ fullName: '', relation: 'Mẹ', phone: '', idNumber: '', email: '' });

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
