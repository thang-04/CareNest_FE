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

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { validateStockDisposal } = await import('@/utils/kitchen/kitchenValidation');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const RETURN = 'SUPPLIER_RETURN';
const WRITE_OFF = 'WRITE_OFF';

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const stockOf = (campusId, foodId) => readDb().foodStock.find((s) => s.campusId === campusId && s.foodId === foodId)?.quantity || 0;
const today = todayInput();

test('validateStockDisposal: trả NCC chặn lô hết hạn và lô NCC khác; xuất hủy chặn lô còn hạn; bắt lý do và số lượng', () => {
  const lotById = {
    fresh: { qty: 5, expiryDate: '2999-01-01', supplierName: 'NCC A' },
    old: { qty: 5, expiryDate: '2000-01-01', supplierName: 'NCC A' },
  };
  const ctx = { lotById, today, supplierName: 'NCC A' };
  const ok = (kind, lotId, extra = {}) =>
    validateStockDisposal({ kind, supplierId: 's1', reason: 'Hết hạn', lines: [{ lotId, qty: 2 }], ...extra }, ctx);

  assert.deepEqual(ok(RETURN, 'fresh'), {});
  assert.deepEqual(ok(WRITE_OFF, 'old'), {});
  assert.ok(ok(RETURN, 'old')['lines.0.lotId'], 'lô hết hạn không trả NCC');
  assert.ok(ok(WRITE_OFF, 'fresh')['lines.0.lotId'], 'lô còn hạn không xuất hủy');
  assert.ok(
    validateStockDisposal({ kind: RETURN, supplierId: 's1', reason: 'Giao thừa', lines: [{ lotId: 'fresh', qty: 1 }] }, { ...ctx, supplierName: 'NCC B' })[
      'lines.0.lotId'
    ],
    'lô không do NCC đã chọn giao',
  );
  assert.ok(ok(RETURN, 'fresh', { supplierId: '' }).supplierId, 'trả NCC bắt chọn NCC');
  assert.equal(ok(WRITE_OFF, 'old', { supplierId: '' }).supplierId, undefined, 'xuất hủy không cần NCC');
  assert.ok(ok(WRITE_OFF, 'old', { reason: ' a ' }).reason, 'lý do ngắn bị chặn');
  assert.ok(ok(RETURN, 'fresh', { lines: [{ lotId: 'fresh', qty: 6 }] })['lines.0.qty'], 'không vượt tồn lô');
  assert.ok(ok(RETURN, 'fresh', { lines: [{ lotId: 'fresh', qty: 0 }] })['lines.0.qty'], 'số lượng phải lớn hơn 0');
  assert.ok(ok(RETURN, 'fresh', { lines: [{ lotId: 'fresh', qty: 1 }, { lotId: 'fresh', qty: 1 }] })['lines.1.lotId'], 'không chọn trùng lô');
  assert.ok(ok(RETURN, 'fresh', { lines: [] }).lines, 'cần ít nhất một lô');
});

test('xuất kho khô: trả NCC trừ lô còn hạn đúng NCC, xuất hủy trừ lô hết hạn; ghi lịch sử riêng, không lẫn hoàn kho', async () => {
  const food = (await repo.getDryStock(VP)).foods[2];
  const line = { foodId: food.foodId, receivedQty: 8, rejectedQty: 0, mfgDate: '2026-09-01', expiryDate: '2027-06-30', unitPrice: 20000 };
  const base = { campusId: 'c1', date: today, supplierId: 'sup_01', note: '' };
  await repo.createStockReceipt({ ...base, items: [{ ...line, lotNo: 'L-DISP-A' }] }, VP);
  await repo.createStockReceipt({ ...base, items: [{ ...line, lotNo: 'L-DISP-B' }] }, VP);

  const lotsNow = () => repo.getStockLots({ campusId: 'c1' }, VP);
  const lotA = (await lotsNow()).find((l) => l.lotNo === 'L-DISP-A');
  const lotB = (await lotsNow()).find((l) => l.lotNo === 'L-DISP-B');
  assert.ok(lotA && !lotA.expired);
  // Phiếu nhập không cho hạn đã qua: cho lô B hết hạn bằng cách sửa thẳng dữ liệu mẫu
  writeDb((db) => {
    db.stockLots.find((l) => l.id === lotB.id).expiryDate = '2020-01-01';
    return db;
  });
  assert.equal((await lotsNow()).find((l) => l.id === lotB.id).expired, true);

  const ret = { kind: RETURN, campusId: 'c1', supplierId: 'sup_01', reason: 'Giao thừa so với đơn đặt', lines: [{ lotId: lotA.id, qty: 3 }] };
  await rejects(repo.createStockDisposal({ ...ret, lines: [{ lotId: lotB.id, qty: 1 }] }, VP), 422); // lô hết hạn
  await rejects(repo.createStockDisposal({ ...ret, reason: '' }, VP), 422);
  await rejects(repo.createStockDisposal({ ...ret, supplierId: '' }, VP), 422);
  await rejects(repo.createStockDisposal({ ...ret, lines: [{ lotId: lotA.id, qty: lotA.qty + 1 }] }, VP), 422);
  await rejects(repo.createStockDisposal(ret, COOK_A), 403);
  await rejects(repo.createStockDisposal({ ...ret, kind: 'OTHER' }, VP), 403);

  const before = stockOf('c1', food.foodId);
  const record = await repo.createStockDisposal(ret, VP);
  assert.match(record.code, /^XT-/);
  assert.equal(record.supplierName, 'Đại lý thực phẩm khô mẫu');
  assert.ok(Math.abs(stockOf('c1', food.foodId) - (before - 3)) < 1e-6, 'trừ tồn tổng');
  const afterA = (await lotsNow()).find((l) => l.id === lotA.id);
  assert.ok(Math.abs(afterA.qty - (lotA.qty - 3)) < 1e-6, 'trừ lô');

  await rejects(repo.createStockDisposal({ kind: WRITE_OFF, campusId: 'c1', reason: 'Hết hạn sử dụng', lines: [{ lotId: lotA.id, qty: 1 }] }, VP), 422); // lô còn hạn
  const midStock = stockOf('c1', food.foodId);
  const off = await repo.createStockDisposal({ kind: WRITE_OFF, campusId: 'c1', reason: 'Hết hạn sử dụng', lines: [{ lotId: lotB.id, qty: lotB.qty }] }, VP);
  assert.match(off.code, /^XH-/);
  assert.equal(off.supplierName, '');
  assert.ok(Math.abs(stockOf('c1', food.foodId) - (midStock - lotB.qty)) < 1e-6);
  assert.ok(!(await lotsNow()).some((l) => l.id === lotB.id), 'lô đã xuất hết không còn trong danh sách');

  const item = await repo.getDryStockItem({ foodId: food.foodId }, VP);
  assert.ok(item.transactions.some((t) => t.type === RETURN && t.code === record.code && t.quantity < 0), 'trả NCC ghi là xuất');
  assert.ok(item.transactions.some((t) => t.type === WRITE_OFF && t.code === off.code && t.quantity < 0), 'xuất hủy ghi là xuất');
});

test('điểm trường có mã lạ (mã BE thật) vẫn có lô demo cả hết hạn lẫn còn hạn để lập phiếu xuất kho; tồn tổng khớp để trừ không âm', async () => {
  const VP2 = { ...VP, campusId: '2' };
  const lots = await repo.getStockLots({ campusId: '2' }, VP2);
  assert.ok(lots.some((l) => l.expired), 'có lô hết hạn để xuất hủy');
  assert.ok(lots.some((l) => !l.expired), 'có lô còn hạn để trả NCC');
  assert.equal((await repo.getStockLots({ campusId: '2' }, VP2)).length, lots.length, 'gọi lại không dựng thêm lô');

  const expired = lots.find((l) => l.expired);
  const before = stockOf('2', expired.foodId);
  assert.ok(before >= expired.qty, 'tồn tổng đã cộng theo lô demo');
  const record = await repo.createStockDisposal(
    { kind: WRITE_OFF, campusId: '2', reason: 'Hết hạn sử dụng', lines: [{ lotId: expired.id, qty: expired.qty }] },
    VP2,
  );
  assert.match(record.code, /^XH-/);
  assert.ok(Math.abs(stockOf('2', expired.foodId) - (before - expired.qty)) < 1e-6);

  const fresh = lots.find((l) => !l.expired);
  const supplierId = readDb().suppliers.find((s) => s.name === fresh.supplierName).id;
  const ret = await repo.createStockDisposal(
    { kind: RETURN, campusId: '2', supplierId, reason: 'Giao thừa so với đơn đặt', lines: [{ lotId: fresh.id, qty: 1 }] },
    VP2,
  );
  assert.match(ret.code, /^XT-/);
});
