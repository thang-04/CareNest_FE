import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { dishAllergens, dishTotals } from '@/utils/menu-planning/menuCalculations';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, RECORD_STATUS, portionFactorOf } from '@/models/menu-planning/menuPlanningConstants';

/**
 * Edits the dishes and portion multipliers of each session.
 * meals: [{ session, items: [{ dishId, portion }] }]; errors: { meal_<SESSION>: message }.
 */
export function MealEditor({ meals, sessions, onChange, catalog, ageGroupId, errors = {}, disabled = false }) {
  const factor = portionFactorOf(ageGroupId);
  const options = useMemo(
    () =>
      catalog.dishes
        .filter((d) => d.status === RECORD_STATUS.ACTIVE)
        .map((d) => ({ value: d.id, label: d.name, searchText: `${d.name} ${DISH_TYPE_LABELS[d.type]}` })),
    [catalog.dishes],
  );
  const mealOf = (session) => meals.find((m) => m.session === session) || { session, items: [] };
  const update = (session, items) => {
    const next = sessions.map((s) => (s === session ? { session, items } : mealOf(s)));
    onChange(next);
  };

  return (
    <div className="td-meal-editor">
      {sessions.map((session) => {
        const meal = mealOf(session);
        const err = errors[`meal_${session}`];
        return (
          <div key={session} className={`td-session td-session--edit ${err ? 'td-session--error' : ''}`}>
            <div className="td-session__title">{MEAL_SESSION_LABELS[session]}</div>
            {meal.items.length > 0 && (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>Món</th>
                      <th style={{ width: 120 }}>Hệ số khẩu phần</th>
                      <th className="right">Năng lượng</th>
                      <th>Chứa</th>
                      <th className="center" style={{ width: 56 }}>
                        <span className="sr-only">Xóa</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {meal.items.map((item, idx) => {
                      const dish = catalog.dishById[item.dishId];
                      const kcal = dish ? dishTotals(dish, catalog.foodById, (Number(item.portion) || 0) * factor).totals.kcal : null;
                      const taken = meal.items.filter((_, j) => j !== idx).map((i) => i.dishId);
                      const opts = options.filter((o) => !taken.includes(o.value));
                      // An inactive dish already on the menu stays selectable so the row still shows its name.
                      if (dish && dish.status !== RECORD_STATUS.ACTIVE)
                        opts.push({ value: dish.id, label: `${dish.name} (ngừng sử dụng)` });
                      return (
                        <tr key={`${session}_${idx}`}>
                          <td>
                            <SearchSelect
                              options={opts}
                              value={item.dishId}
                              placeholder="Chọn món..."
                              ariaLabel={`${MEAL_SESSION_LABELS[session]}: món ${idx + 1}`}
                              disabled={disabled}
                              onChange={(v) =>
                                update(
                                  session,
                                  meal.items.map((it, j) => (j === idx ? { ...it, dishId: v } : it)),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              min="0.1"
                              max="3"
                              step="0.1"
                              value={item.portion}
                              disabled={disabled}
                              aria-label={`Hệ số khẩu phần món ${idx + 1} – ${MEAL_SESSION_LABELS[session]}`}
                              onChange={(e) =>
                                update(
                                  session,
                                  meal.items.map((it, j) => (j === idx ? { ...it, portion: e.target.value } : it)),
                                )
                              }
                            />
                          </td>
                          <td className="right nowrap">{kcal == null ? '—' : `${kcal.toLocaleString('vi-VN')} kcal`}</td>
                          <td>{dish ? <AllergenChips allergens={dishAllergens(dish, catalog.foodById)} /> : '—'}</td>
                          <td className="center">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Bỏ món ${dish?.name || idx + 1}`}
                              title="Bỏ món"
                              disabled={disabled}
                              onClick={() =>
                                update(
                                  session,
                                  meal.items.filter((_, j) => j !== idx),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {err && (
              <span className="field__error" role="alert">
                {err}
              </span>
            )}
            {!disabled && (
              <button
                type="button"
                className="btn btn--sm btn--ghost mt-8"
                onClick={() => update(session, [...meal.items, { dishId: '', portion: 1 }])}
              >
                <Plus size={15} /> Thêm món
              </button>
            )}
          </div>
        );
      })}
      <p className="text-xs muted">
        Hệ số 1 = một khẩu phần chuẩn của món; năng lượng đã nhân hệ số khẩu phần của nhóm tuổi ({String(factor).replace('.', ',')}).
      </p>
    </div>
  );
}
