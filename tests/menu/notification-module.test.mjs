import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { activeSettingsTab, settingsTabsFor } from '@/pages/announcement/notificationSettingsTabs.mjs';
import { ROLES } from '@/models/User';
import { alignCrumbs, menuEntryFor } from '@/utils/menuBreadcrumb';

const personal = ['/notifications'];
const management = ['/announcements', '/notification-settings'];
// Ba danh sách cấu hình đã gộp vào /notification-settings; đường dẫn cũ chỉ còn là chuyển hướng, không còn là mục menu.
const retired = ['/announcement-templates', '/notification-rules', '/announcement-schedules'];

// Admin quản trị kỹ thuật chỉ có Tài khoản + Hồ sơ + Đổi mật khẩu (BUG-005), không có nhóm Thông báo
const BUSINESS_ROLES = Object.values(ROLES).filter((role) => role !== ROLES.ADMIN);

test('Admin không có nhóm Thông báo nghiệp vụ', () => {
  assert.ok(!getMenuForRole(ROLES.ADMIN, { role: ROLES.ADMIN }).some((entry) => entry.key === 'notifications'));
});

test('mọi role có đúng một nhóm Thông báo, các trang con giữ đúng quyền hiện có', () => {
  for (const role of BUSINESS_ROLES) {
    const menu = getMenuForRole(role, { role });
    const groups = menu.filter((entry) => entry.key === 'notifications');
    assert.equal(groups.length, 1, role);
    assert.equal(groups[0].label, 'Thông báo');
    const expected = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(role) ? [...personal, ...management] : personal;
    assert.deepEqual(
      groups[0].children.map((child) => child.to),
      expected,
      role,
    );
    assert.equal(groups[0].children[0].label, 'Thông báo của tôi');
    assert.ok(!menu.some((entry) => [...personal, ...management, ...retired].includes(entry.to)), role);
    const paths = menu.flatMap((entry) => (entry.children ? entry.children.map((child) => child.to) : [entry.to]));
    for (const path of [...personal, ...management, ...retired]) {
      assert.equal(paths.filter((value) => value === path).length, expected.includes(path) ? 1 : 0, `${role}: ${path}`);
    }
  }
});

test('nhóm Thông báo giữ mục cá nhân khi tài khoản BE không có quyền quản trị nghiệp vụ', () => {
  for (const role of BUSINESS_ROLES) {
    const group = getMenuForRole(role, { role, bePermissions: [] }).find((entry) => entry.key === 'notifications');
    assert.ok(
      group.children.some((child) => child.to === '/notifications'),
      role,
    );
    if (![ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(role)) {
      assert.deepEqual(
        group.children.map((child) => child.to),
        personal,
        role,
      );
    }
  }
});

test('trang chi tiết, soạn, sửa và các mục quản trị chọn đúng mục con trong nhóm Thông báo', () => {
  const menu = getMenuForRole(ROLES.PRINCIPAL, { role: ROLES.PRINCIPAL });
  const cases = [
    ['/notifications/42', 'notifications'],
    ['/announcements/new', 'announcements'],
    ['/announcements/42/edit', 'announcements'],
    ['/notification-settings', 'notificationSettings'],
    ['/announcement-schedules/new', 'notificationSettings'],
    ['/announcement-schedules/42', 'notificationSettings'],
    ['/announcement-schedules/42/edit', 'notificationSettings'],
  ];
  for (const [path, key] of cases) {
    const hit = menuEntryFor(menu, path);
    assert.equal(hit.group.key, 'notifications', path);
    assert.equal(hit.item.key, key, path);
  }
  const crumbs = alignCrumbs(
    [{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo nhà trường', to: '/announcements' }, { label: 'Sửa thông báo' }],
    menu,
    '/announcements/42/edit',
  );
  assert.deepEqual(
    crumbs.map((item) => item.label),
    ['Trang chủ', 'Thông báo', 'Thông báo nhà trường', 'Sửa thông báo'],
  );
  assert.equal(crumbs[2].to, '/announcements');
  const scheduleCrumbs = alignCrumbs(
    [
      { label: 'Trang chủ', to: '/' },
      { label: 'Cấu hình thông báo', to: '/notification-settings' },
      { label: 'Lịch gửi thông báo', to: '/notification-settings?tab=schedules' },
      { label: 'Sửa lịch gửi' },
    ],
    menu,
    '/announcement-schedules/42/edit',
  );
  assert.deepEqual(
    scheduleCrumbs.map((item) => item.label),
    ['Trang chủ', 'Thông báo', 'Cấu hình thông báo', 'Lịch gửi thông báo', 'Sửa lịch gửi'],
  );
});

test('trang Cấu hình thông báo: Hiệu trưởng thấy 3 tab, Phó hiệu trưởng chỉ tab Mẫu, tab lạ rơi về tab đầu', () => {
  const keys = (role) => settingsTabsFor(role).map((tab) => tab.key);
  assert.deepEqual(keys(ROLES.PRINCIPAL), ['templates', 'rules', 'schedules']);
  assert.deepEqual(keys(ROLES.VICE_PRINCIPAL), ['templates']);
  assert.deepEqual(keys(ROLES.TEACHER), []);
  assert.equal(activeSettingsTab(ROLES.PRINCIPAL, 'schedules').key, 'schedules');
  assert.equal(activeSettingsTab(ROLES.PRINCIPAL, 'khong-co').key, 'templates');
  assert.equal(activeSettingsTab(ROLES.VICE_PRINCIPAL, 'schedules').key, 'templates');
  assert.equal(activeSettingsTab(ROLES.TEACHER, 'rules'), null);
});

test('route cũ của ba danh sách chuyển về đúng tab, trang tạo/sửa/chi tiết lịch gửi giữ route riêng', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.match(routes, /path="notification-settings" element=\{only\(LEADERS, <NotificationSettingsPage \/>\)\}/);
  assert.match(routes, /path="announcement-templates" element=\{<Navigate to="\/notification-settings" replace \/>\}/);
  assert.match(routes, /path="notification-rules" element=\{<Navigate to="\/notification-settings\?tab=rules" replace \/>\}/);
  assert.match(routes, /path="announcement-schedules" element=\{<Navigate to="\/notification-settings\?tab=schedules" replace \/>\}/);
  for (const path of ['announcement-schedules/new', 'announcement-schedules/:id', 'announcement-schedules/:id/edit']) {
    assert.match(routes, new RegExp(`path="${path}" element=\\{only\\(\\[R.PRINCIPAL\\]`));
  }
});
