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

const { writeDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const COOK_B = { id: 'u_cook_b', role: 'KITCHEN_STAFF', campusId: 'c2' };
// Ngày học đã qua trong tuần đã xuất bản của dữ liệu mẫu
const DATE = '2026-10-14';

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);

test('sổ lưu mẫu: món lấy từ thực đơn đã công bố; bếp lưu theo món, thiếu giờ hoặc khối lượng bị chặn', async () => {
  await repo.getFoodSampleLog({ campusId: 'c1', date: DATE }, COOK_A);
  writeDb((db) => {
    db.foodSamples = db.foodSamples.filter((s) => !(s.campusId === 'c1' && s.date === DATE));
  });
  const log = await repo.getFoodSampleLog({ campusId: 'c1', date: DATE }, COOK_A);
  assert.equal(log.canEdit, true);
  const meal = log.meals.find((m) => m.session === 'LUNCH');
  assert.ok(meal && meal.dishes.length > 0, 'bữa trưa có món');
  assert.equal(meal.status, 'TODO');

  const forVp = await repo.getFoodSampleLog({ campusId: 'c1', date: DATE }, VP);
  assert.equal(forVp.canEdit, false);
  await rejects(repo.getFoodSampleLog({ campusId: 'c1', date: DATE }, COOK_B), 403);

  const payload = { campusId: 'c1', date: DATE, session: 'LUNCH', takenAt: '10:30' };
  const dishes = meal.dishes.map((d) => ({
    dishId: d.dishId,
    weight: '100 g',
    container: 'Hộp thủy tinh',
    temperature: '2–8 °C',
    note: '',
  }));
  await rejects(repo.saveFoodSample({ ...payload, takenAt: '', dishes }, COOK_A), 422);
  await rejects(repo.saveFoodSample({ ...payload, dishes: dishes.map((d, i) => (i ? d : { ...d, weight: '' })) }, COOK_A), 422);
  await rejects(repo.saveFoodSample({ ...payload, dishes }, VP), 403);
  await rejects(repo.saveFoodSample({ ...payload, dishes: [{ ...dishes[0], dishId: 'khong-co' }] }, COOK_A), 422);

  const saved = await repo.saveFoodSample({ ...payload, dishes }, COOK_A);
  assert.equal(saved.status, 'SAVED');
  assert.equal(saved.dishes[0].weight, '100 g');
  assert.ok(saved.takenAt);
});

test('hủy mẫu: chỉ khi đủ 24 giờ; đã hủy thì không sửa; mẫu quá hạn hiện ở "Chờ ghi hủy"', async () => {
  const log = await repo.getFoodSampleLog({ campusId: 'c1', date: DATE }, COOK_A);
  assert.ok(
    log.pendingDestroy.some((p) => p.date === DATE && p.session === 'LUNCH'),
    'mẫu ngày đã qua đủ 24 giờ',
  );
  await rejects(repo.destroyFoodSample({ campusId: 'c1', date: DATE, session: 'LUNCH' }, VP), 403);
  const done = await repo.destroyFoodSample({ campusId: 'c1', date: DATE, session: 'LUNCH' }, COOK_A);
  assert.equal(done.status, 'DESTROYED');
  assert.ok(done.destroyedAt);
  await rejects(repo.destroyFoodSample({ campusId: 'c1', date: DATE, session: 'LUNCH' }, COOK_A), 409);
  const dishes = done.dishes.map((d) => ({ dishId: d.dishId, weight: '90 g' }));
  await rejects(repo.saveFoodSample({ campusId: 'c1', date: DATE, session: 'LUNCH', takenAt: '10:30', dishes }, COOK_A), 409);

  // Mẫu vừa lấy chưa đủ 24 giờ
  const today = todayInput();
  writeDb((db) => {
    db.foodSamples.push({
      campusId: 'c1',
      date: today,
      session: 'AFTERNOON',
      takenAt: new Date().toISOString(),
      takenBy: COOK_A.id,
      dishes: [],
    });
  });
  await rejects(repo.destroyFoodSample({ campusId: 'c1', date: today, session: 'AFTERNOON' }, COOK_A), 409);
});
