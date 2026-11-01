import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Table2 } from '@/components/ui/icons';
import './mini-charts.css';

const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

/**
 * Cột dọc xếp hạng theo tỷ lệ (vd. có mặt theo lớp), đáy 0%. Cột dưới `average` tô cam, còn lại xám; đường đứt = `average`.
 * rows: [{ key, label, meta, value, total, pending, to }] đã xếp sẵn; `pending` = chưa có số (cột gạch chéo).
 */
export function RankBars({ rows, caption, average, valueLabel = 'Có mặt', pendingLabel = 'Chưa điểm danh', averageLabel = 'Mức chung' }) {
  const [table, setTable] = useState(false);
  const hasAverage = average != null;
  return (
    <div className="mc-rank">
      {table ? (
        <div className="table-wrap">
          <table className="table table--compact">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Lớp</th>
                <th scope="col" className="num">
                  {valueLabel}
                </th>
                <th scope="col" className="num">
                  Sĩ số
                </th>
                <th scope="col" className="num">
                  Tỷ lệ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.label}
                    {r.meta && <span className="muted"> · {r.meta}</span>}
                  </td>
                  <td className="num">{r.pending ? '—' : r.value}</td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.pending ? pendingLabel : `${pct(r.value, r.total)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ul className="mc-cols__legend" aria-hidden="true">
            {hasAverage && (
              <>
                <li>
                  <i className="mc-cols__swatch mc-cols__swatch--low" />
                  Dưới mức chung
                </li>
                <li>
                  <i className="mc-cols__swatch" />
                  Từ mức chung trở lên
                </li>
                <li>
                  <i className="mc-cols__swatch mc-cols__swatch--line" />
                  {averageLabel} {average}%
                </li>
              </>
            )}
            {rows.some((r) => r.pending) && (
              <li>
                <i className="mc-cols__swatch mc-cols__swatch--pending" />
                {pendingLabel}
              </li>
            )}
          </ul>
          <div className="mc-cols__scroll">
            <ul className="mc-cols" aria-label={caption}>
              {hasAverage && <li className="mc-cols__avg" style={{ '--avg': average }} aria-hidden="true" />}
              {rows.map((r) => {
                const rate = pct(r.value, r.total);
                const low = !r.pending && hasAverage && rate < average;
                const label = r.pending
                  ? `${r.label}: ${pendingLabel.toLowerCase()}, sĩ số ${r.total}`
                  : `${r.label}: ${valueLabel.toLowerCase()} ${r.value}/${r.total} (${rate}%)`;
                const body = (
                  <>
                    <span className="mc-cols__plot">
                      <b className="mc-cols__value">{r.pending ? '—' : `${rate}%`}</b>
                      <span
                        className={`mc-cols__bar ${r.pending ? 'mc-cols__bar--pending' : low ? 'mc-cols__bar--low' : ''}`}
                        style={r.pending ? undefined : { '--rate': rate }}
                      />
                    </span>
                    <span className="mc-cols__label">
                      {r.label}
                      {r.meta && <small className="muted">{r.meta}</small>}
                    </span>
                  </>
                );
                return (
                  <li key={r.key}>
                    {r.to ? (
                      <Link to={r.to} className="mc-cols__col" title={label} aria-label={label}>
                        {body}
                      </Link>
                    ) : (
                      <div className="mc-cols__col" title={label} aria-label={label}>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      <button type="button" className="mc-rank__toggle" onClick={() => setTable((v) => !v)}>
        {table ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
        {table ? 'Xem dạng biểu đồ' : 'Xem dạng bảng'}
      </button>
    </div>
  );
}
