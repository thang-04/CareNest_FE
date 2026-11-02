import { StatCardIcon } from './StatCardIcon';

/**
 * Thẻ số liệu (DESIGN §6.3): nhãn trên, số to theo tông, icon mờ ở góc.
 * `onClick` ⇒ nút lọc (aria-pressed = `active`). `loading` ⇒ vạch khung chờ thay số, không hiện "0" khi dữ liệu chưa về.
 * `icon`: bỏ trống = icon theo tông, `false` = không icon.
 */
export function StatCard({ tone = 'blue', label, value, icon, loading = false, active = false, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'div';
  const classes = ['stat-card', `stat-card--${tone}`, active && 'stat-card--active', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...(onClick ? { type: 'button', onClick, 'aria-pressed': active } : {})} aria-busy={loading || undefined}>
      <div className="stat-card__value">{loading ? <span className="skeleton stat-card__skeleton" /> : value}</div>
      <div className="stat-card__label">{label}</div>
      {icon !== false && <StatCardIcon tone={tone} icon={icon} />}
    </Tag>
  );
}
