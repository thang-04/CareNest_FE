import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { permissionMockRepository: repo, effectivePermissionsOf } = await import('@/services/account/mock/permissionMockRepository');
const { authMockRepository: auth, DEMO_PASSWORD } = await import('@/mocks/authMockRepository');
const { schoolConfigMockRepository: school } = await import('@/services/school-config/mock/schoolConfigMockRepository');
const { permissionMatrixRows } = await import('@/utils/account/permissionMatrix');
const { personPermissionRows, permissionDraftRows, overridesFromSwitches } = await import('@/utils/account/personPermissions');

let principal;
let teacher;
let vp;
beforeEach(async () => {
  resetDb();
  const users = readDb().users;
  principal = users.find((user) => user.role === 'PRINCIPAL');
  teacher = users.find((user) => user.role === 'TEACHER');
  vp = users.find((user) => user.role === 'VICE_PRINCIPAL');
  await school.getRolePermissions(principal);
});
const payload = (effect) => ({ overrides: [{ permission: 'CHILD_PROFILE_VIEW', effect }], reason: 'Kiểm tra dữ liệu demo độc lập' });
const protectedSnapshot = () =>
  structuredClone(
    Object.fromEntries(Object.entries(readDb()).filter(([key]) => !key.startsWith('permissionCenter') && key !== 'mockSeedVersions')),
  );
const rejectStatus = (status) => (error) => error.status === status;

test('UI mới nhận catalog, sáu vai trò và ma trận hai cột cấu hình', async () => {
  const catalog = await repo.getPermissionCatalog(principal);
  const roles = await repo.getRolePermissions(principal);
  assert.equal(roles.length, 6);
  assert.equal(catalog.length, 6);
  const rows = permissionMatrixRows(catalog, roles);
  assert.deepEqual(Object.keys(rows[0].cells), ['VICE_PRINCIPAL', 'TEACHER']);
  assert.equal(rows.find((row) => row.code === 'PERMISSION_MANAGE').cells.TEACHER.configurable, false);
});

test('lưu mặc định mới, lý do và lịch sử riêng; không ghi catalog legacy', async () => {
  const before = protectedSnapshot();
  await repo.updateRolePermissions('TEACHER', { permissions: [], reason: 'Demo tắt quyền' }, principal);
  const role = (await repo.getRolePermissions(principal)).find((row) => row.role === 'TEACHER');
  assert.deepEqual(role.permissions, []);
  const log = (await repo.getPermissionChangeLogs({}, principal)).items[0];
  assert.equal(log.beforeState, 'ON');
  assert.equal(log.afterState, 'OFF');
  assert.equal(log.reason, 'Demo tắt quyền');
  assert.deepEqual(protectedSnapshot(), before);
});

test('ngoại lệ GRANT/REVOKE, đặt lại và lịch sử tài khoản demo', async () => {
  const before = protectedSnapshot();
  await repo.updatePermissionOverrides(teacher.id, payload('REVOKE'), principal);
  assert.deepEqual((await repo.getPermissionOverrides(teacher.id, principal)).effectivePermissions, []);
  assert.equal((await repo.getAccountsWithOverrides(principal))[0].userId, teacher.id);
  await repo.updatePermissionOverrides(teacher.id, { overrides: [], reason: 'Demo đặt lại' }, principal);
  assert.equal((await repo.getAccountsWithOverrides(principal)).length, 0);
  assert.ok((await repo.getPermissionOverrides(teacher.id, principal)).effectivePermissions.includes('CHILD_PROFILE_VIEW'));
  const logs = await repo.getPermissionChangeLogs({ targetUserId: teacher.id }, principal);
  assert.equal(logs.totalElements, 2);
  assert.equal(logs.items[0].afterState, 'INHERIT');
  assert.deepEqual(protectedSnapshot(), before);
});

test('chặn role không phải Principal dù gửi permissions giả', async () => {
  for (const role of ['VICE_PRINCIPAL', 'TEACHER', 'TEAM_LEADER', 'KITCHEN_STAFF', 'ADMIN', 'PARENT']) {
    const actor = { ...vp, role, permissions: ['PERMISSION_MANAGE'] };
    await assert.rejects(repo.getPermissionCatalog(actor), rejectStatus(403));
    await assert.rejects(repo.getPermissionStaff(actor), rejectStatus(403));
    await assert.rejects(repo.updateRolePermissions('TEACHER', { permissions: [], reason: 'Demo' }, actor), rejectStatus(403));
  }
});

test('không tự map tổ trưởng sang giáo viên hoặc đưa vào danh sách chỉnh sửa', async () => {
  const leader = readDb().users.find((row) => row.role === 'TEAM_LEADER');
  assert.ok(leader);
  assert.deepEqual(effectivePermissionsOf(readDb(), leader), []);
  assert.ok(!(await repo.getPermissionStaff(principal)).items.some((row) => row.userId === leader.id));
  await assert.rejects(repo.updatePermissionOverrides(leader.id, payload('GRANT'), principal), rejectStatus(403));
  assert.equal(readDb().users.find((row) => row.id === leader.id).role, 'TEAM_LEADER');
});

test('không tự sửa quyền mình và không giao quyền quản lý phân quyền', async () => {
  await assert.rejects(repo.updatePermissionOverrides(principal.id, payload('GRANT'), principal), rejectStatus(400));
  await assert.rejects(repo.updateRolePermissions('PRINCIPAL', { permissions: [], reason: 'Demo' }, principal), rejectStatus(403));
  await assert.rejects(
    repo.updateRolePermissions('TEACHER', { permissions: ['PERMISSION_MANAGE'], reason: 'Demo' }, principal),
    rejectStatus(400),
  );
});

test('lý do rỗng/quá dài không được lưu', async () => {
  for (const reason of ['', ' ', 'x'.repeat(501)]) {
    await assert.rejects(repo.updatePermissionOverrides(teacher.id, { ...payload('GRANT'), reason }, principal), rejectStatus(400));
  }
});

test('payload quyền sai, effect sai, quyền lặp bị từ chối và rollback', async () => {
  await repo.getRolePermissions(principal);
  const before = structuredClone(readDb());
  for (const overrides of [
    null,
    [{ permission: 'CHILD_PROFILE_VIEW', effect: 'UNKNOWN' }],
    [{ permission: 'UNKNOWN', effect: 'GRANT' }],
    [payload('GRANT').overrides[0], payload('REVOKE').overrides[0]],
    [null],
  ]) {
    await assert.rejects(repo.updatePermissionOverrides(teacher.id, { overrides, reason: 'Demo' }, principal), rejectStatus(400));
  }
  await assert.rejects(repo.updateRolePermissions('TEACHER', { permissions: null, reason: 'Demo' }, principal), rejectStatus(400));
  assert.deepEqual(readDb(), before);
});

test('tài khoản không tồn tại trả 404', async () => {
  await assert.rejects(repo.getPermissionOverrides('missing-demo', principal), rejectStatus(404));
  await assert.rejects(repo.updatePermissionOverrides('missing-demo', payload('GRANT'), principal), rejectStatus(404));
});

test('không seed lại mảng quyền demo đã chủ động lưu rỗng', async () => {
  writeDb((db) => {
    db.permissionCenterRoleRows = [];
    db.permissionCenterOverrides = [];
    db.permissionCenterChangeLogs = [];
  });
  await repo.getRolePermissions(principal);
  await repo.getRolePermissions(principal);
  assert.deepEqual(readDb().permissionCenterRoleRows, []);
});

test('refresh phiên vẫn trả permissions object và scope/phân công cũ', async () => {
  const session = await auth.login({ email: vp.email, password: DEMO_PASSWORD, remember: false });
  const before = await auth.me(session.accessToken);
  await repo.updateRolePermissions('VICE_PRINCIPAL', { permissions: [], reason: 'Demo độc lập' }, principal);
  await repo.updatePermissionOverrides(vp.id, payload('GRANT'), principal);
  const after = await auth.me(session.accessToken);
  assert.ok(!Array.isArray(after.permissions));
  assert.deepEqual(after, before);
});

test('phân trang và lọc lịch sử không trộn role/tài khoản', async () => {
  for (let i = 0; i < 3; i += 1) await repo.updatePermissionOverrides(teacher.id, payload(i % 2 ? 'GRANT' : 'REVOKE'), principal);
  const page = await repo.getPermissionChangeLogs({ targetUserId: teacher.id, page: 1, size: 2 }, principal);
  assert.equal(page.totalElements, 3);
  assert.equal(page.items.length, 1);
  assert.equal(page.totalPages, 2);
  await assert.rejects(repo.getPermissionChangeLogs({ targetRole: 'TEACHER', targetUserId: teacher.id }, principal), rejectStatus(400));
  await assert.rejects(repo.getPermissionChangeLogs({ page: -1 }, principal), rejectStatus(400));
});

test('danh sách chọn nhân sự chỉ có field cần thiết, không có mật khẩu hoặc dữ liệu trẻ', async () => {
  const data = await repo.getPermissionStaff(principal);
  assert.ok(data.items.length > 0);
  for (const row of data.items) {
    assert.ok(['VICE_PRINCIPAL', 'TEACHER'].includes(row.role));
    assert.deepEqual(Object.keys(row).sort(), ['userId', 'fullName', 'role', 'phone', 'status', 'campusName'].sort());
  }
});

test('helper công tắc chỉ tạo ngoại lệ khác mặc định', () => {
  const rows = personPermissionRows({ configurable: ['A', 'B'], roleDefaults: ['A'] });
  assert.deepEqual(overridesFromSwitches(rows, { A: true, B: false }), []);
  assert.deepEqual(overridesFromSwitches(rows, { A: false, B: true }), [
    { permission: 'A', effect: 'REVOKE' },
    { permission: 'B', effect: 'GRANT' },
  ]);
});

test('đường sidebar cũ mở UI mới, không có endpoint API giả hoặc sửa auth', () => {
  const routes = readFileSync(new URL('../../../src/routes/AppRoutes.jsx', import.meta.url), 'utf8');
  assert.match(routes, /path="roles" element=\{only\(\[R.PRINCIPAL\], <RoleDefaultsPage/);
  assert.match(routes, /path="overrides"/);
  const facade = readFileSync(new URL('../../../src/services/account/permissionService.js', import.meta.url), 'utf8');
  assert.match(facade, /status: 501/);
  assert.doesNotMatch(facade, /permissionApi|axios|fetch\(/);
});

test('wizard 2→3→2→3 giữ payload và giữ được draft reset rỗng', () => {
  const view = { configurablePermissions: ['A', 'B'], overrides: [{ permission: 'A', effect: 'REVOKE' }] };
  const rows = permissionDraftRows(view, ['A'], undefined);
  const payload = overridesFromSwitches(rows, { A: false, B: true });
  const back = permissionDraftRows(view, ['A'], payload);
  assert.deepEqual(overridesFromSwitches(back, Object.fromEntries(back.map((row) => [row.code, row.on]))), payload);
  const reset = permissionDraftRows(view, ['A'], []);
  assert.equal(reset.find((row) => row.code === 'A').on, true);
  assert.deepEqual(overridesFromSwitches(reset, { A: true, B: false }), []);
});
