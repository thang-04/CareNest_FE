import assert from 'node:assert/strict';
import { test } from 'node:test';

const { statisticsExportRows, storageGroups } = await import('@/utils/menu-planning/menuStatistics');

const ing = (foodId, foodName, storage, cost) => ({
  foodId,
  foodName,
  storage,
  gramsPerChild: 10,
  eatenTotal: 380,
  wastePct: 0,
  purchaseTotal: 380,
  purchaseQty: 0.38,
  purchaseUnit: 'kg',
  unitPrice: 20000,
  cost,
});
const base = { children: 38, totalCost: 30000 };

test('NUT-10: Chia Cần mua (hàng tươi) / Lấy từ kho khô theo storage, tổng nhóm lấy nguyên từ BE', () => {
  const stats = {
    ...base,
    freshCost: 12000,
    dryCost: 18000,
    ingredients: [ing(1, 'Rau cải', 'FRESH', 12000), ing(2, 'Gạo tẻ', 'DRY', 18000)],
  };
  const groups = storageGroups(stats);
  assert.deepEqual(
    groups.map((g) => [g.title, g.rows.map((r) => r.foodName), g.total]),
    [
      ['Cần mua (hàng tươi)', ['Rau cải'], 12000],
      ['Lấy từ kho khô', ['Gạo tẻ'], 18000],
    ],
  );
});

test('NUT-10: BE chưa trả storage hoặc tổng nhóm ⇒ không chia, giữ một bảng', () => {
  assert.equal(storageGroups({ ...base, ingredients: [ing(1, 'Rau cải', undefined, 12000)] }), null);
  assert.equal(storageGroups({ ...base, ingredients: [ing(1, 'Rau cải', 'FRESH', 12000)] }), null, 'thiếu freshCost/dryCost');
});

test('NUT-19: Dòng Excel giữ số BE trả, có tiêu đề nhóm, tổng nhóm và tổng cuối', () => {
  const stats = {
    ...base,
    freshCost: 12000,
    dryCost: 18000,
    ingredients: [ing(1, 'Rau cải', 'FRESH', 12000), ing(2, 'Gạo tẻ', 'DRY', 18000)],
  };
  const rows = statisticsExportRows(stats, 'Định lượng & đi chợ · Thứ Hai');
  assert.deepEqual(rows[0], ['Định lượng & đi chợ · Thứ Hai']);
  assert.equal(rows[1][9], 'Tiền ăn 38 trẻ');
  assert.deepEqual(rows[2], ['Cần mua (hàng tươi)']);
  assert.deepEqual(rows[3], [1, 'Rau cải', 10, 380, 0, 380, 0.38, 'kg', 20000, 12000]);
  assert.equal(rows[4][9], 12000);
  assert.deepEqual(rows.at(-1), ['', 'Tổng tiền ăn 38 trẻ', '', '', '', '', '', '', '', 30000]);
  const flat = statisticsExportRows({ ...base, ingredients: [ing(1, 'Rau cải', undefined, 12000)] }, 'X');
  assert.equal(flat.length, 4, 'không nhóm: tiêu đề, đầu cột, 1 dòng, tổng');
});
