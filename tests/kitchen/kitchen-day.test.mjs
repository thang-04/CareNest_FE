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

const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const COOK_B = { id: 'u_cook_b', role: 'KITCHEN_STAFF', campusId: 'c2' };
// Ngày học trong tuần đã xuất bản của dữ liệu mẫu, đã qua nên có số suất chốt (như market-list.test)
const SEED_DATE = '2026-10-06';

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);

test('Quy trình bếp: số suất chốt, phiếu đi chợ và phiếu xuất của đúng cơ sở', async () => {
  const day = await repo.getKitchenDay({ campusId: 'c1', date: SEED_DATE }, VP);
  assert.equal(day.campusId, 'c1');
  assert.ok(day.mealCount.sessions.length > 0, 'ngày học có bữa');
  assert.equal(day.mealCount.confirmed, day.mealCount.sessions.filter((s) => s.status === 'CONFIRMED').length);
  for (const s of day.mealCount.sessions) {
    if (s.status === 'CONFIRMED') assert.ok(s.total > 0);
    else assert.equal(s.total, null, 'NUT-03: số chưa chốt không hiện');
  }
  assert.ok(day.market.fresh + day.market.dry > 0, 'có thực phẩm cần mua');
  assert.ok(day.issue.state);
  assert.equal(typeof day.stock.outOfStock, 'number', 'PHT thấy tồn kho');
  assert.ok(['NEW', 'DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(day.fresh.status));
  assert.ok(Array.isArray(day.samples.meals));
  assert.equal(typeof day.samples.pendingDestroy, 'number');
  assert.equal(typeof day.forecast.pendingChanges, 'number');
});

test('Bếp không thấy tồn kho; Bếp cơ sở B không đọc được cơ sở A; HT đọc được mọi cơ sở', async () => {
  const day = await repo.getKitchenDay({ campusId: 'c1', date: SEED_DATE }, COOK_A);
  assert.equal(day.stock, null);
  await rejects(repo.getKitchenDay({ campusId: 'c1', date: SEED_DATE }, COOK_B), 403);
  const forPrincipal = await repo.getKitchenDay({ campusId: 'c2', date: SEED_DATE }, PRINCIPAL);
  assert.equal(forPrincipal.campusId, 'c2');
});
