import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateClassTeachers } from '@/utils/school-config/schoolConfigValidation';

// BE SCH-04 (Cần chốt 18/11/2026): năm đang học mỗi lớp 2–3 giáo viên, có GV phụ trách chính; năm sắp tới xếp dần
test('năm đang học: thiếu hoặc bỏ hết giáo viên báo lỗi ngay dưới ô', () => {
  assert.match(
    validateClassTeachers({ teacherIds: ['a'], homeroomTeacherId: 'a' }, { yearActive: true }).teacherIds,
    /ít nhất 2 giáo viên đứng lớp/,
  );
  assert.match(
    validateClassTeachers({ teacherIds: [], homeroomTeacherId: '' }, { yearActive: true }).teacherIds,
    /ít nhất 2 giáo viên đứng lớp/,
  );
  assert.equal(
    validateClassTeachers({ teacherIds: ['a', 'b'], homeroomTeacherId: '' }, { yearActive: true }).homeroomTeacherId,
    'Chọn GV phụ trách chính',
  );
  assert.deepEqual(validateClassTeachers({ teacherIds: ['a', 'b'], homeroomTeacherId: 'a' }, { yearActive: true }), {});
});

test('năm sắp tới: được xếp 1 giáo viên trước', () => {
  assert.deepEqual(validateClassTeachers({ teacherIds: ['a'], homeroomTeacherId: 'a' }), {});
});

test('mỗi lớp tối đa 3 giáo viên; 3 cô có phụ trách chính là hợp lệ ở năm đang học', () => {
  assert.deepEqual(validateClassTeachers({ teacherIds: ['a', 'b', 'c'], homeroomTeacherId: 'b' }, { yearActive: true }), {});
  assert.match(
    validateClassTeachers({ teacherIds: ['a', 'b', 'c', 'd'], homeroomTeacherId: 'a' }, { yearActive: true }).teacherIds,
    /tối đa 3 giáo viên đứng lớp/,
  );
  assert.match(validateClassTeachers({ teacherIds: ['a', 'b', 'c', 'd'], homeroomTeacherId: 'a' }).teacherIds, /tối đa 3/);
});
