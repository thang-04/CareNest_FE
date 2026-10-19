import {
  compareToNorm,
  mealsAllergens,
  mealsTotals,
  priceOn,
  repeatedMainDishes,
  sameAllergen,
} from '@/utils/menu-planning/menuCalculations';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);
const NUTRIENT_WORD = { protein: 'chất đạm', lipid: 'chất béo', glucid: 'tinh bột' };
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Thứ Hai 12/10" từ ngày ISO. */
export const dayLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

/**
 * Kiểm tra tự động một thực đơn một ngày theo định mức và giá suất ăn ở Thiết lập (quy tắc, không AI).
 * Lời nhắn viết cho giáo viên không chuyên dinh dưỡng; con số chi tiết để riêng ở `numbers`.
 * Trả { status, problems, checks, numbers, totals, cost, price, mealCount }; checks = problems + các mục đạt.
 * allergyRows: số trẻ dị ứng tổng hợp của nhóm tuổi; allergyMenus: suất thay thế đã có của thực đơn này.
 */
export function checkDayMenu({ meals, ageGroupId, catalog, date, allergyRows = [], allergyMenus = [] }) {
  const result = mealsTotals(meals, catalog.dishById, catalog.foodById, ageGroupId);
  const rows = compareToNorm(result.totals, ageGroupId, result.missing.length > 0, catalog.norms);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const price = priceOn(catalog.mealPrices, ageGroupId, date)?.price ?? null;
  const setupMeals = mealsOf(catalog.nutritionSetups, ageGroupId);
  const emptyMeals = setupMeals.filter((m) => !(meals || []).find((x) => x.session === m.code)?.items?.length);
  const problems = [];
  const oks = [];

  emptyMeals.forEach((m) => problems.push({ tone: 'bad', text: `${m.name} chưa có món` }));
  if (result.missing.length) problems.push({ tone: 'warn', text: `Chưa đủ số liệu dinh dưỡng của: ${result.missing.join(', ')}` });

  const kcal = byKey.kcal;
  if (kcal?.status === 'LOW')
    problems.push({ tone: 'bad', text: `Hơi ít năng lượng (thiếu khoảng ${round10(kcal.min - kcal.value)} kcal)` });
  else if (kcal?.status === 'HIGH')
    problems.push({ tone: 'warn', text: `Hơi nhiều năng lượng (thừa khoảng ${round10(kcal.value - kcal.max)} kcal)` });
  else if (kcal?.status === 'OK') oks.push({ tone: 'ok', text: 'Đủ năng lượng' });

  const ratio = ['protein', 'lipid', 'glucid']
    .map((k) => byKey[k])
    .filter((r) => r?.status === 'LOW' || r?.status === 'HIGH')
    .map((r) => `${r.status === 'LOW' ? 'ít' : 'nhiều'} ${NUTRIENT_WORD[r.key]}`);
  if (ratio.length) problems.push({ tone: 'warn', text: cap(ratio.join(', ')) });
  else if (kcal?.status === 'OK') oks.push({ tone: 'ok', text: 'Cân đối đạm, béo, tinh bột' });

  if (price != null) {
    if (result.cost > price) problems.push({ tone: 'warn', text: `Vượt tiền ăn ${formatMoney(result.cost - price)}` });
    else oks.push({ tone: 'ok', text: 'Trong tiền ăn' });
  }

  mealsAllergens(meals, catalog.dishById, catalog.foodById).forEach((a) => {
    const kids = allergyRows.find((r) => sameAllergen(r.allergen, a.allergen))?.childCount || 0;
    if (!kids) return;
    const covered = allergyMenus.some((m) => (m.restrictions || []).some((x) => sameAllergen(x, a.allergen)));
    const what = `Có món chứa ${a.allergen.toLowerCase()} (${kids} trẻ dị ứng)`;
    if (covered) oks.push({ tone: 'ok', text: `${what}, đã có suất thay thế` });
    else problems.push({ tone: 'warn', text: `${what}, chưa có suất thay thế` });
  });

  let status = { tone: 'green', label: 'Đủ chất' };
  if (emptyMeals.length) status = { tone: 'red', label: 'Thiếu bữa' };
  else if (result.missing.length) status = { tone: 'gray', label: 'Thiếu số liệu' };
  else if (kcal?.status === 'LOW') status = { tone: 'orange', label: 'Ít năng lượng' };
  else if (kcal?.status === 'HIGH') status = { tone: 'orange', label: 'Nhiều năng lượng' };
  else if (price != null && result.cost > price) status = { tone: 'orange', label: 'Vượt tiền ăn' };
  else if (ratio.length) status = { tone: 'orange', label: 'Chưa cân đối' };

  const pct = ['protein', 'lipid', 'glucid'].map((k) => fmt(byKey[k]?.percent));
  return {
    status,
    problems,
    checks: [...problems, ...oks],
    numbers: [
      {
        label: 'Năng lượng',
        value: `${fmt(result.totals.kcal)} kcal`,
        norm: kcal?.min != null ? `${kcal.min}–${kcal.max} kcal` : '—',
      },
      {
        label: 'Đạm · béo · tinh bột',
        value: `${pct[0]}% · ${pct[1]}% · ${pct[2]}%`,
        norm: ['protein', 'lipid', 'glucid'].map((k) => (byKey[k]?.min != null ? `${byKey[k].min}–${byKey[k].max}%` : '—')).join(' · '),
      },
      { label: 'Tiền ăn', value: formatMoney(result.cost), norm: price != null ? `tối đa ${formatMoney(price)}` : '—' },
    ],
    totals: result.totals,
    cost: result.cost,
    price,
    mealCount: (meals || []).filter((m) => m.items?.length).length,
  };
}

/**
 * Các ngày cần xem lại của một tuần, viết bằng lời thường: ngày chưa chọn thực đơn, vấn đề của checkDayMenu,
 * món mặn lặp trong 7 ngày (tính cả tuần trước đã xuất bản, nêu ngày đã có). Trả [{ date, tone, text }].
 */
export function weekIssues({ wm, catalog, previousDays = [], allergyRows = [], allergyMenus = [] }) {
  const issues = [];
  const school = (wm?.days || []).filter((d) => !d.holiday);
  school.forEach((day) => {
    if (!day.menuId && !day.meals?.some((m) => m.items?.length)) {
      issues.push({ date: day.date, tone: 'bad', text: 'Chưa chọn thực đơn' });
      return;
    }
    const subs = allergyMenus.filter((a) => a.baseMenuId === day.menuId);
    checkDayMenu({
      meals: day.meals,
      ageGroupId: wm.ageGroupId,
      catalog,
      date: day.date,
      allergyRows,
      allergyMenus: subs,
    }).problems.forEach((c) => issues.push({ date: day.date, tone: c.tone, text: c.text }));
  });
  repeatedMainDishes([...previousDays, ...school], catalog.dishById).forEach((r) =>
    r.dates.forEach((date, i) => {
      if (i === 0 || !school.some((s) => s.date === date)) return;
      issues.push({ date, tone: 'warn', text: `Món ${r.name} lặp lại (đã ăn ${dayLabel(r.dates[i - 1])})` });
    }),
  );
  return issues.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
