import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Table2 } from '@/components/ui/icons';
import './mini-charts.css';

const pct = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

/**
 * Thanh xếp hạng theo tỷ lệ (vd. có mặt theo lớp). Độ dài = value/total của chính hàng, không so với hàng lớn nhất.
 * rows: [{ key, label, meta, value, total, pending, to }] đã xếp sẵn; `pending` = chưa có số (hiện chip thay thanh).
 */
export function RankBars({ rows, caption, valueLabel = 'Có mặt', pendingLabel = 'Chưa điểm danh' }) {
  const [table, setTable] = useState(false);
  return (
    <div className="mc-rank">
      {table ? (
        <div className="table-wrap">
          <table className="table table--compact">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Lớp</th>
                <th scope="col" className="right">
                  {valueLabel}
                </th>
                <th scope="col" className="right">
                  Sĩ số
                </th>
                <th scope="col" className="right">
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
                  <td className="right">{r.pending ? '—' : r.value}</td>
                  <td className="right">{r.total}</td>
                  <td className="right">{r.pending ? pendingLabel : `${pct(r.value, r.total)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mc-rank__list" aria-label={caption}>
          {rows.map((r) => {
            const body = (
              <>
                <span className="mc-rank__label">
                  {r.label}
                  {r.meta && <small className="muted"> {r.meta}</small>}
                </span>
                {r.pending ? (
                  <span>
                    <span className="chip chip--orange">{pendingLabel}</span>
                  </span>
                ) : (
                  <span className="mc-rank__track" aria-hidden="true">
                    <span className="mc-rank__fill" style={{ width: `${pct(r.value, r.total)}%` }} />
                  </span>
                )}
                <span className="mc-rank__end">
                  {r.pending ? (
                    <small className="muted">{r.total} trẻ</small>
                  ) : (
                    <>
                      <b>{pct(r.value, r.total)}%</b>{' '}
                      <small className="muted">
                        {r.value}/{r.total}
                      </small>
                    </>
                  )}
                </span>
              </>
            );
            return (
              <li key={r.key}>
                {r.to ? (
                  <Link to={r.to} className="mc-rank__row">
                    {body}
                  </Link>
                ) : (
                  <div className="mc-rank__row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="mc-rank__toggle" onClick={() => setTable((v) => !v)}>
        {table ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />}
        {table ? 'Xem dạng biểu đồ' : 'Xem dạng bảng'}
      </button>
    </div>
  );
}
