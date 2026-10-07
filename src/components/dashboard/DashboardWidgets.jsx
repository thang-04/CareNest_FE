import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
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
 * KPI tile (DESIGN stat-grid). The value always comes from a service call;
 * while loading it shows a spinner, on error a dash with a short hint.
 */
export function KpiCard({ to, tone = 'blue', label, value, hint, loading, error }) {
  const content = (
    <>
      <div className="stat-card__value db-kpi__value">{loading ? <Spinner small /> : error ? '—' : value}</div>
      <div className="stat-card__label">{label}</div>
      {(hint || error) && <div className="db-kpi__hint">{error ? 'Không tải được số liệu' : hint}</div>}
    </>
  );
  if (!to) return <div className={`stat-card stat-card--${tone} db-kpi db-kpi--static`}>{content}</div>;
  return (
    <Link to={to} className={`stat-card stat-card--${tone} db-kpi`}>
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
