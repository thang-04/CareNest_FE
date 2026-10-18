import { CalendarClock, CalendarCheck2, Archive } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { YEAR_STATUS_LABELS } from '@/models/school-config/schoolConfigConstants';

/* Tones follow DESIGN.md §3.2: waiting = orange, done/valid = green, inactive = gray. */
export const YearStatusBadge = createStatusBadge(
  { PLANNED: ['orange', CalendarClock], ACTIVE: ['green', CalendarCheck2], CLOSED: ['gray', Archive] },
  YEAR_STATUS_LABELS,
);
