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

const calc = await import('@/utils/menu-planning/menuCalculations');
const { checkDayMenu } = await import('@/utils/menu-planning/menuChecks');
const { validateFood, validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');
const { IMPORT_COLUMNS, matchFoodRows } = await import('@/utils/menu-planning/foodImport');
const { normScopeMeals } = await import('@/utils/menu-planning/nutritionSetup');
const { defaultOriginOf } = await import('@/models/menu-planning/menuPlanningConstants');
const { buildSeedMenuPlanning } = await import('@/mocks/menuPlanningSeed');
const { buildReferenceLibrary } = await import('@/mocks/menuReferenceSeed');
const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { menuPlanningMockRepository: menu } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { computeMarket } = await import('@/services/kitchen/mock/marketList');
const { createNutritionCatalogApi } = await import('@/services/nutritionCatalogApi');
const { BE_ERROR_FIELDS } = await import('@/services/http/beErrorFields');
const { todayInput } = await import('@/utils/format');
const { schoolWeekStart } = await import('@/models/menu-planning/menuPlanningConstants');

const { byId, compareToNorm, dishTotals, mealsTotals, overallNormStatus, structureShares } = calc;
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const r1 = (n) => Math.round(n * 10) / 10;

beforeEach(() => values.clear());

// Thịt (động vật), gạo (thực vật), dầu (thực vật) — số tròn để kiểm công thức
const FOODS = {
  meat: {
    id: 'meat',
    name: 'Thịt',
    origin: 'ANIMAL',
    unitPrice: 100000,
    purchaseUnitSize: 1000,
    nutrition: { kcal: 140, protein: 20, lipid: 6, glucid: 0 },
  },
  rice: {
    id: 'rice',
    name: 'Gạo',
    origin: 'PLANT',
    unitPrice: 20000,
    purchaseUnitSize: 1000,
    nutrition: { kcal: 350, protein: 8, lipid: 1, glucid: 76 },
  },
  oil: {
    id: 'oil',
    name: 'Dầu',
    origin: 'PLANT',
    unitPrice: 50000,
    purchaseUnitSize: 1000,
    nutrition: { kcal: 900, protein: 0, lipid: 100, glucid: 0 },
  },
};
const DISH = {
  id: 'd1',
  name: 'Cơm thịt',
  ingredients: [
    { foodId: 'meat', portions: { 'ag-4': 50 } },
    { foodId: 'rice', portions: { 'ag-4': 60 } },
    { foodId: 'oil', portions: { 'ag-4': 5 } },
  ],
};
const NORMS = { 'ag-4': { kcal: [600, 700], protein: [13, 20], lipid: [25, 35], glucid: [52, 60] } };

test('6 chỉ số của món: đạm, béo chia động vật/thực vật theo nguồn gốc; tổng đạm, tổng béo = động vật + thực vật', () => {
  const { totals, missing } = dishTotals(DISH, FOODS, 1, 'ag-4');
  assert.deepEqual(missing, []);
  assert.equal(totals.animalProtein, 10); // 50 g thịt × 20/100
  assert.equal(totals.plantProtein, 4.8); // 60 g gạo × 8/100
  assert.equal(totals.animalLipid, 3);
  assert.equal(totals.plantLipid, 5.6); // gạo 0,6 + dầu 5
  assert.equal(totals.glucid, 45.6);
  assert.equal(totals.kcal, 325);
  assert.equal(totals.protein, r1(totals.animalProtein + totals.plantProtein));
  assert.equal(totals.lipid, r1(totals.animalLipid + totals.plantLipid));
  assert.deepEqual(calc.INDICATORS, ['animalProtein', 'plantProtein', 'animalLipid', 'plantLipid', 'glucid', 'kcal']);
});

test('ngày và từng bữa cộng đủ 6 chỉ số; hai suất = gấp đôi', () => {
  const meals = [
    { session: 'LUNCH', items: [{ dishId: 'd1', portion: 1 }] },
    { session: 'AFTERNOON', items: [{ dishId: 'd1', portion: 1 }] },
  ];
  const day = mealsTotals(meals, { d1: DISH }, FOODS, 'ag-4');
  const one = dishTotals(DISH, FOODS, 1, 'ag-4').totals;
  calc.INDICATORS.forEach((k) => assert.equal(day.totals[k], r1(one[k] * 2), k));
  assert.equal(day.bySession.LUNCH.animalProtein, one.animalProtein);
  assert.equal(day.totals.protein, r1(day.totals.animalProtein + day.totals.plantProtein));
});

test('tỷ lệ cơ cấu (% động vật) và P:L:G tách khỏi lượng gam', () => {
  const t = dishTotals(DISH, FOODS, 1, 'ag-4').totals;
  assert.deepEqual(structureShares(t), { animalProteinPct: r1((10 * 100) / 14.8), animalLipidPct: r1((3 * 100) / 8.6) });
  assert.deepEqual(structureShares({ protein: 0, lipid: 0 }), { animalProteinPct: null, animalLipidPct: null });
  const rows = Object.fromEntries(compareToNorm(t, 'ag-4', false, NORMS).map((r) => [r.key, r]));
  assert.equal(rows.protein.value, 14.8, 'value vẫn là gam');
  assert.equal(rows.protein.percent, r1((14.8 * 4 * 100) / 325));
  assert.equal(rows.lipid.percent, r1((8.6 * 9 * 100) / 325));
  assert.equal(rows.animalProteinPct.value, structureShares(t).animalProteinPct);
});

test('% đạt định mức = thực tế / giữa khoảng; đạm, béo, bột quy ra gam từ năng lượng mục tiêu', () => {
  const totals = { kcal: 520, protein: 20, lipid: 20, glucid: 80, animalProtein: 12, plantProtein: 8, animalLipid: 8, plantLipid: 12 };
  const rows = Object.fromEntries(compareToNorm(totals, 'ag-4', false, NORMS).map((r) => [r.key, r]));
  assert.equal(rows.kcal.target, 650);
  assert.equal(rows.kcal.attainment, 80);
  assert.equal(rows.kcal.status, 'LOW');
  // đạm mục tiêu: 650 kcal × 16,5% / 4 = 26,8 g
  assert.equal(rows.protein.target, r1((650 * 16.5) / 100 / 4));
  assert.equal(rows.protein.attainment, Math.round((20 * 100) / rows.protein.target));
  assert.equal(rows.lipid.target, r1((650 * 30) / 100 / 9));
});

test('dòng chưa đặt định mức ⇒ NA "chưa đặt định mức"; tỷ lệ động vật không bắt buộc, không làm ngày thành NA', () => {
  const t = dishTotals(DISH, FOODS, 1, 'ag-4').totals;
  const none = compareToNorm(t, 'ag-4', false, {});
  assert.ok(none.every((r) => r.status === 'NA' && r.attainment == null));
  assert.equal(overallNormStatus(none), 'NA');
  const core = compareToNorm(t, 'ag-4', false, NORMS);
  const share = core.find((r) => r.key === 'animalProteinPct');
  assert.equal(share.status, 'NA');
  assert.equal(share.optional, true);
  assert.notEqual(overallNormStatus(core), 'NA', 'chỉ thiếu định mức không bắt buộc thì vẫn đánh giá');
  const withShare = compareToNorm(t, 'ag-4', false, { 'ag-4': { ...NORMS['ag-4'], animalProteinPct: [70, 80] } });
  const s2 = withShare.find((r) => r.key === 'animalProteinPct');
  assert.deepEqual([s2.min, s2.max, s2.status], [70, 80, 'LOW']);
  // Có định mức tỷ lệ động vật nhưng chưa có 4 định mức chính: dòng đó vẫn được đánh giá riêng
  const onlyShare = compareToNorm(t, 'ag-4', false, { 'ag-4': { animalProteinPct: [50, 80] } });
  assert.equal(onlyShare.find((r) => r.key === 'animalProteinPct').status, 'OK');
});

test('thiếu số liệu dinh dưỡng hoặc nguồn gốc ⇒ chưa đủ dữ liệu: vẫn cộng phần đã biết, liệt kê thực phẩm, không đánh giá', () => {
  const foods = {
    ...FOODS,
    meat: { ...FOODS.meat, origin: '' },
    oil: { ...FOODS.oil, nutrition: { kcal: null, protein: null, lipid: null, glucid: null } },
  };
  const r = dishTotals(DISH, foods, 1, 'ag-4');
  assert.deepEqual(r.missing, ['Thịt', 'Dầu']);
  assert.equal(r.totals.animalProtein, 0, 'chưa rõ nguồn gốc thì không tính vào động vật');
  assert.equal(r.totals.plantProtein, 4.8);
  assert.equal(r.totals.protein, 14.8, 'tổng đạm vẫn cộng phần đã biết');
  assert.equal(r.totals.kcal, 280, 'dầu chưa có số liệu không cộng');
  const rows = compareToNorm(r.totals, 'ag-4', r.missing.length > 0, NORMS);
  assert.ok(rows.filter((x) => !x.optional).every((x) => x.status === 'INCOMPLETE'));
  assert.equal(overallNormStatus(rows), 'INCOMPLETE');
  assert.equal(calc.isNutritionComplete(foods.meat), false);
  assert.equal(calc.isNutritionComplete(FOODS.meat), true);
});

test('kiểm tra tự động (thực đơn mẫu, tuần, AI): thiếu nguồn gốc ⇒ "Chưa đủ dữ liệu đánh giá", nêu tên thực phẩm', async () => {
  const c = await menu.getCatalog(VP);
  const catalog = { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
  const sample = catalog.menus.find((m) => m.ageGroupId === 'ag-4' && m.meals.length);
  const ok = checkDayMenu({ meals: sample.meals, ageGroupId: 'ag-4', catalog, date: '2026-10-20' });
  assert.notEqual(ok.status.label, 'Chưa đủ dữ liệu đánh giá');
  // 4 chỉ số chính + 2 tỷ lệ cơ cấu + 8 vi chất (NUT-26, không bắt buộc)
  assert.equal(ok.rows.length, 14);
  const usedFoodId = catalog.dishById[sample.meals.find((m) => m.items.length).items[0].dishId].ingredients[0].foodId;
  const foodById = { ...catalog.foodById, [usedFoodId]: { ...catalog.foodById[usedFoodId], origin: '' } };
  const bad = checkDayMenu({ meals: sample.meals, ageGroupId: 'ag-4', catalog: { ...catalog, foodById }, date: '2026-10-20' });
  assert.equal(bad.status.label, 'Chưa đủ dữ liệu đánh giá');
  assert.ok(bad.problems.some((p) => p.text.includes(catalog.foodById[usedFoodId].name)));
  assert.ok(!bad.checks.some((p) => p.text === 'Đủ năng lượng'));
});

test('định mức chỉ áp cho các bữa trường phục vụ của nhóm tuổi', () => {
  const setups = [{ ageGroupId: 'ag-4', meals: [{ code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' }] }];
  const meals = [
    { session: 'LUNCH', items: [{ dishId: 'd1', portion: 1 }] },
    { session: 'AFTERNOON', items: [{ dishId: 'd1', portion: 1 }] },
  ];
  assert.deepEqual(
    normScopeMeals(meals, setups, 'ag-4').map((m) => m.session),
    ['LUNCH'],
  );
});

test('sửa thử định lượng: tính lại ngay, ô trống = chưa nhập, ô sai giữ số cũ', () => {
  const draft = calc.withPortionDraft(DISH, { meat: '100', rice: 'abc', oil: '' }, 'ag-4');
  assert.equal(calc.ingredientQty(draft.ingredients[0], 'ag-4'), 100);
  assert.equal(calc.ingredientQty(draft.ingredients[1], 'ag-4'), 60);
  assert.equal(calc.ingredientQty(draft.ingredients[2], 'ag-4'), null);
  assert.equal(dishTotals(draft, FOODS, 1, 'ag-4').totals.animalProtein, 20);
  assert.equal(DISH.ingredients[0].portions['ag-4'], 50, 'không đổi món đã lưu');
  assert.equal(calc.badPortionQty('0'), true);
  assert.equal(calc.badPortionQty(''), false);
});

test('form thực phẩm bắt buộc nguồn gốc; định mức tỷ lệ động vật để trống hợp lệ, nhập dở bị báo', () => {
  const food = { name: 'Thử', group: 'MEAT', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000, nutrientSource: 'Bảng TPVN' };
  assert.ok(validateFood(food).origin);
  assert.equal(validateFood({ ...food, origin: 'ANIMAL' }).origin, undefined);
  const group = (norms) => ({
    ageGroupId: 'ag-4',
    enabled: true,
    price: '30000',
    meals: [
      { code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' },
      { code: 'AFTERNOON', name: 'Bữa chiều', countAs: 'AFTERNOON' },
    ],
    norms,
  });
  const core = { kcal: ['600', '700'], protein: ['13', '20'], lipid: ['25', '35'], glucid: ['52', '60'] };
  const blank = { animalProteinG: ['', ''], plantLipidG: ['', ''], lunchKcalPct: ['', ''] };
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: '2026-10-20', groups: [group({ ...core, ...blank })] }, '2026-10-20'), {});
  const partial = { ...core, ...blank, animalProteinG: ['12', ''] };
  assert.ok(validateNutritionSetup({ effectiveFrom: '2026-10-20', groups: [group(partial)] }, '2026-10-20')['ag-4.norms.animalProteinG']);
  // Gam không giới hạn 100; % năng lượng bữa thì có
  const grams = { ...core, ...blank, plantLipidG: ['90', '120'] };
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: '2026-10-20', groups: [group(grams)] }, '2026-10-20'), {});
  const over = { ...core, ...blank, lunchKcalPct: ['50', '120'] };
  assert.ok(validateNutritionSetup({ effectiveFrom: '2026-10-20', groups: [group(over)] }, '2026-10-20')['ag-4.norms.lunchKcalPct']);
});

test('dữ liệu mẫu: mọi thực phẩm (cả thư viện tham khảo) có nguồn gốc; thịt, thủy sản, trứng sữa là động vật', () => {
  const seed = buildSeedMenuPlanning();
  assert.ok(seed.foods.every((f) => f.origin === defaultOriginOf(f.group)));
  assert.equal(seed.foods.find((f) => f.name === 'Dầu ăn').origin, 'PLANT');
  assert.equal(seed.foods.find((f) => f.name === 'Trứng gà').origin, 'ANIMAL');
  assert.ok(buildReferenceLibrary().foods.every((f) => ['ANIMAL', 'PLANT'].includes(f.origin)));
});

test('localStorage cũ chưa có nguồn gốc: bổ sung theo nhóm một lần; lưu thiếu nguồn gốc bị chặn 422', async () => {
  await menu.listFoods({}, VP);
  writeDb((db) => db.foods.forEach((f) => delete f.origin));
  assert.ok(readDb().foods.every((f) => f.origin === undefined));
  const foods = await menu.listFoods({}, VP);
  assert.ok(foods.every((f) => f.origin === defaultOriginOf(f.group)));
  const payload = {
    name: 'Cá thu thử',
    group: 'SEAFOOD',
    unit: 'g',
    purchaseUnit: 'kg',
    purchaseUnitSize: 1000,
    nutrientSource: 'Bảng TPVN',
  };
  await assert.rejects(menu.saveFood(null, payload, VP), (e) => e.status === 422 && !!e.details.origin);
  assert.equal((await menu.saveFood(null, { ...payload, origin: 'ANIMAL' }, VP)).origin, 'ANIMAL');
});

test('nhập file: cột Nguồn gốc đọc nhãn Động vật/Thực vật; trống thì dòng mới lấy theo nhóm', () => {
  const header = IMPORT_COLUMNS.map(([, label]) => label);
  // Sau cột Nguồn gốc là 8 cột vi chất không bắt buộc (NUT-26)
  assert.equal(header.at(-9), 'Nguồn gốc');
  const row = (name, group, origin) => ['', name, group, 'g', 'kg', 1000, 10000, 0, 100, 10, 1, 1, '', 'Tươi', 'Bảng TPVN', '2017', origin];
  const r = matchFoodRows(
    [header, row('Cá trắm', 'Thủy hải sản', ''), row('Mỡ lợn', 'Dầu, đường', 'Động vật'), row('X', 'Rau, củ', 'Nấm')],
    [],
  );
  assert.deepEqual(
    r.creates.map((c) => [c.name, c.data.origin]),
    [
      ['Cá trắm', 'ANIMAL'],
      ['Mỡ lợn', 'ANIMAL'],
    ],
  );
  assert.ok(r.errors[0].reason.includes('Nguồn gốc'));
});

test('BE: origin của thực phẩm map 1:1; thiếu ⇒ "" (chưa đủ dữ liệu); mã lỗi 6026 về ô Nguồn gốc', async () => {
  const sent = [];
  const beFood = {
    id: '9',
    code: 'TP009',
    name: 'Cá',
    foodGroup: 'SEAFOOD',
    unit: 'g',
    purchaseUnit: 'kg',
    purchaseUnitSize: 1000,
    kcal: 100,
    protein: 18,
    lipid: 3,
    glucid: 0,
    origin: 'ANIMAL',
    status: 'ACTIVE',
    allergens: [],
  };
  const client = {
    get: async (url) =>
      url === '/nutrition/foods' ? [beFood, { ...beFood, id: '10', origin: null }] : url === '/nutrition/allergens' ? [] : beFood,
    put: async (url, body) => (sent.push(body), { ...beFood, ...body }),
    post: async (url, body) => (sent.push(body), { ...beFood, ...body }),
    patch: async () => beFood,
  };
  const api = createNutritionCatalogApi({ client, storage: () => null });
  const [fish, unknown] = await api.listFoods({});
  assert.equal(fish.origin, 'ANIMAL');
  assert.equal(unknown.origin, '');
  await api.saveFood('9', { ...fish, origin: 'PLANT' });
  assert.equal(sent[0].origin, 'PLANT');
  assert.equal(BE_ERROR_FIELDS[6026], 'origin');
});

test('báo ăn, dự trù chợ, phiếu tuần chỉ dùng định lượng: bỏ dinh dưỡng và nguồn gốc không đổi số lượng', async () => {
  const food = (id, extra) => ({
    id,
    name: id,
    unit: 'g',
    purchaseUnit: 'kg',
    purchaseUnitSize: 1000,
    unitPrice: 20000,
    wastePct: 10,
    ...extra,
  });
  const db = (withNutrition) => ({
    foods: [
      food('f1', withNutrition ? { origin: 'PLANT', nutrition: { kcal: 350, protein: 8, lipid: 1, glucid: 76 } } : {}),
      food('f2', withNutrition ? { origin: 'ANIMAL', nutrition: { kcal: 140, protein: 20, lipid: 6, glucid: 0 } } : {}),
    ],
    dishes: [
      {
        id: 'd1',
        name: 'Cơm thịt',
        ingredients: [
          { foodId: 'f1', portions: { 'ag-2': 50 } },
          { foodId: 'f2', portions: { 'ag-2': 20 } },
        ],
      },
    ],
    nutritionSetups: [{ ageGroupId: 'ag-2', meals: [{ code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' }] }],
    mealPrices: [],
    allergyMenus: [],
    weeklyMenus: [
      {
        id: 'w1',
        ageGroupId: 'ag-2',
        status: 'PUBLISHED',
        days: [{ date: '2026-11-03', holiday: false, menuId: 'm1', meals: [{ session: 'LUNCH', items: [{ dishId: 'd1', portion: 1 }] }] }],
      },
    ],
  });
  const args = {
    date: '2026-11-03',
    classById: { c1: { ageGroupId: 'ag-2' } },
    counts: {
      LUNCH: { status: 'CONFIRMED', confirmedAt: '2026-11-03T01:00:00.000Z', classes: [{ classId: 'c1', normal: 10, substitute: 0 }] },
    },
  };
  const plain = computeMarket(db(false), args);
  assert.deepEqual(computeMarket(db(true), args), plain);
  assert.ok(plain.foods.length === 2);

  const week = schoolWeekStart(todayInput());
  const before = await kitchen.getWeeklyForecast({ campusId: 'c1', weekStart: week }, VP);
  assert.ok(before.fresh.length > 0, 'dữ liệu mẫu có hàng tươi để so');
  writeDb((d) =>
    d.foods.forEach((f) => {
      f.nutrition = { kcal: null, protein: null, lipid: null, glucid: null };
      delete f.origin;
    }),
  );
  const after = await kitchen.getWeeklyForecast({ campusId: 'c1', weekStart: week }, VP);
  assert.deepEqual(after.fresh, before.fresh);
  assert.deepEqual(after.classes, before.classes);
});
