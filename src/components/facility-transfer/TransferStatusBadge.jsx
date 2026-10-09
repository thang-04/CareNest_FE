import { CheckCircle2, Clock, FileEdit, PackageCheck, AlertTriangle, XCircle, Scale } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
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
