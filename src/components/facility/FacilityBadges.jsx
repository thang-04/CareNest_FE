import { CheckCircle2, Clock, FileEdit, XCircle, Stamp, Send, Lock } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS, REQUEST_STATUS_LABELS, PROPOSAL_STATUS_LABELS } from '@/models/facility/facilityConstants';

/* Tones follow the shared convention in components/ui/StatusBadge.jsx (DESIGN.md §6). */
export const IssueStatusBadge = createStatusBadge(
  {
    SUBMITTED: ['purple', Send],
    APPROVED: ['green', CheckCircle2],
    REJECTED: ['red', XCircle],
  },
  ISSUE_STATUS_LABELS,
);

export const RequestStatusBadge = createStatusBadge(
  {
    SUBMITTED: ['purple', Send],
    PENDING_PRINCIPAL: ['purple', Stamp],
    APPROVED: ['green', CheckCircle2],
    REJECTED: ['red', XCircle],
  },
  REQUEST_STATUS_LABELS,
);

export const ProposalStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    SUBMITTED: ['purple', Clock],
    APPROVED: ['green', CheckCircle2],
    REJECTED: ['red', XCircle],
    CANCELLED: ['gray', XCircle],
  },
  PROPOSAL_STATUS_LABELS,
);

const TYPE_TONES = { DAMAGED: 'red', MISSING: 'red', INSUFFICIENT: 'orange' };

/** Category tag (not a status): damaged / missing red, shortage orange. */
export function IssueTypeChip({ type }) {
  return <span className={`chip chip--${TYPE_TONES[type] || 'gray'}`}>{ISSUE_TYPE_LABELS[type] || type}</span>;
}

/** Room locked by a running inventory round (DESIGN 12.5). */
export function LockChip({ code }) {
  if (!code) return null;
  return (
    <span className="chip chip--orange" title={`Đang kiểm kê ${code}: tạm khóa thay đổi dữ liệu tài sản`}>
      <Lock size={12} /> Đang kiểm kê {code}
    </span>
  );
}
