import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// menuConfig nạp mock DB dùng localStorage/window: dựng bản giả trước khi import
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { getMenuForRole } = await import('@/layouts/menuConfig');
const { ROLES, ROLE_LABELS } = await import('@/models/User');
const { isSystemAdmin } = await import('@/utils/school-config/schoolConfigPermissions');
const { canManageOwnAccount } = await import('@/utils/account/accountPermissions');
const { toPrincipalPayload, validatePrincipalAccount } = await import('@/utils/school-config/staffImport');

const ADMIN = { id: '1', role: ROLES.ADMIN };
const paths = (role, user) =>
  getMenuForRole(role, user).flatMap((item) => [item.to, ...(item.children || []).map((child) => child.to)]).filter(Boolean);

test('Admin có màn Web: menu chỉ Tài khoản + Hồ sơ + Đổi mật khẩu, không màn nghiệp vụ trẻ', () => {
  assert.equal(ROLE_LABELS[ROLES.ADMIN], 'Quản trị hệ thống');
  const admin = paths(ROLES.ADMIN, ADMIN);
  assert.ok(admin.includes('/school/staff'));
  assert.ok(admin.includes('/account/profile'));
  assert.ok(admin.some((to) => to.includes('password')));
  assert.ok(!admin.some((to) => to.includes('signature')));
  assert.ok(!admin.includes('/'));
  assert.equal(admin.length, 3);
  assert.ok(isSystemAdmin(ADMIN));
  assert.ok(!isSystemAdmin({ role: ROLES.PRINCIPAL }));
  assert.ok(canManageOwnAccount(ADMIN));
});

test('Route Tài khoản nhân sự mở cho Admin; trang chủ Admin chuyển sang /school/staff', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.match(routes, /path="staff" element=\{only\(\[[^\]]*R\.ADMIN[^\]]*\]/);
  const home = readFileSync('src/pages/HomePage.jsx', 'utf8');
  assert.match(home, /ROLES\.ADMIN\) return <Navigate to="\/school\/staff"/);
});

test('Admin tạo Hiệu trưởng: form chỉ họ tên, SĐT, email; payload khóa vai trò PRINCIPAL, không gửi điểm trường', () => {
  assert.deepEqual(Object.keys(validatePrincipalAccount({ fullName: '', phone: '', email: '' })).sort(), ['fullName', 'phone']);
  assert.deepEqual(validatePrincipalAccount({ fullName: 'Nguyễn Văn A', phone: '0912345678', email: '' }), {});
  assert.ok(validatePrincipalAccount({ fullName: 'A', phone: '0912345678', email: 'sai' }).email);
  assert.deepEqual(toPrincipalPayload({ fullName: ' Nguyễn  Văn A ', phone: '+84 912 345 678', email: '' }), {
    phone: '0912345678',
    fullName: 'Nguyễn Văn A',
    email: null,
    role: ROLES.PRINCIPAL,
  });
});
