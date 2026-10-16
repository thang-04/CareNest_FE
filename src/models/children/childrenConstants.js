/**
 * Child records & child health (SRS screens #27–#35).
 *
 * @typedef {Object} HealthDeclaration   enrollment declaration (GBR-CP-02), never a diagnosis
 * @property {string} childId
 * @property {{ state: DeclarationState, items: string[] }} allergies   parent-provided; official as soon as the Vice Principal saves it
 * @property {{ state: DeclarationState, text: string }} diet
 * @property {{ state: DeclarationState, text: string }} otherNotes
 * @property {{ action: string, userId: string, userName: string, at: string, note?: string }[]} history
 *
 * @typedef {'REPORTED'|'NONE_REPORTED'|'NOT_PROVIDED'} DeclarationState
 *
 * @typedef {Object} HealthMeasurement
 * @property {string} id
 * @property {string} childId
 * @property {string|null} campaignId   health-check campaign; null = recorded outside a campaign
 * @property {string} date               yyyy-mm-dd
 * @property {number} heightCm
 * @property {number} weightKg
 * @property {number|null} headCircumferenceCm  null when not measured (over 60 months) or recorded before the field existed
 * @property {MotorResult|null} grossMotor
 * @property {MotorResult|null} fineMotor
 * @property {string} note               examination information, free text
 * @property {number} ageMonths          computed by the service
 * @property {number|null} bmi           computed by the service
 * @property {BmiStatus} bmiStatus       computed by the service (screening rule owned by the backend)
 * @property {HeadCircumferenceStatus|null} headCircumferenceStatus
 * @property {{ key: ScreeningCriterion, flagged: boolean }[]} criteria
 * @property {FollowUpLevel} followUpLevel
 * @property {{ code: string, label: string }} reference   reference standard used for the screening
 * @property {boolean} published         visible to linked parents (GBR-HLT-05)
 * @property {string} measuredBy / measuredByName
 * @property {{ at, userId, userName, reason, changes: { field, from, to }[] }[]} edits  (GBR-HLT-03)
 *
 * @typedef {'NO_ABNORMALITY'|'ABNORMAL'} MotorResult
 * @typedef {'LOW'|'NORMAL'|'HIGH'|'UNAVAILABLE'} BmiStatus
 * @typedef {'NORMAL'|'SMALL'|'LARGE'|'NOT_MEASURED'} HeadCircumferenceStatus
 * @typedef {'HEAD_CIRCUMFERENCE'|'GROSS_MOTOR'|'FINE_MOTOR'} ScreeningCriterion
 * @typedef {'NONE'|'WATCH'|'CLOSE_WATCH'|'UNAVAILABLE'} FollowUpLevel
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

export const MOTOR_RESULT = { NO_ABNORMALITY: 'NO_ABNORMALITY', ABNORMAL: 'ABNORMAL' };

export const MOTOR_RESULT_LABELS = { NO_ABNORMALITY: 'Không ghi nhận bất thường', ABNORMAL: 'Có bất thường' };

// Kết quả sàng lọc do BE tính (user chốt 2026-10-15, PROPOSED); nhãn trung tính, không phải chẩn đoán.
export const BMI_STATUS = { LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', UNAVAILABLE: 'UNAVAILABLE' };

export const BMI_STATUS_LABELS = {
  LOW: 'BMI thấp hơn chuẩn',
  NORMAL: 'BMI bình thường',
  HIGH: 'BMI cao hơn chuẩn',
  UNAVAILABLE: 'Chưa phân loại được',
};

export const HEAD_CIRCUMFERENCE_STATUS = { NORMAL: 'NORMAL', SMALL: 'SMALL', LARGE: 'LARGE', NOT_MEASURED: 'NOT_MEASURED' };

export const HEAD_CIRCUMFERENCE_STATUS_LABELS = {
  NORMAL: 'Trong chuẩn',
  SMALL: 'Bé hơn chuẩn',
  LARGE: 'To hơn chuẩn',
  NOT_MEASURED: 'Không đo',
};

export const SCREENING_CRITERIA_LABELS = {
  HEAD_CIRCUMFERENCE: 'Vòng đầu ngoài chuẩn',
  GROSS_MOTOR: 'Vận động thô có bất thường',
  FINE_MOTOR: 'Vận động tinh có bất thường',
};

export const FOLLOW_UP_LEVEL = { NONE: 'NONE', WATCH: 'WATCH', CLOSE_WATCH: 'CLOSE_WATCH', UNAVAILABLE: 'UNAVAILABLE' };

export const FOLLOW_UP_LEVEL_LABELS = {
  NONE: 'Không ghi nhận bất thường',
  WATCH: 'Cần theo dõi',
  CLOSE_WATCH: 'Cần theo dõi sát – đề nghị khám chuyên khoa',
  UNAVAILABLE: 'Chưa đủ dữ liệu',
};

/** Nhãn ngắn cho ô bảng. */
export const FOLLOW_UP_LEVEL_SHORT_LABELS = { ...FOLLOW_UP_LEVEL_LABELS, CLOSE_WATCH: 'Cần theo dõi sát' };

// Phụ huynh xem tất cả của bản đã công bố (P-13b, user chốt 2026-10-15, chờ BE ghi).
export const PARENT_VISIBLE_HEALTH_TEXT = 'số đo, biểu đồ, đánh giá vận động, phân loại BMI, mức theo dõi và ghi chú khám';

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
  headCircumferenceCm: 'Vòng đầu (cm)',
  grossMotor: 'Vận động thô',
  fineMotor: 'Vận động tinh',
  note: 'Ghi chú khám',
};

/**
 * Trục biểu đồ tăng trưởng theo nhóm tuổi: trẻ cùng nhóm dùng chung thang để so sánh, thang hẹp để thấy rõ độ dốc.
 * Chỉ là khung hiển thị, không phải ngưỡng đánh giá dinh dưỡng; số đo ngoài khung thì biểu đồ tự nới trục.
 */
export const GROWTH_CHART_AXES = {
  DEFAULT: { height: { min: 85, max: 120, step: 5 }, weight: { min: 8, max: 24, step: 2 }, head: { min: 44, max: 54, step: 2 } },
  'ag-2': { height: { min: 80, max: 100, step: 5 }, weight: { min: 8, max: 18, step: 2 }, head: { min: 44, max: 52, step: 2 } },
  'ag-3': { height: { min: 85, max: 105, step: 5 }, weight: { min: 10, max: 20, step: 2 }, head: { min: 44, max: 52, step: 2 } },
  'ag-4': { height: { min: 90, max: 115, step: 5 }, weight: { min: 12, max: 22, step: 2 }, head: { min: 46, max: 54, step: 2 } },
  'ag-5': { height: { min: 95, max: 120, step: 5 }, weight: { min: 14, max: 24, step: 2 }, head: { min: 46, max: 54, step: 2 } },
};

export const growthAxesFor = (ageGroupId) => GROWTH_CHART_AXES[ageGroupId] || GROWTH_CHART_AXES.DEFAULT;
