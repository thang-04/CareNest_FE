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

const { compareToNorm, dishTotals, ingredientBreakdown, mealsTotals, overallNormStatus } = await import(
  '@/utils/menu-planning/menuCalculations'
);
const { validateFood, validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');
const { IMPORT_COLUMNS, matchFoodRows } = await import('@/utils/menu-planning/foodImport');
const { toSetupForm } = await import('@/utils/menu-planning/nutritionSetup');
const { MICRONUTRIENTS } = await import('@/models/menu-planning/menuPlanningConstants');
const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { menuPlanningMockRepository: menu } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
beforeEach(() => values.clear());

const micro = (calcium, iron) => ({
  calcium,
  phosphorus: 100,
  iron,
  vitaminA: 10,
  vitaminB1: 0.1,
  vitaminB2: 0.05,
  vitaminPp: 1,
  vitaminC: 2,
});
const FOODS = {
  rice: {
    id: 'rice',
    name: 'Gạo',
    origin: 'PLANT',
    unit: 'g',
    wastePct: 0,
    nutrition: { kcal: 350, protein: 8, lipid: 1, glucid: 76, ...micro(30, 1.3) },
  },
  meat: {
    id: 'meat',
    name: 'Thịt',
    origin: 'ANIMAL',
    unit: 'g',
    wastePct: 0,
    nutrition: { kcal: 140, protein: 19, lipid: 7, glucid: 0, ...micro(7, 1) },
  },
};
const DISH = {
  id: 'd',
  name: 'Cơm thịt',
  ingredients: [
    { foodId: 'rice', portions: { 'ag-4': 100 } },
    { foodId: 'meat', portions: { 'ag-4': 50 } },
  ],
};

test('NUT-26: tổng vi chất một suất = Σ định lượng/100 × hàm lượng; chi tiết từng thành phần cùng công thức', () => {
  const t = dishTotals(DISH, FOODS, 1, 'ag-4').totals;
  assert.equal(t.calcium, 33.5);
  assert.equal(t.iron, 1.8);
  assert.equal(t.vitaminB2, 0.08, 'làm tròn 0,01 cho số nhỏ (khớp BE)');
  const { rows, total } = ingredientBreakdown(DISH, FOODS, 'ag-4');
  assert.deepEqual(
    rows.map((r) => r.calcium),
    [30, 3.5],
  );
  assert.equal(total.calcium, 33.5);
});

test('NUT-26: một nguyên liệu thiếu số liệu chất nào ⇒ tổng chất đó null (chưa đủ dữ liệu), không ảnh hưởng chất khác và năng lượng', () => {
  const foods = { ...FOODS, meat: { ...FOODS.meat, nutrition: { ...FOODS.meat.nutrition, iron: null } } };
  const r = dishTotals(DISH, foods, 1, 'ag-4');
  assert.equal(r.totals.iron, null);
  assert.equal(r.totals.calcium, 33.5);
  assert.equal(r.totals.kcal, 420);
  assert.deepEqual(r.missing, [], 'thiếu vi chất không làm món thành thiếu số liệu dinh dưỡng chính');
  const day = mealsTotals([{ session: 'LUNCH', items: [{ dishId: 'd', portion: 1 }] }], { d: DISH }, foods, 'ag-4');
  assert.equal(day.totals.iron, null);
  assert.equal(day.totals.calcium, 33.5);
});

test('NUT-26: so định mức vi chất — chưa đặt NA, đủ OK, thấp LOW, cao HIGH, số sau trống chỉ xét tối thiểu; không đổi trạng thái ngày', () => {
  const t = dishTotals(DISH, FOODS, 1, 'ag-4').totals;
  const core = { kcal: [400, 450], protein: [10, 30], lipid: [10, 30], glucid: [40, 80] };
  const norms = { 'ag-4': { ...core, calcium: [30, 40], iron: [5, ''], vitaminC: [0, 1], vitaminA: [10, null] } };
  const rows = compareToNorm(t, 'ag-4', false, norms);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by.calcium.status, 'OK');
  assert.equal(by.calcium.attainment, 96);
  assert.deepEqual([by.iron.status, by.iron.max, by.iron.target], ['LOW', null, 5]);
  assert.equal(by.vitaminC.status, 'HIGH');
  assert.equal(by.vitaminA.status, 'OK', 'không có số tối đa thì không bao giờ cao');
  assert.equal(by.phosphorus.status, 'NA');
  assert.ok(MICRONUTRIENTS.every((k) => by[k].optional));
  const withoutMicro = compareToNorm(t, 'ag-4', false, { 'ag-4': core });
  assert.equal(overallNormStatus(rows), overallNormStatus(withoutMicro), 'vi chất lệch chỉ cảnh báo');
});

test('NUT-26: form thực phẩm — vi chất để trống hợp lệ, số âm hoặc chữ bị báo', () => {
  const base = {
    name: 'X',
    group: 'GRAIN',
    unit: 'g',
    origin: 'PLANT',
    nutrientSource: 'Bảng TPVN',
    purchaseUnit: 'kg',
    purchaseUnitSize: 1000,
  };
  assert.deepEqual(validateFood({ ...base, nutrition: { calcium: '' } }), {});
  assert.equal(validateFood({ ...base, nutrition: { calcium: '-1' } }).calcium, 'Nhập số không âm.');
  assert.equal(validateFood({ ...base, nutrition: { iron: 'abc' } }).iron, 'Nhập số không âm.');
});

test('NUT-26: định mức vi chất — cần số tối thiểu, số sau trống được, đầu > sau bị báo; không bắt buộc nhập', () => {
  const group = (norms) => ({ effectiveFrom: '2099-01-01', groups: [{ ageGroupId: 'ag-4', price: '30000', meals: [], norms }] });
  const core = { kcal: ['600', '700'], protein: ['13', '20'], lipid: ['25', '35'], glucid: ['52', '60'] };
  const opts = { mealsReadOnly: true };
  assert.deepEqual(validateNutritionSetup(group({ ...core, calcium: ['350', ''] }), '2026-11-03', opts), {});
  assert.deepEqual(validateNutritionSetup(group({ ...core, calcium: ['', ''] }), '2026-11-03', opts), {});
  assert.equal(
    validateNutritionSetup(group({ ...core, calcium: ['', '500'] }), '2026-11-03', opts)['ag-4.norms.calcium'],
    'Nhập số tối thiểu.',
  );
  assert.match(validateNutritionSetup(group({ ...core, iron: ['9', '5'] }), '2026-11-03', opts)['ag-4.norms.iron'], /nhỏ hơn hoặc bằng/);
  // Chỉ nhập vi chất, chưa có chuẩn chính: không ép nhập chuẩn chính
  assert.deepEqual(validateNutritionSetup(group({ calcium: ['350', ''] }), '2026-11-03', opts), {});
});

test('NUT-26: form Thiết lập đọc số sau null của vi chất thành ô trống, không thành chữ "null"', () => {
  const form = toSetupForm([{ ageGroupId: 'ag-4', enabled: true, meals: [], norms: { calcium: [350, null] }, prices: [] }], '2026-11-03');
  assert.deepEqual(form.groups.find((g) => g.ageGroupId === 'ag-4').norms.calcium, ['350', '']);
});

test('NUT-26: nhập file thực phẩm — cột vi chất không bắt buộc; file cũ không có cột vẫn đọc được, có cột thì cập nhật', () => {
  const labels = IMPORT_COLUMNS.map(([, l]) => l);
  const oldHeader = labels.slice(0, labels.indexOf('Nguồn gốc') + 1);
  const foods = [
    {
      id: 'f1',
      code: 'TP001',
      name: 'Gạo tẻ',
      group: 'GRAIN',
      unit: 'g',
      origin: 'PLANT',
      nutrientSource: 'x',
      purchaseUnit: 'kg',
      purchaseUnitSize: 1000,
      nutrition: { kcal: 344, protein: 7.9, lipid: 1, glucid: 76.2 },
    },
  ];
  const row = (extra = []) => ['TP001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ...extra];
  assert.equal(matchFoodRows([oldHeader, row()], foods).errors.length, 0, 'file mẫu cũ');
  const r = matchFoodRows([labels, row(['30', '', '1,3'])], foods);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.updates[0].data.nutrition, { calcium: 30, iron: 1.3 });
  assert.match(matchFoodRows([labels, row(['-5'])], foods).errors[0].reason, /Canxi/);
});

test('NUT-26: dữ liệu demo cũ trong trình duyệt được bổ sung vi chất mẫu một lần; thực phẩm chưa có số liệu để trống', async () => {
  await menu.getCatalog(VP);
  writeDb((d) => {
    d.foods.forEach((f) => MICRONUTRIENTS.forEach((k) => delete f.nutrition[k]));
    delete d.mockSeedVersions['menu-micronutrients'];
  });
  const { foods } = await menu.getCatalog(VP);
  assert.equal(foods.find((f) => f.id === 'f01').nutrition.calcium, 30);
  assert.equal(foods.find((f) => f.id === 'f28').nutrition.calcium, null, 'nấm hương chưa có số liệu');
  assert.equal(readDb().mockSeedVersions['menu-micronutrients'], 1);
});
