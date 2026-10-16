import {
  CheckCircle2,
  Clock,
  UserX,
  AlertTriangle,
  MinusCircle,
  KeyRound,
  UserCheck,
  UserPlus,
  Eye,
  CalendarClock,
  CircleX,
  Handshake,
  FileCheck2,
} from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CHILD_STATUS_LABELS } from '@/models/School';
import {
  BMI_STATUS_LABELS,
  FOLLOW_UP_LEVEL_LABELS,
  FOLLOW_UP_LEVEL_SHORT_LABELS,
  HEAD_CIRCUMFERENCE_STATUS_LABELS,
  MOTOR_RESULT_LABELS,
  PARENT_ACCOUNT_STATUS_LABELS,
} from '@/models/children/childrenConstants';
import { CAMPAIGN_STATUS_LABELS, CHILD_RESULT_STATUS_LABELS, FOLLOW_UP_STATUS_LABELS } from '@/models/children/healthCheckConstants';

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
export const BmiStatusBadge = createStatusBadge(
  {
    NORMAL: ['green', CheckCircle2],
    LOW: ['orange', AlertTriangle],
    HIGH: ['orange', AlertTriangle],
    UNAVAILABLE: ['gray', MinusCircle],
  },
  BMI_STATUS_LABELS,
);

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

const FOLLOW_UP_STYLE = {
  NONE: ['green', CheckCircle2],
  WATCH: ['orange', Eye],
  CLOSE_WATCH: ['red', AlertTriangle],
  UNAVAILABLE: ['gray', MinusCircle],
};

export const FollowUpLevelBadge = createStatusBadge(FOLLOW_UP_STYLE, FOLLOW_UP_LEVEL_LABELS);

/** Nhãn ngắn cho ô bảng. */
export const FollowUpLevelShortBadge = createStatusBadge(FOLLOW_UP_STYLE, FOLLOW_UP_LEVEL_SHORT_LABELS);

export const ParentAccountBadge = createStatusBadge(
  {
    NOT_ACTIVATED: ['gray', UserPlus],
    PENDING_ACTIVATION: ['orange', KeyRound],
    ACTIVE: ['green', UserCheck],
  },
  PARENT_ACCOUNT_STATUS_LABELS,
);

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
    RECORDED: ['green', CheckCircle2],
    ABSENT: ['gray', UserX],
  },
  CHILD_RESULT_STATUS_LABELS,
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
