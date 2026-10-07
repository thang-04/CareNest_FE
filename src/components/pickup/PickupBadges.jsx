import { CheckCircle2, Clock, UserMinus, XCircle } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { PICKUP_OUTCOME_LABELS, PICKUP_STATUS_LABELS } from '@/models/pickup/pickupConstants';

/* Tones follow DESIGN.md §6 */
export const PickupStatusBadge = createStatusBadge(
  { WAITING: ['orange', Clock], PICKED_UP: ['green', CheckCircle2], ABSENT: ['gray', UserMinus] },
  PICKUP_STATUS_LABELS,
);

export const PickupOutcomeBadge = createStatusBadge(
  { HANDED_OVER: ['green', CheckCircle2], NOT_HANDED_OVER: ['red', XCircle] },
  PICKUP_OUTCOME_LABELS,
);
