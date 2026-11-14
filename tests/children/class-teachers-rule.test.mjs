import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateClassTeachers } from '@/utils/school-config/schoolConfigValidation';

// BE SCH-04: năm đang học mỗi lớp đúng 2 giáo viên, có chủ nhiệm; năm sắp tới xếp dần
test('năm đang học: thiếu hoặc bỏ hết giáo viên báo lỗi ngay dưới ô', () => {
  assert.match(validateClassTeachers({ teacherIds: ['a'], homeroomTeacherId: 'a' }, { yearActive: true }).teacherIds, /đúng 2/);
  assert.match(validateClassTeachers({ teacherIds: [], homeroomTeacherId: '' }, { yearActive: true }).teacherIds, /đúng 2/);
  assert.equal(
    validateClassTeachers({ teacherIds: ['a', 'b'], homeroomTeacherId: '' }, { yearActive: true }).homeroomTeacherId,
    'Chọn giáo viên chủ nhiệm',
  );
  assert.deepEqual(validateClassTeachers({ teacherIds: ['a', 'b'], homeroomTeacherId: 'a' }, { yearActive: true }), {});
});

test('năm sắp tới: được xếp 1 giáo viên trước', () => {
  assert.deepEqual(validateClassTeachers({ teacherIds: ['a'], homeroomTeacherId: 'a' }), {});
});
