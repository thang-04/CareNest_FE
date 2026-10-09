import { Check, WarningCircle, AlertOctagon, RefreshCw } from '@/components/ui/icons';
import { useAppearance } from '@/contexts/AppearanceContext';

/** Ba chấm màu logo nảy lần lượt; trong nút thì theo màu chữ của nút. */
export const Spinner = ({ small }) => (
  <span className={`spinner ${small ? 'spinner--sm' : ''}`} role="status" aria-label="Đang tải">
    <i />
    <i />
    <i />
  </span>
);

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

/** Màn trống (X2): tranh vẽ nhỏ chọn ngẫu nhiên (ổn định trong ngày theo tiêu đề); prop `icon` cũ được bỏ qua. */
export function EmptyState({ title = 'Chưa có dữ liệu', description, action }) {
  const { emptySceneUrl } = useAppearance();
  return (
    <div className="state">
      <div className="state__art" style={{ '--empty-scene': `url('${emptySceneUrl(title)}')` }} aria-hidden="true" />
      <div className="state__title">{title}</div>
      {description && <div className="state__desc">{description}</div>}
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
      <div className="state__desc">{error?.message || 'Đã có lỗi xảy ra.'}</div>
      {onRetry && (
        <button className="btn btn--sm mt-8" onClick={() => onRetry()}>
          <RefreshCw size={14} /> Thử lại
        </button>
      )}
    </div>
  );
}

/**
 * Lớp phủ gửi form: đặt trong khối có `position: relative`.
 * state: 'sending' | 'done' | 'error'. Nút "Thử lại" chỉ hiện khi có onRetry.
 */
export function SubmitOverlay({ state = 'sending', text, sub, onRetry, onClose }) {
  const defaults = { sending: 'Đang gửi…', done: 'Đã gửi', error: 'Chưa gửi được' };
  return (
    <div className={`submit-veil submit-veil--${state}`} role="status" aria-live="polite">
      {state === 'sending' && <Spinner />}
      {state === 'done' && (
        <span className="submit-veil__icon" aria-hidden="true">
          <Check size={24} />
        </span>
      )}
      {state === 'error' && (
        <span className="submit-veil__icon" aria-hidden="true">
          <WarningCircle size={24} />
        </span>
      )}
      <div>{text || defaults[state]}</div>
      {sub && <div className="submit-veil__sub">{sub}</div>}
      {state === 'error' && (onRetry || onClose) && (
        <div className="row" style={{ justifyContent: 'center' }}>
          {onClose && (
            <button className="btn btn--sm" onClick={onClose}>
              Đóng
            </button>
          )}
          {onRetry && (
            <button className="btn btn--sm btn--primary" onClick={onRetry}>
              <RefreshCw size={14} /> Thử lại
            </button>
          )}
        </div>
      )}
    </div>
  );
}
