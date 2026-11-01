import { useState } from 'react';
import { BookOpen, Plus, Search } from '@/components/ui/icons';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { dishAllergens, dishTotals } from '@/utils/menu-planning/menuCalculations';
import { normalizeText } from '@/utils/format';
import { DISH_TYPE_LABELS, RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';

/** Thư viện món của trường bên phải trang sửa thực đơn mẫu: tìm và thêm nhanh món vào bữa đang chọn. */
export function DishQuickAdd({ catalog, ageGroupId, meals, mealOptions, target, onTarget, onAdd }) {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const inTarget = new Set((meals.find((m) => m.session === target)?.items || []).map((i) => i.dishId));
  const key = normalizeText(keyword).trim();
  const list = catalog.dishes
    .filter((d) => d.status === RECORD_STATUS.ACTIVE && !inTarget.has(d.id))
    .filter((d) => (!type || d.type === type) && (!key || normalizeText(d.name).includes(key)))
    .slice(0, 30);

  return (
    <section className="card td-quick-add">
      <div className="card__header">
        <h2 className="card__title">
          <BookOpen size={18} /> Thêm nhanh từ danh mục
        </h2>
      </div>
      <div className="card__body td-quick-add__body">
        <label className="field">
          <span className="field__label">Thêm vào</span>
          <select className="select" value={target} onChange={(e) => onTarget(e.target.value)}>
            {mealOptions.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="search-box">
          <Search size={17} className="muted" />
          <input placeholder="Tìm món…" value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm món để thêm" />
        </label>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại món">
          <option value="">Tất cả loại món</option>
          {Object.entries(DISH_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <ul className="td-quick-add__list">
          {list.map((d) => {
            const t = ageGroupId ? dishTotals(d, catalog.foodById, 1, ageGroupId) : null;
            return (
              <li key={d.id}>
                <span className="td-grow">
                  <b>{d.name}</b>
                  <span className="text-xs muted">
                    {DISH_TYPE_LABELS[d.type]}
                    {t && !t.noQuantity ? ` · ${Math.round(t.totals.kcal)} kcal` : t?.noQuantity ? ' · chưa có định lượng' : ''}
                  </span>
                  <AllergenChips allergens={dishAllergens(d, catalog.foodById)} empty="" />
                </span>
                <button type="button" className="icon-btn" aria-label={`Thêm ${d.name}`} onClick={() => onAdd(d.id)}>
                  <Plus size={18} />
                </button>
              </li>
            );
          })}
          {!list.length && <li className="muted text-sm">Không có món phù hợp.</li>}
        </ul>
      </div>
    </section>
  );
}
