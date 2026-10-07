/**
 * Shared school structure used by many modules (classes, children, attendance, health, assessment…).
 * @typedef {Object} SchoolClass
 * @property {string} id
 * @property {string} name
 * @property {string} campusId
 * @property {string} ageGroupId
 * @property {string|null} locationId   room of the class (facility module)
 * @property {string|null} homeroomTeacherId
 * @property {string[]} teacherIds
 * @property {string} schoolYear         '2026-2027'
 * @property {number} capacity
 *
 * @typedef {Object} Child
 * @property {string} id
 * @property {string} code
 * @property {string} fullName
 * @property {'MALE'|'FEMALE'} gender
 * @property {string} dateOfBirth        yyyy-mm-dd
 * @property {string|null} classId
 * @property {string} campusId
 * @property {'ACTIVE'|'PENDING_PLACEMENT'|'LEFT'} status
 * @property {string} enrolledAt
 * @property {string[]} allergies
 * @property {{ fullName: string, relation: string, phone: string, email: string, accountStatus: 'NOT_ACTIVATED'|'ACTIVE' }[]} guardians
 */

export const AGE_GROUPS = [
  { id: 'ag-2', name: 'Nhà trẻ (24–36 tháng)', shortName: 'Nhà trẻ' },
  { id: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)', shortName: 'Mẫu giáo bé' },
  { id: 'ag-4', name: 'Mẫu giáo nhỡ (4–5 tuổi)', shortName: 'Mẫu giáo nhỡ' },
  { id: 'ag-5', name: 'Mẫu giáo lớn (5–6 tuổi)', shortName: 'Mẫu giáo lớn' },
];

export const ageGroupById = (id) => AGE_GROUPS.find((g) => g.id === id) || null;

export const CHILD_STATUS = {
  ACTIVE: 'ACTIVE',
  PENDING_PLACEMENT: 'PENDING_PLACEMENT',
  LEFT: 'LEFT',
};

export const CHILD_STATUS_LABELS = {
  ACTIVE: 'Đang học',
  PENDING_PLACEMENT: 'Chờ xếp lớp',
  LEFT: 'Đã nghỉ học',
};

export const GENDER_LABELS = { MALE: 'Nam', FEMALE: 'Nữ' };

/** Age in months on a given date (yyyy-mm-dd). */
export const ageInMonths = (dateOfBirth, on = new Date().toISOString().slice(0, 10)) => {
  const [y1, m1, d1] = dateOfBirth.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

export const ageLabel = (dateOfBirth) => {
  const m = ageInMonths(dateOfBirth);
  return m < 36 ? `${m} tháng` : `${Math.floor(m / 12)} tuổi ${m % 12} tháng`;
};
