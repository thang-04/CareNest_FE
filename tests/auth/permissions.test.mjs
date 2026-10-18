import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { normalizeAccountProfile } = await import('@/services/authProfile');
const { getMenuForRole } = await import('@/layouts/menuConfig');
const { permissionMockRepository: repo, effectivePermissionsOf } = await import(
  '@/services/account/mock/permissionMockRepository'
);
const { readDb } = await import('@/mocks/mockDatabase');

const HT = { id: 'u_hung', role: 'PRINCIPAL', permissions: ['CHILD_PROFILE_VIEW', 'PERMISSION_MANAGE'] };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', permissions: ['CHILD_PROFILE_VIEW'] };
const TEACHER_ID = 'u_minhanh';
const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const keysOf = (role, permissions) =>
  getMenuForRole(role, (code) => permissions.includes(code)).flatMap((m) => (m.children || []).map((c) => c.key));

beforeEach(() => values.clear());

test('profile keeps BE permissions and defaults to none when missing', () => {
  const user = normalizeAccountProfile({ userId: 3, roles: ['TEACHER'], permissions: ['CHILD_PROFILE_VIEW', 'CHILD_PROFILE_VIEW'] });
  assert.deepEqual(user.permissions, ['CHILD_PROFILE_VIEW']);
  assert.deepEqual(normalizeAccountProfile({ userId: 3, roles: ['TEACHER'] }).permissions, []);
});

test('management hub is one entry; staff permission controls its tab rather than the menu entry', () => {
  assert.ok(keysOf('PRINCIPAL', ['PERMISSION_MANAGE']).includes('peopleHub'));
  assert.ok(keysOf('PRINCIPAL', ['STAFF_ASSIGNMENT_MANAGE']).includes('peopleHub'));
  assert.ok(keysOf('PRINCIPAL', ['PERMISSION_MANAGE']).includes('permissions'), 'Hiệu trưởng có PERMISSION_MANAGE thấy mục Phân quyền');
  assert.ok(!keysOf('PRINCIPAL', []).includes('permissions'), 'Không có PERMISSION_MANAGE thì ẩn mục Phân quyền');
  assert.ok(!keysOf('PRINCIPAL', ['PERMISSION_MANAGE']).includes('schoolRoles'), 'mục cũ đã gộp');
  assert.ok(keysOf('PRINCIPAL', []).includes('schoolYears'), 'items without permission stay');
});

test('AUTH-11: only PERMISSION_MANAGE opens the matrix; fixed roles cannot be edited', async () => {
  await rejects(repo.getRolePermissions(VP), 403);
  const roles = await repo.getRolePermissions(HT);
  assert.deepEqual(
    roles.filter((r) => r.editable).map((r) => r.role),
    ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'],
  );
  await rejects(repo.updateRolePermissions('PRINCIPAL', { permissions: [], reason: 'x' }, HT), 403);
  await rejects(repo.updateRolePermissions('TEACHER', { permissions: ['PERMISSION_MANAGE'], reason: 'x' }, HT), 400);
  await rejects(repo.updateRolePermissions('TEACHER', { permissions: [], reason: '  ' }, HT), 400);
});

test('AUTH-10/14: turning a role permission off takes effect for its users and is logged', async () => {
  const teacher = readDb().users.find((u) => u.id === TEACHER_ID);
  assert.ok(effectivePermissionsOf(readDb(), teacher).includes('CHILD_PROFILE_VIEW'));

  await repo.updateRolePermissions('TEACHER', { permissions: [], reason: 'Thử tắt' }, HT);

  assert.ok(!effectivePermissionsOf(readDb(), teacher).includes('CHILD_PROFILE_VIEW'));
  const logs = await repo.getPermissionChangeLogs({ targetRole: 'TEACHER' }, HT);
  assert.equal(logs.totalElements, 1);
  assert.equal(logs.items[0].beforeState, 'ON');
  assert.equal(logs.items[0].afterState, 'OFF');
});

test('AUTH-10/12: user override revokes one teacher only; self and principal targets are rejected', async () => {
  await repo.updatePermissionOverrides(
    TEACHER_ID,
    { overrides: [{ permission: 'CHILD_PROFILE_VIEW', effect: 'REVOKE' }], reason: 'Tạm dừng' },
    HT,
  );
  const view = await repo.getPermissionOverrides(TEACHER_ID, HT);
  assert.deepEqual(view.effectivePermissions, []);
  assert.equal(view.overrides[0].effect, 'REVOKE');

  await rejects(repo.updatePermissionOverrides('u_hung', { overrides: [], reason: 'x' }, HT), 400);
  await rejects(
    repo.updatePermissionOverrides('u_hung', { overrides: [], reason: 'x' }, { ...HT, id: 'other_principal' }),
    403,
  );
});

test('AUTH-10: getAccountsWithOverrides lists staff who have custom overrides', async () => {
  await repo.updatePermissionOverrides(
    TEACHER_ID,
    { overrides: [{ permission: 'CHILD_PROFILE_VIEW', effect: 'REVOKE' }], reason: 'Ngoại lệ riêng' },
    HT,
  );
  const accountsWithOverrides = await repo.getAccountsWithOverrides(HT);
  assert.ok(accountsWithOverrides.length > 0);
  const found = accountsWithOverrides.find((a) => a.userId === TEACHER_ID);
  assert.ok(found);
  assert.equal(found.overrides[0].effect, 'REVOKE');
});
