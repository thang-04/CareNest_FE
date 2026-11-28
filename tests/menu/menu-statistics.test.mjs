import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { ageGroupOptions } = await import('@/utils/menu-planning/menuStatistics');
const { createMealPlanApi } = await import('@/services/mealPlanApi');

test('nhóm tuổi lấy tên từ danh mục, id lạ có tên dự phòng', () => {
  assert.deepEqual(ageGroupOptions([2, 5], [{ id: 2, name: 'Mẫu giáo bé' }]), [
    { id: '2', name: 'Mẫu giáo bé' },
    { id: '5', name: 'Nhóm tuổi 5' },
  ]);
});

test('API thống kê: số trẻ trống thì không gửi để BE tự lấy suất hoặc sĩ số', async () => {
  const calls = [];
  const api = createMealPlanApi({
    client: { post: async (url, body) => (calls.push({ url, body }), { children: 80 }) },
  });
  const stats = await api.getMenuStatistics({
    ageGroupId: 2,
    date: '2026-11-09',
    children: '',
    items: [{ session: 'LUNCH', dishId: 10, dishName: 'Cơm' }],
  });
  assert.deepEqual(calls[0], {
    url: '/nutrition/menu-statistics',
    body: { ageGroupId: 2, date: '2026-11-09', items: [{ session: 'LUNCH', dishId: 10 }] },
  });
  assert.deepEqual(stats.ingredients, []);
});

test('API tất cả nhóm tuổi gửi null và giữ block của từng món', async () => {
  const calls = [];
  const api = createMealPlanApi({ client: { post: async (url, body) => (calls.push({ url, body }), { groups: [] }) } });
  await api.getMenuStatistics({
    ageGroupId: null,
    date: '2026-11-09',
    children: '',
    items: [{ session: 'LUNCH', block: 'NURSERY', dishId: 11 }],
  });
  assert.deepEqual(calls[0].body, {
    ageGroupId: null,
    date: '2026-11-09',
    items: [{ session: 'LUNCH', block: 'NURSERY', dishId: 11 }],
  });
});
