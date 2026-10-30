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
const { confirmExistingCounts } = await import('./confirm-existing-counts.mjs');

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { todayInput } = await import('@/utils/format');

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

test('chốt từng bữa đang có: mọi bữa CONFIRMED; Bếp và PHT cơ sở khác không chốt được', async () => {
  const date = await findPendingDay(VP, 'c1');
  assert.ok(date, 'cần một ngày chờ chốt');
  await rejects(confirmExistingCounts({ campusId: 'c1', date }, COOK_A), 403);
  await rejects(confirmExistingCounts({ campusId: 'c1', date }, VP_B), 403);
  const counts = await confirmExistingCounts({ campusId: 'c1', date }, VP);
  assert.ok(counts.length >= 2 && counts.every((c) => c.status === 'CONFIRMED'));
  await rejects(confirmExistingCounts({ campusId: 'c1', date }, VP), 409);
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

test('xuất kho theo BA: thiếu một dòng dừng cả phiếu; nhập bổ sung xong bếp chọn lô; ghi xuất một lần', async () => {
  const target = await reopenRecentDay('c2');
  assert.ok(target, 'cần một ngày có đồ khô ở cơ sở 2');
  const { date } = target;
  const dryIds = new Set(
    readDb()
      .foods.filter((f) => (f.storage || 'FRESH') === 'DRY')
      .map((f) => f.id),
  );
  // Cho một đồ khô hết hàng (cả tồn tổng và lô) để có dòng thiếu
  const zeroId = target.items[0].foodId;
  writeDb((db) => {
    const line = db.foodStock.find((s) => s.campusId === 'c2' && s.foodId === zeroId);
    if (line) line.quantity = 0;
    else db.foodStock.push({ campusId: 'c2', foodId: zeroId, quantity: 0 });
    db.stockLots.filter((l) => l.campusId === 'c2' && l.foodId === zeroId).forEach((l) => (l.qty = 0));
  });
  const before = Object.fromEntries([...dryIds].map((id) => [id, stockOf('c2', id)]));

  // NUT-02 (Cần chốt 27/10/2026): HT cũng xác nhận được sổ báo ăn của mọi điểm trường
  await confirmExistingCounts({ campusId: 'c2', date }, PRINCIPAL);
  let issue = (await kitchen.getStockIssues({ campusId: 'c2' }, VP_B)).issues.find((i) => i.date === date);
  assert.ok(issue, 'có phiếu xuất cho ngày vừa chốt');
  assert.equal(issue.status, 'AWAITING_STOCK', 'thiếu một dòng ⇒ dừng cả phiếu');
  issue.items.forEach((it) => {
    assert.ok(dryIds.has(it.foodId), `${it.name} phải là đồ khô`);
    assert.equal(it.issuedQty, 0, 'không xuất một phần');
    assert.equal(stockOf('c2', it.foodId), before[it.foodId], `${it.name} chưa trừ tồn`);
  });
  const zero = issue.items.find((it) => it.foodId === zeroId);
  assert.ok(zero.shortage > 0 && zero.availableQty === 0);
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: {} }, COOK_B), 409);

  // Lô hết hạn không tính là tồn khả dụng
  writeDb((db) =>
    db.stockLots.push({ id: 'klot_expired_test', campusId: 'c2', foodId: zeroId, lotNo: 'L-HET-HAN', expiryDate: '2000-01-01', qty: 999 }),
  );
  issue = (await kitchen.getStockIssues({ campusId: 'c2' }, VP_B)).issues.find((i) => i.date === date);
  assert.equal(issue.status, 'AWAITING_STOCK', 'lô hết hạn không gỡ chặn');

  // PHT nhập bổ sung ⇒ phiếu chuyển sang chờ bếp chọn lô
  await kitchen.saveStockReceipt(
    {
      campusId: 'c2',
      date: todayInput(),
      supplierId: 'sup_01',
      confirm: true,
      // Nhập bổ sung mọi dòng đang thiếu
      items: issue.items
        .filter((it) => it.shortage > 0)
        .map((it, i) => ({
          foodId: it.foodId,
          receivedQty: it.shortage + 1,
          lotNo: `L-BOSUNG-${i}`,
          mfgDate: '2026-09-01',
          expiryDate: '2099-12-31',
          unitPrice: 1000,
        })),
    },
    VP_B,
  );
  issue = (await kitchen.getStockIssues({ campusId: 'c2' }, COOK_B)).issues.find((i) => i.date === date);
  assert.equal(issue.status, 'AWAITING_LOT_ALLOCATION', 'đủ hàng ⇒ chờ bếp chọn lô');
  const zeroLots = issue.items.find((it) => it.foodId === zeroId).lots;
  assert.ok(
    zeroLots.some((l) => l.lotNo === 'L-HET-HAN' && !l.usable),
    'lô hết hạn hiện nhưng không chọn được',
  );

  const pick = (expiredFor) =>
    Object.fromEntries(
      issue.items.map((it) => {
        let left = it.requiredQty;
        const lots = it.lots.filter((l) => (it.foodId === expiredFor ? l.id === 'klot_expired_test' : l.usable));
        return [
          it.foodId,
          lots
            .map((l) => {
              const qty = Math.min(left, l.qty);
              left -= qty;
              return { lotId: l.id, qty };
            })
            .filter((x) => x.qty > 0),
        ];
      }),
    );
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: pick() }, VP_B), 403);
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: pick() }, COOK_A), 403);
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: pick(zeroId) }, COOK_B), 422);
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: { ...pick(), [zeroId]: [] } }, COOK_B), 422);

  const mid = Object.fromEntries([...dryIds].map((id) => [id, stockOf('c2', id)]));
  const posted = await kitchen.allocateIssueLots({ id: issue.id, allocations: pick() }, COOK_B);
  assert.equal(posted.status, 'POSTED');
  posted.items.forEach((it) => {
    assert.equal(it.issuedQty, it.requiredQty);
    assert.ok(Math.abs(stockOf('c2', it.foodId) - (mid[it.foodId] - it.requiredQty)) < 1e-6, `${it.name} trừ đúng một lần`);
    assert.ok(it.allocations.length > 0 && it.allocations.every((a) => a.lotId !== 'klot_expired_test'));
  });
  await rejects(kitchen.allocateIssueLots({ id: issue.id, allocations: pick() }, COOK_B), 409);
  const again = await kitchen.getStockIssues({ campusId: 'c2' }, COOK_B);
  assert.equal(again.issues.filter((i) => i.date === date).length, 1);
  posted.items.forEach((it) => assert.ok(Math.abs(stockOf('c2', it.foodId) - (mid[it.foodId] - it.requiredQty)) < 1e-6));
});

test('phiếu xuất: HT, PHT, Bếp xem được cơ sở mình; không còn API duyệt và nhận', async () => {
  await rejects(kitchen.getStockIssues({ campusId: 'c1' }, COOK_B), 403);
  const forPrincipal = await kitchen.getStockIssues({ campusId: 'c1' }, PRINCIPAL);
  assert.ok(Array.isArray(forPrincipal.issues));
  for (const name of ['getStockIssue', 'approveStockIssue', 'confirmIngredientReceipt']) assert.equal(kitchen[name], undefined, name);
});
