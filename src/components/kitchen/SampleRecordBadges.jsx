import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CheckCircle2, Clock, FileQuestion } from '@/components/ui/icons';
import { SAMPLE_DISPOSAL_LABELS, SAMPLE_STATUS_LABELS } from '@/models/kitchen/kitchenRecordConstants';

// Chờ duyệt = tím (DESIGN: chờ người duyệt), đã duyệt = xanh lá, chưa ghi hủy = xám
export const SampleStatusBadge = createStatusBadge(
  { RECORDED: ['purple', Clock], APPROVED: ['green', CheckCircle2] },
  SAMPLE_STATUS_LABELS,
);

export const SampleDisposalBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], RECORDED: ['purple', Clock], APPROVED: ['green', CheckCircle2] },
  SAMPLE_DISPOSAL_LABELS,
);
