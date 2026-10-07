import { AGE_GROUPS } from '@/models/School';

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

export const emptyGuardian = () => ({ fullName: '', relation: 'Mẹ', phone: '', email: '' });

export const emptyDeclaration = () => ({
  allergies: { state: 'NOT_PROVIDED', items: [] },
  diet: { state: 'NOT_PROVIDED', text: '' },
  otherNotes: { state: 'NOT_PROVIDED', text: '' },
});
