import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight } from '@/components/ui/icons';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/States';

/**
 * Card of one dashboard widget with its own loading / error / empty state,
 * so one failing service never breaks the whole dashboard (DESIGN §14).
 */
export function Widget({
  title,
  icon: Icon,
  to,
  linkLabel = 'Xem tất cả',
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = 'Không có việc cần xử lý',
  emptyText,
  emptyIcon,
  children,
}) {
  let body = children;
  if (loading) {
    body = (
      <div className="db-skeleton" aria-busy="true" aria-label="Đang tải">
        <div className="skeleton" style={{ width: '70%' }} />
        <div className="skeleton" style={{ width: '90%' }} />
        <div className="skeleton" style={{ width: '55%' }} />
      </div>
    );
  } else if (error) {
    body = <ErrorState error={error} onRetry={onRetry} />;
  } else if (empty) {
    body = <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyText} />;
  }
  return (
    <section className="card db-widget" aria-label={title}>
      <div className="card__header">
        <h2 className="card__title">
          {Icon && <Icon size={18} className="text-primary" aria-hidden="true" />}
          {title}
        </h2>
        {to && (
          <Link to={to} className="db-widget__link">
            {linkLabel} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="card__body">{body}</div>
    </section>
  );
}

/**
 * KPI tile ngang (nhìn lướt): icon · nhãn (+ trạng thái / thanh tỷ lệ) · số lớn + đơn vị · mũi tên.
 * Số luôn lấy từ service; đang tải ⇒ spinner, lỗi ⇒ "—" + gợi ý ngắn.
 * `action` = chỉ số "việc cần làm": hiện nhãn "Cần xử lý" / "Không có việc" (kèm icon, không chỉ dựa vào màu).
 * `progress` (0..1) = tỷ lệ hiển thị thành thanh ngang dưới nhãn (vd. trẻ có mặt).
 */
export function KpiCard({ to, tone = 'blue', icon: Icon, label, value, unit, hint, progress, action, loading, error }) {
  const ready = !loading && !error;
  const hasWork = action && ready && Number(value) > 0;
  const calm = action && ready && !hasWork;
  const status = !action || !ready ? null : hasWork ? 'todo' : 'ok';
  const content = (
    <>
      {Icon && (
        <span className="kpi-tile__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      <span className="kpi-tile__body">
        <span className="kpi-tile__label">{label}</span>
        {status && (
          <span className={`kpi-tile__status kpi-tile__status--${status}`}>
            {status === 'todo' ? <AlertCircle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
            {status === 'todo' ? 'Cần xử lý' : 'Không có việc'}
          </span>
        )}
        {progress == null && (hint || error) && <span className="kpi-tile__hint">{error ? 'Không tải được số liệu' : hint}</span>}
      </span>
      <span className="kpi-tile__value">
        {loading ? <Spinner small /> : error ? '—' : value}
        {unit && ready && <small>{unit}</small>}
      </span>
      {to && <ChevronRight size={20} className="kpi-tile__chev" aria-hidden="true" />}
      {/* Thẻ có tỷ lệ: thanh + gợi ý nằm hàng riêng, trải hết chiều rộng thẻ */}
      {progress != null && (
        <span className="kpi-tile__foot">
          {ready && (
            <span className="kpi-tile__bar" aria-hidden="true">
              <span style={{ width: `${Math.round(Math.min(progress, 1) * 100)}%` }} />
            </span>
          )}
          <span className="kpi-tile__hint">
            {error ? 'Không tải được số liệu' : hint}
            {ready && <b className="kpi-tile__pct">{Math.round(progress * 100)}% có mặt</b>}
          </span>
        </span>
      )}
    </>
  );
  const count = ready ? Number(value) : NaN;
  const alert = count > 0 && (action || tone === 'red' || tone === 'orange');
  const cls = `kpi-tile kpi-tile--${calm ? 'calm' : tone}${alert ? ' kpi-tile--alert' : ''}${count === 0 ? ' kpi-tile--zero' : ''} db-kpi`;
  if (!to) return <div className={`${cls} db-kpi--static`}>{content}</div>;
  return (
    <Link to={to} className={cls}>
      {content}
    </Link>
  );
}

/** Short list of records or tasks. rows: [{ key, to, icon, title, code, meta, end }] */
export function ShortList({ rows }) {
  return (
    <ul className="db-list">
      {rows.map(({ key, to, icon: Icon, title, code, meta, end }) => {
        const inner = (
          <>
            {Icon && (
              <span className="db-list__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
            )}
            <span className="db-list__main">
              <span className="db-list__title">
                {code && <span className="db-code">{code} </span>}
                {title}
              </span>
              {meta && <span className="db-list__meta">{meta}</span>}
            </span>
            {(end != null || to) && (
              <span className="db-list__end">
                {end}
                {to && <ChevronRight size={16} className="muted" aria-hidden="true" />}
              </span>
            )}
          </>
        );
        return (
          <li key={key} className="db-list__item">
            {to ? (
              <Link to={to} className="db-list__link">
                {inner}
              </Link>
            ) : (
              <div className="db-list__link">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Count shown at the end of a task row; zero is muted so open work stands out. */
export const TaskCount = ({ value }) => <span className={`db-count ${value ? '' : 'db-count--zero'}`}>{value}</span>;

/** Quick entries to the role's menu groups (SRS #10/#11 "menus …"). links: [{ to, label, icon }] */
export function Shortcuts({ links }) {
  return (
    <nav className="db-shortcuts" aria-label="Lối tắt">
      {links.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="btn btn--sm">
          {Icon && <Icon size={16} aria-hidden="true" />} {label}
        </Link>
      ))}
    </nav>
  );
}
