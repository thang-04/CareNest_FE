import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const {
  applyTemplateDay,
  dayBlockItemCount,
  dayCounts,
  dayItems,
  hasTemplateDays,
  itemsBySession,
  templateItemsForDate,
  toTemplateRequest,
  toStatisticsItems,
} = await import('@/utils/menu-planning/menuTemplateGrid');
const { createMenuTemplateApi } = await import('@/services/menuTemplateApi');

const template = {
  block: 'KINDERGARTEN',
  items: [
    { session: 'LUNCH', dishId: 10, dishName: 'Cơm', dishType: 'CARB' },
    { session: 'AFTERNOON', dishId: 20, dishName: 'Sữa', dishType: 'SNACK' },
  ],
};

test('NUT-13: mẫu một ngày điền vào đúng ngày — thay món khối mẫu, giữ khối khác, ngày nghỉ không đổi', () => {
  const plan = {
    days: ['2026-11-16', '2026-11-17', '2026-11-18'].map((date, i) => ({
      date,
      off: i === 2,
      note: '',
      items: [
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '99', dishName: 'Cũ', dishType: 'MAIN' },
        { session: 'LUNCH', block: 'NURSERY', dishId: '88', dishName: 'Cháo', dishType: 'CARB' },
      ],
    })),
  };
  assert.equal(dayBlockItemCount(plan, '2026-11-16', 'KINDERGARTEN'), 1);
  const out = applyTemplateDay(plan, '2026-11-16', template);
  assert.deepEqual(
    out.days[0].items.map((i) => `${i.block}:${i.dishId}`),
    ['NURSERY:88', 'KINDERGARTEN:10', 'KINDERGARTEN:20'],
  );
  assert.equal(out.days[1], plan.days[1], 'ngày khác giữ nguyên');
  assert.equal(applyTemplateDay(plan, '2026-11-18', template).days[2], plan.days[2], 'ngày nghỉ giữ nguyên');
});

test('mẫu ngày: gom theo bữa, body lưu và body thống kê chỉ mang bữa + món', () => {
  assert.deepEqual(Object.keys(itemsBySession(template.items)), ['LUNCH', 'AFTERNOON']);
  assert.deepEqual(toTemplateRequest({ name: ' Mẫu A ', seasonLabel: '', block: 'KINDERGARTEN', items: template.items }), {
    name: 'Mẫu A',
    seasonLabel: '',
    block: 'KINDERGARTEN',
    items: [
      { session: 'LUNCH', dishId: 10 },
      { session: 'AFTERNOON', dishId: 20 },
    ],
  });
  assert.deepEqual(toStatisticsItems(template.items)[1], { session: 'AFTERNOON', dishId: 20 });
});

test('bộ 4 tuần: lọc món theo ngày, body lưu giữ weekNo + weekday của từng món', () => {
  const items = [
    { weekNo: 1, weekday: 1, session: 'LUNCH', dishId: '10' },
    { weekNo: 1, weekday: 2, session: 'LUNCH', dishId: '11' },
    { weekNo: 2, weekday: 1, session: 'LUNCH', dishId: '12' },
  ];
  assert.equal(hasTemplateDays(items), true);
  assert.equal(hasTemplateDays(template.items), false);
  assert.deepEqual(
    dayItems(items, { weekNo: 1, weekday: 2 }).map((i) => i.dishId),
    ['11'],
  );
  assert.equal(dayItems(template.items, null).length, template.items.length, 'không chọn ngày thì giữ nguyên');
  assert.deepEqual(dayCounts(items), { '1-1': 1, '1-2': 1, '2-1': 1 });
  assert.deepEqual(toTemplateRequest({ name: 'Bộ', block: 'NURSERY', items }).items[1], {
    weekNo: 1,
    weekday: 2,
    session: 'LUNCH',
    dishId: '11',
  });
});

test('bộ 4 tuần: điền vào ngày kế hoạch lấy Tuần 1 cùng thứ, thứ chưa có món thì rỗng', () => {
  const bo = {
    block: 'KINDERGARTEN',
    items: [
      { weekNo: 1, weekday: 1, session: 'LUNCH', dishId: 10, dishName: 'A' },
      { weekNo: 1, weekday: 2, session: 'LUNCH', dishId: 11, dishName: 'B' },
      { weekNo: 2, weekday: 1, session: 'LUNCH', dishId: 12, dishName: 'C' },
    ],
  };
  // 2026-11-16 là Thứ Hai, 2026-11-17 Thứ Ba, 2026-11-18 Thứ Tư
  assert.deepEqual(
    templateItemsForDate(bo, '2026-11-16').map((i) => i.dishId),
    [10],
  );
  assert.deepEqual(
    templateItemsForDate(bo, '2026-11-17').map((i) => i.dishId),
    [11],
  );
  assert.deepEqual(templateItemsForDate(bo, '2026-11-18'), []);
  assert.equal(templateItemsForDate(template, '2026-11-16').length, template.items.length, 'mẫu một ngày giữ nguyên');
  const plan = { days: [{ date: '2026-11-17', off: false, items: [] }] };
  assert.deepEqual(
    applyTemplateDay(plan, '2026-11-17', bo).days[0].items.map((i) => i.dishId),
    ['11'],
  );
});

test('API bộ mẫu: tạo POST, sửa PUT, ngừng dùng PATCH status, lọc bỏ tham số trống', async () => {
  const calls = [];
  const client = Object.fromEntries(
    ['get', 'post', 'put', 'patch'].map((m) => [
      m,
      async (url, a) => {
        calls.push([m, url, a]);
        return m === 'get' && url === '/nutrition/menu-templates' ? [{ id: 1 }] : { id: 1, items: null };
      },
    ]),
  );
  const api = createMenuTemplateApi({ client });
  assert.deepEqual(await api.listTemplates({ block: 'NURSERY', status: '' }), [{ id: 1, sessions: [], items: [] }]);
  await api.saveTemplate(null, { name: 'A' });
  await api.saveTemplate(5, { name: 'A' });
  await api.setTemplateStatus(5, 'INACTIVE');
  assert.deepEqual(
    calls.map(([m, url, a]) => [m, url, a]),
    [
      ['get', '/nutrition/menu-templates', { params: { block: 'NURSERY' } }],
      ['post', '/nutrition/menu-templates', { name: 'A' }],
      ['put', '/nutrition/menu-templates/5', { name: 'A' }],
      ['patch', '/nutrition/menu-templates/5/status', { status: 'INACTIVE' }],
    ],
  );
});

test('loại mẫu suy từ các ngày có món; mẫu ngày điền được vào mọi thứ', async () => {
  const { templateKind, templateItemsForDate } = await import('../../src/utils/menu-planning/menuTemplateGrid.js');
  const item = (weekNo, weekday) => ({ weekNo, weekday, session: 'LUNCH', dishId: 1 });
  assert.equal(templateKind([item(1, 1)]), 'DAY');
  assert.equal(templateKind([item(1, 1), item(1, 2)]), 'WEEK');
  assert.equal(templateKind([item(1, 1), item(2, 1)]), 'MONTH');
  assert.equal(templateItemsForDate({ items: [item(1, 1)] }, '2026-11-11').length, 1);
  assert.equal(templateItemsForDate({ items: [item(1, 1), item(1, 2)] }, '2026-11-11').length, 0);
});

test('tên gợi ý của bản sao thêm hậu tố và cắt vừa 100 ký tự', async () => {
  const { copyTemplateName } = await import('../../src/utils/menu-planning/menuTemplateGrid.js');
  assert.equal(copyTemplateName('Mùa thu'), 'Mùa thu (bản sao)');
  const long = copyTemplateName('x'.repeat(100));
  assert.equal(long.length, 100);
  assert.ok(long.endsWith('(bản sao)'));
});
