import assert from 'node:assert/strict';
import { test } from 'node:test';

const { permissionMatrixRows } = await import('@/utils/account/permissionMatrix');

test('matrix shows every catalog permission and locks roles the BE marks non-configurable', () => {
  const catalog = [
    { code: 'CHILD_PROFILE_VIEW', module: 'child', description: 'Xem hồ sơ trẻ', configurableRoles: ['VICE_PRINCIPAL', 'TEACHER'] },
    { code: 'ACCOUNT_MANAGE', module: 'account', description: 'Quản lý tài khoản', configurableRoles: ['VICE_PRINCIPAL'] },
    { code: 'PERMISSION_MANAGE', module: 'account', description: 'Quản lý phân quyền', configurableRoles: [] },
  ];
  const roles = [
    {
      role: 'VICE_PRINCIPAL',
      editable: true,
      configurablePermissions: ['CHILD_PROFILE_VIEW', 'ACCOUNT_MANAGE'],
      permissions: ['CHILD_PROFILE_VIEW', 'ACCOUNT_MANAGE'],
    },
    { role: 'TEACHER', editable: true, configurablePermissions: ['CHILD_PROFILE_VIEW'], permissions: [] },
  ];
  const rows = permissionMatrixRows(catalog, roles);
  assert.deepEqual(
    rows.map((row) => row.code),
    catalog.map((permission) => permission.code),
  );
  assert.deepEqual(rows[0].cells, {
    VICE_PRINCIPAL: { configurable: true, checked: true },
    TEACHER: { configurable: true, checked: false },
  });
  assert.deepEqual(rows[1].cells, {
    VICE_PRINCIPAL: { configurable: true, checked: true },
    TEACHER: { configurable: false, checked: false },
  });
  assert.deepEqual(rows[2].cells, {
    VICE_PRINCIPAL: { configurable: false, checked: false },
    TEACHER: { configurable: false, checked: false },
  });
});
