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
 * @property {MotorResult|null} grossMotor   mẫu cũ (trước phiếu Phụ lục II)
 * @property {MotorResult|null} fineMotor    mẫu cũ
 * @property {string} note               examination information, free text
 * @property {import('./healthExamForm').HealthExam|null} exam   phiếu Phụ lục II (kết quả trong đợt khám từ 2026-10-17)
 * @property {'DRAFT'|'CONCLUDED'|null} examStatus   phiếu nháp không hiện ở Sổ sức khỏe, xu hướng
 * @property {MeasurementSource} source  computed by the service
 * @property {number} ageMonths          computed by the service
 * @property {number|null} bmi           computed by the service; không còn nhãn phân loại BMI (user chốt 2026-10-17)
 * @property {HeadCircumferenceStatus|null} headCircumferenceStatus
 * @property {{ key: ScreeningCriterion, flagged: boolean }[]} criteria   chỉ mẫu cũ
 * @property {FollowUpLevel} followUpLevel   phiếu: theo kết luận bác sĩ; mẫu cũ: theo 3 tiêu chí
 * @property {'NORMAL'|'ISSUE'|'REFERRAL'|'TB_RISK'|null} conclusionCategory
 * @property {{ code: string, label: string }} reference   reference standard used for the screening
 * @property {boolean} published         visible to linked parents (GBR-HLT-05); BE công bố ngay khi lưu, trừ phiếu nháp (2026-10-23)
 * @property {ParentContact|null} parentContact  phiếu khám mức Cần theo dõi sát: đã trao đổi với phụ huynh chưa (BE tính)
 *
 * @typedef {Object} ParentContact
 * @property {boolean} contacted
 * @property {boolean} atExam            trao đổi tại buổi khám (có người đi cùng)
 * @property {string|null} on            ngày trao đổi
 * @property {string} opinion            ý kiến phụ huynh tại buổi khám
 * @property {string} measuredBy / measuredByName
 * @property {{ at, userId, userName, reason, changes: { field, from, to }[] }[]} edits  (GBR-HLT-03)
 *
 * @typedef {'NO_ABNORMALITY'|'ABNORMAL'} MotorResult
 * @typedef {'NORMAL'|'SMALL'|'LARGE'|'NOT_MEASURED'} HeadCircumferenceStatus
 * @typedef {'HEAD_CIRCUMFERENCE'|'GROSS_MOTOR'|'FINE_MOTOR'} ScreeningCriterion
 * @typedef {'NONE'|'KNOWN_STABLE'|'WATCH'|'CLOSE_WATCH'|'UNAVAILABLE'} FollowUpLevel
 * @typedef {'EXAM'|'LEGACY'|'MEASUREMENT_ONLY'} MeasurementSource
 */

export const MEASUREMENT_SOURCE = { EXAM: 'EXAM', LEGACY: 'LEGACY', MEASUREMENT_ONLY: 'MEASUREMENT_ONLY' };

export const MEASUREMENT_SOURCE_LABELS = {
  EXAM: 'Phiếu khám',
  LEGACY: 'Mẫu cũ',
  MEASUREMENT_ONLY: 'Cân đo, chưa có kết luận bác sĩ',
};

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

// Kết quả sàng lọc mẫu cũ do BE tính (user chốt 2026-10-15, PROPOSED); nhãn trung tính, không phải chẩn đoán.
// Bỏ nhãn phân loại BMI (user chốt 2026-10-17): chỉ còn số BMI.
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

// KNOWN_STABLE: vấn đề đã biết, không thay đổi — không phải cảnh báo; "Cần theo dõi" là vấn đề có thể chuyển biến (user chốt 2026-10-21).
export const FOLLOW_UP_LEVEL = {
  NONE: 'NONE',
  KNOWN_STABLE: 'KNOWN_STABLE',
  WATCH: 'WATCH',
  CLOSE_WATCH: 'CLOSE_WATCH',
  UNAVAILABLE: 'UNAVAILABLE',
};

export const FOLLOW_UP_LEVEL_LABELS = {
  NONE: 'Không ghi nhận bất thường',
  KNOWN_STABLE: 'Vấn đề đã biết, ổn định',
  WATCH: 'Cần theo dõi',
  CLOSE_WATCH: 'Cần theo dõi sát – đề nghị khám chuyên khoa',
  UNAVAILABLE: 'Chưa có kết luận bác sĩ',
};

/** Nhãn ngắn cho ô bảng. */
export const FOLLOW_UP_LEVEL_SHORT_LABELS = { ...FOLLOW_UP_LEVEL_LABELS, CLOSE_WATCH: 'Cần theo dõi sát' };

// Phụ huynh xem toàn bộ phiếu đã công bố (user chốt 2026-10-15, giữ 2026-10-17; chờ BE ghi).
export const PARENT_VISIBLE_HEALTH_TEXT =
  'toàn bộ phiếu khám (số đo, các phần khám, kết luận, lời tư vấn, chuyển khám), biểu đồ và ghi chú khám';

/**
 * Parent account state as stored on child.guardians[i].accountStatus: chưa có tài khoản liên kết với trẻ, hoặc trạng thái
 * tài khoản (`UserStatus` BE: ACTIVE / INACTIVE = bị khóa, AUTH-19).
 */
export const PARENT_ACCOUNT_STATUS = {
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export const PARENT_ACCOUNT_STATUS_LABELS = {
  NOT_ACTIVATED: 'Chưa kích hoạt',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã khóa',
};

export const SMS_STATUS = { SENT: 'SENT', FAILED: 'FAILED' };

export const SMS_STATUS_LABELS = { SENT: 'Đã gửi SMS', FAILED: 'Gửi SMS lỗi' };

/** Quan hệ phụ huynh–trẻ trên hồ sơ; tài khoản dùng cùng 6 loại (user chốt 2026-10-28, D-5a B); file Excel chỉ nhận các giá trị này. */
export const GUARDIAN_RELATIONS = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Anh/chị', 'Người giám hộ'];

/** Số phụ huynh tối đa trên hồ sơ một trẻ; BE cũng chặn (user chốt 2026-10-28, D-5b A). */
export const MAX_GUARDIANS = 3;

export const AI_TREND_STATUS = { OK: 'OK', NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA', FAILED: 'FAILED' };

/** Columns of the enrollment template (CSV / Excel), in order. */
export const IMPORT_COLUMNS = [
  { key: 'fullName', label: 'Họ tên trẻ', required: true },
  { key: 'dateOfBirth', label: 'Ngày sinh (dd/mm/yyyy)', required: true },
  { key: 'gender', label: 'Giới tính (Nam/Nữ)', required: true },
  { key: 'guardianName', label: 'Họ tên phụ huynh', required: true },
  { key: 'relation', label: 'Quan hệ (Bố, Mẹ, Ông, Bà, Anh/chị, Người giám hộ)', required: true },
  { key: 'phone', label: 'Số điện thoại', required: true },
  // CCCD phụ huynh bắt buộc cả khi nhập Excel (user chốt 2026-10-21); file mẫu cũ thiếu cột này không nhập được.
  { key: 'guardianIdNumber', label: 'Số CCCD phụ huynh', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'allergies', label: 'Dị ứng (để trống = chưa cung cấp, "Không" = không có)', required: false },
  { key: 'diet', label: 'Chế độ ăn (để trống = chưa cung cấp, "Không" = không có)', required: false },
  // Hành chính và tiền sử bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22); file mẫu cũ thiếu cột không nhập được.
  { key: 'idNumber', label: 'Số CCCD/mã định danh của trẻ', required: false },
  { key: 'premature', label: 'Sinh non (Có/Không)', required: true },
  { key: 'gestationWeeks', label: 'Tuần thai khi sinh (bắt buộc khi sinh non)', required: false },
  { key: 'ethnicity', label: 'Dân tộc', required: true },
  { key: 'beneficiary', label: 'Đối tượng', required: true },
  { key: 'bloodType', label: 'Nhóm máu', required: false },
  { key: 'province', label: 'Nơi ở - Tỉnh/thành', required: true },
  { key: 'ward', label: 'Nơi ở - Phường/xã', required: true },
  { key: 'street', label: 'Nơi ở - Số nhà/thôn/xóm', required: true },
  { key: 'selfHistory', label: 'Tiền sử bản thân ("Không" hoặc tên bệnh)', required: true },
  { key: 'familyHistory', label: 'Tiền sử gia đình ("Không" hoặc tên bệnh)', required: true },
  { key: 'tbContact', label: 'Tiếp xúc người bệnh lao (Có/Không)', required: true },
  // Bắt buộc khi cột trên là "Có" (user chốt 2026-10-21); kiểm theo dòng.
  { key: 'tbContactDate', label: 'Ngày tiếp xúc người bệnh lao gần nhất (dd/mm/yyyy)', required: false },
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
