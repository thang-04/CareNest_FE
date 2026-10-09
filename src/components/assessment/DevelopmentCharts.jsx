import { useState } from 'react';
import { BarChart3, Table2 } from '@/components/ui/icons';
import { formatDate } from '@/utils/format';

/*
 * Weekly progress in plain SVG (no chart library). Two single-series charts instead of one dual-axis chart:
 * flags per week (count) and share of criteria met (%). A table view carries the same numbers.
 */

const W = 420;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 30, left: 32 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

function Axis({ max, ticks, suffix = '' }) {
  return ticks.map((t) => {
    const y = PAD.top + plotH - (t / max) * plotH;
    return (
      <g key={t}>
        <line className="dg-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
        <text className="dg-chart__axis" x={PAD.left - 6} y={y + 3} textAnchor="end">
          {t}
          {suffix}
        </text>
      </g>
    );
  });
}

function FlagBars({ weeks }) {
  const max = Math.max(5, ...weeks.map((w) => w.flags));
  const step = plotW / Math.max(weeks.length, 1);
  const barW = Math.min(28, step - 8);
  return (
    <svg className="dg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Số cờ bé ngoan theo tuần">
      <Axis max={max} ticks={[0, Math.round(max / 2), max]} />
      {weeks.map((w, i) => {
        const h = (w.flags / max) * plotH;
        const x = PAD.left + i * step + (step - barW) / 2;
        const base = PAD.top + plotH;
        const y = base - h;
        const r = Math.min(4, h);
        return (
          <g key={w.weekStart}>
            <rect className="dg-chart__hit" x={PAD.left + i * step} y={PAD.top} width={step} height={plotH}>
              <title>{`Tuần ${formatDate(w.weekStart)}: ${w.flags} cờ, ${w.presentDays} ngày có mặt`}</title>
            </rect>
            {w.flags > 0 && (
              <path
                className={`dg-chart__bar ${w.finished ? '' : 'dg-chart__bar--muted'}`}
                d={`M${x},${base} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                pointerEvents="none"
              />
            )}
            {w.flags > 0 && (
              <text className="dg-chart__value" x={x + barW / 2} y={y - 4} textAnchor="middle">
                {w.flags}
              </text>
            )}
            <text className="dg-chart__axis" x={PAD.left + i * step + step / 2} y={H - 10} textAnchor="middle">
              {dm(w.weekStart)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RateLine({ weeks }) {
  const step = plotW / Math.max(weeks.length, 1);
  const pts = weeks
    .map((w, i) =>
      w.criteriaRate == null ? null : { x: PAD.left + i * step + step / 2, y: PAD.top + plotH - (w.criteriaRate / 100) * plotH, w },
    )
    .filter(Boolean);
  const last = pts[pts.length - 1];
  return (
    <svg className="dg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tỉ lệ tiêu chí đạt theo tuần">
      <Axis max={100} ticks={[0, 50, 100]} suffix="%" />
      {pts.length > 1 && <polyline className="dg-chart__line" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />}
      {pts.map((p) => (
        <g key={p.w.weekStart}>
          <circle className="dg-chart__hit" cx={p.x} cy={p.y} r={14}>
            <title>{`Tuần ${formatDate(p.w.weekStart)}: đạt ${p.w.criteriaRate}% tiêu chí`}</title>
          </circle>
          <circle className="dg-chart__dot" cx={p.x} cy={p.y} r={5} pointerEvents="none" />
        </g>
      ))}
      {last && (
        <text className="dg-chart__value" x={last.x} y={last.y - 10} textAnchor="middle">
          {last.w.criteriaRate}%
        </text>
      )}
      {weeks.map((w, i) => (
        <text key={w.weekStart} className="dg-chart__axis" x={PAD.left + i * step + step / 2} y={H - 10} textAnchor="middle">
          {dm(w.weekStart)}
        </text>
      ))}
    </svg>
  );
}

export function DevelopmentCharts({ weeks }) {
  const [view, setView] = useState('chart');
  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">Tiến bộ theo tuần</div>
        <div className="row" role="group" aria-label="Kiểu hiển thị">
          <button
            className={`btn btn--sm ${view === 'chart' ? 'btn--outline-primary' : ''}`}
            aria-pressed={view === 'chart'}
            onClick={() => setView('chart')}
          >
            <BarChart3 size={15} /> Biểu đồ
          </button>
          <button
            className={`btn btn--sm ${view === 'table' ? 'btn--outline-primary' : ''}`}
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
          >
            <Table2 size={15} /> Bảng
          </button>
        </div>
      </div>
      <div className="card__body">
        {view === 'chart' ? (
          <div className="dg-chart-grid">
            <div className="dg-chart-card">
              <div className="subsection-title">Số cờ bé ngoan mỗi tuần</div>
              <FlagBars weeks={weeks} />
            </div>
            <div className="dg-chart-card">
              <div className="subsection-title">Tỉ lệ tiêu chí đạt (%)</div>
              <RateLine weeks={weeks} />
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Tuần</th>
                  <th className="right">Ngày có mặt</th>
                  <th className="right">Lượt đánh giá</th>
                  <th className="right">Cờ bé ngoan</th>
                  <th className="right">Tiêu chí đạt</th>
                  <th>Đánh giá tuần</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekStart}>
                    <td className="nowrap">
                      {formatDate(w.weekStart)} – {formatDate(w.weekEnd)}
                    </td>
                    <td className="right">{w.presentDays}</td>
                    <td className="right">{w.assessments}</td>
                    <td className="right">{w.flags}</td>
                    <td className="right">{w.criteriaRate == null ? '—' : `${w.criteriaRate}%`}</td>
                    <td>
                      {w.evaluationConfirmed ? (
                        <span className="chip chip--green">Đã công bố</span>
                      ) : w.finished ? (
                        <span className="chip chip--gray">Chưa có đánh giá công bố</span>
                      ) : (
                        <span className="muted">Tuần đang diễn ra</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted text-xs mt-8">Cột màu nhạt: tuần đang diễn ra, số liệu chưa đầy đủ.</div>
      </div>
    </div>
  );
}
