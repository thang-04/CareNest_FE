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

const { readDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { getMenuForRole } = await import('@/layouts/menuConfig');
const { getQuickActionsForRole } = await import('@/layouts/quickActions');
const { canEnrollChild, canOpenPlacement, childCampusesOf } = await import('@/utils/children/childrenPermissions');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Hiệu trưởng tiếp nhận trẻ như Phó hiệu trưởng, trên mọi điểm trường (user yêu cầu 2026-10-27, PROPOSED — chờ BE;
 * plan docs/plans/active/2026-10-27-principal-child-enrollment.md). Dữ liệu giả (CCCD bắt đầu bằng 999).
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const C1_CLASS = 'cls_c1_x06';
const C2_CLASS = 'cls_c2_x04';

const guardian = (n) => ({
  fullName: `Phụ huynh thử ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 7${String(n).padStart(2, '0')}`,
  idNumber: `9999000007${String(n).padStart(2, '0')}`,
  email: '',
});
const child = (n) => ({
  ...emptyChildInfo(),
  fullName: `Trẻ thử ${n}`,
  dateOfBirth: '2023-05-17',
  gender: 'FEMALE',
  guardians: [guardian(n)],
  profile: filledProfile(),
});
const row = (n) => ({ child: child(n), declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() } });
const payload = (n, patch = {}) => ({ ...row(n), classId: '', ...patch });
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: Hiệu trưởng có Tiếp nhận trẻ, Xếp lớp ở menu và Tạo nhanh; tiếp nhận được vào mọi điểm trường', () => {
  const kids = getMenuForRole(PRINCIPAL.role, PRINCIPAL).find((m) => m.key === 'children');
  const keys = kids.children.map((c) => c.key);
  assert.ok(keys.includes('childEnroll'));
  assert.ok(keys.includes('childPlacement'));
  assert.ok(getQuickActionsForRole(PRINCIPAL.role, PRINCIPAL).some((a) => a.to === '/children/new'));
  assert.equal(canEnrollChild(PRINCIPAL), true);
  assert.equal(canOpenPlacement(PRINCIPAL), true);
  const campuses = readDb().campuses;
  assert.deepEqual(
    childCampusesOf(PRINCIPAL, campuses).map((c) => c.id),
    ['c1', 'c2'],
  );
  assert.deepEqual(
    childCampusesOf(VP, campuses).map((c) => c.id),
    ['c1'],
  );
  assert.equal(canEnrollChild(TEACHER), false);
  assert.equal(canOpenPlacement(TEACHER), false);
});

test('AC-2: Hiệu trưởng tiếp nhận không xếp lớp ⇒ trẻ Chờ xếp lớp ở điểm trường đã chọn; thiếu điểm trường ⇒ 422', async () => {
  const saved = await children.enrollChild(payload(1, { campusId: 'c2' }), PRINCIPAL);
  assert.equal(saved.campusId, 'c2');
  assert.equal(saved.status, 'PENDING_PLACEMENT');
  await rejects(children.enrollChild(payload(2), PRINCIPAL), 422, 'campusId');
  await rejects(children.enrollChild(payload(3, { campusId: 'c9' }), PRINCIPAL), 422, 'campusId');
});

test('AC-3: Hiệu trưởng xếp lớp khi tiếp nhận ⇒ trẻ thuộc điểm trường của lớp; lớp khác điểm trường đã chọn ⇒ 422', async () => {
  const saved = await children.enrollChild(payload(4, { campusId: 'c2', classId: C2_CLASS }), PRINCIPAL);
  assert.equal(saved.campusId, 'c2');
  assert.equal(saved.classId, C2_CLASS);
  assert.equal(saved.status, 'ACTIVE');
  await rejects(children.enrollChild(payload(5, { campusId: 'c2', classId: C1_CLASS }), PRINCIPAL), 422, 'classId');
});

test('AC-4: Hiệu trưởng nhập Excel ⇒ trẻ Chờ xếp lớp ở điểm trường đã chọn; thiếu điểm trường ⇒ 422', async () => {
  const result = await children.importChildren([row(6), row(7)], PRINCIPAL, 'c2');
  assert.equal(result.created, 2);
  const created = readDb().children.filter((c) => result.ids.includes(c.id));
  assert.deepEqual(
    created.map((c) => [c.campusId, c.status]),
    [
      ['c2', 'PENDING_PLACEMENT'],
      ['c2', 'PENDING_PLACEMENT'],
    ],
  );
  await rejects(children.importChildren([row(8)], PRINCIPAL), 422, 'campusId');
});

test('AC-5: Hiệu trưởng thấy gợi ý và mở lại hồ sơ trẻ đã nghỉ học ở điểm trường bất kỳ', async () => {
  const old = await children.enrollChild(payload(9, { campusId: 'c2' }), PRINCIPAL);
  await children.withdrawChild(old.id, { leftAt: todayInput(), reason: 'Chuyển nơi ở (giả)' }, PRINCIPAL);
  const dup = await children.checkDuplicate(
    { fullName: old.fullName, dateOfBirth: old.dateOfBirth, guardianIdNumbers: [guardian(9).idNumber] },
    PRINCIPAL,
  );
  assert.equal(dup.kind, 'LEFT');
  assert.equal(dup.sameCampus, true);
  assert.equal(dup.canReadmit, true);
  const back = await children.readmitChild(old.id, { reason: 'Quay lại học (giả)' }, PRINCIPAL);
  assert.equal(back.status, 'PENDING_PLACEMENT');
  assert.equal(back.campusId, 'c2');
});

test('AC-6: Hiệu trưởng xếp lớp, chuyển lớp; lớp ở điểm trường khác ⇒ trẻ đổi điểm trường theo lớp', async () => {
  const pending = await children.enrollChild(payload(10, { campusId: 'c2' }), PRINCIPAL);
  const placed = await children.placeChild(pending.id, { classId: C2_CLASS }, PRINCIPAL);
  assert.equal(placed.status, 'ACTIVE');
  assert.equal(placed.campusId, 'c2');
  const moved = await children.placeChild(pending.id, { classId: C1_CLASS, reason: 'Gia đình chuyển nhà (giả)' }, PRINCIPAL);
  assert.equal(moved.classId, C1_CLASS);
  assert.equal(moved.campusId, 'c1');
});

test('AC-7: Phó hiệu trưởng một điểm trường giữ nguyên; giáo viên không tiếp nhận được', async () => {
  const saved = await children.enrollChild(payload(11), VP);
  assert.equal(saved.campusId, 'c1');
  await rejects(children.enrollChild(payload(12, { campusId: 'c2' }), VP), 422, 'campusId');
  const imported = await children.importChildren([row(13)], VP);
  assert.equal(readDb().children.find((c) => c.id === imported.ids[0]).campusId, 'c1');
  await rejects(children.placeChild(saved.id, { classId: C2_CLASS }, VP), 422, 'classId');
  await rejects(children.enrollChild(payload(14), TEACHER), 403);
  await rejects(children.importChildren([row(15)], TEACHER, 'c1'), 403);
});
