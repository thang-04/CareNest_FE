import { CheckCircle2, Clock, FileEdit, AlertTriangle, XCircle, Undo2, Award, Ticket, Lock, Unlock } from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import { EVAL_STATUS_LABELS, REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';

/* Tones follow DESIGN.md §3.2: purple = waiting for review, red = needs action, green = done. */
export const EvaluationStatusBadge = createStatusBadge(
  {
    AWAITING_REVIEW: ['purple', Clock],
    AI_FAILED: ['red', AlertTriangle],
    CONFIRMED: ['green', CheckCircle2],
  },
  EVAL_STATUS_LABELS,
);

export const RewardStatusBadge = createStatusBadge(
  {
    NONE: ['gray', null],
    DRAFT: ['gray', FileEdit],
    PENDING_VP: ['purple', Clock],
    PENDING_PRINCIPAL: ['purple', Clock],
    APPROVED: ['green', Award],
    RETURNED: ['red', Undo2],
    REJECTED: ['red', XCircle],
  },
  REWARD_STATUS_LABELS,
);

/** Như createStatusBadge, nhưng nhãn kèm số liệu / thời hạn do nơi dùng truyền qua `detail`. */
const createDetailBadge = (styleMap, labels) =>
  function DetailStatusBadge({ status, detail, size }) {
    const [tone, icon] = styleMap[status] || ['gray', null];
    const label = detail ? `${labels[status]} ${detail}` : labels[status];
    return <StatusBadge tone={tone} icon={icon} label={label} size={size} />;
  };

/** Tuần đã kết thúc: đánh giá tuần đã công bố hay chưa. */
export const WeekPublishBadge = createStatusBadge(
  { PUBLISHED: ['green', CheckCircle2], MISSING: ['gray', FileEdit] },
  { PUBLISHED: 'Đã công bố', MISSING: 'Chưa có đánh giá công bố' },
);

/** Phiếu bé ngoan: đủ điều kiện / đã phát / chờ phát (kèm số lượng qua `detail`). */
export const TicketBadge = createDetailBadge(
  { ELIGIBLE: ['green', CheckCircle2], ISSUED: ['teal', Ticket], PENDING_ISSUE: ['orange', Clock] },
  { ELIGIBLE: 'Đủ điều kiện', ISSUED: 'Đã phát', PENDING_ISSUE: 'Chờ phát' },
);

/** Lần mở lại ngày đánh giá: còn hiệu lực hay đã hết hạn (hạn truyền qua `detail`). */
export const UnlockWindowBadge = createDetailBadge(
  { ACTIVE: ['green', Unlock], EXPIRED: ['gray', Lock], REVOKED: ['red', Lock] },
  { ACTIVE: 'Đến', EXPIRED: 'Đã hết ·', REVOKED: 'Kết thúc sớm ·' },
);

// Nhãn bản nháp AI dùng chung (components/ui/AiDraftTag)
export { AiDraftTag } from '@/components/ui/AiDraftTag';
