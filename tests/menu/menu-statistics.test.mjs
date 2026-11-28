import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { allDayItems, planDayItems, templateDayItems, ageGroupOptions, statisticsHref, statisticsExportRows } = await import(
  '@/utils/menu-planning/menuStatistics'
);
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

test('tất cả nhóm tuổi giữ khối của từng món và không lấy món ngày nghỉ', () => {
  assert.deepEqual(allDayItems(plan, '2026-11-09'), [
    { session: 'LUNCH', block: 'KINDERGARTEN', dishId: 10 },
    { session: 'LUNCH', block: 'NURSERY', dishId: 11 },
    { session: 'AFTERNOON', block: 'KINDERGARTEN', dishId: 12 },
  ]);
  assert.deepEqual(allDayItems(plan, '2026-11-10'), []);
});

test('mẫu một ngày lấy đủ món của mẫu', () => {
  const template = {
    items: [
      { session: 'LUNCH', dishId: '7' },
      { session: 'AFTERNOON', dishId: '8' },
    ],
  };
  assert.deepEqual(templateDayItems(template), [
    { session: 'LUNCH', dishId: 7 },
    { session: 'AFTERNOON', dishId: 8 },
  ]);
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

test('Excel tất cả nhóm tuổi có KPI tổng và từng bảng thực phẩm riêng', () => {
  const rows = statisticsExportRows(
    {
      children: 5,
      totalCost: 8000,
      costPerChild: 1600,
      mealPrice: 30000,
      groups: [
        { ageGroupName: 'Mẫu giáo bé', children: 2, totalCost: 3000, ingredients: [{ foodName: 'Gạo', cost: 3000 }] },
        { ageGroupName: 'Mẫu giáo nhỡ', children: 3, totalCost: 5000, ingredients: [{ foodName: 'Sữa', cost: 5000 }] },
      ],
    },
    'Định lượng & đi chợ',
  );
  assert.ok(rows.some((row) => row.includes('Tổng toàn trường')));
  assert.ok(rows.some((row) => row.some((cell) => String(cell).includes('Mẫu giáo bé'))));
  assert.ok(rows.some((row) => row.some((cell) => String(cell).includes('Mẫu giáo nhỡ'))));
  assert.ok(rows.some((row) => row.includes('Gạo')));
  assert.ok(rows.some((row) => row.includes('Sữa')));
});
