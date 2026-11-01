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

const { dishTotals, ingredientQty, mealsTotals, missingPortionGroups } = await import('@/utils/menu-planning/menuCalculations');
const { validateDish, validateFood } = await import('@/utils/menu-planning/menuPlanningValidation');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const foodById = {
  f1: { id: 'f1', name: 'Gạo', unitPrice: 20000, purchaseUnitSize: 1000, nutrition: { kcal: 350, protein: 8, lipid: 1, glucid: 76 } },
};
const dish = { name: 'Cơm', ingredients: [{ foodId: 'f1', quantity: 60, portions: { 'ag-2': '', 'ag-3': 54, 'ag-4': 60, 'ag-5': 66 } }] };

beforeEach(() => values.clear());

test('định lượng theo nhóm: dùng số đã nhập, ô trống là chưa nhập, món cũ không suy từ hệ số giả định', () => {
  assert.equal(ingredientQty(dish.ingredients[0], 'ag-3'), 54);
  assert.equal(ingredientQty(dish.ingredients[0], 'ag-2'), null);
  assert.equal(ingredientQty({ foodId: 'f1', quantity: 60 }, 'ag-2'), null);
  assert.deepEqual(missingPortionGroups(dish, ['ag-2', 'ag-3']), ['ag-2']);
});

test('dinh dưỡng một suất tính theo định lượng của nhóm; thiếu định lượng thì báo noQuantity', () => {
  assert.equal(dishTotals(dish, foodById, 1, 'ag-5').totals.kcal, 231);
  assert.equal(dishTotals(dish, foodById, 1, 'ag-2').noQuantity, true);
  const day = mealsTotals([{ session: 'LUNCH', items: [{ dishId: 'd1', portion: 1 }] }], { d1: dish }, foodById, 'ag-2');
  assert.ok(day.missing.includes('Định lượng Cơm'));
});

test('kiểm tra món: ô định lượng sai bị báo, ô trống được phép nhưng phải có ít nhất một nhóm', () => {
  const e = validateDish({
    name: 'Món thử',
    type: 'MAIN',
    ingredients: [
      { foodId: 'f1', portions: { 'ag-2': '2000', 'ag-3': '' } },
      { foodId: 'f2', portions: { 'ag-2': '' } },
    ],
  });
  assert.ok(e['ing_0_ag-2']);
  assert.ok(!e['ing_0_ag-3']);
  assert.match(e.ing_1, /ít nhất một nhóm/);
});

test('kiểm tra thực phẩm: tỷ lệ thải bỏ 0–90%', () => {
  const base = { name: 'Rau thử', group: 'VEGETABLE', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
  assert.ok(validateFood({ ...base, wastePct: 95 }).wastePct);
  assert.ok(!validateFood({ ...base, wastePct: 15 }).wastePct);
});

test('lưu món với định lượng theo nhóm; dữ liệu mẫu có định lượng đủ 4 nhóm', async () => {
  const foods = await repo.listFoods({}, VP);
  const saved = await repo.saveDish(
    null,
    {
      name: 'Món thử nhóm tuổi',
      type: 'MAIN',
      // Thiếu định lượng nhóm nhà trẻ ⇒ chỉ lưu được ở Nháp
      status: 'DRAFT',
      ingredients: [{ foodId: foods[0].id, portions: { 'ag-2': '', 'ag-3': '45', 'ag-4': '50', 'ag-5': '55' } }],
    },
    VP,
  );
  assert.deepEqual(saved.ingredients[0].portions, { 'ag-2': null, 'ag-3': 45, 'ag-4': 50, 'ag-5': 55 });
  assert.equal(saved.ingredients[0].quantity, 50);
  const dishes = await repo.listDishes({}, VP);
  const seeded = dishes.find((d) => d.id !== saved.id);
  assert.deepEqual(missingPortionGroups(seeded, ['ag-2', 'ag-3', 'ag-4', 'ag-5']), []);
  assert.deepEqual(missingPortionGroups(saved, ['ag-2', 'ag-3']), ['ag-2']);
});

test('đánh dấu hay dùng; dữ liệu mẫu có tỷ lệ thải bỏ', async () => {
  const [f] = await repo.listFoods({}, VP);
  assert.equal(typeof f.wastePct, 'number');
  const after = await repo.setFoodFavorite(f.id, !f.favorite, VP);
  assert.equal(after.favorite, !f.favorite);
  await assert.rejects(repo.setFoodFavorite(f.id, true, { id: 'u_hung', role: 'PRINCIPAL' }), (e) => e.status === 403);
});
