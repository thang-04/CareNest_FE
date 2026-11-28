import assert from 'node:assert/strict';
import { test } from 'node:test';

const { addDish, removeDish, replaceDish, setDayNote, sharedSessions, syncSharedMeals } = await import(
  '@/utils/menu-planning/mealPlanGrid'
);

const DAY = '2026-11-09';
const draft = {
  days: [
    {
      date: DAY,
      off: false,
      note: '',
      items: [
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '1', dishName: 'Cơm tẻ', dishType: 'RICE' },
        { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '2', dishName: 'Canh bí', dishType: 'SOUP' },
        { session: 'LUNCH', block: 'NURSERY', dishId: '1', dishName: 'Cơm tẻ', dishType: 'RICE' },
      ],
    },
  ],
};

test('NUT-18: Thay món giữ đúng vị trí, chỉ đổi ô của khối và bữa đó', () => {
  const next = replaceDish(draft, DAY, 'KINDERGARTEN', 'LUNCH', '1', { id: 9, name: 'Cơm gạo lứt', type: 'RICE' });
  const items = next.days[0].items;
  assert.deepEqual(items[0], { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '9', dishName: 'Cơm gạo lứt', dishType: 'RICE' });
  assert.equal(items[1].dishId, '2');
  assert.equal(items[2].dishId, '1', 'khối nhà trẻ giữ nguyên');
});

test('NUT-18: Thay bằng món đã có trong ô thì không đổi gì', () => {
  const next = replaceDish(draft, DAY, 'KINDERGARTEN', 'LUNCH', '1', { id: 2, name: 'Canh bí', type: 'SOUP' });
  assert.deepEqual(next.days[0], draft.days[0]);
});

const plan = {
  blocks: [
    { block: 'NURSERY', sessions: ['MORNING', 'LUNCH', 'AFTERNOON'] },
    { block: 'KINDERGARTEN', sessions: ['LUNCH', 'AFTERNOON'] },
  ],
};
const dishIds = (d, block, session) => d.days[0].items.filter((i) => i.block === block && i.session === session).map((i) => i.dishId);
const synced = (fn, block, from = draft) => syncSharedMeals(from, fn(from), plan, block);

test('bữa chung là bữa cả hai khối cùng ăn', () => {
  assert.deepEqual(sharedSessions(plan, 'NURSERY', 'KINDERGARTEN'), ['LUNCH', 'AFTERNOON']);
});

test('đồng bộ: thêm món bữa chung ở một khối ghi đè ô cùng bữa của khối kia', () => {
  const next = synced((d) => addDish(d, DAY, 'NURSERY', 'LUNCH', { id: 3, name: 'Trứng', type: 'MAIN' }), 'NURSERY');
  assert.deepEqual(dishIds(next, 'NURSERY', 'LUNCH'), ['1', '3']);
  assert.deepEqual(dishIds(next, 'KINDERGARTEN', 'LUNCH'), ['1', '3'], 'món riêng của khối kia (Canh bí) bị ghi đè');
});

test('đồng bộ: đổi và xóa món cũng chép sang khối kia', () => {
  const replaced = synced(
    (d) => replaceDish(d, DAY, 'KINDERGARTEN', 'LUNCH', '2', { id: 9, name: 'Canh rau', type: 'SOUP' }),
    'KINDERGARTEN',
  );
  assert.deepEqual(dishIds(replaced, 'NURSERY', 'LUNCH'), ['1', '9']);
  const removed = synced((d) => removeDish(d, DAY, 'KINDERGARTEN', 'LUNCH', '1'), 'KINDERGARTEN');
  assert.deepEqual(dishIds(removed, 'NURSERY', 'LUNCH'), ['2']);
});

test('đồng bộ: bữa chỉ một khối ăn không chép; sửa không đổi món thì giữ nguyên khối kia', () => {
  const morning = synced((d) => addDish(d, DAY, 'NURSERY', 'MORNING', { id: 4, name: 'Cháo', type: 'OTHER' }), 'NURSERY');
  assert.deepEqual(dishIds(morning, 'KINDERGARTEN', 'MORNING'), []);
  assert.deepEqual(dishIds(morning, 'KINDERGARTEN', 'LUNCH'), ['1', '2']);
  const noted = synced((d) => setDayNote(d, DAY, 'ghi chú'), 'NURSERY');
  assert.deepEqual(noted.days[0].items, draft.days[0].items);
  assert.equal(noted.days[0].note, 'ghi chú');
});
