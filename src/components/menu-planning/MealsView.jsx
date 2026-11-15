import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { dishAllergens } from '@/utils/menu-planning/menuCalculations';
import { DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { mealLabel } from '@/utils/menu-planning/nutritionSetup';

const portionText = (p) => (Number(p) === 1 ? '1 suất' : `${String(p).replace('.', ',')} suất`);

/**
 * Read-only meals of a day. Mặc định là bảng (dải tên bữa, rồi mỗi món một dòng: món · loại · khẩu phần · dị ứng);
 * `compact` giữ danh sách gọn cho thẻ ngày trong tuần. changedDishIds tô các món thay thế ở thực đơn thay thế.
 */
export function MealsView({ meals, catalog, ageGroupId, linkDishes = false, changedDishIds = [], compact = false }) {
  if (!compact) {
    return (
      <div className="table-wrap">
        <table className="table table--grid table--compact td-meals-table">
          <colgroup>
            <col className="td-meals-table__c1" />
            <col />
            <col className="td-meals-table__c3" />
            <col className="td-meals-table__c4" />
          </colgroup>
          <thead>
            <tr>
              <th>Món ăn</th>
              <th>Loại món</th>
              <th className="num">Khẩu phần</th>
              <th>Dị ứng</th>
            </tr>
          </thead>
          <tbody>
            {(meals || []).map((meal) => (
              <Fragment key={meal.session}>
                <tr className="td-meal-band">
                  <th scope="colgroup" colSpan={4}>
                    {mealLabel(catalog.nutritionSetups, ageGroupId, meal.session)}
                  </th>
                </tr>
                {meal.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Chưa có món
                    </td>
                  </tr>
                ) : (
                  meal.items.map((item) => {
                    const dish = catalog.dishById[item.dishId];
                    const allergens = dish ? dishAllergens(dish, catalog.foodById) : [];
                    return (
                      <tr key={item.dishId} className={changedDishIds.includes(item.dishId) ? 'td-meals-table__changed' : undefined}>
                        <td>{dish ? linkDishes ? <Link to={`/menu/dishes/${dish.id}`}>{dish.name}</Link> : dish.name : 'Món đã xóa'}</td>
                        <td>{dish ? DISH_TYPE_LABELS[dish.type] : '—'}</td>
                        <td className="num nowrap">{portionText(item.portion)}</td>
                        <td>{allergens.length > 0 ? <AllergenChips allergens={allergens} /> : <span className="muted">—</span>}</td>
                      </tr>
                    );
                  })
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="td-meals td-meals--compact">
      {(meals || []).map((meal) => (
        <div key={meal.session} className="td-session">
          <div className="td-session__title">{mealLabel(catalog.nutritionSetups, ageGroupId, meal.session)}</div>
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
