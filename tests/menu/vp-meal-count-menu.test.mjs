import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';

const keys = (user) => getMenuForRole(user.role, user).flatMap((e) => (e.children ? e.children.map((c) => c.key) : [e.key]));

test('PHT không có quyền xác nhận số suất: ẩn mục Sổ suất ăn', () => {
  const vp = { id: 'v', role: ROLES.VICE_PRINCIPAL, campusId: 'c1', bePermissions: ['ATTENDANCE_VIEW', 'MENU_MANAGE'] };
  assert.ok(!keys(vp).includes('mealCount'));
  assert.ok(keys({ ...vp, bePermissions: [...vp.bePermissions, 'MEAL_COUNT_CONFIRM'] }).includes('mealCount'));
});

test('Hiệu trưởng vẫn thấy Sổ suất ăn dù danh sách quyền BE không có mã xác nhận số suất', () => {
  const principal = { id: 'p', role: ROLES.PRINCIPAL, bePermissions: ['ATTENDANCE_VIEW'] };
  assert.ok(keys(principal).includes('mealCount'));
});
