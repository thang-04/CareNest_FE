import { AlertOctagon, Inbox, RefreshCw } from 'lucide-react';

export const Spinner = ({ small }) => <span className={`spinner ${small ? 'spinner--sm' : ''}`} role="status" aria-label="Đang tải" />;

export function LoadingState({ text = 'Đang tải dữ liệu...' }) {
  return (
    <div className="state">
      <Spinner />
      <div>{text}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}>
              <div className="skeleton" style={{ width: `${50 + ((r * 7 + c * 13) % 45)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Chưa có dữ liệu', description, action }) {
  return (
    <div className="state">
      <div className="state__icon">
        <Icon size={26} />
      </div>
      <div className="state__title">{title}</div>
      {description && (
        <div className="muted" style={{ maxWidth: 420 }}>
          {description}
        </div>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state--error">
      <div className="state__icon">
        <AlertOctagon size={26} />
      </div>
      <div className="state__title">Không tải được dữ liệu</div>
      <div className="muted">{error?.message || 'Đã có lỗi xảy ra.'}</div>
      {onRetry && (
        <button className="btn btn--sm mt-8" onClick={() => onRetry()}>
          <RefreshCw size={14} /> Thử lại
        </button>
      )}
    </div>
  );
}
