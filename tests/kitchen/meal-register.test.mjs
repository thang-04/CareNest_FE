import assert from 'node:assert/strict';
import { test } from 'node:test';

const { dayRegister } = await import('@/utils/attendance/mealRegister');

const line = (classId, normal, substitute, missing = 0) => ({
  classId,
  className: classId,
  present: normal + substitute,
  absent: 1,
  missing,
  normal,
  substitute,
});

test('sổ báo ăn ngày: mỗi lớp một suất/ngày, bữa phụ chỉ của nhà trẻ không làm mất lớp mẫu giáo, không cộng dồn các bữa', () => {
  const morning = { session: 'MORNING', classes: [line('nt1', 10, 2)] };
  const lunch = { session: 'LUNCH', classes: [line('nt1', 10, 2), line('mg1', 20, 1, 3)] };
  const afternoon = { session: 'AFTERNOON', classes: [line('nt1', 10, 2), line('mg1', 20, 1, 3)] };
  const d = dayRegister([morning, lunch, afternoon]);
  assert.deepEqual(
    d.rows.map((r) => r.classId),
    ['nt1', 'mg1'],
  );
  assert.equal(d.servings, 33, '12 + 21, không nhân số bữa');
  assert.equal(d.substitute, 3);
  assert.equal(d.missing, 3);
});
