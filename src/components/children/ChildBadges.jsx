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
  Handshake,
  FileCheck2,
  Hourglass,
  Stethoscope,
  ShieldAlert,
  Info,
  Send,
} from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import { CHILD_STATUS_LABELS } from '@/models/School';
import {
  ALLERGY_STATE_LABELS,
  DIET_STATE_LABELS,
  FOLLOW_UP_LEVEL_LABELS,
  FOLLOW_UP_LEVEL_SHORT_LABELS,
  HEAD_CIRCUMFERENCE_STATUS_LABELS,
  MOTOR_RESULT_LABELS,
  NOTE_STATE_LABELS,
  PARENT_ACCOUNT_STATUS_LABELS,
  SMS_STATUS_LABELS,
} from '@/models/children/childrenConstants';
import { CAMPAIGN_STATUS_LABELS, CHILD_RESULT_STATUS_LABELS, FOLLOW_UP_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { CONCLUSION_CATEGORY_LABELS } from '@/models/children/healthExamForm';
import { formatDate } from '@/utils/format';

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

/* Kết luận bác sĩ (BE trả nhóm): chuyển khám, nguy cơ lao, bất thường mới khi đang theo dõi = cần xử lý (red);
   có vấn đề, tư vấn = cần để ý (orange); đang theo dõi, chưa ghi nhận thêm = đang thực hiện (blue). */
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

/* Phiếu theo dõi: chờ trao đổi = cần để ý; đã trao đổi = đang thực hiện; có kết quả khám ngoài = thông tin; đã đóng = hoàn tất. */
export const FollowUpStatusBadge = createStatusBadge(
  {
    WAITING_PARENT_CONTACT: ['orange', Clock],
    PARENT_CONTACTED: ['blue', Handshake],
    EXTERNAL_RESULT_RECORDED: ['teal', FileCheck2],
    CLOSED: ['green', CheckCircle2],
  },
  FOLLOW_UP_STATUS_LABELS,
);

/* Công bố kết quả cho phụ huynh (BE công bố khi lưu, 2026-10-23): đã công bố = hoàn tất (green), chưa công bố = chưa có (gray). */
export const PublishStatusBadge = createStatusBadge(
  {
    PUBLISHED: ['green', CheckCircle2],
    UNPUBLISHED: ['gray', MinusCircle],
  },
  { PUBLISHED: 'Đã công bố', UNPUBLISHED: 'Chưa công bố' },
);

/* Phiếu khám mức Cần theo dõi sát đã trao đổi với phụ huynh chưa: chưa = việc của giáo viên (orange). */
export const ParentContactBadge = createStatusBadge(
  {
    CONTACTED: ['green', Handshake],
    NOT_CONTACTED: ['orange', Clock],
  },
  { CONTACTED: 'Đã trao đổi phụ huynh', NOT_CONTACTED: 'Chưa trao đổi phụ huynh' },
);

/** Hạn trao đổi của vòng theo dõi (BE trả dueOn, overdueDays). Quá hạn = cần xử lý (red). */
export function FollowUpDueBadge({ dueOn, overdueDays = 0, hideOnTime = false }) {
  if (!dueOn) return null;
  if (overdueDays > 0) return <StatusBadge tone="red" icon={Hourglass} label={`Quá hạn ${overdueDays} ngày`} />;
  return hideOnTime ? null : <span className="muted text-xs">Hạn trao đổi {formatDate(dueOn)}</span>;
}
