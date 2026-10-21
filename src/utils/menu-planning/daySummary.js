import { compareToNorm, mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';

export const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');

/**
 * Số liệu một ngày của thực đơn tuần, dùng chung cho đầu cột bảng tuần và bảng cân đối để hai nơi luôn khớp.
 * Ngày nghỉ hoặc chưa có món ⇒ null.
 */
export const daySummary = (day, { ageGroupId, weekStart }, catalog) => {
  if (day.holiday || !day.meals?.some((m) => m.items?.length)) return null;
  const r = mealsTotals(day.meals, catalog.dishById, catalog.foodById, ageGroupId);
  const nutrients = Object.fromEntries(compareToNorm(r.totals, ageGroupId, r.missing.length > 0, catalog.norms).map((x) => [x.key, x]));
  const price = priceOn(catalog.mealPrices, ageGroupId, weekStart)?.price ?? null;
  return {
    nutrients,
    cost: r.cost,
    price,
    overPrice: price != null && r.cost > price,
    check: checkDayMenu({ meals: day.meals, ageGroupId, catalog, date: day.date }).status,
  };
};
