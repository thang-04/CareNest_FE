import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { computeMarket, purchaseStep } = await import('@/services/kitchen/mock/marketList');
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
// Ngày học trong tuần đã xuất bản của dữ liệu mẫu, đã qua nên có số suất chốt
const SEED_DATE = '2026-10-06';

beforeEach(() => values.clear());

// Dữ liệu tối thiểu, số tròn để kiểm công thức
const food = (id, name, extra = {}) => ({
  id,
  name,
  unit: 'g',
  purchaseUnit: 'kg',
  purchaseUnitSize: 1000,
  unitPrice: 20000,
  wastePct: 0,
  ...extra,
});
const dish = (id, name, foodId, g) => ({ id, name, ingredients: [{ foodId, quantity: g, portions: { 'ag-2': g, 'ag-3': g } }] });
const DATE = '2026-11-03';
const db = {
  foods: [
    food('f1', 'Gạo tẻ', { unitPrice: 18000 }),
    food('f2', 'Rau ngót', { wastePct: 20, unitPrice: null }),
    food('f3', 'Tôm đồng'),
    food('f4', 'Thịt lợn nạc'),
    food('f5', 'Trứng gà', { purchaseUnit: 'quả', purchaseUnitSize: 50, unitPrice: 3500 }),
  ],
  dishes: [
    dish('d1', 'Cơm trắng', 'f1', 50),
    dish('d2', 'Canh rau ngót', 'f2', 30),
    dish('d3', 'Tôm rim', 'f3', 15),
    dish('d4', 'Thịt rim', 'f4', 15),
    dish('d5', 'Cháo', 'f1', 20),
    dish('d6', 'Trứng hấp', 'f5', 30),
  ],
  nutritionSetups: [
    {
      ageGroupId: 'ag-2',
      meals: [
        { code: 'MORNING', name: 'Bữa phụ sáng', countAs: 'MORNING' },
        { code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' },
        { code: 'AFTERNOON', name: 'Bữa chiều', countAs: 'AFTERNOON' },
      ],
    },
    { ageGroupId: 'ag-3', meals: [{ code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' }] },
  ],
  mealPrices: [{ ageGroupId: 'ag-2', price: 32000, effectiveFrom: '2026-09-01', effectiveTo: null }],
  allergyMenus: [
    { baseMenuId: 'm1', restrictions: ['Tôm'], replacements: [{ session: 'LUNCH', originalDishId: 'd3', replacementDishId: 'd4' }] },
  ],
  weeklyMenus: [
    {
      id: 'w1',
      ageGroupId: 'ag-2',
      status: 'PUBLISHED',
      days: [
        {
          date: DATE,
          holiday: false,
          menuId: 'm1',
          meals: [
            { session: 'MORNING', items: [{ dishId: 'd5', portion: 1 }] },
            {
              session: 'LUNCH',
              items: [
                { dishId: 'd1', portion: 1 },
                { dishId: 'd2', portion: 1 },
                { dishId: 'd3', portion: 1 },
              ],
            },
            { session: 'AFTERNOON', items: [{ dishId: 'd6', portion: 1 }] },
          ],
        },
        { date: '2026-11-04', holiday: true, note: 'Nghỉ', menuId: null, meals: [] },
      ],
    },
    // Bản nháp của nhóm khác không được tính
    {
      id: 'w2',
      ageGroupId: 'ag-3',
      status: 'DRAFT',
      days: [{ date: DATE, menuId: 'm2', meals: [{ session: 'LUNCH', items: [{ dishId: 'd1' }] }] }],
    },
  ],
};
const classById = { c1: { ageGroupId: 'ag-2' }, c2: { ageGroupId: 'ag-3' } };
const counts = {
  LUNCH: {
    status: 'CONFIRMED',
    confirmedAt: '2026-11-03T01:30:00.000Z',
    classes: [
      { classId: 'c1', normal: 10, substitute: 2 },
      { classId: 'c2', normal: 5, substitute: 0 },
    ],
  },
  AFTERNOON: { status: 'DRAFT', classes: [{ classId: 'c1', normal: 11, substitute: 2 }] },
};
const byName = (m, name) => m.foods.find((f) => f.name === name);

test('lượng ăn theo định lượng nhóm tuổi; bữa phụ sáng tính theo số suất bữa trưa; bữa chưa chốt không tính', () => {
  const m = computeMarket(db, { date: DATE, counts, classById });
  // Cơm 12 suất × 50 g + cháo bữa phụ sáng 12 suất × 20 g = 840 g ⇒ mua 0,9 kg (làm tròn lên 0,1)
  assert.deepEqual((({ eatQty, buyQty, buyUnits, amount }) => ({ eatQty, buyQty, buyUnits, amount }))(byName(m, 'Gạo tẻ')), {
    eatQty: 840,
    buyQty: 840,
    buyUnits: 0.9,
    amount: 16200,
  });
  assert.ok(!byName(m, 'Trứng gà'), 'bữa chiều chưa chốt thì không tính');
  assert.ok(m.checks.some((c) => c.text === 'Bữa phụ sáng (Nhà trẻ) tính theo số suất Bữa trưa'));
  assert.ok(m.checks.some((c) => c.tone === 'warn' && c.text.startsWith('Bữa chiều chưa chốt')));
  assert.equal(m.status, 'READY');
});

test('thải bỏ tăng lượng mua; thiếu đơn giá không cộng vào tổng chi và có cảnh báo', () => {
  const m = computeMarket(db, { date: DATE, counts, classById });
  const rau = byName(m, 'Rau ngót');
  // 12 × 30 = 360 g, thải bỏ 20% ⇒ 450 g ⇒ 0,5 kg
  assert.deepEqual([rau.eatQty, rau.wastePct, rau.buyQty, rau.buyUnits, rau.amount], [360, 20, 450, 0.5, null]);
  assert.deepEqual(m.cost.missingPrice, ['Rau ngót']);
  assert.equal(
    m.cost.total,
    m.foods.reduce((s, f) => s + (f.amount || 0), 0),
  );
  assert.ok(m.checks.some((c) => c.text === 'Rau ngót chưa có đơn giá'));
});

test('suất thay thế dùng món thay của thực đơn mẫu', () => {
  const m = computeMarket(db, { date: DATE, counts, classById });
  assert.equal(byName(m, 'Tôm đồng').eatQty, 150); // 10 suất thường × 15 g
  assert.equal(byName(m, 'Thịt lợn nạc').eatQty, 30); // 2 suất thay thế × 15 g
  assert.deepEqual(m.substitutes, [{ original: 'Tôm rim', replacement: 'Thịt rim', servings: 2 }]);
});

test('tổng thu = suất bữa trưa × giá ngày; nhóm chỉ có bản nháp báo chưa có thực đơn', () => {
  const m = computeMarket(db, { date: DATE, counts, classById });
  assert.deepEqual(m.revenue.parts, [{ ageGroupId: 'ag-2', name: 'Nhà trẻ', servings: 12, price: 32000 }]);
  assert.equal(m.revenue.total, 384000);
  assert.equal(m.balance, m.revenue.total - m.cost.total);
  assert.ok(m.checks.some((c) => c.tone === 'bad' && c.text === 'Chưa có thực đơn tuần đã xuất bản: Mẫu giáo bé'));
  // Nhóm có suất trưa nhưng chưa có giá ngày: không cộng thu, có cảnh báo
  assert.ok(m.checks.some((c) => c.text === 'Chưa có giá suất ăn: Mẫu giáo bé'));
});

test('ngày nghỉ không có thực đơn; chưa chốt số suất thì chờ', () => {
  assert.equal(computeMarket(db, { date: '2026-11-04', counts, classById }).status, 'NO_MENU');
  const waiting = computeMarket(db, { date: DATE, counts: { LUNCH: null, AFTERNOON: null }, classById });
  assert.equal(waiting.status, 'WAITING_MEAL_COUNT');
  assert.equal(waiting.foods.length, 0);
});

test('bước làm tròn theo đơn vị mua', () => {
  assert.equal(purchaseStep('kg'), 0.1);
  assert.equal(purchaseStep('lít'), 0.1);
  assert.equal(purchaseStep('quả'), 1);
  assert.equal(purchaseStep('hộp 180 ml'), 1);
});

test('dự trù tuần đọc được thực đơn tuần đã xuất bản của luồng mới', async () => {
  const { mondayOf } = await import('@/models/menu-planning/menuPlanningConstants');
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: mondayOf(SEED_DATE) }, VP);
  assert.equal(week.status, 'READY');
  assert.ok(week.fresh.length > 0);
  assert.ok(week.days.find((d) => d.date === SEED_DATE).hasMenu);
});

test('dữ liệu đã lưu kiểu cũ được bổ sung tuần gần đây nhưng giữ nguyên bản nháp cũ', async () => {
  const { topUpRecentWeeklyMenus, buildRecentWeeklyMenus } = await import('@/mocks/menuPlanningSeed');
  const { mondayOf, addDays } = await import('@/models/menu-planning/menuPlanningConstants');
  const today = '2026-10-15';
  const old = {
    weeklyMenus: [
      { id: 'wm_4', ageGroupId: 'ag-4', weekStart: '2026-10-05', status: 'PUBLISHED' },
      { id: 'wm_8', ageGroupId: 'ag-4', weekStart: '2026-10-12', status: 'DRAFT', updatedAt: '2026-10-07T08:00:00.000Z' },
    ],
  };
  assert.equal(topUpRecentWeeklyMenus(old, today), true);
  assert.ok(
    old.weeklyMenus.some((w) => w.id === 'wm_8'),
    'không xóa bản nháp người dùng có thể đang sửa',
  );
  const published = (ag, week) => old.weeklyMenus.some((w) => w.ageGroupId === ag && w.weekStart === week && w.status === 'PUBLISHED');
  ['ag-2', 'ag-3', 'ag-4', 'ag-5'].forEach((ag) => {
    assert.ok(published(ag, mondayOf(today)), `${ag} tuần này`);
    assert.ok(published(ag, addDays(mondayOf(today), -7)), `${ag} tuần trước`);
  });
  assert.equal(old.weeklyMenus.filter((w) => w.ageGroupId === 'ag-4' && w.weekStart === '2026-10-05').length, 1, 'không thêm trùng');
  assert.equal(topUpRecentWeeklyMenus(old, today), false, 'chạy lại không đổi gì');
  assert.equal(buildRecentWeeklyMenus(today).filter((w) => w.status === 'DRAFT').length, 1);
});

test('ngày học gần nhất đã qua có thực đơn trong dự trù tuần, kể cả Nhà trẻ', async () => {
  const { todayInput } = await import('@/utils/format');
  const { addDays, mondayOf } = await import('@/models/menu-planning/menuPlanningConstants');
  let d = addDays(todayInput(), -1);
  while ([0, 6].includes(new Date(`${d}T00:00:00`).getDay())) d = addDays(d, -1);
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: mondayOf(d) }, VP);
  assert.equal(week.status, 'READY', d);
  assert.ok(week.days.find((x) => x.date === d).hasMenu, d);
  assert.ok(week.fresh.some((f) => f.days.some((x) => x.date === d && x.qty > 0)));
});
