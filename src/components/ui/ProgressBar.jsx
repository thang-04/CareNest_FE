/** Thin progress bar with an "x/y" label. tone: primary | green | purple. */
export function ProgressBar({ value, total, tone = 'primary', label }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress" title={`${value}/${total}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
      <div className="progress__track">
        <div className={`progress__bar progress__bar--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="progress__label">{label ?? `${value}/${total}`}</span>
    </div>
  );
}
