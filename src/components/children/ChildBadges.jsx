import {
  CheckCircle2,
  Clock,
  UserX,
  AlertTriangle,
  MinusCircle,
  Lock,
  UserCheck,
  UserPlus,
  Eye,
  CalendarClock,
  CircleX,
  Stethoscope,
  ShieldAlert,
  Info,
  Send,
  Scale,
  Sparkles,
} from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import { CHILD_STATUS_LABELS } from '@/models/School';
import {
  ALLERGY_STATE_LABELS,
  BMI_STATUS_LABELS,
  DIET_STATE_LABELS,
  FOLLOW_UP_LEVEL_LABELS,
  FOLLOW_UP_LEVEL_SHORT_LABELS,
  HEAD_CIRCUMFERENCE_STATUS_LABELS,
  MOTOR_RESULT_LABELS,
  NOTE_STATE_LABELS,
  PARENT_ACCOUNT_STATUS_LABELS,
  SMS_STATUS_LABELS,
} from '@/models/children/childrenConstants';
import {
  CAMPAIGN_KIND_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CHILD_RESULT_STATUS_LABELS,
  MEASUREMENT_RESULT_STATUS_LABELS,
} from '@/models/children/healthCheckConstants';
import { CONCLUSION_CATEGORY_LABELS } from '@/models/children/healthExamForm';
import { TREND_REVIEW_STATUS_LABELS } from '@/models/children/childrenConstants';

/* Tones follow DESIGN.md §3.2. */
export const ChildStatusBadge = createStatusBadge(
  {
    ACTIVE: ['green', CheckCircle2],
    PENDING_PLACEMENT: ['orange', Clock],
    LEFT: ['gray', UserX],
  },
  CHILD_STATUS_LABELS,
);

/* Kết quả sàng lọc do BE trả; UI không tự tính. Ngoài khoảng bình thường = cần để ý (orange), không dùng màu chẩn đoán. */
export const HeadCircumferenceBadge = createStatusBadge(
  {
    NORMAL: ['green', CheckCircle2],
    SMALL: ['orange', AlertTriangle],
    LARGE: ['orange', AlertTriangle],
    NOT_MEASURED: ['gray', MinusCircle],
  },
  HEAD_CIRCUMFERENCE_STATUS_LABELS,
);

export const MotorResultBadge = createStatusBadge(
  {
    NO_ABNORMALITY: ['green', CheckCircle2],
    ABNORMAL: ['orange', AlertTriangle],
  },
  MOTOR_RESULT_LABELS,
);

// Vấn đề đã biết, ổn định là nhãn thông tin (teal), không phải cảnh báo (user chốt 2026-10-21).
const FOLLOW_UP_STYLE = {
  NONE: ['green', CheckCircle2],
  KNOWN_STABLE: ['teal', Info],
  WATCH: ['orange', Eye],
  CLOSE_WATCH: ['red', AlertTriangle],
  UNAVAILABLE: ['gray', MinusCircle],
};

export const FollowUpLevelBadge = createStatusBadge(FOLLOW_UP_STYLE, FOLLOW_UP_LEVEL_LABELS);

/** Nhãn ngắn cho ô bảng. */
export const FollowUpLevelShortBadge = createStatusBadge(FOLLOW_UP_STYLE, FOLLOW_UP_LEVEL_SHORT_LABELS);

/*
 * Mức BMI theo tuổi WHO (BE trả bmiStatus, HLT-18): gầy còm nặng, béo phì = cần xử lý (red); gầy còm, thừa cân = cần để ý (orange,
 * cảnh báo); nguy cơ thừa cân = cần để ý nhẹ (orange, icon Eye như "Cần theo dõi"; không dùng vàng — dành cho chờ duyệt, DESIGN §2.1.7).
 */
export const BmiStatusBadge = createStatusBadge(
  {
    SEVERE_THINNESS: ['red', AlertTriangle],
    THINNESS: ['orange', AlertTriangle],
    NORMAL: ['green', CheckCircle2],
    OVERWEIGHT_RISK: ['orange', Eye],
    OVERWEIGHT: ['orange', AlertTriangle],
    OBESE: ['red', AlertTriangle],
  },
  BMI_STATUS_LABELS,
);

/* NO_ACCOUNT: trẻ chưa có phụ huynh nào có tài khoản = cần cấp (orange). */
export const ParentAccountBadge = createStatusBadge(
  {
    NOT_ACTIVATED: ['gray', UserPlus],
    ACTIVE: ['green', UserCheck],
    INACTIVE: ['gray', Lock],
    NO_ACCOUNT: ['orange', UserPlus],
  },
  { ...PARENT_ACCOUNT_STATUS_LABELS, NO_ACCOUNT: 'Chưa có tài khoản' },
);

export const SmsStatusBadge = createStatusBadge(
  { SENT: ['green', Send], FAILED: ['red', AlertTriangle] },
  { ...SMS_STATUS_LABELS, FAILED: 'Gửi SMS lỗi – cần gửi lại' },
);

/* Khai báo của phụ huynh: chưa cung cấp = chờ phụ huynh (orange), báo không có = đã khai (green).
   Có dị ứng = cần lưu ý khi chế biến (red); có chế độ ăn / thông tin khác = thông tin (teal). */
const DECLARATION_STATE_STYLE = { NONE_REPORTED: ['green', CheckCircle2], NOT_PROVIDED: ['orange', Clock] };

export const AllergyStateBadge = createStatusBadge({ ...DECLARATION_STATE_STYLE, REPORTED: ['red', AlertTriangle] }, ALLERGY_STATE_LABELS);

export const DietStateBadge = createStatusBadge({ ...DECLARATION_STATE_STYLE, REPORTED: ['teal', Info] }, DIET_STATE_LABELS);

export const NoteStateBadge = createStatusBadge({ ...DECLARATION_STATE_STYLE, REPORTED: ['teal', Info] }, NOTE_STATE_LABELS);

/** Kết quả kiểm tra một dòng file nhập trẻ: hợp lệ = green, có lỗi = cần sửa (red). */
export function ImportRowResultBadge({ errorCount = 0 }) {
  return errorCount > 0 ? (
    <StatusBadge tone="red" icon={AlertTriangle} label={`${errorCount} lỗi`} />
  ) : (
    <StatusBadge tone="green" icon={CheckCircle2} label="Hợp lệ" />
  );
}

/* Đợt khám: đang diễn ra = blue (chấm sáng), đã đóng = hoàn tất. */
export const CampaignStatusBadge = createStatusBadge(
  {
    UPCOMING: ['gray', CalendarClock],
    IN_PROGRESS: ['blue', null],
    CLOSED: ['green', CheckCircle2],
    CANCELLED: ['gray', CircleX],
  },
  CAMPAIGN_STATUS_LABELS,
);

export const ChildResultBadge = createStatusBadge(
  {
    NOT_RECORDED: ['orange', Clock],
    IN_PROGRESS: ['blue', Stethoscope],
    RECORDED: ['green', CheckCircle2],
    ABSENT: ['gray', UserX],
    NOT_CONCLUDED: ['gray', MinusCircle],
  },
  CHILD_RESULT_STATUS_LABELS,
);

/* Trẻ trong kỳ cân đo: không có nháp, kết luận (user chốt 2026-10-31). */
export const MeasurementResultBadge = createStatusBadge(
  {
    NOT_RECORDED: ['orange', Clock],
    RECORDED: ['green', CheckCircle2],
    ABSENT: ['gray', UserX],
  },
  MEASUREMENT_RESULT_STATUS_LABELS,
);

/* Loại: đợt khám (bác sĩ khám) hay kỳ cân đo (giáo viên cân đo). Chỉ là nhãn phân loại, tone trung tính. */
export const CampaignKindBadge = createStatusBadge(
  {
    EXAM: ['blue', Stethoscope],
    MEASUREMENT: ['gray', Scale],
  },
  CAMPAIGN_KIND_LABELS,
);

/* Tổng hợp cân đo mẫu 5.1: điểm trường có kỳ/đợt chưa đóng trong tháng ⇒ số liệu còn thay đổi (đang xử lý = xanh dương, §3.2). */
export const GrowthReportDataBadge = createStatusBadge({ PROVISIONAL: ['blue', Clock] }, { PROVISIONAL: 'Số liệu chưa chốt' });

/* Kết luận bác sĩ (BE trả nhóm): chuyển khám, nguy cơ lao, bất thường mới khi đang theo dõi = cần xử lý (red);
   có vấn đề, tư vấn = cần để ý (orange); đang theo dõi, chưa ghi nhận thêm = đang thực hiện (blue). FOLLOWING_* chỉ ở dữ liệu cũ. */
export const ConclusionCategoryBadge = createStatusBadge(
  {
    NORMAL: ['green', CheckCircle2],
    ISSUE: ['orange', Eye],
    REFERRAL: ['red', AlertTriangle],
    TB_RISK: ['red', ShieldAlert],
    FOLLOWING_NO_NEW: ['blue', Eye],
    FOLLOWING_NEW: ['red', AlertTriangle],
  },
  CONCLUSION_CATEGORY_LABELS,
);

/* Công bố kết quả cho phụ huynh (BE công bố khi lưu, 2026-10-23): đã công bố = hoàn tất (green), chưa công bố = chưa có (gray). */
export const PublishStatusBadge = createStatusBadge(
  {
    PUBLISHED: ['green', CheckCircle2],
    UNPUBLISHED: ['gray', MinusCircle],
  },
  { PUBLISHED: 'Đã công bố', UNPUBLISHED: 'Chưa công bố' },
);

/* Nhận định xu hướng: nháp AI chờ duyệt (purple), đã duyệt (green) — HLT-05, HLT-21. */
export const TrendReviewBadge = createStatusBadge(
  {
    DRAFT: ['purple', Sparkles],
    APPROVED: ['green', CheckCircle2],
  },
  TREND_REVIEW_STATUS_LABELS,
);
