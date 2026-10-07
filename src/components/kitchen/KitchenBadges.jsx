import { CheckCircle2, Clock, CookingPot, FileQuestion, PackageCheck, Scale, Truck, UtensilsCrossed } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import {
  ISSUE_STATUS_LABELS,
  MEAL_COUNT_STATUS_LABELS,
  MISSING_STATUS_LABELS,
  PREP_STATUS_LABELS,
} from '@/models/kitchen/kitchenConstants';

/* Tones follow DESIGN.md §6: orange = waiting for someone else, blue = in progress, purple = waiting for approval, green = done. */
export const PrepStatusBadge = createStatusBadge(
  {
    NOT_STARTED: ['gray', FileQuestion],
    WAITING: ['orange', Clock],
    COOKING: ['blue', CookingPot],
    READY_FOR_HANDOVER: ['green', UtensilsCrossed],
  },
  PREP_STATUS_LABELS,
);

export const IssueStatusBadge = createStatusBadge(
  {
    NO_MENU: ['gray', FileQuestion],
    WAITING_MEAL_COUNT: ['orange', Clock],
    PENDING_APPROVAL: ['purple', Scale],
    APPROVED: ['blue', Truck],
    RECEIVED: ['green', PackageCheck],
  },
  ISSUE_STATUS_LABELS,
);

export const MissingStatusBadge = createStatusBadge(
  { SUBMITTED: ['orange', Clock], SUPPLIED: ['green', CheckCircle2] },
  MISSING_STATUS_LABELS,
);

export const MealCountStatusBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], PENDING_CONFIRMATION: ['purple', Clock], CONFIRMED: ['green', CheckCircle2] },
  MEAL_COUNT_STATUS_LABELS,
);
