import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@/components/ui/icons';

const EXIT_MS = 350;

/**
 * Panel trượt từ phải để xem nhanh chi tiết mà không rời danh sách.
 * Esc / bấm nền mờ đóng; tiêu điểm vào khung panel và trả về chỗ cũ khi đóng.
 */
export function SidePanel({ open, title, onClose, children, footer }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Giữ panel trong DOM thêm một nhịp khi đóng để chạy chuyển động ra
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Chờ panel gắn vào DOM rồi mới đưa tiêu điểm vào
  useEffect(() => {
    if (!open || !mounted) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className={`side-panel-layer ${shown ? 'side-panel-layer--open' : ''}`}>
      <div className="side-panel-backdrop" onMouseDown={() => onClose?.()} />
      <aside className="side-panel" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="side-panel__header">
          <div className="side-panel__title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="side-panel__body">{children}</div>
        {footer && <div className="side-panel__footer">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}
