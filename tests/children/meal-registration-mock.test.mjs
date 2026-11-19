import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { readDb, resetDb, writeDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/* Báo ăn (CHD-13): cờ nằm trên hồ sơ trẻ; bỏ báo ăn không xóa dị ứng, chế độ ăn đã khai. */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const reported = (items) => ({ state: 'REPORTED', items });

const decl = (patch) => ({
  ...emptyDeclaration(),
  allergies: { state: 'NONE_REPORTED', items: [] },
  diet: { state: 'NONE_REPORTED', text: '' },
  medicalHistory: filledMedicalHistory(),
  ...patch,
});

let seq = 0;
const row = (declaration) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ thử báo ăn ${seq}`,
      dateOfBirth: '2023-03-09',
      gender: 'MALE',
      guardians: [
        {
          fullName: `Phụ huynh báo ăn ${seq}`,
          relation: 'Mẹ',
          phone: `0900 000 7${String(seq).padStart(2, '0')}`,
          idNumber: `9999000007${String(seq).padStart(2, '0')}`,
          email: '',
        },
      ],
      profile: filledProfile(),
    },
    declaration: decl(declaration),
    classId: '',
  };
};

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('tiếp nhận không báo ăn: hồ sơ ghi cờ, dị ứng Chưa cung cấp', async () => {
  const saved = await children.enrollChild(row({ mealRegistered: false, allergies: reported(['Trứng']) }), VP);
  const { child, declaration } = await children.getChildDetail(saved.id, VP);
  assert.equal(child.mealRegistered, false);
  assert.equal(declaration.allergies.state, 'NOT_PROVIDED');
  assert.deepEqual(child.allergies, []);
});

test('thiếu cờ khi tiếp nhận ⇒ báo ăn', async () => {
  const { mealRegistered: _flag, ...withoutFlag } = decl();
  const saved = await children.enrollChild({ ...row(), declaration: withoutFlag }, VP);
  assert.equal((await children.getChildDetail(saved.id, VP)).child.mealRegistered, true);
});

test('trẻ có sẵn trong mock (hoặc localStorage cũ, chưa có cờ) đọc ra báo ăn', async () => {
  const seeded = readDb().children.find((ch) => ch.campusId === VP.campusId && ch.status === 'ACTIVE');
  writeDb((db) => {
    delete db.children.find((ch) => ch.id === seeded.id).mealRegistered;
  });
  const { child } = await children.getChildDetail(seeded.id, VP);
  assert.equal(child.mealRegistered, true);
});

test('bỏ báo ăn giữ dị ứng, báo ăn lại vẫn còn', async () => {
  const saved = await children.enrollChild(row({ allergies: reported(['Sữa']) }), VP);
  await children.saveDeclaration(
    saved.id,
    { declaration: decl({ mealRegistered: false, allergies: reported(['Trứng']) }), reason: 'Gia đình không đăng ký ăn' },
    VP,
  );
  let detail = await children.getChildDetail(saved.id, VP);
  assert.equal(detail.child.mealRegistered, false);
  assert.deepEqual(detail.declaration.allergies.items, ['Sữa']);
  assert.deepEqual(detail.child.allergies, ['Sữa']);

  await children.saveDeclaration(
    saved.id,
    { declaration: decl({ mealRegistered: true, allergies: reported(['Sữa']) }), reason: 'Đăng ký ăn lại' },
    VP,
  );
  detail = await children.getChildDetail(saved.id, VP);
  assert.equal(detail.child.mealRegistered, true);
  assert.deepEqual(detail.child.allergies, ['Sữa']);
});
