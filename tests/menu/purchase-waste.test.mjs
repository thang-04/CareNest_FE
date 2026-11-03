import assert from 'node:assert/strict';
import { test } from 'node:test';

const { purchaseQty, dishTotals, ingredientBreakdown } = await import('@/utils/menu-planning/menuCalculations');

test('lượng mua = lượng ăn ÷ (1 − % thải bỏ): 1,17 kg cà rốt thải bỏ 10% → 1,3 kg', () => {
  assert.equal(Math.round(purchaseQty(1170, 10)), 1300);
  assert.equal(purchaseQty(500, 0), 500);
  assert.equal(purchaseQty(500, undefined), 500);
});

test('chi phí một suất tính trên lượng mua (đã cộng thải bỏ)', () => {
  const foodById = {
    carrot: { id: 'carrot', name: 'Cà rốt', unitPrice: 28000, purchaseUnitSize: 1000, wastePct: 10, nutrition: {} },
    rice: { id: 'rice', name: 'Gạo', unitPrice: 18000, purchaseUnitSize: 1000, wastePct: 0, nutrition: {} },
  };
  const dish = {
    ingredients: [
      { foodId: 'carrot', portions: { 'ag-4': 18 } },
      { foodId: 'rice', portions: { 'ag-4': 70 } },
    ],
  };
  // 18 ÷ 0,9 = 20 g × 28 đ + 70 g × 18 đ = 560 + 1.260 = 1.820 đ
  assert.equal(dishTotals(dish, foodById, 1, 'ag-4').cost, 1820);
  const { rows, total } = ingredientBreakdown(dish, foodById, 'ag-4');
  assert.equal(Math.round(rows[0].purchaseQty), 20);
  assert.equal(total.cost, 1820);
});
