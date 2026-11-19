import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { List } from '@/components/ui/icons';

/** Giữ nguyên các control và state; thiếu chỗ thì hiện chúng trong bảng lựa chọn thay vì xuống hàng. */
export function ResponsiveToolbar({ children, className = '', 'aria-label': label = 'Thao tác', ...props }) {
  const root = useRef(null);
  const content = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const host = root.current;
    const controls = content.current;
    let disposed = false;
    let frame;
    const measure = () => {
      if (disposed || !host.clientWidth) return;
      const style = getComputedStyle(host);
      const available = host.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
      // Đo hàng ngang gốc, kể cả khi bảng đang đóng; không nhân đôi React component/hộp xác nhận.
      controls.dataset.measuring = 'true';
      const required = controls.scrollWidth;
      delete controls.dataset.measuring;
      const next = required > available + 1;
      setCompact(next);
      if (!next) setOpen(false);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    resize.observe(controls);
    for (const child of controls.children) resize.observe(child);
    const mutations = new MutationObserver(schedule);
    mutations.observe(controls, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(() => !disposed && schedule());
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const first = content.current?.querySelector('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)');
    first?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Hộp thoại/menu con tự xử lý Escape trước bảng lựa chọn ngoài.
      if (!root.current?.contains(event.target)) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div
      {...props}
      ref={root}
      role="group"
      aria-label={label}
      className={`responsive-toolbar ${className}`}
      data-compact={compact || undefined}
    >
      {compact && (
        <>
          <span className="responsive-toolbar__label" title={label}>
            {label}
          </span>
          <button
            ref={trigger}
            type="button"
            className="btn responsive-toolbar__trigger"
            aria-label={`${open ? 'Đóng' : 'Mở'} ${label.toLowerCase()}`}
            aria-expanded={open}
            aria-controls={id}
            aria-haspopup="dialog"
            onClick={() => setOpen((value) => !value)}
          >
            <List size={20} aria-hidden="true" />
          </button>
        </>
      )}
      <div
        ref={content}
        id={id}
        className="responsive-toolbar__content"
        data-open={open || undefined}
        role={compact ? 'dialog' : undefined}
        aria-label={compact ? label : undefined}
        inert={compact && !open ? '' : undefined}
        aria-hidden={(compact && !open) || undefined}
      >
        {children}
      </div>
    </div>
  );
}
