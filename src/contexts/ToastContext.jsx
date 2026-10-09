import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from '@/components/ui/icons';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const FADE_MS = 280; // thời gian hiệu ứng mờ dần trước khi gỡ toast

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  // Đánh dấu "leaving" để chạy hiệu ứng mờ dần, rồi mới gỡ khỏi danh sách
  const dismiss = useCallback(
    (id) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => remove(id), FADE_MS);
    },
    [remove],
  );

  const show = useCallback(
    (type, message, title) => {
      const id = `${Date.now()}${Math.random()}`;
      const duration = type === 'error' ? 6000 : 3500;
      setToasts((list) => [...list.slice(-3), { id, type, message, title, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m, t) => show('success', m, t),
      error: (m, t) => show('error', m, t),
      warning: (m, t) => show('warning', m, t),
      info: (m, t) => show('info', m, t),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type} ${t.leaving ? 'toast--leaving' : ''}`}>
              <span className="toast__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="toast__body">
                {t.title && <div className="toast__title">{t.title}</div>}
                <div className="toast__msg">{t.message}</div>
              </div>
              <button className="icon-btn toast__close" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">
                <X size={16} />
              </button>
              {/* Thanh đếm ngược thời gian hiển thị */}
              <span className="toast__timer" style={{ animationDuration: `${t.duration}ms` }} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
