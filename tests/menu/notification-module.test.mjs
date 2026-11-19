import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { alignCrumbs, menuEntryFor } from '@/utils/menuBreadcrumb';

const personal = ['/notifications'];
const management = ['/announcements', '/announcement-templates'];
const principalOnly = ['/notification-rules', '/announcement-schedules'];

test('mọi role có đúng một nhóm Thông báo, các trang con giữ đúng quyền hiện có', () => {
  for (const role of [...Object.values(ROLES), 'ADMIN']) {
    const menu = getMenuForRole(role, { role });
    const groups = menu.filter((entry) => entry.key === 'notifications');
    assert.equal(groups.length, 1, role);
    assert.equal(groups[0].label, 'Thông báo');
    const expected =
      role === ROLES.PRINCIPAL
        ? [...personal, ...management, ...principalOnly]
        : role === ROLES.VICE_PRINCIPAL
          ? [...personal, ...management]
          : personal;
    assert.deepEqual(
      groups[0].children.map((child) => child.to),
      expected,
      role,
    );
    assert.equal(groups[0].children[0].label, 'Thông báo của tôi');
    assert.ok(!menu.some((entry) => [...personal, ...management, ...principalOnly].includes(entry.to)), role);
    const paths = menu.flatMap((entry) => (entry.children ? entry.children.map((child) => child.to) : [entry.to]));
    for (const path of [...personal, ...management, ...principalOnly]) {
      assert.equal(paths.filter((value) => value === path).length, expected.includes(path) ? 1 : 0, `${role}: ${path}`);
    }
  }
});

test('nhóm Thông báo giữ mục cá nhân khi tài khoản BE không có quyền quản trị nghiệp vụ', () => {
  for (const role of Object.values(ROLES)) {
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
    ['/announcement-templates', 'announcementTemplates'],
    ['/notification-rules', 'notificationRules'],
    ['/announcement-schedules', 'announcementSchedules'],
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
});
