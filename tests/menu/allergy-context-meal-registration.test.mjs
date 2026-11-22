import assert from 'node:assert/strict';
import { test } from 'node:test';

const { allergyContext } = await import('@/utils/menu-planning/menuCalculations');

const classes = [{ id: 'c1', name: 'Lớp mẫu', campusId: 'cp1', ageGroupId: 'ag-3' }];

test('dị ứng của trẻ không báo ăn không vào allergyContext', () => {
  const children = [
    { id: 'a', classId: 'c1', status: 'ACTIVE', allergies: ['Tôm'] },
    { id: 'b', classId: 'c1', status: 'ACTIVE', allergies: ['Tôm', 'Trứng'], mealRegistered: false },
    { id: 'c', classId: 'c1', status: 'ACTIVE', allergies: ['Cá'], mealRegistered: true },
  ];
  const rows = allergyContext(classes, children);
  assert.deepEqual(
    rows.map((r) => [r.allergen, r.childCount]),
    [
      ['Tôm', 1],
      ['Cá', 1],
    ],
  );
});
