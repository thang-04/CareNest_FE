import { CheckCircle2, Clock, FileEdit, PackageCheck, AlertTriangle, XCircle, Scale } from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import { TRANSFER_STATUS_LABELS } from '@/models/facility-transfer/transferConstants';

/* Tones follow the shared convention in components/ui/StatusBadge.jsx */
export const TransferStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    PENDING_HANDOVER: ['orange', Clock],
    REVISION_REQUESTED: ['red', AlertTriangle],
    PENDING_RECEIPT: ['blue', PackageCheck],
    PENDING_RESOLUTION: ['purple', Scale],
    COMPLETED: ['green', CheckCircle2],
    CANCELLED: ['gray', XCircle],
  },
  TRANSFER_STATUS_LABELS,
);

/** Trạng thái một lần báo chênh lệch: chờ PHT xử lý (vàng) → đã xử lý (xanh lá). */
export const DiscrepancyStatusBadge = createStatusBadge(
  { OPEN: ['purple', Scale], RESOLVED: ['green', CheckCircle2] },
  { OPEN: 'Chờ PHT xử lý', RESOLVED: 'Đã xử lý' },
);

const STOCK_STATE_TONES = { UPDATED: 'green', UNCHANGED: 'gray', EXPECTED: 'orange' };

/** Nhãn biến động tồn kho; nhãn có giờ cập nhật nên truyền từ ngoài thay vì bảng nhãn cố định. */
export function StockStateBadge({ state, label }) {
  return <StatusBadge tone={STOCK_STATE_TONES[state] || 'gray'} label={label} />;
}
