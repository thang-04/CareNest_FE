import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CheckCircle2, FileQuestion } from '@/components/ui/icons';
import { INSPECTION_STATUS_LABELS } from '@/models/kitchen/inspectionConstants';

// Chưa ký = xám, đã ký = xanh lá (DESIGN §3.2)
export const InspectionStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileQuestion], SIGNED: ['green', CheckCircle2] },
  INSPECTION_STATUS_LABELS,
);
