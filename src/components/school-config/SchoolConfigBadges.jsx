import {
  AlertTriangle,
  CalendarClock,
  CalendarCheck2,
  Archive,
  CircleCheck,
  CircleX,
  Eye,
  PauseCircle,
  ShieldCheck,
  ShieldHalf,
  ShieldOff,
} from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CLASS_FILL_LABELS, PERMISSION_LEVEL_LABELS, YEAR_STATUS_LABELS } from '@/models/school-config/schoolConfigConstants';
import { ROOM_STATUS_LABELS } from '@/models/Location';

/* Tones follow DESIGN.md §3.2: waiting = orange, done/valid = green, inactive = gray. */
export const YearStatusBadge = createStatusBadge(
  { PLANNED: ['orange', CalendarClock], ACTIVE: ['green', CalendarCheck2], CLOSED: ['gray', Archive] },
  YEAR_STATUS_LABELS,
);

export const PermissionLevelBadge = createStatusBadge(
  {
    FULL: ['green', ShieldCheck],
    RESTRICTED: ['blue', ShieldHalf],
    VIEW_FULL: ['teal', Eye],
    VIEW_RESTRICTED: ['teal', Eye],
    NONE: ['gray', ShieldOff],
  },
  PERMISSION_LEVEL_LABELS,
);

export const RoomStatusBadge = createStatusBadge({ ACTIVE: ['green', CircleCheck], INACTIVE: ['gray', PauseCircle] }, ROOM_STATUS_LABELS);

/* Gần đủ = cần để ý (orange), đã đủ = không xếp thêm trẻ được (red), còn chỗ = xanh lá. */
export const ClassFillBadge = createStatusBadge(
  { OPEN: ['green', CircleCheck], NEAR: ['orange', AlertTriangle], FULL: ['red', CircleX] },
  CLASS_FILL_LABELS,
);

export const StaffStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CircleCheck], INACTIVE: ['gray', PauseCircle] },
  { ACTIVE: 'Đang hoạt động', INACTIVE: 'Đã vô hiệu hóa' },
);
