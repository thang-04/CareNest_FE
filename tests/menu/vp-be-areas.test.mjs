import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { areaAccess, canEditYearPlacement, canViewYearPlacement, roomCampusIds } = await import(
  '@/utils/school-config/schoolConfigPermissions'
);
const { getMenuForRole } = await import('@/layouts/menuConfig');

const campuses = [{ id: '1' }, { id: '2' }];
// PHT đăng nhập BE: mảng mock "Không có" không còn quyết định quyền (FE-BUG-261102)
const beVp = (bePermissions) => ({
  id: '7',
  userId: 7,
  roles: ['VICE_PRINCIPAL'],
  role: 'VICE_PRINCIPAL',
  campusId: '1',
  areas: { rooms: 'NONE', yearPlacement: 'NONE', staff: 'NONE' },
  bePermissions,
});
const keys = (menu) => menu.flatMap((e) => [e.key, ...(e.children || []).map((c) => c.key)]);

test('BE vice principal views rooms and year placement of every campus, read only', () => {
  const user = beVp(['STAFF_ASSIGNMENT_MANAGE']);
  assert.deepEqual(roomCampusIds(user, campuses), ['1', '2']);
  assert.deepEqual(roomCampusIds(user, campuses, true), []);
  assert.equal(canViewYearPlacement(user), true);
  assert.equal(canEditYearPlacement(user, '1'), false);
  const menu = keys(getMenuForRole('VICE_PRINCIPAL', user));
  assert.ok(menu.includes('schoolRooms'));
  assert.ok(menu.includes('schoolPlacement'));
});

test('staff screen follows BE account permissions', () => {
  assert.equal(areaAccess(beVp(['ACCOUNT_MANAGE']), 'staff').access, 'VIEW');
  assert.equal(areaAccess(beVp(['MEAL_COUNT_CONFIRM']), 'staff').access, 'NONE');
  assert.ok(!keys(getMenuForRole('VICE_PRINCIPAL', beVp(['MEAL_COUNT_CONFIRM']))).includes('schoolStaffView'));
});

test('demo login keeps vice principal areas from the mock assignment', () => {
  const demo = { id: 'u', role: 'VICE_PRINCIPAL', campusId: '1', areas: { rooms: 'NONE', yearPlacement: 'NONE' } };
  assert.deepEqual(roomCampusIds(demo, campuses), []);
  assert.equal(canViewYearPlacement(demo), false);
});
