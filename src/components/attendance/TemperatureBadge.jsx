import { HeartPulse } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTemperature } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';

/** Thân nhiệt kèm mức (màu cố định theo khoảng đo); mức bình thường chỉ hiện số. */
export function TemperatureBadge({ value, showLabel = true }) {
  const level = temperatureLevel(value);
  if (!level) return <span className="muted">{formatTemperature(value)}</span>;
  if (!level.chip) return <span>{formatTemperature(value)}</span>;
  // Tông lấy từ lớp chip của mức ('chip--red' -> 'red'); 'critical' là mức đỏ đậm nhất
  const tone = level.chip.replace('chip--', '');
  return (
    <span title={level.label}>
      <StatusBadge tone={tone} icon={HeartPulse} label={`${formatTemperature(value)}${showLabel ? ` · ${level.label}` : ''}`} />
    </span>
  );
}
