import { CalendarClock, CalendarCheck2, Archive, ShieldCheck, ShieldHalf, ShieldOff } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { PERMISSION_LEVEL_LABELS, YEAR_STATUS_LABELS } from '@/models/school-config/schoolConfigConstants';

/* Tones follow DESIGN.md §6: waiting = orange, done/valid = green, inactive = gray. */
export const YearStatusBadge = createStatusBadge(
  { PLANNED: ['orange', CalendarClock], ACTIVE: ['green', CalendarCheck2], CLOSED: ['gray', Archive] },
  YEAR_STATUS_LABELS,
);

export const PermissionLevelBadge = createStatusBadge(
  { FULL: ['green', ShieldCheck], RESTRICTED: ['blue', ShieldHalf], NONE: ['gray', ShieldOff] },
  PERMISSION_LEVEL_LABELS,
);
