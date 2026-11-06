import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { applyTemplateDay, dayBlockItemCount, itemsBySession, toTemplateRequest, toStatisticsItems } = await import(
  '@/utils/menu-planning/menuTemplateGrid'
);
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
