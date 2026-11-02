import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { canManageParentAccounts, hasBePermission } from '@/utils/account/accountPermissions';

const childKeys = (user) => (getMenuForRole(user.role, user).find((m) => m.key === 'children')?.children || []).map((c) => c.key);
const schoolKeys = (user) => (getMenuForRole(user.role, user).find((m) => m.key === 'school')?.children || []).map((c) => c.key);

test('Hiệu trưởng có mục Tài khoản phụ huynh và vào được màn (AUTH-18)', () => {
  const principal = { id: 'p', role: ROLES.PRINCIPAL, bePermissions: ['PARENT_ACCOUNT_MANAGE', 'PERMISSION_MANAGE'] };
  assert.ok(childKeys(principal).includes('parentActivation'));
  assert.equal(canManageParentAccounts(principal), true);
});

test('PHT bị Hiệu trưởng thu hồi PARENT_ACCOUNT_MANAGE: ẩn mục và route chặn', () => {
  const vp = { id: 'v', role: ROLES.VICE_PRINCIPAL, campusId: 'c1', bePermissions: ['CHILD_PROFILE_VIEW'] };
  assert.ok(!childKeys(vp).includes('parentActivation'));
  assert.equal(canManageParentAccounts(vp), false);
  const granted = { ...vp, bePermissions: ['CHILD_PROFILE_VIEW', 'PARENT_ACCOUNT_MANAGE'] };
  assert.equal(canManageParentAccounts(granted), true);
});

test('Ma trận quyền ẩn khi người dùng BE không có PERMISSION_MANAGE', () => {
  const principal = { id: 'p', role: ROLES.PRINCIPAL, bePermissions: ['PARENT_ACCOUNT_MANAGE'] };
  assert.ok(!schoolKeys(principal).includes('schoolRoles'));
});

test('chế độ mock (không có quyền BE): không lọc thêm, giữ menu theo vai trò; giáo viên không vào màn phụ huynh', () => {
  const principal = { id: 'p', role: ROLES.PRINCIPAL };
  assert.equal(hasBePermission(principal, 'PARENT_ACCOUNT_MANAGE'), true);
  assert.ok(schoolKeys(principal).includes('schoolRoles'));
  assert.equal(canManageParentAccounts({ id: 't', role: ROLES.TEACHER }), false);
  assert.equal(hasBePermission(null, 'PARENT_ACCOUNT_MANAGE'), false);
});
