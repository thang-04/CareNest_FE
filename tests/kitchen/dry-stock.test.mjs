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
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const stockOf = (campusId, foodId) => readDb().foodStock.find((s) => s.campusId === campusId && s.foodId === foodId)?.quantity || 0;

test('kho khô xem chung: HT và PHT thấy cả hai cơ sở, chỉ đồ khô, sắp theo mức gấp; Bếp không vào được', async () => {
  const stock = await repo.getDryStock(VP);
  assert.equal(stock.campuses.length, 2);
  assert.ok(stock.campuses.every((c) => c.canWrite), 'PHT ghi được cả hai cơ sở (quản lý chung)');
  assert.ok(stock.foods.length > 0);
  const dry = new Set(readDb().foods.filter((f) => f.storage === 'DRY').map((f) => f.id));
  assert.ok(stock.foods.every((f) => dry.has(f.foodId)));
  stock.foods.forEach((f, i) => {
    if (i) assert.ok(stock.foods[i - 1].urgency <= f.urgency, 'sắp theo mức gấp');
    stock.campuses.forEach((c) => {
      const cell = f.byCampus[c.id];
      assert.ok(cell.daysLeft === null || Number.isInteger(cell.daysLeft));
      if (cell.qty <= 0) assert.equal(cell.status, 'OUT');
    });
  });
  const forPrincipal = await repo.getDryStock(PRINCIPAL);
  assert.ok(forPrincipal.campuses.every((c) => !c.canWrite), 'HT chỉ xem');
  await rejects(repo.getDryStock(COOK_A), 403);
});

test('phiếu nhập: bắt NCC, lô, hạn, giá; chỉ đồ khô; PHT nhập cho cơ sở khác được; lô mới hiện trong panel', async () => {
  const stock = await repo.getDryStock(VP);
  const food = stock.foods[0];
  const fresh = readDb().foods.find((f) => f.storage !== 'DRY');
  const line = { foodId: food.foodId, receivedQty: 7, rejectedQty: 0, lotNo: 'L-TEST-1', expiryDate: '2027-06-30', unitPrice: 25000 };
  const base = { campusId: 'c2', date: todayInput(), supplierName: 'NCC thử', note: '', items: [line] };
  await rejects(repo.createStockReceipt({ ...base, supplierName: '' }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, lotNo: '' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, expiryDate: '' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, foodId: fresh.id }] }, VP), 422);
  await rejects(repo.createStockReceipt(base, PRINCIPAL), 403);

  const before = stockOf('c2', food.foodId);
  const receipt = await repo.createStockReceipt(base, VP);
  assert.equal(receipt.campusId, 'c2');
  assert.equal(receipt.supplierName, 'NCC thử');
  assert.ok(Math.abs(stockOf('c2', food.foodId) - (before + 7)) < 1e-6);

  const item = await repo.getDryStockItem({ foodId: food.foodId }, VP);
  const lot = item.campuses.find((c) => c.id === 'c2').lots.find((l) => l.lotNo === 'L-TEST-1');
  assert.ok(lot, 'có lô vừa nhập');
  assert.equal(lot.unitPrice, 25000);
  assert.equal(lot.supplierName, 'NCC thử');
  assert.equal(lot.expiryDate, '2027-06-30');
  assert.ok(item.transactions.some((t) => t.type === 'IN' && t.code === receipt.code));
});

test('kiểm kê: một nháp mỗi cơ sở; lệch phải có lý do; chốt ⇒ tồn = số đếm, giao dịch ADJUST, khóa phiếu', async () => {
  await rejects(repo.createStockCount({ campusId: 'c1' }, COOK_A), 403);
  const count = await repo.createStockCount({ campusId: 'c1' }, VP);
  assert.equal(count.status, 'DRAFT');
  await rejects(repo.createStockCount({ campusId: 'c1' }, VP), 409);

  const [first, ...rest] = count.lines;
  const lines = [{ foodId: first.foodId, countedQty: first.systemQty + 2, reason: '' }, ...rest.map((l) => ({ foodId: l.foodId, countedQty: l.systemQty }))];
  await rejects(repo.saveStockCount({ id: count.id, lines, finalize: true }, VP), 422);
  await rejects(repo.saveStockCount({ id: count.id, lines: lines.slice(1), finalize: true }, VP), 422);
  const saved = await repo.saveStockCount({ id: count.id, lines }, VP);
  assert.equal(saved.status, 'DRAFT');
  assert.equal(saved.lines[0].diff, 2);

  const expected = first.systemQty + 2;
  const done = await repo.saveStockCount({ id: count.id, lines: [{ ...lines[0], reason: 'WRONG_ENTRY' }, ...lines.slice(1)], finalize: true }, VP);
  assert.equal(done.status, 'FINALIZED');
  assert.ok(Math.abs(stockOf('c1', first.foodId) - expected) < 1e-6);
  assert.ok(readDb().stockTransactions.some((t) => t.refId === count.id && t.type === 'ADJUST' && t.foodId === first.foodId));
  await rejects(repo.saveStockCount({ id: count.id, lines }, VP), 409);

  const list = await repo.getStockCounts({ campusId: 'c1' }, PRINCIPAL);
  assert.equal(list.canWrite, false);
  assert.ok(list.counts.some((c) => c.id === count.id && c.status === 'FINALIZED'));
});
