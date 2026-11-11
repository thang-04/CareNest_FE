/**
 * Thanh tiến độ nhiều trạng thái (vd. đợt khám: đã kết luận · đang khám · vắng · chưa khám) kèm chú giải có số đếm.
 * segments: [{ key, label, value, tone, hideZero }] theo thứ tự vẽ; tone: green | blue | orange | red | gray | rest (phần còn lại,
 * để trống trên rãnh). Số đếm do BE trả, thanh chỉ chia tỉ lệ để vẽ. Vẽ bằng SVG theo % để không cần style inline.
 */
export function SegmentedProgress({ segments, total, label }) {
  const shown = segments.filter((s) => !s.hideZero || s.value > 0);
  let x = 0;
  const bars = shown
    .filter((s) => s.tone !== 'rest' && s.value > 0 && total > 0)
    .map((s) => {
      const width = (s.value / total) * 100;
      const bar = { ...s, x, width };
      x += width;
      return bar;
    });
  return (
    <div className="seg-progress">
      <svg
        className="seg-progress__track"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${shown.map((s) => `${s.label} ${s.value}`).join(', ')}, tổng ${total}`}
      >
        {bars.map((b) => (
          <rect key={b.key} className={`seg-progress__bar seg-progress__bar--${b.tone}`} x={b.x} y="0" width={b.width} height="10" />
        ))}
      </svg>
      <ul className="seg-progress__legend">
        {shown.map((s) => (
          <li key={s.key}>
            <span className={`seg-progress__dot seg-progress__dot--${s.tone}`} aria-hidden="true" />
            <span className="seg-progress__name">{s.label}</span>
            <span className="seg-progress__value">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
