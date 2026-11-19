/*
 * Account module (SRS screens 2–4, 6, 7, 9): password recovery, password change, own profile, notification detail.
 * OTP/length bounds follow AUTH_CONTRACT; additional password policy is enforced by Keycloak.
 */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Why a password is being set without a session. */
export const PASSWORD_TOKEN_PURPOSE = {
  RESET: 'RESET',
  FIRST_LOGIN: 'FIRST_LOGIN',
};

export const GENDER = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' };
export const GENDER_LABELS = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

/** Profile fields a signed-in user may change; the rest is managed by the school (assumption, SRS silent). */
export const EDITABLE_PROFILE_FIELDS = ['phone', 'dateOfBirth', 'gender', 'address'];

export { NOTIFICATION_GROUPS, notificationTypeLabel as notificationGroupLabel } from '@/utils/notificationLabel.mjs';

/** Nhãn `staffRole` trong phân công (enum StaffRole của BE). */
export const STAFF_ROLE_LABELS = {
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng phụ trách',
  TEACHER: 'Giáo viên lớp',
  KITCHEN_STAFF: 'Nhân viên bếp',
};
