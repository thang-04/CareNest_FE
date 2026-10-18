import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuForRole } from '@/layouts/menuConfig';
import { getActiveMenuChild } from '@/layouts/sidebarSelection';
import { ROLES } from '@/models/User';

test('the most specific kitchen route is the only selected sidebar child', () => {
  const menu = getMenuForRole(ROLES.KITCHEN_STAFF);
  assert.deepEqual(getActiveMenuChild(menu, '/kitchen/meal-count'), {
    groupKey: 'kitchen',
    childKey: 'confirmedMealCount',
  });
  assert.deepEqual(getActiveMenuChild(menu, '/kitchen'), {
    groupKey: 'kitchen',
    childKey: 'kitchenDay',
  });
});

test('child forms keep their own menu item while profiles select the people hub', () => {
  const menu = getMenuForRole(ROLES.VICE_PRINCIPAL);
  assert.deepEqual(getActiveMenuChild(menu, '/children/new'), {
    groupKey: 'children',
    childKey: 'childEnroll',
  });
  assert.deepEqual(getActiveMenuChild(menu, '/children/123'), {
    groupKey: 'people',
    childKey: 'peopleHub',
  });
  assert.equal(getActiveMenuChild(menu, '/childrenish'), null);
});

test('permission center routes select the permissions item in people group for principal', () => {
  const menu = getMenuForRole(ROLES.PRINCIPAL, (code) => code === 'PERMISSION_MANAGE');
  assert.deepEqual(getActiveMenuChild(menu, '/permissions'), {
    groupKey: 'people',
    childKey: 'permissions',
  });
  assert.deepEqual(getActiveMenuChild(menu, '/permissions/overrides'), {
    groupKey: 'people',
    childKey: 'permissions',
  });
  assert.deepEqual(getActiveMenuChild(menu, '/permissions/history'), {
    groupKey: 'people',
    childKey: 'permissions',
  });
});
