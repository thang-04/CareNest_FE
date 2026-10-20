import { dishAllergens, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { DISH_TYPE } from '@/models/menu-planning/menuPlanningConstants';

// Bữa trưa tách hàng theo loại món như sổ thực đơn; bữa khác mỗi bữa một hàng
export const LUNCH_TYPES = [DISH_TYPE.CARB, DISH_TYPE.MAIN, DISH_TYPE.SOUP, DISH_TYPE.VEGETABLE, DISH_TYPE.DESSERT];
const LUNCH_LABELS = { CARB: 'Cơm', MAIN: 'Món mặn', SOUP: 'Canh', VEGETABLE: 'Món rau', DESSERT: 'Tráng miệng' };

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

/**
 * Bảng tuần gom theo bữa: mỗi bữa một nhóm mang tên bữa; bữa trưa tách theo loại món, bữa khác một hàng "Món".
 * keepEmpty=false (bản chỉ xem): ẩn loại món cả tuần không dùng để bảng không có hàng trống.
 */
export const weekSections = (setups, ageGroupId, days, dishById, { keepEmpty = true } = {}) =>
  mealsOf(setups, ageGroupId).map((m) => {
    if (m.code !== 'LUNCH') return { session: m.code, label: m.name, rows: [{ key: m.code, label: 'Món', session: m.code }] };
    const used = new Set(
      days.flatMap((d) =>
        (d.meals || []).filter((x) => x.session === 'LUNCH').flatMap((x) => x.items.map((i) => dishById[i.dishId]?.type)),
      ),
    );
    const rows = weekRows(setups, ageGroupId, days, dishById).filter(
      (r) => r.session === 'LUNCH' && (keepEmpty || used.has(r.type) || r.type === 'OTHER'),
    );
    return { session: m.code, label: m.name, rows: rows.length ? rows : [{ key: 'LUNCH', label: 'Món', session: 'LUNCH' }] };
  });

/** Ghi chú dị ứng của một bữa trong ngày: món có chất mà nhóm có trẻ dị ứng, kèm suất thay thế của thực đơn mẫu. */
export const dayAllergyNotes = ({ day, session, catalog, allergyRows = [], allergyMenus = [] }) => {
  if (day.holiday) return [];
  const items = (day.meals || []).find((m) => m.session === session)?.items || [];
  return items.flatMap(({ dishId }) => {
    const dish = catalog.dishById[dishId];
    return dishAllergens(dish, catalog.foodById)
      .map((a) => {
        const kids = allergyRows.find((r) => sameAllergen(r.allergen, a))?.childCount;
        if (!kids) return null;
        const rep = allergyMenus
          .filter((s) => s.baseMenuId === day.menuId && s.restrictions.some((x) => sameAllergen(x, a)))
          .flatMap((s) => s.replacements)
          .find((r) => r.session === session && r.originalDishId === dishId);
        const swap = rep ? (rep.replacementDishId ? catalog.dishById[rep.replacementDishId]?.name : 'bỏ món') : null;
        return {
          key: `${dishId}|${a}`,
          dish: dish?.name || 'Món đã xóa',
          text: `${kids} trẻ ${a.toLowerCase()}${swap ? ` → ${swap}` : ' · chưa có suất thay thế'}`,
          missing: !swap,
        };
      })
      .filter(Boolean);
  });
};
