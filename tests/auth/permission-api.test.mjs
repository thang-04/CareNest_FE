import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { AxiosError } from 'axios';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { permissionApi } = await import('@/services/account/api/permissionApi');
const { permissionFeatureLabel, permissionFeatures } = await import('@/utils/account/permissionMatrix');

// Dữ liệu giả theo DTO BE PermissionController / AccountController
const BE_CATALOG = [
  { code: 'CHILD_PROFILE_VIEW', module: 'child', description: 'Xem hồ sơ trẻ trong phạm vi', defaultRoles: [], configurableRoles: ['TEACHER'], campusScoped: false },
  { code: 'ACCOUNT_MANAGE', module: 'account', description: 'Cấp tài khoản', defaultRoles: [], configurableRoles: ['VICE_PRINCIPAL'], campusScoped: false },
  { code: 'STAFF_ASSIGNMENT_MANAGE', module: 'staff', description: 'Phân công', defaultRoles: [], configurableRoles: ['VICE_PRINCIPAL'], campusScoped: false },
  { code: 'PARENT_ACCOUNT_MANAGE', module: 'child', description: 'Tài khoản phụ huynh', defaultRoles: [], configurableRoles: ['VICE_PRINCIPAL'], campusScoped: false },
  { code: 'MEAL_COUNT_CONFIRM', module: 'meals', description: 'Xác nhận số suất', defaultRoles: [], configurableRoles: ['VICE_PRINCIPAL'], campusScoped: true },
  { code: 'PERMISSION_MANAGE', module: 'account', description: 'Quản lý phân quyền', defaultRoles: ['PRINCIPAL'], configurableRoles: [], campusScoped: false },
];
const account = (userId, role, campusId) => ({
  userId,
  username: `09000000${userId}`,
  fullName: `Nhân sự demo ${userId}`,
  email: null,
  role,
  status: 'ACTIVE',
  activeAssignments: campusId ? [{ staffRole: role, campusId, classroomId: null, ageGroupId: null }] : [],
});
const ACCOUNTS = {
  VICE_PRINCIPAL: [[account(2, 'VICE_PRINCIPAL', 1)]],
  TEACHER: [[account(3, 'TEACHER', 2)], [account(4, 'TEACHER', null)]],
};
const OVERRIDES = {
  2: [{ permission: 'MEAL_COUNT_CONFIRM', effect: 'GRANT', scope: 'SCHOOL', reason: 'Trực cả trường', updatedBy: 1, updatedAt: '2026-10-30T02:00:00Z' }],
  3: [],
  4: [{ permission: 'CHILD_PROFILE_VIEW', effect: 'REVOKE', scope: null, reason: 'Tạm nghỉ', updatedBy: 1, updatedAt: '2026-10-30T02:00:00Z' }],
};
const overridesView = (userId) => ({ userId, roles: [], configurablePermissions: [], overrides: OVERRIDES[userId], effectivePermissions: [] });

let calls;
let bodies;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });
const fail = (config, status, desc) => {
  throw new AxiosError(desc, AxiosError.ERR_BAD_REQUEST, config, null, {
    status,
    statusText: 'Error',
    headers: {},
    config,
    data: { code: status, desc, data: null },
  });
};

beforeEach(() => {
  calls = [];
  bodies = [];
  axiosClient.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    const query = config.params ? `?${new URLSearchParams(Object.entries(config.params).filter(([, v]) => v != null))}` : '';
    calls.push(`${method} ${config.url}${query}`);
    if (config.data) bodies.push(JSON.parse(config.data));
    if (config.url === '/permissions') return envelope(config, BE_CATALOG);
    if (config.url === '/campuses/options') return envelope(config, [{ id: 1, code: 'CS1', name: 'Điểm trường 1' }, { id: 2, code: 'CS2', name: 'Điểm trường 2' }]);
    if (config.url === '/accounts') {
      const pages = ACCOUNTS[config.params.role];
      return envelope(config, { items: pages[config.params.page], page: config.params.page, size: 100, totalElements: 0, totalPages: pages.length });
    }
    const override = config.url.match(/^\/accounts\/(\d+)\/permission-overrides$/);
    if (override && method === 'GET') return envelope(config, overridesView(Number(override[1])));
    if (override && method === 'PUT') return envelope(config, overridesView(Number(override[1])));
    if (config.url === '/role-permissions/TEACHER') return fail(config, 403, 'Bạn không có quyền thực hiện thao tác này');
    return envelope(config, { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  };
});

test('catalog BE thiếu feature/action/requires ⇒ gom theo nhóm FE, nhãn nhóm không phải mã thô', async () => {
  const catalog = await permissionApi.getPermissionCatalog();
  const byCode = Object.fromEntries(catalog.map((p) => [p.code, p]));

  assert.deepEqual(calls, ['GET /permissions']);
  assert.equal(byCode.CHILD_PROFILE_VIEW.action, 'VIEW');
  assert.equal(byCode.ACCOUNT_MANAGE.action, 'MANAGE');
  assert.equal(byCode.ACCOUNT_MANAGE.feature, byCode.STAFF_ASSIGNMENT_MANAGE.feature);
  assert.deepEqual(byCode.ACCOUNT_MANAGE.requires, []);
  for (const feature of permissionFeatures(catalog)) {
    assert.ok(!BE_CATALOG.some((p) => p.code === permissionFeatureLabel(feature, catalog)), `nhãn nhóm ${feature.key}`);
  }
});

test('danh sách nhân sự: đọc đủ các trang /accounts theo vai trò, SĐT từ username, tên điểm trường từ options', async () => {
  const { items } = await permissionApi.getPermissionStaff();

  assert.deepEqual(items.map((s) => s.userId), [2, 3, 4]);
  assert.deepEqual(items[0], {
    userId: 2,
    fullName: 'Nhân sự demo 2',
    role: 'VICE_PRINCIPAL',
    phone: '090000002',
    status: 'ACTIVE',
    campusName: 'Điểm trường 1',
  });
  assert.equal(items[2].campusName, null);
  assert.ok(calls.includes('GET /accounts?role=TEACHER&page=1&size=100'));
});

test('người có ngoại lệ: chỉ giữ nhân sự có override, kèm thông tin hiển thị', async () => {
  const result = await permissionApi.getAccountsWithOverrides();

  assert.deepEqual(result.map((r) => r.userId), [2, 4]);
  assert.equal(result[0].fullName, 'Nhân sự demo 2');
  assert.equal(result[1].overrides[0].effect, 'REVOKE');
});

test('lưu ngoại lệ: giữ scope SCHOOL đang có, mã mới để BE mặc định', async () => {
  await permissionApi.updatePermissionOverrides(2, {
    reason: 'Điều chỉnh',
    overrides: [
      { permission: 'MEAL_COUNT_CONFIRM', effect: 'GRANT' },
      { permission: 'ACCOUNT_MANAGE', effect: 'GRANT' },
    ],
  });

  assert.deepEqual(calls, ['GET /accounts/2/permission-overrides', 'PUT /accounts/2/permission-overrides']);
  assert.deepEqual(bodies[0], {
    reason: 'Điều chỉnh',
    overrides: [
      { permission: 'MEAL_COUNT_CONFIRM', effect: 'GRANT', scope: 'SCHOOL' },
      { permission: 'ACCOUNT_MANAGE', effect: 'GRANT', scope: null },
    ],
  });
});

test('lịch sử và quyền theo vai trò gọi đúng API; lỗi BE trả nguyên desc', async () => {
  await permissionApi.getPermissionChangeLogs({ targetRole: 'TEACHER', page: 1, size: 20 });
  await permissionApi.updateRolePermissions('VICE_PRINCIPAL', { permissions: ['ACCOUNT_MANAGE'], reason: 'Giao việc' });

  assert.deepEqual(calls, ['GET /permission-change-logs?targetRole=TEACHER&page=1&size=20', 'PUT /role-permissions/VICE_PRINCIPAL']);
  assert.deepEqual(bodies[0], { permissions: ['ACCOUNT_MANAGE'], reason: 'Giao việc' });
  await assert.rejects(permissionApi.updateRolePermissions('TEACHER', { permissions: [], reason: 'x' }), {
    status: 403,
    message: 'Bạn không có quyền thực hiện thao tác này',
  });
});
