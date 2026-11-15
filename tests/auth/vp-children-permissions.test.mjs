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

const children = await import('@/utils/children/childrenPermissions');
const { getMenuForRole } = await import('@/layouts/menuConfig');
const { isVpReadOnlyPage } = await import('@/utils/account/vpReadOnlyPages');

// PHT đăng nhập BE phụ trách điểm trường 1; mảng demo (areas) không còn quyết định quyền
const beVp = (bePermissions) => ({
  id: '7',
  role: 'VICE_PRINCIPAL',
  roles: ['VICE_PRINCIPAL'],
  locationIds: ['1'],
  campusId: '1',
  areas: { children: 'RESTRICTED' },
  bePermissions,
});
const child = (campusId, status = 'ACTIVE') => ({ id: 'k', campusId, status });
const keys = (menu) => menu.flatMap((e) => [e.key, ...(e.children || []).map((c) => c.key)]);
const ALL = ['CHILD_PROFILE_VIEW', 'CHILD_ENROLL', 'CHILD_PROFILE_EDIT', 'CHILD_PLACEMENT', 'PARENT_ACCOUNT_MANAGE'];

test('AUTH-20: HT tắt CHILD_ENROLL thì PHT không còn tiếp nhận trẻ, kể cả mục menu', () => {
  const vp = beVp(ALL.filter((c) => c !== 'CHILD_ENROLL'));
  assert.equal(children.canEnrollChild(vp), false);
  assert.equal(children.canReadmitChild(child('1', 'LEFT'), vp), false);
  assert.equal(keys(getMenuForRole('VICE_PRINCIPAL', vp)).includes('childEnroll'), false);
  assert.equal(keys(getMenuForRole('VICE_PRINCIPAL', beVp(ALL))).includes('childEnroll'), true);
});

test('AUTH-20: mỗi nút theo đúng mã của nó, chỉ ở điểm trường phụ trách', () => {
  const vp = beVp(['CHILD_PROFILE_VIEW', 'CHILD_PROFILE_EDIT']);
  assert.equal(children.canEditChild(child('1'), vp), true);
  assert.equal(children.canEditChild(child('2'), vp), false);
  assert.equal(children.canPlaceChild(child('1'), vp), false);
  assert.equal(children.canActivateParent(child('1'), vp), false);
  assert.equal(keys(getMenuForRole('VICE_PRINCIPAL', vp)).includes('childPlacement'), false);
  assert.deepEqual(
    children.childCampusesOf(beVp(ALL), [{ id: '1' }, { id: '2' }], 'update').map((c) => c.id),
    ['1'],
  );
});

test('AUTH-20: PHT xem hồ sơ trẻ mọi điểm trường, có cột và bộ lọc điểm trường', () => {
  const vp = beVp(['CHILD_PROFILE_VIEW']);
  assert.equal(children.canViewChildren(vp), true);
  assert.equal(children.seesAllCampusChildren(vp), true);
  assert.equal(children.canViewChild(child('2'), vp), true);
});

test('AUTH-07: trang PHT không có mã sửa nào thì báo đang chỉ xem; có mã hoặc bản demo thì không', () => {
  assert.equal(isVpReadOnlyPage(beVp(['CHILD_PROFILE_VIEW']), '/children'), true);
  assert.equal(isVpReadOnlyPage(beVp(['CHILD_PLACEMENT']), '/children'), false);
  assert.equal(isVpReadOnlyPage(beVp([]), '/menu/foods/12'), true);
  assert.equal(isVpReadOnlyPage(beVp(['NUTRITION_MANAGE']), '/menu/foods'), false);
  assert.equal(isVpReadOnlyPage(beVp([]), '/kitchen/stock-history'), false);
  assert.equal(isVpReadOnlyPage({ role: 'VICE_PRINCIPAL' }, '/children'), false);
  assert.equal(isVpReadOnlyPage({ role: 'PRINCIPAL', bePermissions: [] }, '/children'), false);
});
