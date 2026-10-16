import { byId, ingredientQty, priceOn } from '@/utils/menu-planning/menuCalculations';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { ageGroupById } from '@/models/School';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Khẩu phần & đi chợ (NUT-07; công thức chi tiết chờ P-10): số suất đã chốt × định lượng theo nhóm tuổi của thực đơn
 * tuần đã xuất bản. Lượng mua = lượng ăn ÷ (1 − thải bỏ), làm tròn lên theo đơn vị mua. BE phải tính lại giống vậy.
 */

const COUNTED = ['LUNCH', 'AFTERNOON'];
const COUNTED_LABEL = { LUNCH: 'Bữa trưa', AFTERNOON: 'Bữa chiều' };
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const roundUp = (qty, step) => r3(Math.ceil(Math.round((qty / step) * 1e6) / 1e6) * step);
const groupName = (ag) => ageGroupById(ag)?.shortName || ag;
const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '';

/** Bước làm tròn khi mua: đơn vị cân đo (kg, lít) 0,1; đơn vị đếm (quả, hộp, chai…) 1. */
export const purchaseStep = (unit) => (/^(kg|lít|lit|l)$/i.test(String(unit || '').trim()) ? 0.1 : 1);

/** Bữa có số suất chốt riêng là trưa, chiều; bữa khác theo "Tính suất theo" ở Thiết lập, không có thì theo Bữa trưa. */
export const countedSession = (setups, ageGroupId, code) => {
  const countAs = (setups || []).find((s) => s.ageGroupId === ageGroupId)?.meals?.find((m) => m.code === code)?.countAs || code;
  return COUNTED.includes(countAs) ? countAs : 'LUNCH';
};

/** Ngày học của thực đơn tuần đã xuất bản (bản nháp, bản đã thay thế, ngày nghỉ không tính). */
export const publishedDay = (weeklyMenus, ageGroupId, date) => {
  const wm = (weeklyMenus || []).find(
    (w) => w.ageGroupId === ageGroupId && w.status === 'PUBLISHED' && (w.days || []).some((d) => d.date === date),
  );
  const day = wm?.days.find((d) => d.date === date);
  return day && !day.holiday ? day : null;
};

/** Món thay của suất thay thế: mọi suất thay thế của thực đơn mẫu ngày đó áp cho mọi suất thay thế. */
const replacementOf = (allergyMenus, session, dishId) =>
  allergyMenus.flatMap((a) => a.replacements || []).find((r) => r.session === session && r.originalDishId === dishId);

/**
 * Phiếu đi chợ một ngày của một điểm trường.
 * counts: { LUNCH, AFTERNOON } số suất đã chuẩn hóa (`{ status, confirmedAt, classes: [{ classId, normal, substitute }] }`).
 */
export function computeMarket(db, { date, counts, classById }) {
  const foodById = byId(db.foods);
  const dishById = byId(db.dishes);
  const confirmed = Object.fromEntries(COUNTED.map((s) => [s, counts[s]?.status === 'CONFIRMED' ? counts[s] : null]));

  // Số suất theo nhóm tuổi và bữa có số chốt
  const servings = {};
  COUNTED.forEach((s) =>
    (confirmed[s]?.classes || []).forEach((row) => {
      const ag = classById[row.classId]?.ageGroupId;
      if (!ag) return;
      servings[ag] ||= {};
      servings[ag][s] ||= { normal: 0, substitute: 0 };
      servings[ag][s].normal += row.normal;
      servings[ag][s].substitute += row.substitute;
    }),
  );

  const eat = {};
  const subs = {};
  const meals = [];
  const missingMenu = [];
  const noSubstitute = [];
  const noQuantity = new Set();
  const countedBy = [];
  const add = (dish, ageGroupId, n) => {
    if (!n) return;
    (dish.ingredients || []).forEach((ing) => {
      const q = ingredientQty(ing, ageGroupId);
      if (q == null) {
        noQuantity.add(dish.name);
        return;
      }
      eat[ing.foodId] = (eat[ing.foodId] || 0) + q * n;
    });
  };

  Object.keys(servings)
    .sort()
    .forEach((ag) => {
      const day = publishedDay(db.weeklyMenus, ag, date);
      if (!day) {
        missingMenu.push(groupName(ag));
        return;
      }
      const allergyMenus = (db.allergyMenus || []).filter((a) => a.baseMenuId === day.menuId);
      let subsWithoutMenu = false;
      mealsOf(db.nutritionSetups, ag).forEach((meal) => {
        const items = (day.meals || []).find((m) => m.session === meal.code)?.items || [];
        const base = countedSession(db.nutritionSetups, ag, meal.code);
        const sv = servings[ag][base];
        if (!items.length || !sv) return;
        meals.push({ ageGroupId: ag, code: meal.code, name: meal.name, countAs: base, servings: sv.normal + sv.substitute });
        if (meal.code !== base) countedBy.push(`${meal.name} (${groupName(ag)}) tính theo số suất ${COUNTED_LABEL[base]}`);
        if (sv.substitute && !allergyMenus.length) subsWithoutMenu = true;
        items.forEach((it) => {
          const dish = dishById[it.dishId];
          if (!dish) return;
          const portion = it.portion || 1;
          add(dish, ag, sv.normal * portion);
          const rep = sv.substitute ? replacementOf(allergyMenus, meal.code, dish.id) : null;
          if (!rep) {
            add(dish, ag, sv.substitute * portion);
            return;
          }
          const to = rep.replacementDishId ? dishById[rep.replacementDishId] : null;
          if (to) add(to, ag, sv.substitute * (rep.portion || portion));
          const key = `${dish.id}>${to?.id || ''}`;
          subs[key] ||= { original: dish.name, replacement: to?.name || null, servings: 0 };
          subs[key].servings += sv.substitute;
        });
      });
      if (subsWithoutMenu) noSubstitute.push(groupName(ag));
    });

  const foods = Object.entries(eat)
    .map(([foodId, qty]) => {
      const f = foodById[foodId] || { name: foodId };
      const wastePct = Number(f.wastePct) || 0;
      const buy = wastePct > 0 && wastePct < 100 ? qty / (1 - wastePct / 100) : qty;
      const purchaseUnit = f.purchaseUnit || f.unit || '';
      const buyUnits = roundUp(buy / (Number(f.purchaseUnitSize) || 1), purchaseStep(purchaseUnit));
      const unitPrice = typeof f.unitPrice === 'number' ? f.unitPrice : null;
      return {
        foodId,
        name: f.name,
        storage: f.storage || null,
        unit: f.unit || 'g',
        eatQty: r1(qty),
        wastePct,
        buyQty: r1(buy),
        purchaseUnit,
        buyUnits,
        unitPrice,
        amount: unitPrice == null ? null : Math.round(buyUnits * unitPrice),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // Tổng thu = suất Bữa trưa đã chốt × giá suất ăn ngày của từng nhóm tuổi
  const noPrice = [];
  const parts = Object.keys(servings)
    .sort()
    .flatMap((ag) => {
      const lunch = servings[ag].LUNCH;
      if (!lunch) return [];
      const price = priceOn(db.mealPrices, ag, date)?.price ?? null;
      if (price == null) {
        noPrice.push(groupName(ag));
        return [];
      }
      return [{ ageGroupId: ag, name: groupName(ag), servings: lunch.normal + lunch.substitute, price }];
    });
  const revenue = parts.reduce((s, p) => s + p.servings * p.price, 0);
  const cost = foods.reduce((s, f) => s + (f.amount || 0), 0);
  const missingPrice = foods.filter((f) => f.unitPrice == null).map((f) => f.name);

  const checks = [];
  COUNTED.forEach((s) => {
    const c = confirmed[s];
    if (c) {
      const n = c.classes.reduce((t, r) => t + r.normal + r.substitute, 0);
      checks.push({ tone: 'ok', text: `${COUNTED_LABEL[s]} đã chốt ${n} suất${c.confirmedAt ? ` lúc ${hhmm(c.confirmedAt)}` : ''}` });
    } else checks.push({ tone: 'warn', text: `${COUNTED_LABEL[s]} chưa chốt số suất, chưa tính vào phiếu` });
  });
  if (missingMenu.length) checks.push({ tone: 'bad', text: `Chưa có thực đơn tuần đã xuất bản: ${missingMenu.join(', ')}` });
  else if (meals.length) checks.push({ tone: 'ok', text: 'Thực đơn tuần đã xuất bản' });
  countedBy.forEach((text) => checks.push({ tone: 'ok', text }));
  noSubstitute.forEach((g) =>
    checks.push({ tone: 'warn', text: `${g}: có suất thay thế nhưng thực đơn mẫu chưa có suất thay thế (tính như suất thường)` }),
  );
  if (noQuantity.size) checks.push({ tone: 'warn', text: `Món chưa có định lượng cho nhóm tuổi: ${[...noQuantity].join(', ')}` });
  if (missingPrice.length) checks.push({ tone: 'warn', text: `${missingPrice.join(', ')} chưa có đơn giá` });
  if (noPrice.length) checks.push({ tone: 'warn', text: `Chưa có giá suất ăn: ${noPrice.join(', ')}` });
  if (cost > revenue && revenue > 0) checks.push({ tone: 'warn', text: `Chi vượt thu ${formatMoney(cost - revenue)}` });

  const hasMenu = (db.weeklyMenus || []).some((w) => publishedDay([w], w.ageGroupId, date)?.meals?.some((m) => m.items?.length));
  const anyConfirmed = COUNTED.some((s) => confirmed[s]);
  return {
    date,
    status: !hasMenu ? 'NO_MENU' : !anyConfirmed ? 'WAITING_MEAL_COUNT' : 'READY',
    foods,
    revenue: { total: revenue, parts },
    cost: { total: cost, missingPrice },
    balance: revenue - cost,
    substitutes: Object.values(subs),
    meals,
    checks,
  };
}
