import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocked, workingTeacherCount } from '../../src/utils/school-config/classTeachers.js';

test('giáo viên bị khóa tài khoản không tính là còn đứng lớp', () => {
  const cls = { teacherIds: [1, 2], lockedTeacherIds: [2] };
  assert.equal(isLocked(cls, 2), true);
  assert.equal(workingTeacherCount(cls), 1);
  assert.equal(workingTeacherCount({ teacherIds: [1, 2] }), 2);
});
