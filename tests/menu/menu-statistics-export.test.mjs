import assert from 'node:assert/strict';
import { test } from 'node:test';

const { statisticsExportRows, storageGroups, supplierGroups, buysInBaseUnit } = await import('@/utils/menu-planning/menuStatistics');

const ing = (foodId, foodName, storage, cost) => ({
  foodId,
  foodName,
  storage,
  unit: 'g',
  supplierId: storage === 'DRY' ? 7 : null,
  supplierName: storage === 'DRY' ? 'NCC Gạo' : null,
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
  assert.equal(rows[1][10], 'Tiền ăn 38 trẻ (theo lượng dùng)');
  assert.deepEqual(rows[2], ['Cần mua (hàng tươi)']);
  assert.deepEqual(rows[3], [1, 'Rau cải', '', 10, 380, 0, 380, 0.38, 'kg', 20000, 12000]);
  assert.equal(rows[4][10], 12000);
  assert.deepEqual(rows.at(-1), ['', 'Tổng tiền ăn 38 trẻ', '', '', '', '', '', '', '', '', 30000]);
  const flat = statisticsExportRows({ ...base, ingredients: [ing(1, 'Rau cải', undefined, 12000)] }, 'X');
  assert.equal(flat.length, 4, 'không nhóm: tiêu đề, đầu cột, 1 dòng, tổng');
});

test('NUT-27: Nhóm theo NCC dùng tổng supplierCosts BE trả; thiếu supplierCosts ⇒ không nhóm', () => {
  const stats = {
    ...base,
    ingredients: [ing(1, 'Rau cải', 'FRESH', 12000), ing(2, 'Gạo tẻ', 'DRY', 18000)],
    supplierCosts: [
      { supplierId: null, supplierName: null, contractStatus: 'NONE', cost: 12000 },
      { supplierId: 7, supplierName: 'NCC Gạo', contractStatus: 'EXPIRING', cost: 18000 },
    ],
  };
  assert.deepEqual(
    supplierGroups(stats).map((g) => [g.title, g.rows.map((r) => r.foodName), g.total, g.contractStatus]),
    [
      ['Chưa gán nhà cung cấp', ['Rau cải'], 12000, null],
      ['NCC Gạo', ['Gạo tẻ'], 18000, 'EXPIRING'],
    ],
  );
  const rows = statisticsExportRows(stats, 'X', 'supplier');
  assert.deepEqual(rows[2], ['Chưa gán nhà cung cấp']);
  assert.equal(rows.find((r) => r[1] === 'Tổng NCC Gạo')[10], 18000);
  assert.equal(supplierGroups({ ...stats, supplierCosts: undefined }), null);
});

test('Gộp cột mua: ĐVT là kg/lít của đơn vị gốc ⇒ không cần dòng phụ', () => {
  assert.equal(buysInBaseUnit({ unit: 'g', purchaseUnit: 'kg' }), true);
  assert.equal(buysInBaseUnit({ unit: 'ml', purchaseUnit: 'lít' }), true);
  assert.equal(buysInBaseUnit({ unit: 'g', purchaseUnit: 'quả' }), false);
});
