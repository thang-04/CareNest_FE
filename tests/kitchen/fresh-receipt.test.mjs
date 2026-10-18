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
const { schoolWeekStart } = await import('@/models/menu-planning/menuPlanningConstants');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const COOK_B = { id: 'u_cook_b', role: 'KITCHEN_STAFF', campusId: 'c2' };

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);

// Ngày học của tuần đang chạy chưa có phiếu kiểm nhận
const pickDate = async () => {
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: schoolWeekStart(todayInput()) }, VP);
  for (const d of week.days.filter((x) => !x.holiday)) {
    const r = await repo.getFreshReceipt({ campusId: 'c1', date: d.date }, COOK_A);
    if (r.status === 'NEW' && r.lines.length) return d.date;
  }
  return null;
};

const stockSnapshot = () => JSON.stringify(readDb().foodStock);

test('phiếu mới lấy cột Đặt từ phiếu đặt hàng tuần; bếp lưu nháp, thiếu lý do thì không gửi được', async () => {
  const date = await pickDate();
  assert.ok(date, 'cần một ngày có hàng tươi');
  const r = await repo.getFreshReceipt({ campusId: 'c1', date }, COOK_A);
  assert.equal(r.status, 'NEW');
  assert.equal(r.canEdit, true);
  assert.ok(r.lines.every((l) => l.ordered > 0 && l.result === 'OK'));

  const forVp = await repo.getFreshReceipt({ campusId: 'c1', date }, VP);
  assert.equal(forVp.canEdit, false, 'PHT không nhập thay bếp');
  await rejects(repo.getFreshReceipt({ campusId: 'c1', date }, COOK_B), 403);

  const lines = r.lines.map((l, i) => ({
    foodId: l.foodId,
    delivered: l.ordered,
    received: i === 0 ? Math.max(0, l.ordered - 1) : l.ordered,
    result: i === 0 ? 'SHORT' : 'OK',
    reason: '',
  }));
  await rejects(repo.saveFreshReceipt({ campusId: 'c1', date, header: { deliveryNote: 'PGH-1' }, lines, submit: true }, COOK_A), 422);
  await rejects(repo.saveFreshReceipt({ campusId: 'c1', date, header: {}, lines: lines.map((l) => ({ ...l, reason: 'Thiếu' })), submit: true }, COOK_A), 422);
  const draft = await repo.saveFreshReceipt({ campusId: 'c1', date, header: {}, lines: lines.map((l) => ({ ...l, reason: 'Giao thiếu' })) }, COOK_A);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.counts.SHORT, 1);
  await rejects(repo.saveFreshReceipt({ campusId: 'c1', date, header: {}, lines }, VP), 403);
});

test('gửi PHT ⇒ khóa bếp; PHT trả kiểm lại cần ghi chú; xác nhận cuối khóa phiếu; tồn kho không đổi', async () => {
  const date = await pickDate();
  assert.ok(date);
  const before = stockSnapshot();
  const r = await repo.getFreshReceipt({ campusId: 'c1', date }, COOK_A);
  const lines = r.lines.map((l, i) => ({
    foodId: l.foodId,
    delivered: l.ordered,
    received: i === 0 ? 0 : l.ordered,
    result: i === 0 ? 'RETURNED' : 'OK',
    reason: i === 0 ? 'Rau dập, trả lại' : '',
  }));
  const header = { deliveryNote: 'PGH-TEST-01', supplierName: 'NCC thử', deliveredAt: '06:35' };
  const sent = await repo.saveFreshReceipt({ campusId: 'c1', date, header, lines, submit: true }, COOK_A);
  assert.equal(sent.status, 'SUBMITTED');
  assert.equal(sent.canEdit, false);
  await rejects(repo.saveFreshReceipt({ campusId: 'c1', date, header, lines }, COOK_A), 409);

  await repo.setFreshSupplierNotified({ campusId: 'c1', date, foodId: lines[0].foodId, notified: true }, COOK_A);
  await rejects(repo.setFreshSupplierNotified({ campusId: 'c1', date, foodId: lines[1].foodId, notified: true }, COOK_A), 404);

  await rejects(repo.reviewFreshReceipt({ campusId: 'c1', date, approve: false, note: '' }, VP), 422);
  await rejects(repo.reviewFreshReceipt({ campusId: 'c1', date, approve: true }, COOK_A), 403);
  const back = await repo.reviewFreshReceipt({ campusId: 'c1', date, approve: false, note: 'Cân lại thịt' }, VP);
  assert.equal(back.status, 'DRAFT');
  assert.equal(back.returnNote, 'Cân lại thịt');

  await repo.saveFreshReceipt({ campusId: 'c1', date, header, lines, submit: true }, COOK_A);
  const done = await repo.reviewFreshReceipt({ campusId: 'c1', date, approve: true }, VP);
  assert.equal(done.status, 'CONFIRMED');
  assert.ok(done.lines[0].supplierNotifiedAt, 'giữ dấu đã báo NCC');
  await rejects(repo.setFreshSupplierNotified({ campusId: 'c1', date, foodId: lines[0].foodId, notified: false }, VP), 409);
  assert.equal(stockSnapshot(), before, 'hàng tươi không vào kho');

  const forPrincipal = await repo.getFreshReceipt({ campusId: 'c1', date }, PRINCIPAL);
  assert.equal(forPrincipal.canReview, false);
});

test('không còn API báo thiếu', () => {
  for (const name of ['getMissingFoodReports', 'submitMissingFoodReport', 'markMissingFoodSupplied']) assert.equal(repo[name], undefined, name);
});
