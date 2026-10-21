import {
  AlertTriangle,
  ArrowUp,
  Award,
  CalendarClock,
  CalendarCheck2,
  Archive,
  CircleCheck,
  CircleX,
  Eye,
  PauseCircle,
  Repeat,
  ShieldCheck,
  ShieldHalf,
  ShieldOff,
  UserMinus,
} from '@/components/ui/icons';
import { StatusBadge, createStatusBadge } from '@/components/ui/StatusBadge';
import {
  CLASS_FILL_LABELS,
  PERMISSION_LEVEL_LABELS,
  PLACEMENT_ACTION_SHORT,
  YEAR_STATUS_LABELS,
} from '@/models/school-config/schoolConfigConstants';
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

/* Chưa có người phụ trách = chờ người khác làm (orange). label đổi được theo ngữ cảnh ("Chưa có" trong bảng lớp). */
export const UnassignedBadge = ({ label = 'Chưa phân công' }) => <StatusBadge tone="orange" icon={UserMinus} label={label} />;

export const StaffStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CircleCheck], INACTIVE: ['gray', PauseCircle] },
  { ACTIVE: 'Đang hoạt động', INACTIVE: 'Đã vô hiệu hóa' },
);

/* Kết quả xếp lớp năm mới, kèm số trẻ khi truyền `count` ("Lên lớp: 12"). */
const PLACEMENT_ACTION_STYLE = {
  PROMOTE: ['green', ArrowUp],
  STAY: ['orange', Repeat],
  LEAVE: ['gray', UserMinus],
  GRADUATE: ['blue', Award],
};
export function PlacementActionBadge({ action, count }) {
  const [tone, icon] = PLACEMENT_ACTION_STYLE[action] || ['gray', null];
  const label = PLACEMENT_ACTION_SHORT[action] || action;
  return <StatusBadge tone={tone} icon={icon} label={count == null ? label : `${label}: ${count}`} />;
}
