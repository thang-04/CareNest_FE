import { CheckCircle2, Clock, UserX, AlertTriangle, MinusCircle, KeyRound, UserCheck, UserPlus } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CHILD_STATUS_LABELS } from '@/models/School';
import { NUTRITION_STATUS_LABELS, PARENT_ACCOUNT_STATUS_LABELS } from '@/models/children/childrenConstants';

/* Tones follow DESIGN.md §6. */
export const ChildStatusBadge = createStatusBadge(
  {
    ACTIVE: ['green', CheckCircle2],
    PENDING_PLACEMENT: ['orange', Clock],
    LEFT: ['gray', UserX],
  },
  CHILD_STATUS_LABELS,
);

/** Shows the status returned by the service rule; the UI never computes it. */
export const NutritionBadge = createStatusBadge(
  {
    NORMAL: ['green', CheckCircle2],
    MALNOURISHED: ['red', AlertTriangle],
    OBESE: ['red', AlertTriangle],
    UNAVAILABLE: ['gray', MinusCircle],
  },
  NUTRITION_STATUS_LABELS,
);

export const ParentAccountBadge = createStatusBadge(
  {
    NOT_ACTIVATED: ['gray', UserPlus],
    PENDING_ACTIVATION: ['orange', KeyRound],
    ACTIVE: ['green', UserCheck],
  },
  PARENT_ACCOUNT_STATUS_LABELS,
);
