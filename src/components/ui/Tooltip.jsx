import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * Bóng chữ giải thích cho một phần tử (nút khóa, nút chỉ icon). Mở khi rê chuột, Tab tới hoặc chạm; Esc đóng.
 * Phần tử con nhận aria-describedby ⇒ trình đọc màn hình đọc được nội dung kể cả khi bóng chữ đang đóng.
 *
 * <Tooltip content="Quá giờ khóa 08:30">
 *   <Button disabledReason="…">Lưu điểm danh</Button>
 * </Tooltip>
 */
export function Tooltip({ content, children }) {
  const id = useId();
  const anchorRef = useRef(null);
  const bubbleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ above: false, alignEnd: false });

  // Sát mép phải/dưới khung nhìn thì lật bóng chữ sang trái/lên trên để không bị cắt
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !bubbleRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();
    setPlace({
      above: anchor.bottom + bubble.height + 8 > window.innerHeight,
      alignEnd: anchor.left + bubble.width > window.innerWidth,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    // Chạm ra ngoài trên máy tính bảng thì đóng
    const onPointer = (e) => anchorRef.current && !anchorRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!content) return children;
  const bubbleClass = ['tooltip', place.above && 'tooltip--above', place.alignEnd && 'tooltip--end'].filter(Boolean).join(' ');
  return (
    <span
      ref={anchorRef}
      className="tooltip-anchor"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span ref={bubbleRef} id={id} role="tooltip" className={bubbleClass} hidden={!open}>
        {content}
      </span>
    </span>
  );
}
