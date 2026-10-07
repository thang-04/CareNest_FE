import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Accessible modal: Esc closes, focus moves inside and returns on close. */
export function Modal({ open, title, onClose, children, footer, size = 'md', closeOnBackdrop = true, className = '' }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs once per opening so typing inside the modal never loses focus.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    document.addEventListener('keydown', onKey);
    const focusable = ref.current?.querySelector('textarea, input, select, button:not(.modal__close)');
    (focusable || ref.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop no-print-backdrop" onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal--${size} ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        {title && (
          <div className="modal__header no-print">
            <div className="modal__title">{title}</div>
            <button className="icon-btn modal__close" onClick={onClose} aria-label="Đóng">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer no-print">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
