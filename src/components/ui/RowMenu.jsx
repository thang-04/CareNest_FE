import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from '@/components/ui/icons';
import { ConfirmationModal } from './ConfirmationModal';

const GAP = 4;
// Đặt ngoài màn tới khi place() đo xong vị trí (layout effect, trước khi vẽ). Không dùng visibility: hidden vì
// rule giảm chuyển động toàn cục cho mọi thuộc tính transition 0.01ms, menu còn "hidden" lúc focus nên focus hỏng.
// Hằng số để React không ghi đè style lúc render lại.
const OFFSCREEN = { top: -9999, right: 0 };
// Click trong menu không được lan lên hàng bảng bấm được (portal vẫn nổi bọt theo cây React)
const stop = (e) => e.stopPropagation();

/**
 * Nút "…" cuối dòng bảng mở danh sách thao tác (chuẩn hành động hàng, DESIGN §6.4).
 * items: [{ label, icon?, to? | onClick?, danger?, disabled?, confirm?: { title, message, confirmLabel } }]
 * Mục `danger` có `confirm` thì hỏi lại bằng ConfirmationModal trước khi chạy onClick.
 * Menu render ra body (position: fixed) để không bị khung cuộn của bảng cắt mất.
 * text (+ icon, className): nút có chữ thay cho nút "…" (vd. gom nhiều nút thao tác trên điện thoại).
 */
export function RowMenu({ label, items, text, icon, className }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback((focusButton = false) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  }, []);

  // Đặt menu dưới nút, căn mép phải; không đủ chỗ phía dưới thì lật lên trên. Gán thẳng DOM (không qua state) để chạy được khi cuộn.
  const place = useCallback(() => {
    const panel = panelRef.current;
    const btn = btnRef.current;
    if (!panel || !btn) return;
    const b = btn.getBoundingClientRect();
    const h = panel.offsetHeight;
    const top = b.bottom + GAP + h <= window.innerHeight ? b.bottom + GAP : Math.max(GAP, b.top - GAP - h);
    Object.assign(panel.style, { top: `${top}px`, right: `${window.innerWidth - b.right}px` });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // preventScroll: focus không được làm trang/bảng cuộn
    panelRef.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, close, place]);

  const onPanelKey = (e) => {
    e.stopPropagation();
    const list = [...panelRef.current.querySelectorAll('[role="menuitem"]')];
    const at = list.indexOf(document.activeElement);
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[next]?.focus();
    }
  };

  const run = (item) => {
    close(true);
    if (item.confirm) setPending(item);
    else item.onClick?.();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={text ? className || 'btn btn--sm' : 'icon-btn row-menu__btn'}
        aria-label={label}
        title={text || 'Thao tác khác'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        onKeyDown={stop}
      >
        {text ? (
          <>
            {icon} {text}
          </>
        ) : (
          <MoreHorizontal size={18} />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="row-menu__panel"
            role="menu"
            aria-label={label}
            style={OFFSCREEN}
            onClick={stop}
            onKeyDown={onPanelKey}
          >
            {items.map((item) => {
              const { label: text, to, icon: Icon, danger, disabled } = item;
              const cls = `row-menu__item${danger && !disabled ? ' row-menu__item--danger' : ''}`;
              const body = (
                <>
                  {Icon && <Icon size={16} />} {text}
                </>
              );
              return to ? (
                <Link key={text} to={to} role="menuitem" className={cls} onClick={() => close()}>
                  {body}
                </Link>
              ) : (
                <button key={text} type="button" role="menuitem" className={cls} disabled={disabled} onClick={() => run(item)}>
                  {body}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      {pending && (
        <ConfirmationModal
          open
          danger={!!pending.danger}
          title={pending.confirm.title}
          message={pending.confirm.message}
          confirmLabel={pending.confirm.confirmLabel || pending.label}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await pending.onClick?.();
            setPending(null);
          }}
        />
      )}
    </>
  );
}
