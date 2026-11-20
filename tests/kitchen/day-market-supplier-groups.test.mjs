import assert from 'node:assert/strict';
import { test } from 'node:test';

const { dayMarketSupplierGroups, NO_SUPPLIER_LABEL } = await import('@/utils/kitchen/dayMarketGroups');
const { toDayMarket } = await import('@/services/freshGoodsApi');

const line = (foodId, supplierId, supplierName) => ({ foodId, supplierId, supplierName });

test('gom theo NCC theo thứ tự xuất hiện, nhóm chưa gán NCC để cuối', () => {
  const groups = dayMarketSupplierGroups([line(1, null, ''), line(2, 7, 'NCC Rau'), line(3, 9, 'NCC Thịt'), line(4, 7, 'NCC Rau')]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.lines.map((l) => l.foodId)]),
    [
      ['NCC Rau', [2, 4]],
      ['NCC Thịt', [3]],
      [NO_SUPPLIER_LABEL, [1]],
    ],
  );
});

test('không có dòng thì không có nhóm', () => {
  assert.deepEqual(dayMarketSupplierGroups([]), []);
});

test('mapper giữ supplierId BE trả để gom nhóm', () => {
  const market = toDayMarket({
    groups: [],
    lines: [{ food: { id: 3, name: 'Rau cải', purchaseUnit: 'kg' }, storage: 'FRESH', supplierId: 7, supplierName: 'NCC Rau', groups: [] }],
    menu: [],
    totals: { groups: [] },
  });
  assert.equal(market.lines[0].supplierId, 7);
});
