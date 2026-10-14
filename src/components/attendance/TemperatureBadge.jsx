import { formatTemperature } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';

/** Thân nhiệt kèm mức (màu cố định theo khoảng đo); mức bình thường chỉ hiện số. */
export function TemperatureBadge({ value, showLabel = true }) {
  const level = temperatureLevel(value);
  if (!level) return <span className="muted">{formatTemperature(value)}</span>;
  if (!level.chip) return <span>{formatTemperature(value)}</span>;
  return (
    <span className={`chip ${level.chip}`} title={level.label}>
      {formatTemperature(value)}
      {showLabel ? ` · ${level.label}` : ''}
    </span>
  );
}
