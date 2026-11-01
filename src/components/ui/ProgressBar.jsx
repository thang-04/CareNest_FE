/** Progress bar with an "x/y" label. tone: primary | green | purple. Xong 100% thì xanh lá, chưa xong thì sọc chạy. */
export function ProgressBar({ value, total, tone = 'primary', label }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const done = total > 0 && value >= total;
  return (
    <div className="progress" title={`${value}/${total}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
      <div className="progress__track">
        <div
          className={`progress__bar progress__bar--${done ? 'green' : tone} ${done || !pct ? '' : 'progress__bar--run'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Tổng 0 thì không ghi "0/0" (đọc như lỗi chia cho 0) */}
      <span className="progress__label">{label ?? (total ? `${value}/${total}` : '—')}</span>
    </div>
  );
}
