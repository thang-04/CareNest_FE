import { computeMarket } from '@/services/kitchen/mock/marketList';
import { forecastDay, forecastEnv, storageOf } from '@/services/kitchen/mock/weeklyForecast';
import { ageGroupById } from '@/models/School';

/*
 * Bảng đi chợ một ngày của một điểm trường (gộp "Phiếu kê chợ" và "Bảng đi chợ" của PMS): mỗi thực phẩm có đơn giá, lượng
 * mua chợ hoặc xuất kho, thành tiền, chia theo nhóm tuổi; kèm thu–chi trong ngày và thực đơn theo bữa.
 * Lượng theo NUT-07 (thực đơn đã công bố × số suất; ngày chưa chốt dùng số dự trù), thải bỏ NUT-18, đồ khô xuất kho NUT-11.
 * BE phải tính lại giống vậy; giao diện chỉ hiển thị.
 */

export const DAY_MARKET_SOURCE = { MARKET: 'MARKET', STOCK: 'STOCK' };

const r2 = (n) => Math.round(n * 100) / 100;
const groupOfRow = (row, classById) => row.ageGroupId || classById[row.classId]?.ageGroupId;
const servingsOf = (row) => Number(row.normal || 0) + Number(row.substitute || 0);

/** Chia `total` theo tỷ lệ `weights`; phần lẻ dồn vào nhóm cuối có phần để các nhóm cộng lại đúng bằng `total`. */
export const splitByWeight = (total, weights, round) => {
  if (total == null) return weights.map(() => null);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const last = weights.findLastIndex((w) => w > 0);
  let used = 0;
  return weights.map((w, i) => {
    if (i === last) return round(total - used);
    const part = w > 0 ? round((total * w) / sum) : 0;
    used += part;
    return part;
  });
};

const onlyGroup = (counts, classById, ageGroupId) =>
  Object.fromEntries(
    Object.entries(counts).map(([session, count]) => [
      session,
      count ? { ...count, classes: (count.classes || []).filter((row) => groupOfRow(row, classById) === ageGroupId) } : count,
    ]),
  );

// Số suất tính tiền của nhóm: bữa trưa, nhóm không có bữa trưa thì bữa đầu có suất (như phần thu của computeMarket)
const paidServings = (counts) => {
  const withRows = Object.keys(counts).filter((s) => counts[s]?.classes?.some((row) => servingsOf(row) > 0));
  const reference = withRows.includes('LUNCH') ? 'LUNCH' : withRows[0];
  return reference ? counts[reference].classes.reduce((n, row) => n + servingsOf(row), 0) : 0;
};

const emptyView = (base, status) => ({
  ...base,
  status,
  groups: [],
  lines: [],
  totals: { servings: 0, revenue: 0, cost: 0, marketCost: 0, stockCost: 0, balance: 0, groups: [] },
  menu: [],
  warnings: [],
});

/** ctx: { today, isSchoolDay(date), mealCountOf(date, session) }; record: bản dự trù tuần đã lưu của tuần chứa `date`. */
export function buildDayMarket(db, { campusId, date, record, ctx }) {
  const env = forecastEnv(db, { campusId, record });
  const day = forecastDay(db, env, date, ctx);
  const base = { campusId, date, basis: day.confirmed ? 'CONFIRMED' : 'FORECAST', confirmedAt: day.confirmedAt };
  if (day.holiday) return emptyView(base, 'HOLIDAY');
  const { classById } = env;
  const market = computeMarket(db, { date, counts: day.counts, classById });
  if (market.status === 'NO_MENU') return emptyView(base, 'NO_MENU');

  const foodById = Object.fromEntries((db.foods || []).map((f) => [f.id, f]));
  const groupIds = [
    ...new Set(
      Object.values(day.counts)
        .flatMap((count) => count?.classes || [])
        .filter((row) => servingsOf(row) > 0)
        .map((row) => groupOfRow(row, classById))
        .filter(Boolean),
    ),
  ].sort();

  const eatOf = {};
  const menu = [];
  const groups = groupIds.map((ageGroupId) => {
    const counts = onlyGroup(day.counts, classById, ageGroupId);
    const own = computeMarket(db, { date, counts, classById });
    eatOf[ageGroupId] = Object.fromEntries(own.foods.map((f) => [f.foodId, f.eatQty]));
    own.meals.forEach((meal) => {
      if (!meal.dishes.length) return;
      let row = menu.find((m) => m.code === meal.code);
      if (!row) menu.push((row = { code: meal.code, name: meal.name, groups: [] }));
      row.groups.push({ ageGroupId, dishes: meal.dishes });
    });
    const servings = paidServings(counts);
    // Nhóm chưa có giá suất ăn không nằm trong phần thu của computeMarket
    const price = own.revenue.parts.find((p) => p.ageGroupId === ageGroupId)?.price ?? null;
    return {
      ageGroupId,
      name: ageGroupById(ageGroupId)?.shortName || ageGroupId,
      servings,
      price,
      revenue: price == null ? null : servings * price,
    };
  });

  const lines = market.foods
    .map((f) => {
      const food = foodById[f.foodId];
      const fromStock = storageOf(food) === 'DRY';
      // Đồ khô xuất kho theo đơn vị kho, giá quy từ giá một đơn vị mua; hàng tươi mua theo đơn vị mua
      const quantity = fromStock ? f.stockUnits : f.buyUnits;
      const unitPrice = fromStock ? f.stockUnitPrice : f.unitPrice;
      const amount = unitPrice == null ? null : Math.round(quantity * unitPrice);
      const weights = groupIds.map((id) => eatOf[id][f.foodId] || 0);
      const quantities = splitByWeight(quantity, weights, r2);
      const amounts = splitByWeight(amount, weights, Math.round);
      return {
        foodId: f.foodId,
        name: f.name,
        unit: fromStock ? f.stockUnit : f.purchaseUnit,
        unitPrice,
        source: fromStock ? DAY_MARKET_SOURCE.STOCK : DAY_MARKET_SOURCE.MARKET,
        quantity,
        amount,
        groups: groupIds.map((ageGroupId, i) => ({ ageGroupId, quantity: quantities[i], amount: amounts[i] })),
      };
    })
    .filter((line) => line.quantity > 0)
    .sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name, 'vi') : a.source === DAY_MARKET_SOURCE.MARKET ? -1 : 1));

  const sum = (rows, pick) => rows.reduce((n, row) => n + (pick(row) || 0), 0);
  const cost = sum(lines, (l) => l.amount);
  const revenue = sum(groups, (g) => g.revenue);
  return {
    ...base,
    status: 'READY',
    groups,
    lines,
    totals: {
      servings: sum(groups, (g) => g.servings),
      revenue,
      cost,
      marketCost: sum(
        lines.filter((l) => l.source === DAY_MARKET_SOURCE.MARKET),
        (l) => l.amount,
      ),
      stockCost: sum(
        lines.filter((l) => l.source === DAY_MARKET_SOURCE.STOCK),
        (l) => l.amount,
      ),
      balance: revenue - cost,
      groups: groupIds.map((ageGroupId, i) => ({ ageGroupId, cost: sum(lines, (l) => l.groups[i].amount) })),
    },
    menu,
    warnings: market.checks.filter((c) => c.tone !== 'ok').map((c) => c.text),
  };
}
