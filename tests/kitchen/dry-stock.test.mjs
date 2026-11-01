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
  assert.ok(
    stock.campuses.every((c) => c.canWrite),
    'PHT ghi được cả hai cơ sở (quản lý chung)',
  );
  assert.ok(stock.foods.length > 0);
  const dry = new Set(
    readDb()
      .foods.filter((f) => f.storage === 'DRY')
      .map((f) => f.id),
  );
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
  assert.ok(
    forPrincipal.campuses.every((c) => !c.canWrite),
    'HT chỉ xem',
  );
  await rejects(repo.getDryStock(COOK_A), 403);
});

test('phiếu nhập: bắt NCC, lô, hạn, giá; chỉ đồ khô; PHT nhập cho cơ sở khác được; lô mới hiện trong panel', async () => {
  const stock = await repo.getDryStock(VP);
  const food = stock.foods[0];
  const fresh = readDb().foods.find((f) => f.storage !== 'DRY');
  const line = {
    foodId: food.foodId,
    receivedQty: 7,
    rejectedQty: 0,
    lotNo: 'L-TEST-1',
    mfgDate: '2026-09-01',
    expiryDate: '2027-06-30',
    unitPrice: 25000,
  };
  const base = { campusId: 'c2', date: todayInput(), supplierId: 'sup_01', note: '', items: [line] };
  await rejects(repo.createStockReceipt({ ...base, supplierId: '' }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, lotNo: '' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, mfgDate: '' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, expiryDate: '2026-08-01' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, expiryDate: '' }] }, VP), 422);
  await rejects(repo.createStockReceipt({ ...base, items: [{ ...line, foodId: fresh.id }] }, VP), 422);
  await rejects(repo.createStockReceipt(base, PRINCIPAL), 403);

  const before = stockOf('c2', food.foodId);
  const receipt = await repo.createStockReceipt(base, VP);
  assert.equal(receipt.campusId, 'c2');
  assert.equal(receipt.supplierName, 'Đại lý thực phẩm khô mẫu', 'chụp tên NCC lên phiếu');
  assert.ok(Math.abs(stockOf('c2', food.foodId) - (before + 7)) < 1e-6);

  const item = await repo.getDryStockItem({ foodId: food.foodId }, VP);
  const lot = item.campuses.find((c) => c.id === 'c2').lots.find((l) => l.lotNo === 'L-TEST-1');
  assert.ok(lot, 'có lô vừa nhập');
  assert.equal(lot.unitPrice, 25000);
  assert.equal(lot.supplierName, 'Đại lý thực phẩm khô mẫu');
  assert.equal(lot.expiryDate, '2027-06-30');
  assert.ok(item.transactions.some((t) => t.type === 'IN' && t.code === receipt.code));
});

test('phiếu nhập nháp không cộng tồn; xác nhận cộng đúng một lần rồi khóa; có thành tiền và tổng phiếu', async () => {
  const stock = await repo.getDryStock(VP);
  const food = stock.foods[1];
  const before = stockOf('c1', food.foodId);
  // Nháp chỉ cần thực phẩm + số lượng, chưa cần NCC/lô/NSX/HSD/giá
  const draft = await repo.saveStockReceipt(
    { campusId: 'c1', date: todayInput(), supplierId: '', note: '', items: [{ foodId: food.foodId, receivedQty: 4, unitPrice: '' }] },
    VP,
  );
  assert.equal(draft.status, 'DRAFT');
  assert.equal(stockOf('c1', food.foodId), before, 'nháp không cộng tồn');
  const listed = await repo.getStockReceipts({ campusId: 'c1' }, VP);
  assert.ok(listed.some((r) => r.id === draft.id && r.status === 'DRAFT'));
  const item = await repo.getDryStockItem({ foodId: food.foodId }, VP);
  assert.ok(!item.transactions.some((t) => t.code === draft.code), 'nháp không có giao dịch kho');

  const full = {
    id: draft.id,
    campusId: 'c1',
    date: todayInput(),
    supplierId: 'sup_02',
    note: '',
    items: [
      {
        foodId: food.foodId,
        receivedQty: 4,
        rejectedQty: 1,
        lotNo: 'L-DRAFT',
        note: 'Một bao rách',
        mfgDate: '2026-09-01',
        expiryDate: '2027-01-31',
        unitPrice: 12000,
      },
    ],
  };
  await rejects(repo.saveStockReceipt({ ...full, supplierId: '', confirm: true }, VP), 422);
  const done = await repo.saveStockReceipt({ ...full, confirm: true }, VP);
  assert.equal(done.status, 'CONFIRMED');
  assert.equal(done.items[0].amount, 36000, 'thành tiền = lượng nhập kho × đơn giá');
  assert.equal(done.totalAmount, 36000);
  assert.ok(Math.abs(stockOf('c1', food.foodId) - (before + 3)) < 1e-6);
  await rejects(repo.saveStockReceipt({ ...full, confirm: true }, VP), 409);
  assert.ok(Math.abs(stockOf('c1', food.foodId) - (before + 3)) < 1e-6, 'xác nhận lại không cộng tồn lần nữa');
  await rejects(repo.getStockReceipts({}, COOK_A), 403);
});

test('không còn nghiệp vụ kiểm kê kho thực phẩm (BA: không kiểm kê)', () => {
  assert.equal(repo.getStockCounts, undefined);
  assert.equal(repo.createStockCount, undefined);
  assert.equal(repo.saveStockCount, undefined);
});
