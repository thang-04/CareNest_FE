import { formatDate } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { NUTRITION_STATUS_LABELS } from '@/models/children/childrenConstants';

const W = 640;
const H = 240;
const PAD = { top: 16, right: 20, bottom: 36, left: 48 };

const niceTicks = (min, max, count = 4) => {
  const span = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= count) || step * 10;
  const start = Math.floor(min / nice) * nice;
  const ticks = [];
  for (let v = start; v <= max + nice / 2; v += nice) ticks.push(Math.round(v * 10) / 10);
  return ticks;
};

/**
 * Plain SVG line chart of recorded values over time (no chart library).
 * points: [{ date, value, status }] in date order. A data table is shown next to it for screen readers.
 */
export function GrowthChart({ title, unit, points }) {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values) - 1, Math.max(...values) + 1);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const times = points.map((p) => new Date(p.date).getTime());
  const tMin = Math.min(...times);
  const tSpan = Math.max(...times) - tMin || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (t) => PAD.left + (points.length === 1 ? innerW / 2 : ((t - tMin) / tSpan) * innerW);
  const y = (v) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="tr-chart">
      <figcaption className="subsection-title">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="tr-chart__svg"
        role="img"
        aria-label={`${title}: từ ${formatNumber(first.value)} ${unit} ngày ${formatDate(first.date)} đến ${formatNumber(last.value)} ${unit} ngày ${formatDate(last.date)}, ${points.length} lần đo.`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="tr-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tr-chart__axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <text className="tr-chart__axis" x={PAD.left - 8} y={PAD.top - 4} textAnchor="end">
          {unit}
        </text>
        {points.map((p, i) => (
          <text key={`x${p.date}`} className="tr-chart__axis" x={x(times[i])} y={H - 12} textAnchor="middle">
            {formatDate(p.date).slice(0, 5)}/{p.date.slice(2, 4)}
          </text>
        ))}
        <path className="tr-chart__line" d={path} />
        {points.map((p, i) => (
          <circle
            key={p.date}
            className={`tr-chart__pt tr-chart__pt--${(p.status || 'NORMAL').toLowerCase()}`}
            cx={x(times[i])}
            cy={y(p.value)}
            r={5}
          >
            <title>
              {formatDate(p.date)}: {formatNumber(p.value)} {unit}
              {p.status ? ` – ${NUTRITION_STATUS_LABELS[p.status]}` : ''}
            </title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
