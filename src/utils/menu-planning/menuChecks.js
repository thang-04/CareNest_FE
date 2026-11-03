import {
  compareToNorm,
  isNormConfigured,
  mealsAllergens,
  mealsTotals,
  priceOn,
  repeatedMainDishes,
  sameAllergen,
} from '@/utils/menu-planning/menuCalculations';
import { mealsOf, normScopeMeals } from '@/utils/menu-planning/nutritionSetup';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);
const NUTRIENT_WORD = {
  protein: 'chất đạm',
  lipid: 'chất béo',
  glucid: 'tinh bột',
  animalProteinPct: 'đạm động vật',
  animalLipidPct: 'béo động vật',
};
const RATIO_KEYS = ['protein', 'lipid', 'glucid', 'animalProteinPct', 'animalLipidPct'];
const pctOf = (v) => (typeof v === 'number' ? `${fmt(v)}%` : '—');
const rangeOf = (r, unit = '%') => (r?.min != null ? `${r.min}–${r.max}${unit === '%' ? '%' : ` ${unit}`}` : 'Chưa đặt định mức');
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
  // Định mức áp cho phạm vi các bữa trường phục vụ của nhóm tuổi
  const result = mealsTotals(normScopeMeals(meals, catalog.nutritionSetups, ageGroupId), catalog.dishById, catalog.foodById, ageGroupId);
  const rows = compareToNorm(result.totals, ageGroupId, result.missing.length > 0, catalog.norms);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const price = priceOn(catalog.mealPrices, ageGroupId, date)?.price ?? null;
  const setupMeals = mealsOf(catalog.nutritionSetups, ageGroupId);
  const emptyMeals = setupMeals.filter((m) => !(meals || []).find((x) => x.session === m.code)?.items?.length);
  const problems = [];
  const oks = [];

  // BA: chưa nhập chuẩn tạm thì không đánh giá dinh dưỡng, không hiện "Đạt"
  const normSet = isNormConfigured(catalog.norms?.[ageGroupId]);
  emptyMeals.forEach((m) => problems.push({ tone: 'bad', text: `${m.name} chưa có món` }));
  if (!normSet) problems.push({ tone: 'warn', text: 'Chưa nhập chuẩn tạm của nhóm tuổi, chưa đánh giá được dinh dưỡng' });
  if (result.missing.length)
    problems.push({ tone: 'warn', text: `Chưa đủ số liệu dinh dưỡng hoặc nguồn gốc của: ${result.missing.join(', ')}` });

  const kcal = byKey.kcal;
  if (kcal?.status === 'LOW')
    problems.push({ tone: 'bad', text: `Hơi ít năng lượng (thiếu khoảng ${round10(kcal.min - kcal.value)} kcal)` });
  else if (kcal?.status === 'HIGH')
    problems.push({ tone: 'warn', text: `Hơi nhiều năng lượng (thừa khoảng ${round10(kcal.value - kcal.max)} kcal)` });
  else if (kcal?.status === 'OK') oks.push({ tone: 'ok', text: 'Đủ năng lượng' });

  const ratio = RATIO_KEYS.map((k) => byKey[k])
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
  else if (result.missing.length || !normSet) status = { tone: 'gray', label: 'Chưa đủ dữ liệu đánh giá' };
  else if (kcal?.status === 'LOW') status = { tone: 'orange', label: 'Ít năng lượng' };
  else if (kcal?.status === 'HIGH') status = { tone: 'orange', label: 'Nhiều năng lượng' };
  else if (price != null && result.cost > price) status = { tone: 'orange', label: 'Vượt tiền ăn' };
  else if (ratio.length) status = { tone: 'orange', label: 'Chưa cân đối' };

  const t = result.totals;
  const plg = ['protein', 'lipid', 'glucid'];
  return {
    status,
    problems,
    checks: [...problems, ...oks],
    // Ba loại số tách riêng: lượng thực tế (g, kcal) · tỷ lệ cơ cấu (%) · % đạt định mức
    numbers: [
      { label: 'Năng lượng', value: `${fmt(t.kcal)} kcal`, norm: kcal?.min != null ? `${kcal.min}–${kcal.max} kcal` : 'Chưa đặt định mức' },
      { label: 'Đạm động vật · thực vật', value: `${fmt(t.animalProtein)} g · ${fmt(t.plantProtein)} g`, norm: '—' },
      { label: 'Béo động vật · thực vật', value: `${fmt(t.animalLipid)} g · ${fmt(t.plantLipid)} g`, norm: '—' },
      { label: 'Tinh bột', value: `${fmt(t.glucid)} g`, norm: '—' },
      {
        label: 'Tỷ lệ năng lượng đạm · béo · bột',
        value: plg.map((k) => pctOf(byKey[k]?.percent)).join(' · '),
        norm: byKey.protein?.min != null ? plg.map((k) => `${byKey[k].min}–${byKey[k].max}%`).join(' · ') : 'Chưa đặt định mức',
      },
      { label: 'Đạm động vật / tổng đạm', value: pctOf(byKey.animalProteinPct?.value), norm: rangeOf(byKey.animalProteinPct) },
      { label: 'Béo động vật / tổng béo', value: pctOf(byKey.animalLipidPct?.value), norm: rangeOf(byKey.animalLipidPct) },
      {
        label: '% đạt định mức năng lượng · đạm · béo · bột',
        value: ['kcal', ...plg].map((k) => pctOf(byKey[k]?.attainment)).join(' · '),
        norm: kcal?.target != null ? '100% = giữa khoảng định mức' : 'Chưa đặt định mức',
      },
      { label: 'Tiền ăn', value: formatMoney(result.cost), norm: price != null ? `tối đa ${formatMoney(price)}` : '—' },
    ],
    rows,
    totals: result.totals,
    missing: result.missing,
    cost: result.cost,
    price,
    mealCount: (meals || []).filter((m) => m.items?.length).length,
  };
}

/**
 * Các ngày cần xem lại của một tuần, viết bằng lời thường: ngày chưa chọn thực đơn, vấn đề của checkDayMenu,
 * món mặn lặp trong 7 ngày (tính cả tuần trước đã xuất bản, nêu ngày đã có). Trả [{ date, tone, text }].
 */
/** Gom lưu ý trùng nội dung của cả tuần thành một dòng kèm các ngày bị ảnh hưởng; lỗi nặng ('bad') lên trước. */
export function groupIssues(issues) {
  const groups = [];
  issues.forEach(({ date, tone, text }) => {
    const g = groups.find((x) => x.text === text);
    if (!g) groups.push({ tone, text, dates: [date] });
    else {
      if (!g.dates.includes(date)) g.dates.push(date);
      if (tone === 'bad') g.tone = 'bad';
    }
  });
  return groups.sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
}

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

/**
 * Kiểm tra tiền ăn của thực đơn tuần. days: [{ date, cost }] các ngày học. Trả { level: 'ok'|'warn', text }.
 * Giá BE tính theo ngày (`catalog.pricePerDay`, NUT-19) ⇒ so chi phí từng ngày với giá áp dụng ngày đó;
 * dữ liệu mẫu giữ cách cũ: tổng tuần so với giá × số ngày học.
 */
export function weekBudgetCheck({ days, ageGroupId, weekStart, catalog }) {
  if (catalog.pricePerDay) {
    const rows = days.map((d) => ({ ...d, price: priceOn(catalog.mealPrices, ageGroupId, d.date)?.price ?? null }));
    const priced = rows.filter((r) => r.price != null);
    if (!priced.length) return { level: 'warn', text: 'Chưa có giá suất ăn áp dụng cho tuần này nên chưa kiểm tra được tiền ăn.' };
    const over = priced.filter((r) => r.cost > r.price);
    const unpriced = rows.length - priced.length;
    const note = unpriced ? ` ${unpriced} ngày chưa có giá suất ăn áp dụng.` : '';
    if (over.length)
      return {
        level: 'warn',
        text: `${over.length} ngày vượt tiền ăn / ngày: ${over
          .map((r) => `${dayLabel(r.date)} (${formatMoney(r.cost)} / ${formatMoney(r.price)})`)
          .join(', ')}.${note}`,
      };
    return {
      level: unpriced ? 'warn' : 'ok',
      text: `Chi phí thực phẩm ước tính từng ngày đều trong tiền ăn / ngày (${formatMoney(priced[0].price)} / trẻ).${note}`,
    };
  }
  const price = priceOn(catalog.mealPrices, ageGroupId, weekStart)?.price;
  const cost = days.reduce((s, d) => s + d.cost, 0);
  const budget = price ? price * days.length : null;
  if (!budget) return { level: 'warn', text: 'Chưa có giá suất ăn áp dụng cho tuần này nên chưa kiểm tra được ngân sách.' };
  return {
    level: cost > budget ? 'warn' : 'ok',
    text: `Chi phí thực phẩm ước tính ${formatMoney(cost)} / ngân sách tuần ${formatMoney(budget)} (${formatMoney(price)} × ${days.length} ngày)${
      cost > budget ? ' – vượt ngân sách.' : '.'
    }`,
  };
}
