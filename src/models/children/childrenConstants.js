/**
 * Child records & child health (SRS screens #27–#35).
 *
 * @typedef {Object} HealthDeclaration   enrollment declaration (GBR-CP-02), never a diagnosis
 * @property {string} childId
 * @property {{ state: DeclarationState, items: string[] }} allergies   declared by the parent, confirmed later by the Principal
 * @property {{ state: DeclarationState, text: string }} diet
 * @property {{ state: DeclarationState, text: string }} otherNotes
 * @property {{ by: string, byName: string, at: string }|null} allergyConfirmation
 * @property {{ action: string, userId: string, userName: string, at: string, note?: string }[]} history
 *
 * @typedef {'REPORTED'|'NONE_REPORTED'|'NOT_PROVIDED'} DeclarationState
 *
 * @typedef {Object} HealthMeasurement
 * @property {string} id
 * @property {string} childId
 * @property {string} date               yyyy-mm-dd
 * @property {number} heightCm
 * @property {number} weightKg
 * @property {string} note               examination information, free text
 * @property {number} ageMonths          computed by the service
 * @property {number|null} bmi           computed by the service
 * @property {NutritionStatus} nutritionStatus  computed by the service by a fixed rule (GBR-HLT-02)
 * @property {boolean} published         visible to linked parents (GBR-HLT-05)
 * @property {string} measuredBy / measuredByName
 * @property {{ at, userId, userName, reason, changes: { field, from, to }[] }[]} edits  (GBR-HLT-03)
 *
 * @typedef {'NORMAL'|'MALNOURISHED'|'OBESE'|'UNAVAILABLE'} NutritionStatus
 */

export const DECLARATION_STATE = {
  REPORTED: 'REPORTED',
  NONE_REPORTED: 'NONE_REPORTED',
  NOT_PROVIDED: 'NOT_PROVIDED',
};

export const ALLERGY_STATE_LABELS = {
  REPORTED: 'Có dị ứng',
  NONE_REPORTED: 'Phụ huynh báo không có dị ứng',
  NOT_PROVIDED: 'Chưa cung cấp',
};

export const DIET_STATE_LABELS = {
  REPORTED: 'Có chế độ ăn riêng',
  NONE_REPORTED: 'Không có chế độ ăn riêng',
  NOT_PROVIDED: 'Chưa cung cấp',
};

export const NOTE_STATE_LABELS = {
  REPORTED: 'Có thông tin',
  NONE_REPORTED: 'Không có',
  NOT_PROVIDED: 'Chưa cung cấp',
};

export const NUTRITION_STATUS = {
  NORMAL: 'NORMAL',
  MALNOURISHED: 'MALNOURISHED',
  OBESE: 'OBESE',
  UNAVAILABLE: 'UNAVAILABLE',
};

export const NUTRITION_STATUS_LABELS = {
  NORMAL: 'Bình thường',
  MALNOURISHED: 'Suy dinh dưỡng',
  OBESE: 'Béo phì',
  UNAVAILABLE: 'Chưa phân loại được',
};

/** Parent account state as stored on child.guardians[i].accountStatus. */
export const PARENT_ACCOUNT_STATUS = {
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE',
};

export const PARENT_ACCOUNT_STATUS_LABELS = {
  NOT_ACTIVATED: 'Chưa kích hoạt',
  PENDING_ACTIVATION: 'Chờ phụ huynh đổi mật khẩu',
  ACTIVE: 'Đang hoạt động',
};

export const SMS_STATUS = { SENT: 'SENT', FAILED: 'FAILED' };

export const SMS_STATUS_LABELS = { SENT: 'Đã gửi SMS', FAILED: 'Gửi SMS lỗi' };

export const GUARDIAN_RELATIONS = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Anh/chị', 'Người giám hộ'];

export const AI_TREND_STATUS = { OK: 'OK', NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA', FAILED: 'FAILED' };

/** Columns of the enrollment template (CSV / Excel), in order. */
export const IMPORT_COLUMNS = [
  { key: 'fullName', label: 'Họ tên trẻ', required: true },
  { key: 'dateOfBirth', label: 'Ngày sinh (dd/mm/yyyy)', required: true },
  { key: 'gender', label: 'Giới tính (Nam/Nữ)', required: true },
  { key: 'guardianName', label: 'Họ tên phụ huynh', required: true },
  { key: 'relation', label: 'Quan hệ', required: true },
  { key: 'phone', label: 'Số điện thoại', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'allergies', label: 'Dị ứng (để trống = chưa cung cấp, "Không" = không có)', required: false },
  { key: 'diet', label: 'Chế độ ăn (để trống = chưa cung cấp, "Không" = không có)', required: false },
];

export const MEASUREMENT_FIELD_LABELS = {
  date: 'Ngày đo',
  heightCm: 'Chiều cao (cm)',
  weightKg: 'Cân nặng (kg)',
  note: 'Ghi chú khám',
};
