import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };

test('database bếp cũ có collection rỗng được backfill lịch sử mẫu, giữ dữ liệu đã có', async () => {
  await kitchen.getDryStock(VP);
  writeDb((db) => {
    db.kitchenDemoSeedVersion = 0;
    db.foodStock = [];
    db.stockReceipts = [];
    db.stockCounts = [];
    db.stockTransactions = [];
    db.stockIssues = [];
    db.freshReceipts = [];
    db.foodSamples = [];
    db.weeklyForecasts.push({ id: 'user-forecast', campusId: 'c1', weekStart: '2099-01-05', cells: {} });
  });

  const counts = await kitchen.getStockCounts({ campusId: 'c1' }, VP);
  const stock = await kitchen.getDryStock(VP);
  const issues = await kitchen.getStockIssues({ campusId: 'c1' }, COOK);
  const db = readDb();

  assert.ok(counts.counts.length > 0, 'có phiếu kiểm kê mẫu đã chốt');
  assert.ok(stock.foods.length > 0, 'có thực phẩm và tồn đầu kỳ');
  assert.ok(stock.transactions.length > 0, 'có giao dịch nhập kho mẫu');
  assert.ok(issues.issues.length > 0, 'có phiếu xuất kho từ ngày đã chốt suất');
  assert.ok(db.stockReceipts.length > 0, 'có phiếu nhập mẫu');
  assert.ok(db.foodStock.length > 0, 'có tồn đầu kỳ');
  assert.ok(db.freshReceipts.length > 0, 'có lịch sử kiểm nhận hàng tươi');
  assert.ok(db.foodSamples.length > 0, 'có lịch sử lưu mẫu');
  assert.ok(db.weeklyForecasts.some((record) => record.id === 'user-forecast'), 'giữ bản ghi người dùng đã có');
  assert.equal(db.kitchenDemoSeedVersion, 1, 'đánh dấu migration đã chạy');
  await kitchen.getStockCounts({ campusId: 'c1' }, VP);
  assert.equal(readDb().stockCounts.filter((count) => count.campusId === 'c1').length, counts.counts.length, 'đọc lại không nhân đôi lịch sử');
});
