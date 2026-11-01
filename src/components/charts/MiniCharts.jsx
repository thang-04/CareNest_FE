import { Link } from 'react-router-dom';
import './mini-charts.css';

/* Biểu đồ nhỏ tự vẽ (SVG), không thêm thư viện. Chỉ hiển thị số liệu được truyền vào từ service. */

/** Danh sách thanh ngang, độ dài = phần của nhóm trên tổng, không phải so với nhóm lớn nhất. rows: [{ key, label, value, color, to, meta, error }] */
export function BarList({ rows }) {
  const total = Math.max(
    1,
    rows.reduce((sum, r) => sum + (r.error ? 0 : r.value), 0),
  );
  return (
    <ul className="mc-bars">
      {rows.map((row) => {
        const body = (
          <>
            <span className="mc-bars__head">
              <span className="mc-bars__label">{row.label}</span>
              <b className={`mc-bars__value ${row.value ? '' : 'mc-bars__value--zero'}`}>{row.error ? '—' : row.value}</b>
            </span>
            {row.meta && <span className={`mc-bars__meta ${row.error ? 'mc-bars__meta--error' : ''}`}>{row.meta}</span>}
            <span className="mc-bars__track" aria-hidden="true">
              <span className="mc-bars__fill" style={{ width: `${row.error ? 0 : (row.value / total) * 100}%`, background: row.color }} />
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {row.to ? (
              <Link to={row.to} className="mc-bars__row">
                {body}
              </Link>
            ) : (
              <div className="mc-bars__row">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Biểu đồ vòng tỷ lệ (CH3). segments: [{ key, label, value, color }]; số ở giữa là `center`.
 * Chỉ vẽ số được truyền vào, không tự tính nghiệp vụ.
 */
export function DonutChart({ segments, center, caption }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let acc = 0;
  const stops = total
    ? segments.map((s) => {
        const from = (acc / total) * 100;
        acc += s.value;
        return `${s.color} ${from}% ${(acc / total) * 100}%`;
      })
    : ['var(--color-secondary) 0 100%'];
  return (
    <div className="mc-donut">
      <div className="mc-donut__ring" style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label={caption}>
        <span className="mc-donut__center">{center}</span>
      </div>
      <ul className="mc-donut__legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} aria-hidden="true" />
            <span>{s.label}</span>
            <b>{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
