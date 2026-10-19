import { useState } from 'react';
import { AlertTriangle, Plus, X } from '@/components/ui/icons';
import { dishAllergens, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { DISH_TYPE, DISH_TYPE_LABELS, RECORD_STATUS, WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';

// Bữa trưa tách hàng theo loại món như sổ thực đơn; bữa khác mỗi bữa một hàng
const LUNCH_TYPES = [DISH_TYPE.CARB, DISH_TYPE.MAIN, DISH_TYPE.SOUP, DISH_TYPE.VEGETABLE, DISH_TYPE.DESSERT];
const LUNCH_LABELS = { CARB: 'Cơm', MAIN: 'Món mặn', SOUP: 'Canh', VEGETABLE: 'Món rau', DESSERT: 'Tráng miệng' };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Hàng của bảng tuần theo bữa ở Thiết lập. */
export const weekRows = (setups, ageGroupId, days, dishById) =>
  mealsOf(setups, ageGroupId).flatMap((m) => {
    if (m.code !== 'LUNCH') return [{ key: m.code, label: m.name, session: m.code }];
    const used = new Set(
      days.flatMap((d) =>
        (d.meals || []).filter((x) => x.session === 'LUNCH').flatMap((x) => x.items.map((i) => dishById[i.dishId]?.type)),
      ),
    );
    const rows = LUNCH_TYPES.map((t) => ({ key: `LUNCH|${t}`, label: LUNCH_LABELS[t], session: 'LUNCH', type: t }));
    if ([...used].some((t) => t && !LUNCH_TYPES.includes(t)))
      rows.push({ key: 'LUNCH|OTHER', label: 'Món khác (trưa)', session: 'LUNCH', type: 'OTHER' });
    return rows;
  });

const inRow = (row, dish) => !row.type || (row.type === 'OTHER' ? !LUNCH_TYPES.includes(dish?.type) : dish?.type === row.type);

/**
 * Bảng thực đơn tuần (cột là các thứ). Đầu cột chọn thực đơn mẫu và đánh dấu ngày nghỉ; trong ô bỏ món (×) và "+ Thêm".
 * Suất thay thế dị ứng hiện ngay dưới món. editable=false: chỉ xem (HT, bản đã xuất bản, xem trước bản AI).
 * dayNotes: { [date]: node } hiện dưới đầu cột; isNew(date, session, dishId): tô nền món khác bản đang soạn.
 */
export function WeekGrid({
  wm,
  catalog,
  menus,
  allergyRows,
  allergyMenus,
  editable,
  busy,
  onPickMenu,
  onHoliday,
  onChangeMeals,
  dayNotes,
  isNew,
}) {
  const [adding, setAdding] = useState(null);
  const rows = weekRows(catalog.nutritionSetups, wm.ageGroupId, wm.days, catalog.dishById);

  const note = (day, session, dish) =>
    dishAllergens(dish, catalog.foodById)
      .map((a) => {
        const kids = allergyRows.find((r) => sameAllergen(r.allergen, a))?.childCount;
        if (!kids) return null;
        const rep = allergyMenus
          .filter((s) => s.baseMenuId === day.menuId && s.restrictions.some((x) => sameAllergen(x, a)))
          .flatMap((s) => s.replacements)
          .find((r) => r.session === session && r.originalDishId === dish.id);
        const swap = rep ? (rep.replacementDishId ? catalog.dishById[rep.replacementDishId]?.name : 'bỏ món') : null;
        return `${kids} trẻ ${a.toLowerCase()}${swap ? ` → ${swap}` : ' · chưa có suất thay thế'}`;
      })
      .filter(Boolean);

  const change = (day, session, fn) => {
    const meals = (day.meals || []).map((m) => (m.session === session ? { ...m, items: fn(m.items) } : m));
    if (!meals.some((m) => m.session === session)) meals.push({ session, items: fn([]) });
    onChangeMeals(day.date, meals);
  };

  return (
    <div className="table-wrap td-week-wrap">
      <table className="table table--grid td-week">
        <thead>
          <tr>
            <th className="td-week__label">Món</th>
            {wm.days.map((d, i) => (
              <th key={d.date}>
                <div className="td-week__day">
                  <b>
                    {WEEKDAY_LABELS[i]} <span className="muted td-week__date">{ddmm(d.date)}</span>
                  </b>
                  {editable && !d.holiday ? (
                    <select
                      className="select"
                      value={d.menuId || ''}
                      disabled={busy}
                      aria-label={`Thực đơn mẫu ${WEEKDAY_LABELS[i]}`}
                      onChange={(e) => onPickMenu(d.date, e.target.value)}
                    >
                      <option value="">Chọn thực đơn mẫu</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs muted">
                      {d.holiday ? `Nghỉ: ${d.note}` : menus.find((m) => m.id === d.menuId)?.name || '—'}
                    </span>
                  )}
                  {editable && (
                    <label className="checkbox text-xs">
                      <input type="checkbox" checked={!!d.holiday} disabled={busy} onChange={(e) => onHoliday(d.date, e.target.checked)} />{' '}
                      Nghỉ
                    </label>
                  )}
                  {dayNotes?.[d.date]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="td-week__label fw-600">{row.label}</td>
              {wm.days.map((d) => {
                if (d.holiday) return <td key={d.date} className="td-week__off" />;
                const items = ((d.meals || []).find((m) => m.session === row.session)?.items || [])
                  .map((it, idx) => ({ it, idx, dish: catalog.dishById[it.dishId] }))
                  .filter(({ dish }) => inRow(row, dish));
                const k = `${d.date}|${row.key}`;
                const options = catalog.dishes.filter(
                  (x) => x.status === RECORD_STATUS.ACTIVE && (row.type && row.type !== 'OTHER' ? x.type === row.type : true),
                );
                return (
                  <td key={d.date} className={!items.length && row.session !== 'LUNCH' ? 'td-week__empty' : ''}>
                    <ul className="td-week__dishes">
                      {items.map(({ it, idx, dish }) => (
                        <li key={`${it.dishId}-${idx}`} className={isNew?.(d.date, row.session, it.dishId) ? 'td-week__new' : undefined}>
                          <span className="td-grow">
                            {dish?.name || 'Món đã xóa'}
                            {note(d, row.session, dish).map((t) => (
                              <span key={t} className="td-week__allergy">
                                <AlertTriangle size={11} /> {t}
                              </span>
                            ))}
                          </span>
                          {editable && (
                            <button
                              type="button"
                              className="td-week__x"
                              aria-label={`Bỏ ${dish?.name || 'món'}`}
                              disabled={busy}
                              onClick={() => change(d, row.session, (list) => list.filter((_, j) => j !== idx))}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {editable &&
                      (adding === k ? (
                        <select
                          className="select td-week__pick"
                          autoFocus
                          defaultValue=""
                          onBlur={() => setAdding(null)}
                          onChange={(e) => {
                            if (e.target.value) change(d, row.session, (list) => [...list, { dishId: e.target.value, portion: 1 }]);
                            setAdding(null);
                          }}
                          aria-label={`Thêm món ${row.label}`}
                        >
                          <option value="">Chọn món…</option>
                          {options.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                              {row.type ? '' : ` (${DISH_TYPE_LABELS[x.type]})`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button type="button" className="td-week__add" disabled={busy} onClick={() => setAdding(k)}>
                          <Plus size={12} /> Thêm
                        </button>
                      ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
