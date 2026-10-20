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

const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const WEEK = '2026-11-23';

const activeDish = async () => (await repo.getCatalog(VP)).dishes.find((d) => d.status === 'ACTIVE');

test('tuần nháp soạn tay: thêm món đầu tiên vào ngày trống lưu được dù các bữa khác còn trống', async () => {
  const wm = await repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: WEEK, days: [] }, VP);
  const day = wm.days.find((d) => !d.holiday);
  const dish = await activeDish();
  const after = await repo.saveDayAdjustment(wm.id, day.date, [{ session: 'LUNCH', items: [{ dishId: dish.id, portion: 1 }] }], VP);
  const saved = after.days.find((d) => d.date === day.date);
  assert.ok(saved.meals.some((m) => m.items.some((i) => i.dishId === dish.id)));
});

test('tuần nháp: bỏ món cuối của một bữa lưu được; hệ số khẩu phần sai vẫn bị chặn', async () => {
  const week = '2026-11-30';
  const wm = await repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: week, days: [] }, VP);
  const day = wm.days.find((d) => !d.holiday);
  const dish = await activeDish();
  await repo.saveDayAdjustment(wm.id, day.date, [{ session: 'LUNCH', items: [{ dishId: dish.id, portion: 1 }] }], VP);
  await repo.saveDayAdjustment(wm.id, day.date, [{ session: 'LUNCH', items: [] }], VP);
  await assert.rejects(
    repo.saveDayAdjustment(wm.id, day.date, [{ session: 'LUNCH', items: [{ dishId: dish.id, portion: 9 }] }], VP),
    (e) => e.status === 422,
  );
});

test('xuất bản vẫn chặn ngày học chưa có món', async () => {
  const week = '2026-12-07';
  const wm = await repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: week, days: [] }, VP);
  await assert.rejects(repo.publishWeeklyMenu(wm.id, VP), (e) => e.status === 422);
});
