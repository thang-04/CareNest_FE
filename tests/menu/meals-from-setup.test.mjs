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

const { mealsOf, mealLabel, toSetupForm, toSetupPayload } = await import('@/utils/menu-planning/nutritionSetup');
const { normalizeMeals } = await import('@/utils/menu-planning/menuCalculations');
const { validateMenu } = await import('@/utils/menu-planning/menuPlanningValidation');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const setups = [
  {
    ageGroupId: 'ag-4',
    meals: [
      { code: 'LUNCH', name: 'Bữa trưa' },
      { code: 'AFTERNOON', name: 'Bữa xế' },
      { code: 'm_x', name: 'Bữa phụ chiều' },
    ],
  },
];

beforeEach(() => values.clear());

test('bữa theo Thiết lập; chưa có thiết lập thì là bữa gốc; nhãn theo tên đã đổi', () => {
  assert.deepEqual(
    mealsOf(setups, 'ag-4').map((m) => m.code),
    ['LUNCH', 'AFTERNOON', 'm_x'],
  );
  assert.deepEqual(
    mealsOf(setups, 'ag-2').map((m) => m.code),
    ['MORNING', 'LUNCH', 'AFTERNOON'],
  );
  assert.equal(mealLabel(setups, 'ag-4', 'AFTERNOON'), 'Bữa xế');
  assert.equal(mealLabel(setups, 'ag-2', 'AFTERNOON'), 'Bữa chiều');
  assert.equal(mealLabel(setups, undefined, 'm_x'), 'Bữa phụ chiều');
});

test('normalizeMeals giữ bữa thêm theo thứ tự Thiết lập', () => {
  const meals = normalizeMeals(
    [
      { session: 'm_x', items: [{ dishId: 'd1' }] },
      { session: 'LUNCH', items: [] },
    ],
    ['LUNCH', 'AFTERNOON', 'm_x'],
  );
  assert.deepEqual(
    meals.map((m) => m.session),
    ['LUNCH', 'AFTERNOON', 'm_x'],
  );
  assert.equal(meals[2].items[0].dishId, 'd1');
});

test('validateMenu đòi món cho cả bữa thêm, báo bằng tên bữa', () => {
  const e = validateMenu(
    { name: 'Mẫu', ageGroupId: 'ag-4', meals: [{ session: 'LUNCH', items: [{ dishId: 'd1', portion: 1 }] }] },
    [],
    mealsOf(setups, 'ag-4'),
  );
  assert.match(e.meal_AFTERNOON, /^Bữa xế/);
  assert.match(e.meal_m_x, /^Bữa phụ chiều/);
});

test('lưu thực đơn mẫu có bữa thêm không mất bữa; AI soạn ngày điền cả bữa thêm', async () => {
  const today = todayInput();
  const form = toSetupForm(await repo.listNutritionSetups(VP), today);
  form.groups.find((g) => g.ageGroupId === 'ag-4').meals.push({ code: '', name: 'Bữa phụ chiều', countAs: 'AFTERNOON' });
  await repo.saveNutritionSetups(toSetupPayload({ ...form, effectiveFrom: today }), VP);
  const added = (await repo.listNutritionSetups(VP)).find((s) => s.ageGroupId === 'ag-4').meals[2];

  const dishes = await repo.listDishes({}, VP);
  const one = (type) => [{ dishId: dishes.find((d) => d.type === type).id, portion: 1 }];
  const saved = await repo.saveMenu(
    null,
    {
      name: 'Mẫu có bữa thêm',
      ageGroupId: 'ag-4',
      status: 'ACTIVE',
      meals: [
        { session: 'LUNCH', items: one('CARB') },
        { session: 'AFTERNOON', items: one('SNACK') },
        { session: added.code, items: one('DESSERT') },
      ],
    },
    VP,
  );
  assert.deepEqual(
    saved.meals.map((m) => m.session),
    ['LUNCH', 'AFTERNOON', added.code],
  );
  assert.equal(saved.meals[2].items.length, 1);

  const draft = await repo.generateAiSuggestion({ kind: 'DAILY', ageGroupId: 'ag-4' }, VP);
  const extra = draft.meals.find((m) => m.session === added.code);
  assert.ok(extra?.items.length, 'bữa thêm có món');
});
