import { CheckCircle2, Clock, FileQuestion, PackageCheck } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import {
  FRESH_RECEIPT_STATUS_LABELS,
  ISSUE_STATUS_LABELS,
  MEAL_COUNT_STATUS_LABELS,
  PREP_STATUS_LABELS,
} from '@/models/kitchen/kitchenConstants';

/* Tones follow DESIGN.md §3.2: orange = waiting for someone else, blue = in progress, purple = waiting for approval, green = done. */
export const IssueStatusBadge = createStatusBadge(
  {
    NO_MENU: ['gray', FileQuestion],
    WAITING_MEAL_COUNT: ['orange', Clock],
    ISSUED: ['green', PackageCheck],
    PENDING_APPROVAL: ['purple', Clock],
    APPROVED: ['orange', Clock],
    RECEIVED: ['green', PackageCheck],
  },
  ISSUE_STATUS_LABELS,
);

export const FreshReceiptStatusBadge = createStatusBadge(
  { NEW: ['gray', FileQuestion], DRAFT: ['blue', Clock], SUBMITTED: ['purple', Clock], CONFIRMED: ['green', CheckCircle2] },
  FRESH_RECEIPT_STATUS_LABELS,
);

export const MealCountStatusBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], PENDING_CONFIRMATION: ['purple', Clock], CONFIRMED: ['green', CheckCircle2] },
  MEAL_COUNT_STATUS_LABELS,
);

export const PrepStatusBadge = createStatusBadge(
  {
    NOT_STARTED: ['gray', FileQuestion],
    WAITING: ['orange', Clock],
    COOKING: ['blue', Clock],
    READY_FOR_HANDOVER: ['green', CheckCircle2],
  },
  PREP_STATUS_LABELS,
);
