import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

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
const { validateStockReceipt, validateSupplier } = await import('@/utils/kitchen/kitchenValidation');
const { todayInput } = await import('@/utils/format');

const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const TEACHER = { id: 'u_teacher', role: 'TEACHER', campusId: 'c1' };

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);

beforeEach(() => values.clear());

const dryLine = async () => {
  const food = (await repo.getDryStock(VP)).foods[0];
  return {
    foodId: food.foodId,
    receivedQty: 2,
    rejectedQty: 0,
    lotNo: 'L-SUP',
    mfgDate: '2026-09-01',
    expiryDate: '2027-06-30',
    unitPrice: 10000,
  };
};

test('BA 01: HT và PHT xem danh mục NCC; Bếp, GV không xem; tìm theo tên hoặc mã, lọc trạng thái', async () => {
  const all = await repo.getSuppliers({}, PRINCIPAL);
  assert.deepEqual(
    all.map((s) => s.code),
    ['NCC001', 'NCC002', 'NCC003', 'NCC004'],
  );
  assert.equal((await repo.getSuppliers({}, VP)).length, all.length, 'PHT xem được');
  await rejects(repo.getSuppliers({}, COOK), 403);
  await rejects(repo.getSuppliers({}, TEACHER), 403);
  assert.deepEqual(
    (await repo.getSuppliers({ keyword: 'gao' }, VP)).map((s) => s.code),
    ['NCC002'],
    'tìm không dấu theo tên',
  );
  assert.deepEqual(
    (await repo.getSuppliers({ keyword: 'ncc003' }, VP)).map((s) => s.code),
    ['NCC003'],
  );
  assert.ok((await repo.getSuppliers({ status: 'INACTIVE' }, VP)).every((s) => s.status === 'INACTIVE'));
  assert.ok(all.find((s) => s.id === 'sup_01').receiptCount > 0, 'phiếu nhập seed gắn NCC');
});

test('BA 01: chỉ HT tạo/sửa/xóa; thiếu tên hoặc SĐT sai ⇒ 422; mã tự sinh tăng dần, không nhận mã gửi lên', async () => {
  const payload = { name: 'NCC thử', address: '', contactName: 'Người thử', phone: '0900 000 099', taxCode: '' };
  await rejects(repo.saveSupplier(payload, VP), 403);
  await rejects(repo.saveSupplier(payload, COOK), 403);
  await rejects(repo.saveSupplier({ ...payload, name: '  ' }, PRINCIPAL), 422);
  await rejects(repo.saveSupplier({ ...payload, phone: '12345' }, PRINCIPAL), 422);
  await rejects(repo.saveSupplier({ ...payload, taxCode: '12' }, PRINCIPAL), 422);

  const created = await repo.saveSupplier({ ...payload, code: 'TU-DAT' }, PRINCIPAL);
  assert.equal(created.code, 'NCC005');
  assert.equal(created.status, 'ACTIVE');
  const again = await repo.saveSupplier({ name: 'NCC thử 2' }, PRINCIPAL);
  assert.equal(again.code, 'NCC006');

  const edited = await repo.saveSupplier({ id: created.id, ...payload, name: 'NCC đã đổi tên', code: 'X' }, PRINCIPAL);
  assert.equal(edited.code, 'NCC005', 'sửa không đổi mã');
  assert.equal(edited.name, 'NCC đã đổi tên');
  await rejects(repo.saveSupplier({ id: created.id, ...payload }, VP), 403);
  await rejects(repo.deleteSupplier({ id: created.id }, VP), 403);
});

test('BA 01: NCC ngừng dùng không chọn được cho phiếu mới; nháp đã gắn trước khi ngừng vẫn giữ', async () => {
  const line = await dryLine();
  const base = { campusId: 'c1', date: todayInput(), note: '', items: [line] };
  await rejects(repo.saveStockReceipt({ ...base, supplierId: 'sup_04' }, VP), 422);
  await rejects(repo.saveStockReceipt({ ...base, supplierId: 'khong-co' }, VP), 422);

  const draft = await repo.saveStockReceipt({ ...base, supplierId: 'sup_03' }, VP);
  assert.equal(draft.supplierName, 'Công ty thực phẩm sạch mẫu');
  const s = (await repo.getSuppliers({}, PRINCIPAL)).find((x) => x.id === 'sup_03');
  await repo.saveSupplier({ ...s, status: 'INACTIVE' }, PRINCIPAL);
  const done = await repo.saveStockReceipt({ ...base, id: draft.id, supplierId: 'sup_03', confirm: true }, VP);
  assert.equal(done.status, 'CONFIRMED');
  assert.equal(done.supplierId, 'sup_03');
  await rejects(repo.saveStockReceipt({ ...base, supplierId: 'sup_03' }, VP), 422);
});

test('BA 01: chi tiết NCC liệt kê phiếu nhập liên kết; xóa NCC có phiếu ⇒ 409, chưa có phiếu thì xóa được', async () => {
  const detail = await repo.getSupplier({ id: 'sup_01' }, VP);
  assert.ok(detail.receipts.length > 0);
  assert.ok(detail.receipts.every((r) => r.supplierId === 'sup_01'));
  assert.ok(
    detail.receipts.every((r, i) => !i || detail.receipts[i - 1].date >= r.date),
    'mới nhất trước',
  );
  assert.ok(detail.receipts.every((r) => typeof r.totalAmount === 'number'));
  await rejects(repo.getSupplier({ id: 'khong-co' }, VP), 404);
  await rejects(repo.getSupplier({ id: 'sup_01' }, COOK), 403);

  await rejects(repo.deleteSupplier({ id: 'sup_01' }, PRINCIPAL), 409);
  // Phiếu nháp cũng tính là đã có giao dịch
  const fresh = await repo.saveSupplier({ name: 'NCC chỉ có nháp' }, PRINCIPAL);
  await repo.saveStockReceipt({ campusId: 'c1', date: todayInput(), supplierId: fresh.id, items: [await dryLine()] }, VP);
  await rejects(repo.deleteSupplier({ id: fresh.id }, PRINCIPAL), 409);
  await repo.deleteSupplier({ id: 'sup_04' }, PRINCIPAL);
  assert.ok(!(await repo.getSuppliers({}, PRINCIPAL)).some((s) => s.id === 'sup_04'));
});

test('dữ liệu cũ: phiếu chỉ có tên NCC được gắn theo tên trùng; tên lạ giữ nguyên, chưa liên kết', async () => {
  await repo.getSuppliers({}, PRINCIPAL);
  writeDb((db) => {
    delete db.suppliers;
    db.stockReceipts.forEach((r) => delete r.supplierId);
    db.stockReceipts[0].supplierName = 'cửa hàng GẠO mẫu';
    db.stockReceipts[1].supplierName = 'NCC ngoài danh mục';
  });
  const receipts = await repo.getStockReceipts({}, VP);
  const [first, second] = readDb().stockReceipts;
  const byId = Object.fromEntries(receipts.map((r) => [r.id, r]));
  assert.equal(byId[first.id].supplierId, 'sup_02');
  assert.equal(byId[second.id].supplierId, null);
  assert.equal(byId[second.id].supplierName, 'NCC ngoài danh mục');
});

test('kiểm tra ở form: xác nhận phiếu cần chọn NCC; NCC chỉ bắt buộc tên', () => {
  assert.equal(validateStockReceipt({ date: todayInput(), items: [] }, todayInput(), { confirm: true }).supplierId, 'Chọn nhà cung cấp.');
  assert.equal(validateStockReceipt({ date: todayInput(), items: [] }, todayInput(), { confirm: false }).supplierId, undefined);
  assert.deepEqual(validateSupplier({ name: 'NCC' }), {});
  assert.deepEqual(validateSupplier({ name: 'NCC', phone: '+84 900 000 001', taxCode: '0100000003-001' }), {});
  assert.ok(validateSupplier({}).name);
});
