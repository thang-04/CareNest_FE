import { AlertTriangle, Archive, CheckCircle2, ClipboardCheck, ClipboardList, Hourglass, Users } from '@/components/ui/icons';

// Icon lớn mờ ở góc thẻ số liệu (T2), chọn theo tông vì tông đã mang nghĩa thống nhất (xem StatusBadge)
const TONE_ICON = {
  blue: ClipboardList,
  orange: Hourglass,
  red: AlertTriangle,
  purple: ClipboardCheck,
  green: CheckCircle2,
  gray: Archive,
  teal: Users,
};

export function StatCardIcon({ tone = 'blue', icon }) {
  const Icon = icon || TONE_ICON[tone] || ClipboardList;
  return (
    <span className="stat-card__icon" aria-hidden="true">
      <Icon size={76} stroke={1.75} />
    </span>
  );
}
