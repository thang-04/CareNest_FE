import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { planDayItems, templateDayItems, ageGroupOptions, statisticsHref } = await import('@/utils/menu-planning/menuStatistics');
const { createMealPlanApi } = await import('@/services/mealPlanApi');

const plan = {
  blocks: [
    { block: 'NURSERY', ageGroupIds: [1] },
    { block: 'KINDERGARTEN', ageGroupIds: [2, 3] },
  ],
  days: [
    {
      date: '2026-11-09',
      off: false,
      items: [
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: 10 },
        { session: 'LUNCH', block: 'NURSERY', dishId: 11 },
        { session: 'AFTERNOON', block: 'KINDERGARTEN', dishId: 12 },
      ],
    },
    { date: '2026-11-10', off: true, items: [{ session: 'LUNCH', block: 'KINDERGARTEN', dishId: 10 }] },
  ],
};

test('ngày của kế hoạch tuần chỉ gửi món thuộc khối của nhóm tuổi', () => {
  assert.deepEqual(planDayItems(plan, '2026-11-09', '3'), [
    { session: 'LUNCH', dishId: 10 },
    { session: 'AFTERNOON', dishId: 12 },
  ]);
  assert.deepEqual(planDayItems(plan, '2026-11-09', 1), [{ session: 'LUNCH', dishId: 11 }]);
});

test('ngày nghỉ, ngày ngoài tuần hoặc nhóm tuổi không thuộc khối nào ⇒ không gửi món', () => {
  assert.deepEqual(planDayItems(plan, '2026-11-10', 2), []);
  assert.deepEqual(planDayItems(plan, '2026-11-20', 2), []);
  assert.deepEqual(planDayItems(plan, '2026-11-09', 99), []);
});

test('bộ mẫu lấy món theo tuần và thứ', () => {
  const template = {
    items: [
      { weekNo: 2, weekday: 3, session: 'LUNCH', dishId: '7' },
      { weekNo: 2, weekday: 4, session: 'LUNCH', dishId: '8' },
      { weekNo: 1, weekday: 3, session: 'LUNCH', dishId: '9' },
    ],
  };
  assert.deepEqual(templateDayItems(template, '2', 3), [{ session: 'LUNCH', dishId: 7 }]);
});

test('nhóm tuổi lấy tên từ danh mục, link thống kê bỏ tham số trống', () => {
  assert.deepEqual(ageGroupOptions([2, 5], [{ id: 2, name: 'Mẫu giáo bé' }]), [
    { id: '2', name: 'Mẫu giáo bé' },
    { id: '5', name: 'Nhóm tuổi 5' },
  ]);
  assert.equal(
    statisticsHref({ week: '2026-11-09', date: '2026-11-10', template: null }),
    '/menu/statistics?week=2026-11-09&date=2026-11-10',
  );
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
