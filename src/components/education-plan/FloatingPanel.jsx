import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 8; // cách mép màn hình
const GAP = 4; // cách ô gốc

/**
 * Khung thả xuống gắn với một ô nhưng vẽ ra ngoài bảng (portal) để khung cuộn của bảng không che mất.
 * Mở xuống dưới ô; dưới không đủ chỗ mà trên rộng hơn thì lật lên trên. Không đủ chỗ cả hai phía thì khung
 * cao bằng phần màn hình còn trống và cuộn bên trong. Vị trí là giá trị động, tính lại khi cuộn, đổi cỡ cửa sổ
 * hoặc khi nội dung khung đổi chiều cao (vd. chuyển tháng trên lịch).
 */
export default function FloatingPanel({ anchorRef, panelRef, keepFocus = false, minWidth = 420, children }) {
  const innerRef = useRef(null);
  const [pos, setPos] = useState(null);
  const posRef = useRef(null);

  const place = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    const el = innerRef.current;
    if (!r || !el) return;
    const width = Math.min(Math.max(r.width, minWidth), window.innerWidth - 2 * MARGIN);
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - width - MARGIN));
    const height = el.scrollHeight;
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const up = height > below && above > below;
    const room = Math.max(up ? above : below, 0);
    const top = up ? r.top - GAP - Math.min(height, room) : r.bottom + GAP;
    // So với vị trí đã đặt (ref) để không gọi setState khi không đổi: gọi setState trong layout effect mỗi lần vẽ dễ thành vòng lặp
    const p = posRef.current;
    if (p && p.top === top && p.left === left && p.width === width && p.maxHeight === room) return;
    posRef.current = { top, left, width, maxHeight: room };
    setPos(posRef.current);
  }, [anchorRef, minWidth]);

  // Đo lại sau mỗi lần vẽ (nội dung có thể đổi chiều cao); chỉ đặt state khi vị trí thật sự đổi
  useLayoutEffect(() => {
    place();
  });
  useEffect(() => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  const setRef = (el) => {
    innerRef.current = el;
    if (panelRef) panelRef.current = el;
  };
  return createPortal(
    <div
      ref={setRef}
      className="search-select__panel"
      style={
        pos
          ? {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
              right: 'auto',
            }
          : // Lần vẽ đầu: ẩn để đo chiều cao trước khi đặt vị trí
            { position: 'fixed', top: 0, left: 0, width: minWidth, visibility: 'hidden' }
      }
      // Khung gợi ý: bấm vào khung (kể cả thanh cuộn) không làm ô đang gõ mất con trỏ
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}
