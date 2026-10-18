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
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const VP_B = { id: 'u_vp_b', role: 'VICE_PRINCIPAL', campusId: 'c2' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const COOK_B = { id: 'u_cook_b', role: 'KITCHEN_STAFF', campusId: 'c2' };

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Ngày đã khóa, ngoài các ngày mẫu đã chốt sẵn ⇒ còn chờ chốt
const findPendingDay = async (user, campusId) => {
  for (let n = 1; n <= 40; n += 1) {
    const { counts } = await attendance.getMealCounts({ date: isoDaysAgo(n) }, user);
    const mine = counts.filter((c) => c.campusId === campusId && c.id);
    if (mine.length && mine.every((c) => c.status === 'PENDING_CONFIRMATION')) return mine[0].date;
  }
  return null;
};

const stockOf = (campusId, foodId) => readDb().foodStock.find((s) => s.campusId === campusId && s.foodId === foodId)?.quantity || 0;

test('chốt suất cả ngày một lần: mọi bữa CONFIRMED; Bếp và PHT cơ sở khác không chốt được', async () => {
  const date = await findPendingDay(VP, 'c1');
  assert.ok(date, 'cần một ngày chờ chốt');
  await rejects(attendance.confirmMealCountDay({ campusId: 'c1', date }, COOK_A), 403);
  await rejects(attendance.confirmMealCountDay({ campusId: 'c1', date }, VP_B), 403);
  const counts = await attendance.confirmMealCountDay({ campusId: 'c1', date }, VP);
  assert.ok(counts.length >= 2 && counts.every((c) => c.status === 'CONFIRMED'));
  await rejects(attendance.confirmMealCountDay({ campusId: 'c1', date }, VP), 409);
});

// Ngày gần đây đã có phiếu xuất (thực đơn có đồ khô): mở lại về chờ chốt, bỏ phiếu cũ để chốt lại
const reopenRecentDay = async (campusId) => {
  const { issues } = await kitchen.getStockIssues({ campusId }, PRINCIPAL);
  const target = [...issues].reverse().find((i) => i.items.length > 0);
  if (!target) return null;
  writeDb((db) => {
    db.stockIssues = db.stockIssues.filter((i) => !(i.campusId === campusId && i.date === target.date));
    db.mealCounts
      .filter((m) => m.campusId === campusId && m.date === target.date)
      .forEach((m) => Object.assign(m, { status: 'PENDING_CONFIRMATION', confirmedAt: null, confirmedBy: null }));
  });
  return target;
};

test('HT chốt thay được; phiếu xuất tự sinh chỉ gồm đồ khô, trừ tồn đúng một lần, thiếu tồn không âm', async () => {
  const target = await reopenRecentDay('c2');
  assert.ok(target, 'cần một ngày có đồ khô ở cơ sở 2');
  const { date } = target;
  // Cho một đồ khô về 0 để có dòng thiếu
  const dryIds = new Set(readDb().foods.filter((f) => (f.storage || 'FRESH') === 'DRY').map((f) => f.id));
  const zeroId = target.items[0].foodId;
  writeDb((db) => {
    const line = db.foodStock.find((s) => s.campusId === 'c2' && s.foodId === zeroId);
    if (line) line.quantity = 0;
    else db.foodStock.push({ campusId: 'c2', foodId: zeroId, quantity: 0 });
  });
  const before = Object.fromEntries([...dryIds].map((id) => [id, stockOf('c2', id)]));

  await attendance.confirmMealCountDay({ campusId: 'c2', date }, PRINCIPAL);
  const { issues } = await kitchen.getStockIssues({ campusId: 'c2' }, VP_B);
  const issue = issues.find((i) => i.date === date);
  assert.ok(issue, 'có phiếu xuất cho ngày vừa chốt');
  assert.ok(issue.items.length > 0);
  issue.items.forEach((it) => {
    assert.ok(dryIds.has(it.foodId), `${it.name} phải là đồ khô`);
    assert.ok(it.issuedQty >= 0 && it.issuedQty <= it.requiredQty);
    assert.ok(Math.abs(it.shortage - (it.requiredQty - it.issuedQty)) < 1e-6);
    assert.ok(Math.abs(stockOf('c2', it.foodId) - (before[it.foodId] - it.issuedQty)) < 1e-6, `${it.name} trừ đúng`);
    assert.ok(stockOf('c2', it.foodId) >= 0);
  });
  const zero = issue.items.find((it) => it.foodId === zeroId);
  assert.equal(zero.issuedQty, 0, 'hết tồn thì không xuất');
  assert.ok(zero.shortage > 0, 'ghi thiếu');

  // Đọc lại không trừ thêm
  const again = await kitchen.getStockIssues({ campusId: 'c2' }, COOK_B);
  assert.equal(again.issues.filter((i) => i.date === date).length, 1);
  issue.items.forEach((it) => assert.ok(Math.abs(stockOf('c2', it.foodId) - (before[it.foodId] - it.issuedQty)) < 1e-6));
});

test('phiếu xuất: HT, PHT, Bếp xem được cơ sở mình; không còn API duyệt và nhận', async () => {
  await rejects(kitchen.getStockIssues({ campusId: 'c1' }, COOK_B), 403);
  const forPrincipal = await kitchen.getStockIssues({ campusId: 'c1' }, PRINCIPAL);
  assert.ok(Array.isArray(forPrincipal.issues));
  for (const name of ['getStockIssue', 'approveStockIssue', 'confirmIngredientReceipt']) assert.equal(kitchen[name], undefined, name);
});
