import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
globalThis.window = new EventTarget();

const { canActivateParentsAt } = await import('@/utils/children/childrenPermissions');
const { sameId } = await import('@/services/http/idStrings');

// Màn Tài khoản phụ huynh: PHT chỉ thấy điểm trường được giao (PARENT_ACCOUNT_MANAGE + locationIds), HT thấy mọi điểm trường
const beUser = (role, locationIds, bePermissions) => ({
  id: '1',
  role,
  roles: [role],
  locationIds,
  campusId: locationIds?.length === 1 ? locationIds[0] : null,
  bePermissions,
});
const campuses = [
  { id: '1', name: 'Cơ sở 1' },
  { id: '2', name: 'Cơ sở 2' },
  { id: '5', name: 'CS-C' },
];
const MANAGE = ['CHILD_PROFILE_VIEW', 'PARENT_ACCOUNT_MANAGE'];

test('PHT một điểm trường: lọc còn đúng điểm trường được giao', () => {
  const vp = beUser('VICE_PRINCIPAL', ['2'], MANAGE);
  assert.deepEqual(
    campuses.filter((c) => canActivateParentsAt(c.id, vp)).map((c) => c.id),
    ['2'],
  );
  // Mặc định: điểm trường của tài khoản, còn campusPick ngoài danh sách bị kéo về default
  const pick = '1';
  const filtered = campuses.filter((c) => canActivateParentsAt(c.id, vp));
  const campusId = pick && filtered.some((c) => sameId(c.id, pick)) ? pick : filtered[0]?.id;
  assert.equal(campusId, '2');
});

test('Hiệu trưởng: thấy mọi điểm trường, không quyền quản lý tài khoản PH thì rỗng', () => {
  const principal = beUser('PRINCIPAL', null, MANAGE);
  assert.deepEqual(
    campuses.filter((c) => canActivateParentsAt(c.id, principal)).map((c) => c.id),
    ['1', '2', '5'],
  );
  const noPerm = beUser('VICE_PRINCIPAL', ['2'], ['CHILD_PROFILE_VIEW']);
  assert.deepEqual(
    campuses.filter((c) => canActivateParentsAt(c.id, noPerm)),
    [],
  );
});
