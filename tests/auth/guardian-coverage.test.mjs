import assert from 'node:assert/strict';
import { test } from 'node:test';

const { groupChildrenByClass, sortMissingFirst, NO_CLASS } = await import('@/utils/account/guardianCoverage');

const kid = (id, classroomId, guardianCount, fullName = `Bé ${id}`) => ({ id, fullName, classroomId, guardianCount });

test('AUTH-18: class coverage counts children with at least one parent account', () => {
  const groups = groupChildrenByClass(
    [kid(1, 10, 2), kid(2, 10, 0), kid(3, 20, 1), kid(4, null, 0), kid(5, 30, 1)],
    [
      { id: 10, name: 'Mầm 1' },
      { id: 20, name: 'Chồi 1' },
      { id: 99, name: 'Lớp trống' },
    ],
    (id) => `Lớp ${id}`,
  );
  assert.deepEqual(
    groups.map((g) => [g.id, g.name, g.total, g.withAccount, g.missing]),
    [
      ['10', 'Mầm 1', 2, 1, 1],
      ['20', 'Chồi 1', 1, 1, 0],
      [NO_CLASS, 'Chưa xếp lớp', 1, 0, 1],
      ['30', 'Lớp 30', 1, 1, 0],
    ],
  );
});

test('children without a parent account come first, then by name', () => {
  const sorted = sortMissingFirst([kid(1, 1, 1, 'An'), kid(2, 1, 0, 'Vy'), kid(3, 1, 0, 'Bảo')]);
  assert.deepEqual(
    sorted.map((c) => c.fullName),
    ['Bảo', 'Vy', 'An'],
  );
});
