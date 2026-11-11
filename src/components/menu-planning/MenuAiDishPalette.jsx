import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Search } from '@/components/ui/icons';
import { ErrorState, LoadingState } from '@/components';
import { DishKcal } from '@/components/menu-planning/MenuBadges';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { paletteDishes, usedDays } from '@/utils/menu-planning/menuAiDraftGrid';
import { formatWeekdayDate } from '@/utils/format';

const fold = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/**
 * Cột "Món của trường" bên phải bảng gợi ý: món ứng viên BE đã lọc (đang dùng, đủ dữ liệu — NUT-05, NUT-09) để kéo vào ô
 * hoặc bấm chọn khi đã chọn ô. Chọn ô ⇒ chỉ hiện món dùng được cho ô đó. Nhãn hợp mùa / trường đã nấu / kho khô hết là
 * tín hiệu của BE, không phải kiểm tra chặn.
 */
export function MenuAiDishPalette({
  candidates,
  error,
  onRetry,
  selected,
  selectedLabel,
  cells,
  dishById,
  kcalAgeGroup,
  onPick,
  onClearSelection,
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const all = useMemo(() => paletteDishes(candidates, selected?.slot), [candidates, selected]);
  const types = useMemo(() => [...new Set(paletteDishes(candidates).map((dish) => dish.dishType))], [candidates]);
  const shown = all.filter(
    (dish) => (selected || !type || dish.dishType === type) && (!query.trim() || fold(dish.dishName).includes(fold(query))),
  );

  return (
    <aside className="td-aip" aria-label="Món của trường">
      <div className="td-aip__head">
        <h3 className="td-aip__title">Món của trường</h3>
        <span className="text-xs muted">Kéo vào ô, hoặc chọn ô rồi bấm món</span>
      </div>
      <label className="td-aip__search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Tìm món</span>
        <input className="input" placeholder="Tìm món" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {selected ? (
        <div className="td-aip__scope">
          <span className="text-xs">
            Đang chọn ô: <strong>{selectedLabel}</strong>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClearSelection}>
            Bỏ chọn ô
          </button>
        </div>
      ) : (
        <div className="td-chips" role="group" aria-label="Lọc theo loại món">
          <button type="button" className={`chip ${type ? 'chip--gray' : 'chip--blue'}`} aria-pressed={!type} onClick={() => setType('')}>
            Tất cả
          </button>
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${type === t ? 'chip--blue' : 'chip--gray'}`}
              aria-pressed={type === t}
              onClick={() => setType(type === t ? '' : t)}
            >
              {DISH_TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !candidates ? (
        <LoadingState text="Đang tải món…" />
      ) : shown.length === 0 ? (
        <p className="text-sm muted td-flat">Không có món phù hợp.</p>
      ) : (
        <ul className="td-aip__list">
          {shown.map((dish) => (
            <PaletteDish
              key={dish.dishId}
              dish={dish}
              used={usedDays(cells, dish.dishId, selected)}
              dishById={dishById}
              kcalAgeGroup={kcalAgeGroup}
              pickable={!!selected}
              onPick={onPick}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function PaletteDish({ dish, used, dishById, kcalAgeGroup, pickable, onPick }) {
  const drag = useDraggable({ id: `pal:${dish.dishId}`, data: { from: 'palette', dish } });
  const notes = [
    dish.seasonal && 'hợp mùa',
    dish.familiar && 'trường đã nấu',
    used.length > 0 && `đã dùng ${used.map((day) => formatWeekdayDate(day).split(' ').slice(0, 2).join(' ')).join(', ')}`,
  ].filter(Boolean);
  return (
    <li>
      <button
        type="button"
        ref={drag.setNodeRef}
        className={`td-dish td-aip__dish ${dishTypeClass(dish.dishType)}${used.length ? ' is-used' : ''}${drag.isDragging ? ' is-dragging' : ''}`}
        aria-label={`${dish.dishName}, ${DISH_TYPE_LABELS[dish.dishType] || dish.dishType}${pickable ? '. Bấm để đặt vào ô đang chọn' : '. Kéo vào ô của bảng'}`}
        onClick={() => pickable && onPick(dish)}
        {...drag.listeners}
        {...drag.attributes}
      >
        <GripVertical size={16} className="td-aip__grip" aria-hidden="true" />
        <span className="td-grow">
          <span>{dish.dishName}</span>
          {(notes.length > 0 || dish.outOfStock) && (
            <span className="text-xs muted">
              {notes.join(' · ')}
              {dish.outOfStock && (
                <>
                  {notes.length > 0 && ' · '}
                  <span className="td-warn">kho khô hết</span>
                </>
              )}
            </span>
          )}
        </span>
        <DishKcal dish={dishById?.[String(dish.dishId)]} ageGroup={kcalAgeGroup} />
      </button>
    </li>
  );
}

/** Tên ô đang chọn để hiện ở cột món: "thứ Ba 17/11 · Bữa trưa · Món mặn". */
export const selectedCellLabel = (selected, columns, slots) => {
  if (!selected) return '';
  const col = columns.find((c) => c.key === selected.day);
  const slot = (slots || []).find((s) => s.key === selected.slot);
  return [
    col?.date ? formatWeekdayDate(col.date) : '',
    slot ? MEAL_SESSION_LABELS[slot.session] || slot.session : '',
    slot ? (slot.dishTypes || []).map((t) => DISH_TYPE_LABELS[t] || t).join(' / ') : '',
  ]
    .filter(Boolean)
    .join(' · ');
};
