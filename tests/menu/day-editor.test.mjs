import assert from 'node:assert/strict';
import { test } from 'node:test';

const { copyDay, dayBlockItems, setDayBlockItems } = await import('@/utils/menu-planning/mealPlanGrid');

const MON = '2026-11-16';
const TUE = '2026-11-17';
const item = (session, block, dishId, dishType = 'RICE') => ({ session, block, dishId, dishName: `Món ${dishId}`, dishType });
const draft = {
  days: [
    {
      date: MON,
      off: false,
      note: '',
      items: [item('LUNCH', 'KINDERGARTEN', '1'), item('SNACK_PM', 'KINDERGARTEN', '2'), item('LUNCH', 'NURSERY', '3')],
    },
    { date: TUE, off: false, note: '', items: [item('LUNCH', 'KINDERGARTEN', '9'), item('LUNCH', 'NURSERY', '8')] },
  ],
};

test('NUT-13: Chép ngày thay món của khối ở ngày đích, giữ món khối khác', () => {
  const next = copyDay(draft, MON, TUE, 'KINDERGARTEN');
  const tue = next.days[1];
  assert.deepEqual(
    dayBlockItems(tue, 'KINDERGARTEN').map((i) => [i.session, i.dishId]),
    [
      ['LUNCH', '1'],
      ['SNACK_PM', '2'],
    ],
  );
  assert.deepEqual(
    dayBlockItems(tue, 'NURSERY').map((i) => i.dishId),
    ['8'],
  );
  assert.deepEqual(next.days[0], draft.days[0], 'ngày nguồn không đổi');
});

test('NUT-08: Áp dụng món đã sửa trong modal chỉ ghi đè khối đang sửa', () => {
  const next = setDayBlockItems(draft, MON, 'NURSERY', [{ session: 'LUNCH', dishId: '5', dishName: 'Món 5', dishType: 'SOUP' }]);
  assert.deepEqual(
    next.days[0].items.map((i) => [i.block, i.dishId]),
    [
      ['KINDERGARTEN', '1'],
      ['KINDERGARTEN', '2'],
      ['NURSERY', '5'],
    ],
  );
});

test('NUT-13: Chép một ngày sang nhiều ngày (cả tuần) trong một lần', () => {
  const WED = '2026-11-18';
  const week = { days: [...draft.days, { date: WED, off: false, note: '', items: [] }] };
  const next = copyDay(week, MON, [TUE, WED], 'KINDERGARTEN');
  for (const day of next.days.slice(1)) {
    assert.deepEqual(
      dayBlockItems(day, 'KINDERGARTEN').map((i) => i.dishId),
      ['1', '2'],
    );
  }
  assert.deepEqual(
    dayBlockItems(next.days[1], 'NURSERY').map((i) => i.dishId),
    ['8'],
    'khối khác giữ nguyên',
  );
});
