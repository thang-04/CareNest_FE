import { CheckCircle2, Clock, FileEdit, AlertTriangle, XCircle, Sparkles, Undo2, Award } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { AI_DRAFT_LABEL, EVAL_STATUS_LABELS, REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';

/* Tones follow DESIGN.md §6: purple = waiting for review, red = needs action, green = done. */
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
    DRAFT: ['gray', FileEdit],
    PENDING_VP: ['purple', Clock],
    PENDING_PRINCIPAL: ['purple', Clock],
    APPROVED: ['green', Award],
    RETURNED: ['red', Undo2],
    REJECTED: ['red', XCircle],
  },
  REWARD_STATUS_LABELS,
);

/** Label shown on every AI draft (GBR-AI: never official until the teacher confirms). */
export function AiDraftTag() {
  return (
    <span className="chip chip--purple">
      <Sparkles size={14} /> {AI_DRAFT_LABEL}
    </span>
  );
}
