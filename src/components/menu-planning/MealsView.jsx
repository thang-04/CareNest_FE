import { Link } from 'react-router-dom';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { dishAllergens } from '@/utils/menu-planning/menuCalculations';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';

const portionText = (p) => (Number(p) === 1 ? '1 suất' : `${String(p).replace('.', ',')} suất`);

/**
 * Read-only meals of a day, one block per session.
 * changedDishIds highlights replacement dishes on alternative menus.
 */
export function MealsView({ meals, catalog, linkDishes = false, changedDishIds = [], compact = false }) {
  return (
    <div className={`td-meals ${compact ? 'td-meals--compact' : ''}`}>
      {(meals || []).map((meal) => (
        <div key={meal.session} className="td-session">
          <div className="td-session__title">{MEAL_SESSION_LABELS[meal.session]}</div>
          {meal.items.length === 0 ? (
            <div className="muted text-sm">Chưa có món</div>
          ) : (
            <ul className="td-dish-list">
              {meal.items.map((item) => {
                const dish = catalog.dishById[item.dishId];
                const allergens = dish ? dishAllergens(dish, catalog.foodById) : [];
                return (
                  <li key={item.dishId} className={changedDishIds.includes(item.dishId) ? 'td-dish-list__item--changed' : ''}>
                    <div className="td-dish-list__name">
                      {dish ? linkDishes ? <Link to={`/menu/dishes/${dish.id}`}>{dish.name}</Link> : dish.name : 'Món đã xóa'}
                      {!compact && dish && <span className="text-xs muted"> · {DISH_TYPE_LABELS[dish.type]}</span>}
                    </div>
                    <div className="td-dish-list__meta">
                      {Number(item.portion) !== 1 && <span className="text-xs muted">{portionText(item.portion)}</span>}
                      {allergens.length > 0 && <AllergenChips allergens={allergens} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
