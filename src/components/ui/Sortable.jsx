import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, DragHandle, ListNumbers } from '@/components/ui/icons';

/**
 * Danh sách sắp xếp được (dnd-kit, theo mẫu Sortable chính thức): kéo tay nắm thì các dòng khác dạt ra nhường chỗ,
 * chỗ sẽ thả tô xanh; bàn phím: Tab tới tay nắm → Space nhấc → ↑/↓ → Space đặt, Esc hủy.
 * Nút lên/xuống cũng trượt mượt; dòng vừa đổi chỗ nháy sáng.
 * STT (`SortIndex`) không tự đổi khi đổi chỗ/xóa: user bấm `RenumberButton` để đánh lại 1, 2, 3… (Tiền 23/10).
 *
 * <SortableList ids={items.map((x) => x.id)} onMove={(from, to) => ...} labelOf={(i) => ...}>
 *   <table><tbody>{items.map((x, i) => (
 *     <SortableRow key={x.id} id={x.id}>... <SortHandle label="..." /> <SortButtons index={i} label="..." /></SortableRow>
 *   ))}</tbody></table>
 * </SortableList>
 */
const ListCtx = createContext(null);
const RowCtx = createContext(null);

const FLASH_MS = 1100;
// Luôn animate khi thứ tự đổi (cả khi bấm nút lên/xuống), không chỉ lúc đang kéo
const animateAlways = (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true });
const INSTRUCTIONS = 'Nhấn Space để nhấc. Khi đang nhấc, dùng mũi tên lên xuống để di chuyển, Space để đặt, Esc để hủy.';

export function SortableList({ ids, onMove, labelOf, disabled = false, children }) {
  const [activeId, setActiveId] = useState(null);
  const [, rerender] = useState(0);
  const nums = useRef(null); // id -> STT đang hiển thị
  const [moved, setMoved] = useState(null); // { id }: dòng vừa đổi chỗ, tô xanh trong FLASH_MS
  const timer = useRef(null);
  const sensors = useSensors(
    // Phải rê ≥4px mới tính là kéo, để bấm nhầm vào tay nắm không nhấc dòng
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  if (disabled) return children;

  // Đồng bộ STT với danh sách: dòng cũ giữ số, dòng mới lấy số lớn nhất + 1, dòng đã xóa bỏ khỏi bảng số
  const prev = nums.current ?? new Map(ids.map((id, i) => [id, i + 1]));
  let max = Math.max(0, ...ids.map((id) => prev.get(id) ?? 0));
  nums.current = new Map(ids.map((id) => [id, prev.get(id) ?? ++max]));
  const numOf = (id) => nums.current.get(id);
  const ordered = ids.every((id, i) => numOf(id) === i + 1);
  const renumber = () => {
    nums.current = new Map(ids.map((id, i) => [id, i + 1]));
    rerender((n) => n + 1);
  };

  const indexOf = (id) => ids.indexOf(id);
  const nameOf = (id) => labelOf(indexOf(id));
  const end = () => setActiveId(null);
  const move = (from, to) => {
    if (from < 0 || to < 0 || to >= ids.length || from === to) return;
    onMove(from, to);
    setMoved({ id: ids[from] });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoved(null), FLASH_MS);
  };
  const announcements = {
    onDragStart: ({ active }) => `Đã nhấc ${nameOf(active.id)}, vị trí ${indexOf(active.id) + 1} trên ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} đang ở vị trí ${indexOf(over.id) + 1}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `Đã đặt ${nameOf(active.id)} ở vị trí ${indexOf(over.id) + 1}.` : ''),
    onDragCancel: ({ active }) => `Đã hủy, ${nameOf(active.id)} về vị trí cũ.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={end}
      onDragEnd={({ active, over }) => {
        end();
        if (over) move(indexOf(active.id), indexOf(over.id));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ListCtx.Provider value={{ move, moved, numOf, ordered, renumber, count: ids.length }}>{children}</ListCtx.Provider>
      </SortableContext>
      {/* Bản "nhấc lên" bám theo chuột; đặt ngoài bảng (portal) vì <table> không chứa được <div> */}
      {createPortal(
        <DragOverlay>
          {activeId != null && (
            <div className="sortable-overlay">
              <DragHandle size={18} aria-hidden />
              <span className="sortable-overlay__text">
                {numOf(activeId)}. {nameOf(activeId)}
              </span>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/** Một dòng sắp xếp được; ngoài SortableList (vd. chế độ chỉ xem) là thẻ thường. */
export function SortableRow({ id, as = 'tr', className = '', children, ...rest }) {
  const list = useContext(ListCtx);
  const Tag = as;
  if (!list)
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  return (
    <ActiveRow id={id} as={as} className={className} list={list} {...rest}>
      {children}
    </ActiveRow>
  );
}

function ActiveRow({ id, as: Tag, className, list, children, ...rest }) {
  const sortable = useSortable({ id, animateLayoutChanges: animateAlways });
  const { setNodeRef, transform, transition, isDragging } = sortable;
  const moved = list.moved?.id === id;
  const cls = ['sortable-item', className, isDragging && 'sortable-item--placeholder', moved && 'sortable-item--moved']
    .filter(Boolean)
    .join(' ');
  return (
    <RowCtx.Provider value={sortable}>
      <Tag ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cls} {...rest}>
        {children}
      </Tag>
    </RowCtx.Provider>
  );
}

/** Tay nắm kéo của dòng chứa nó. */
export function SortHandle({ label }) {
  const row = useContext(RowCtx);
  if (!row) return null;
  const { attributes, listeners, setActivatorNodeRef, isDragging } = row;
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={`drag-handle ${isDragging ? 'drag-handle--grabbed' : ''}`}
      title="Kéo để đổi thứ tự"
      {...attributes}
      {...listeners}
      aria-label={`Sắp xếp ${label}. Kéo, hoặc nhấn Space rồi dùng mũi tên lên xuống`}
    >
      <DragHandle size={18} aria-hidden />
    </button>
  );
}

/** 2 nút lên/xuống của dòng thứ `index` (nút ở đầu/cuối danh sách bị khóa). */
export function SortButtons({ index, label }) {
  const list = useContext(ListCtx);
  if (!list) return null;
  return (
    <>
      <button
        type="button"
        className="icon-btn ga-sort-btn ga-sort-btn--up"
        disabled={index === 0}
        onClick={() => list.move(index, index - 1)}
        aria-label={`Chuyển ${label} lên trên`}
        title="Chuyển lên trên"
      >
        <ArrowUp size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn ga-sort-btn ga-sort-btn--down"
        disabled={index === list.count - 1}
        onClick={() => list.move(index, index + 1)}
        aria-label={`Chuyển ${label} xuống dưới`}
        title="Chuyển xuống dưới"
      >
        <ArrowDown size={16} aria-hidden />
      </button>
    </>
  );
}

/** STT đang hiển thị của dòng (giữ nguyên khi đổi chỗ, chỉ đổi khi bấm "Đánh số lại"). */
export function SortIndex({ id, index }) {
  const list = useContext(ListCtx);
  return list?.numOf(id) ?? index + 1;
}

/** Nút "Đánh số lại" 1, 2, 3… theo thứ tự dòng hiện tại; chỉ bật khi STT đang lệch thứ tự. */
export function RenumberButton() {
  const list = useContext(ListCtx);
  if (!list) return null;
  return (
    <button
      type="button"
      className={`icon-btn renumber-btn ${list.ordered ? '' : 'renumber-btn--active'}`}
      disabled={list.ordered}
      onClick={list.renumber}
      aria-label="Đánh số lại số thứ tự theo thứ tự dòng hiện tại"
      title={list.ordered ? 'Số thứ tự đã đúng thứ tự' : 'Đánh số lại 1, 2, 3… theo thứ tự hiện tại'}
    >
      <ListNumbers size={16} aria-hidden />
    </button>
  );
}
