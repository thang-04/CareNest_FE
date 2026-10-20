import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
const { foodUnits, toStockQty, UNIT_KIND } = await import('@/utils/menu-planning/foodUnits');
const { validateFood } = await import('@/utils/menu-planning/menuPlanningValidation');
const { menuPlanningMockRepository: menu } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const rejects = (promise, status) => assert.rejects(promise, (e) => e.status === status);
const stockOf = (campusId, foodId) => readDb().foodStock.find((s) => s.campusId === campusId && s.foodId === foodId)?.quantity || 0;

test('BA 02: thực phẩm cũ chưa khai đơn vị kho ⇒ đơn vị kho = đơn vị mua, tỷ lệ 1, giữ số g/ml', () => {
  assert.deepEqual(foodUnits({ unit: 'g', purchaseUnit: 'quả', purchaseUnitSize: 50 }), {
    recipeUnit: 'g',
    purchaseUnit: 'quả',
    stockUnit: 'quả',
    purchaseToStock: 1,
    stockUnitSize: 50,
  });
  const bag = { unit: 'g', purchaseUnit: 'bao 10 kg', stockUnit: 'kg', purchaseToStock: 10, stockUnitSize: 1000 };
  assert.equal(toStockQty(bag, 2, UNIT_KIND.PURCHASE), 20);
  assert.equal(toStockQty(bag, 2, UNIT_KIND.STOCK), 2);
  assert.equal(toStockQty(bag, 2), 2, 'dòng cũ không ghi loại = đơn vị kho');
});

test('BA 02: tỷ lệ quy đổi bằng 0, âm hoặc trống bị chặn; thiếu đơn vị kho bị chặn', () => {
  const base = { name: 'Bột thử', group: 'GRAIN', unit: 'g', purchaseUnit: 'bao', purchaseUnitSize: 1000, stockUnit: 'kg' };
  assert.ok(validateFood({ ...base, purchaseToStock: 0, stockUnitSize: 1000 }).purchaseToStock);
  assert.ok(validateFood({ ...base, purchaseToStock: 10, stockUnitSize: -1 }).stockUnitSize);
  assert.ok(validateFood({ ...base, purchaseToStock: '', stockUnitSize: 1000 }).purchaseToStock);
  assert.ok(validateFood({ ...base, stockUnit: ' ', purchaseToStock: 1, stockUnitSize: 1000 }).stockUnit);
  assert.deepEqual(validateFood({ ...base, purchaseToStock: 10, stockUnitSize: 1000 }), {});
});

test('lưu thực phẩm có đơn vị kho: g/ml của đơn vị mua = hai tỷ lệ nhân nhau; tỷ lệ sai ⇒ 422', async () => {
  const payload = {
    name: 'Bột mì thử',
    group: 'GRAIN',
    unit: 'g',
    purchaseUnit: 'bao 25 kg',
    stockUnit: 'kg',
    purchaseToStock: 25,
    stockUnitSize: 1000,
    unitPrice: 500000,
    storage: 'DRY',
  };
  const saved = await menu.saveFood(null, payload, VP);
  assert.deepEqual([saved.stockUnit, saved.purchaseToStock, saved.stockUnitSize, saved.purchaseUnitSize], ['kg', 25, 1000, 25000]);
  await rejects(menu.saveFood(null, { ...payload, name: 'Bột sai', stockUnitSize: 0 }, VP), 422);
});

test('đã có lô / phiếu nhập: khóa đơn vị kho và g/ml trong một đơn vị kho; đơn vị mua vẫn sửa được', async () => {
  await kitchen.getDryStock(VP);
  const stocked = readDb().stockReceipts.find((r) => r.status === 'CONFIRMED').items[0].foodId;
  const food = await menu.getFood(stocked, VP);
  assert.equal(food.unitsLocked, true);
  const u = foodUnits(food);
  await rejects(menu.saveFood(stocked, { ...food, ...u, stockUnitSize: u.stockUnitSize + 1 }, VP), 409);
  await rejects(menu.saveFood(stocked, { ...food, ...u, stockUnit: 'tấn' }, VP), 409);
  const changed = await menu.saveFood(stocked, { ...food, ...u, purchaseUnit: 'bao 5 kg', purchaseToStock: 5 }, VP);
  assert.equal(changed.purchaseUnit, 'bao 5 kg');
});

test('BA 05: nhập kho theo đơn vị mua ⇒ lô và tồn tăng theo đơn vị kho; thành tiền theo đơn vị dòng', async () => {
  // Đường kính mẫu: mua bao 10 kg, tồn theo kg
  const sugar = readDb().foods.find((f) => f.id === 'f27');
  assert.deepEqual([sugar.stockUnit, sugar.purchaseToStock], ['kg', 10]);
  const before = stockOf('c1', 'f27');
  const line = { foodId: 'f27', receivedQty: 2, rejectedQty: 0, lotNo: 'L-BAO', mfgDate: '2026-09-01', expiryDate: '2027-09-01' };
  const done = await kitchen.saveStockReceipt(
    {
      campusId: 'c1',
      date: todayInput(),
      supplierId: 'sup_01',
      items: [{ ...line, unitKind: 'PURCHASE', unitPrice: 240000 }],
      confirm: true,
    },
    VP,
  );
  const item = done.items[0];
  assert.deepEqual([item.unit, item.stockQty, item.amount], ['bao 10 kg', 20, 480000]);
  assert.ok(Math.abs(stockOf('c1', 'f27') - (before + 20)) < 1e-6);
  const lot = readDb().stockLots.find((l) => l.receiptId === done.id);
  assert.deepEqual([lot.qty, lot.unitPrice], [20, 24000], 'giá lô theo kg');

  const byStock = await kitchen.saveStockReceipt(
    {
      campusId: 'c1',
      date: todayInput(),
      supplierId: 'sup_01',
      items: [{ ...line, lotNo: 'L-KG', unitKind: 'STOCK', unitPrice: 24000 }],
      confirm: true,
    },
    VP,
  );
  assert.deepEqual([byStock.items[0].unit, byStock.items[0].stockQty], ['kg', 2]);
});
