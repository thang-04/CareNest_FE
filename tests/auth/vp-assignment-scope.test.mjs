import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROLES } from '@/models/User';
import { canAssignTeachers } from '@/utils/school-config/schoolConfigPermissions';

// AUTH-20 (Cần chốt 11/11/2026): PHT phân công trong đúng phạm vi HT cấp — các cơ sở được phân công hoặc toàn trường
const vp = (locationIds, schoolWide = false) => ({
  role: ROLES.VICE_PRINCIPAL,
  campusId: locationIds[0],
  locationIds,
  bePermissions: ['STAFF_ASSIGNMENT_MANAGE'],
  beSchoolWidePermissions: schoolWide ? ['STAFF_ASSIGNMENT_MANAGE'] : [],
});

test('PHT phụ trách nhiều cơ sở phân công được ở mọi cơ sở mình phụ trách', () => {
  const user = vp(['1', '2']);
  assert.equal(canAssignTeachers('1', user), true);
  assert.equal(canAssignTeachers('2', user), true);
  assert.equal(canAssignTeachers('3', user), false);
});

test('PHT được cấp phân công toàn trường phân công ở cơ sở khác', () => {
  assert.equal(canAssignTeachers('3', vp(['1'], true)), true);
});

test('PHT không có quyền phân công thì không phân công được', () => {
  assert.equal(canAssignTeachers('1', { ...vp(['1']), bePermissions: [] }), false);
});
