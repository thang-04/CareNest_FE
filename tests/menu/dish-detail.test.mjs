import assert from 'node:assert/strict';
import { test } from 'node:test';

const { ingredientBreakdown, dishTotals, energyShares, byId } = await import('@/utils/menu-planning/menuCalculations');
const { buildSeedMenuPlanning } = await import('@/mocks/menuPlanningSeed');

const seed = buildSeedMenuPlanning();
const foodById = byId(seed.foods);

test('hàm lượng từng thành phần cộng lại khớp tổng của dishTotals (cùng số với thực đơn mẫu, tuần)', () => {
  for (const dish of seed.dishes.slice(0, 12)) {
    for (const ag of ['ag-2', 'ag-3', 'ag-4', 'ag-5']) {
      const { total } = ingredientBreakdown(dish, foodById, ag);
      const ref = dishTotals(dish, foodById, 1, ag);
      ['kcal', 'protein', 'lipid', 'glucid'].forEach((k) =>
        assert.ok(Math.abs(total[k] - ref.totals[k]) < 0.11, `${dish.name} ${ag} ${k}`),
      );
      assert.ok(Math.abs(total.cost - ref.cost) <= 1, `${dish.name} ${ag} cost`);
    }
  }
});

test('thành phần chưa nhập định lượng: qty null, không cộng vào tổng', () => {
  const dish = {
    ingredients: [
      { foodId: seed.foods[0].id, portions: { 'ag-4': 50 } },
      { foodId: seed.foods[1].id, portions: { 'ag-4': null } },
    ],
  };
  const { rows, total } = ingredientBreakdown(dish, foodById, 'ag-4');
  assert.equal(rows[1].qty, null);
  assert.equal(total.qty, 50);
  assert.equal(total.kcal, Math.round(((seed.foods[0].nutrition.kcal * 50) / 100) * 10) / 10);
});

test('tỷ lệ năng lượng từ đạm, béo, bột', () => {
  assert.deepEqual(energyShares({ protein: 19, lipid: 7, glucid: 0 }), [55, 45, 0]);
  assert.deepEqual(energyShares({}), [0, 0, 0]);
});
