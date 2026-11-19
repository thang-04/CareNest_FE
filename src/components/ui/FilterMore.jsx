import { useEffect, useRef, useState } from 'react';
import { Filter } from '@/components/ui/icons';

/** Nút "Lọc thêm": gom bộ lọc phụ vào ô nổi để thanh lọc chính gọn; count = số bộ lọc phụ đang bật. */
export function FilterMore({ count = 0, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const summaryRef = useRef(null);

  // Bấm ra ngoài hoặc Esc thì đóng; lịch chọn ngày của trình duyệt không phát sự kiện vào trang nên ô vẫn mở khi chọn ngày
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      summaryRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <details ref={rootRef} className="filter-more" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary ref={summaryRef} className="btn">
        <Filter size={15} /> Lọc thêm{count > 0 && <span className="tab__count">{count}</span>}
      </summary>
      <div className="filter-more__panel">{children}</div>
    </details>
  );
}
