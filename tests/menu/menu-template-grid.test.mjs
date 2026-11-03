import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { weekDraft, applyWeekDraft, toTemplateRequest, weekItemCounts, copyTemplateWeek } = await import(
  '@/utils/menu-planning/menuTemplateGrid'
);
const { createMenuTemplateApi } = await import('@/services/menuTemplateApi');

const items = [
  { weekNo: 1, weekday: 1, session: 'LUNCH', dishId: '10', dishName: 'Cơm', dishType: 'CARB' },
  { weekNo: 1, weekday: 3, session: 'AFTERNOON', dishId: '20', dishName: 'Sữa', dishType: 'SNACK' },
  { weekNo: 2, weekday: 5, session: 'LUNCH', dishId: '30', dishName: 'Canh', dishType: 'SOUP' },
];

test('tuần của bộ mẫu ⇄ bản nháp 5 ngày: đọc đúng ô, ghi lại chỉ thay tuần đó', () => {
  const draft = weekDraft(items, 1, 'KINDERGARTEN');
  assert.equal(draft.days.length, 5);
  assert.deepEqual(
    draft.days.map((d) => d.items.map((i) => i.dishId)),
    [['10'], [], ['20'], [], []],
  );
  draft.days[1].items.push({ session: 'LUNCH', block: 'KINDERGARTEN', dishId: '40', dishName: 'Cá', dishType: 'MAIN' });
  const next = applyWeekDraft(items, 1, draft);
  assert.deepEqual(weekItemCounts(next), { 1: 3, 2: 1, 3: 0, 4: 0 });
  assert.ok(next.some((i) => i.weekNo === 1 && i.weekday === 2 && i.dishId === '40'));
  assert.deepEqual(toTemplateRequest({ name: ' Bộ A ', seasonLabel: '', block: 'KINDERGARTEN', items: next }).items[0], {
    weekNo: 2,
    weekday: 5,
    session: 'LUNCH',
    dishId: '30',
  });
});

test('NUT-13: sao tuần của bộ vào bản nháp — thay món khối bộ mẫu, giữ khối khác và ngày nghỉ', () => {
  const plan = {
    days: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((date, i) => ({
      date,
      off: i === 2,
      note: '',
      items: [
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '99', dishName: 'Cũ', dishType: 'MAIN' },
        { session: 'LUNCH', block: 'NURSERY', dishId: '88', dishName: 'Cháo', dishType: 'CARB' },
      ],
    })),
  };
  const out = copyTemplateWeek(plan, { block: 'KINDERGARTEN', items }, 1);
  assert.deepEqual(
    out.days[0].items.map((i) => `${i.block}:${i.dishId}`),
    ['NURSERY:88', 'KINDERGARTEN:10'],
  );
  assert.deepEqual(out.days[1].items, [{ session: 'LUNCH', block: 'NURSERY', dishId: '88', dishName: 'Cháo', dishType: 'CARB' }]);
  assert.equal(out.days[2], plan.days[2], 'ngày nghỉ giữ nguyên');
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
