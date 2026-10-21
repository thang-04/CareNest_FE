import { useEffect, useRef, useState } from 'react';

/** Đưa phần tử ở vị trí `from` tới vị trí `to` (chỉ số sau khi đã rút phần tử ra). */
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Sắp xếp danh sách bằng kéo-thả tay nắm (HTML5 drag & drop) và bàn phím:
 * Tab tới tay nắm → Space/Enter nhấc → ↑/↓ di chuyển → Space/Enter thả, Esc hủy về chỗ cũ.
 * Chỉ tay nắm kéo được (ảnh kéo là cả dòng), nên ô nhập trong dòng vẫn chọn chữ bình thường.
 *
 * const sort = useSortableList({ count, onMove: (from, to) => ..., labelOf: (i) => ... });
 * <tr {...sort.itemProps(i)}><td><button {...sort.handleProps(i)}>...</button></td></tr>
 * <div {...sort.liveProps} />
 */
export function useSortableList({ count, onMove, labelOf }) {
  const [dragging, setDragging] = useState(null);
  const [dropAt, setDropAt] = useState(null); // vị trí chèn 0..count
  const [grabbed, setGrabbed] = useState(null); // dòng đang nhấc bằng bàn phím
  const [origin, setOrigin] = useState(null);
  const [message, setMessage] = useState('');
  const handles = useRef([]);
  const focusAt = useRef(null);

  // Sau khi dòng đổi chỗ bằng bàn phím: giữ focus trên tay nắm của dòng vừa di chuyển
  useEffect(() => {
    if (focusAt.current == null) return;
    handles.current[focusAt.current]?.focus();
    focusAt.current = null;
  });

  const announce = (text) => setMessage(text);
  const reset = () => {
    setDragging(null);
    setDropAt(null);
  };

  const keyMove = (i, to) => {
    if (to < 0 || to >= count || to === i) return;
    onMove(i, to);
    setGrabbed(to);
    focusAt.current = to;
    announce(`${labelOf(i)}: vị trí ${to + 1} trên ${count}`);
  };

  const handleProps = (i) => ({
    type: 'button',
    ref: (el) => (handles.current[i] = el),
    className: `drag-handle ${grabbed === i ? 'drag-handle--grabbed' : ''}`,
    'aria-label': `Sắp xếp ${labelOf(i)} (vị trí ${i + 1}). Kéo, hoặc nhấn Space rồi dùng mũi tên lên xuống`,
    'aria-pressed': grabbed === i,
    title: 'Kéo để đổi thứ tự',
    draggable: true,
    onDragStart: (e) => {
      const row = e.currentTarget.closest('.sortable-item');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      if (row) e.dataTransfer.setDragImage(row, e.nativeEvent.offsetX + 8, row.offsetHeight / 2);
      setDragging(i);
    },
    onDragEnd: reset,
    onBlur: () => {
      if (grabbed === i && focusAt.current == null) {
        setGrabbed(null);
        setOrigin(null);
      }
    },
    onKeyDown: (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (grabbed === i) {
          setGrabbed(null);
          setOrigin(null);
          announce(`Đã đặt ${labelOf(i)} ở vị trí ${i + 1}`);
        } else {
          setGrabbed(i);
          setOrigin(i);
          announce(`Đã nhấc ${labelOf(i)}, vị trí ${i + 1} trên ${count}. Dùng mũi tên lên xuống, Space để đặt, Esc để hủy`);
        }
      } else if (grabbed === i && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        keyMove(i, i + (e.key === 'ArrowUp' ? -1 : 1));
      } else if (grabbed === i && e.key === 'Escape') {
        e.preventDefault();
        if (origin != null && origin !== i) {
          onMove(i, origin);
          focusAt.current = origin;
        }
        setGrabbed(null);
        setOrigin(null);
        announce(`Đã hủy, ${labelOf(i)} về vị trí cũ`);
      }
    },
  });

  const itemProps = (i) => ({
    className: [
      'sortable-item',
      dragging === i && 'sortable-item--dragging',
      grabbed === i && 'sortable-item--grabbed',
      dropAt === i && dragging != null && dropAt !== dragging && dropAt !== dragging + 1 && 'sortable-item--drop-before',
      dropAt === count && i === count - 1 && dragging != null && dragging !== count - 1 && 'sortable-item--drop-after',
    ]
      .filter(Boolean)
      .join(' '),
    onDragOver: (e) => {
      if (dragging == null) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
    },
    onDrop: (e) => {
      e.preventDefault();
      if (dragging != null && dropAt != null) {
        const to = dropAt > dragging ? dropAt - 1 : dropAt;
        if (to !== dragging) {
          onMove(dragging, to);
          announce(`Đã đặt ${labelOf(dragging)} ở vị trí ${to + 1}`);
        }
      }
      reset();
    },
  });

  return { handleProps, itemProps, liveProps: { className: 'sr-only', 'aria-live': 'polite', children: message } };
}
