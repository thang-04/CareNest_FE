import { CheckCircle2, Clock, FileEdit, XCircle, ClipboardList, RotateCcw, Send, Stamp } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ROUND_STATUS_LABELS, SHEET_STATUS_LABELS } from '@/models/inventory-inspection/inspectionConstants';

/* Tones follow the shared convention in components/ui/StatusBadge.jsx */
export const RoundStatusBadge = createStatusBadge(
  {
    DRAFT: ['gray', FileEdit],
    IN_PROGRESS: ['blue', ClipboardList],
    PENDING_APPROVAL: ['purple', Stamp],
    COMPLETED: ['green', CheckCircle2],
    CANCELLED: ['gray', XCircle],
  },
  ROUND_STATUS_LABELS,
);

export const SheetStatusBadge = createStatusBadge(
  {
    ASSIGNED: ['orange', Clock],
    IN_PROGRESS: ['blue', ClipboardList],
    SUBMITTED: ['purple', Send],
    RECOUNT_REQUESTED: ['red', RotateCcw],
    APPROVED: ['green', CheckCircle2],
    CANCELLED: ['gray', XCircle],
  },
  SHEET_STATUS_LABELS,
);

export { ProgressBar } from '@/components/ui/ProgressBar';
