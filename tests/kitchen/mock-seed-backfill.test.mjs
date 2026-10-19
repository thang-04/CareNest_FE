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

test('database bếp cũ giữ collection rỗng đã lưu, không tạo lại lịch sử hoặc xuất lại ngày đã chốt', async () => {
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

  assert.equal(counts.counts.length, 0);
  assert.ok(stock.foods.length > 0, 'giữ danh mục thực phẩm, không suy diễn là đã nhập kho');
  assert.equal(stock.transactions.length, 0);
  assert.equal(issues.issues.length, 0);
  assert.equal(db.stockReceipts.length, 0);
  assert.equal(db.foodStock.length, 0);
  assert.equal(db.freshReceipts.length, 0);
  assert.equal(db.foodSamples.length, 0);
  assert.ok(
    db.weeklyForecasts.some((record) => record.id === 'user-forecast'),
    'giữ bản ghi người dùng đã có',
  );
  assert.equal(db.kitchenDemoSeedVersion, 1, 'đánh dấu migration đã chạy');
  await kitchen.getStockCounts({ campusId: 'c1' }, VP);
  assert.equal(
    readDb().stockCounts.filter((count) => count.campusId === 'c1').length,
    counts.counts.length,
    'đọc lại không nhân đôi lịch sử',
  );
});
