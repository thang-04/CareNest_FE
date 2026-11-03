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

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { healthCheckMockRepository: healthChecks } = await import('@/services/children/mock/healthCheckMockRepository');
const { pickupMockRepository: pickups } = await import('@/services/pickup/mock/pickupMockRepository');
const { overlapsSchoolYear, schoolYearIdOfDate } = await import('@/mocks/schoolYearScope');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Dữ liệu của nhánh theo năm học (user chốt 2026-10-28, Y-1..Y-4; plan docs/plans/completed/2026-10-28-school-year-scope.md).
 * Năm mẫu: 2025-2026 đã kết thúc (bắt đầu 2025-09-05), 2026-2027 đang hoạt động (bắt đầu 2026-09-05). Dữ liệu giả.
 */
const ACTIVE = '2026-2027';
const CLOSED = '2025-2026';
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const testClass = (id, schoolYear) => ({
  id,
  name: `Lớp thử ${id}`,
  campusId: 'c1',
  ageGroupId: 'ag-4',
  schoolYear,
  capacity: 25,
  status: 'ACTIVE',
  teacherIds: [],
});
const enrollPayload = (n, classId = '') => ({
  child: {
    ...emptyChildInfo(),
    fullName: `Trẻ thử năm học ${n}`,
    dateOfBirth: '2022-05-17',
    gender: 'MALE',
    guardians: [
      {
        fullName: `Phụ huynh năm học ${n}`,
        relation: 'Mẹ',
        phone: `0900 000 6${String(n).padStart(2, '0')}`,
        idNumber: `9999000006${String(n).padStart(2, '0')}`,
        email: '',
      },
    ],
    profile: filledProfile(),
  },
  declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  classId,
});

let principal;
beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
  principal = readDb().users.find((u) => u.role === 'PRINCIPAL');
  writeDb((d) => {
    d.classes.push(testClass('cls_old_test', CLOSED), testClass('cls_next_test', '2027-2028'));
  });
});

test('năm của một ngày: năm gần nhất đã bắt đầu (hè tính vào năm vừa qua)', () => {
  const db = readDb();
  assert.equal(schoolYearIdOfDate(db, '2026-03-10'), CLOSED);
  assert.equal(schoolYearIdOfDate(db, '2026-07-15'), CLOSED);
  assert.equal(schoolYearIdOfDate(db, '2026-10-28T03:00:00.000Z'), ACTIVE);
  assert.equal(schoolYearIdOfDate(db, '2020-01-01'), null);
  assert.equal(overlapsSchoolYear(db, CLOSED, '2026-05-01', '2026-10-01'), true);
  assert.equal(overlapsSchoolYear(db, CLOSED, '2026-09-10', '2026-10-01'), false);
});

test('AC-2 (Y-2): chọn năm cũ ⇒ trẻ đã học năm đó, với lớp của năm đó; trẻ chờ xếp lớp chỉ ở năm đang hoạt động', async () => {
  const kid = readDb().children.find((c) => c.campusId === 'c1' && c.status === 'ACTIVE');
  writeDb((d) => {
    d.childPlacements.push({
      id: 'pl_old_test',
      childId: kid.id,
      fromClassId: null,
      toClassId: 'cls_old_test',
      at: '2025-09-10T02:00:00.000Z',
    });
    // Kích hoạt năm học mới chuyển trẻ lên lớp năm sau (Xếp lớp năm học mới).
    const target = d.children.find((c) => c.id === kid.id);
    (target.history ||= []).push({
      action: 'PLACEMENT_PROMOTE',
      at: '2026-09-05T00:00:00.000Z',
      fromClassId: 'cls_old_test',
      toClassId: kid.classId,
    });
  });
  const pending = await children.enrollChild(enrollPayload(1), VP);

  const old = await children.listChildren({ schoolYear: CLOSED }, VP);
  assert.deepEqual(
    old.filter((c) => c.id === kid.id).map((c) => [c.classId, c.schoolYear]),
    [['cls_old_test', CLOSED]],
  );
  assert.ok(old.every((c) => c.id !== pending.id));
  assert.ok(old.every((c) => c.classId === 'cls_old_test' || c.status === 'LEFT'));

  const now = await children.listChildren({ schoolYear: ACTIVE }, VP);
  assert.deepEqual(
    now.filter((c) => c.id === kid.id).map((c) => c.classId),
    [kid.classId],
  );
  assert.ok(now.some((c) => c.id === pending.id && c.status === 'PENDING_PLACEMENT'));
});

test('AC-3 (Y-3): chỉ tiếp nhận, xếp lớp vào lớp của năm học đang hoạt động', async () => {
  const classes = await children.getPlacementClasses({ schoolYear: '2027-2028' }, VP);
  assert.ok(classes.length > 0);
  assert.ok(classes.every((c) => c.schoolYear === ACTIVE));
  await rejects(children.enrollChild(enrollPayload(2, 'cls_next_test'), VP), 422, 'classId');
  const pending = await children.enrollChild(enrollPayload(3), VP);
  await rejects(children.placeChild(pending.id, { classId: 'cls_old_test' }, VP), 422, 'classId');
  const free = classes.find((c) => c.campusId === 'c1' && c.enrolledCount < c.capacity);
  const placed = await children.placeChild(pending.id, { classId: free.id }, VP);
  assert.equal(placed.status, 'ACTIVE');
});

test('AC-4 (Y-4): đợt khám theo năm của ngày bắt đầu; phiếu theo dõi đang mở luôn hiện, phiếu đã đóng theo năm', async () => {
  const all = await healthChecks.listHealthChecks({}, principal);
  const now = await healthChecks.listHealthChecks({ schoolYear: ACTIVE }, principal);
  const old = await healthChecks.listHealthChecks({ schoolYear: CLOSED }, principal);
  assert.ok(now.length > 0 && old.length > 0);
  assert.ok(now.every((c) => c.startDate >= '2026-09-05'));
  assert.ok(old.every((c) => c.startDate >= '2025-09-05' && c.startDate < '2026-09-05'));
  assert.equal(now.length + old.length, all.filter((c) => c.startDate >= '2025-09-05').length);

  const db = readDb();
  const raw = new Map(db.healthFollowUps.map((f) => [f.id, f]));
  for (const year of [ACTIVE, CLOSED]) {
    const { items } = await healthChecks.listHealthFollowUps({ schoolYear: year }, principal);
    const openIds = db.healthFollowUps.filter((f) => !f.closedAt).map((f) => f.id);
    assert.ok(
      openIds.every((id) => items.some((f) => f.id === id)),
      `${year}: đủ phiếu đang mở`,
    );
    assert.ok(
      items.every((f) => !raw.get(f.id).closedAt || overlapsSchoolYear(db, year, raw.get(f.id).openedAt, raw.get(f.id).closedAt)),
      `${year}: phiếu đã đóng thuộc năm`,
    );
  }
});

test('AC-1 (Y-1): đón trẻ chỉ lớp năm đang hoạt động; ngày trong năm đang hoạt động, không ở tương lai', async () => {
  const teacher = readDb().users.find((u) => u.email === 'minhanh.le@carenest.edu.vn');
  writeDb((d) => {
    d.classes.find((c) => c.id === 'cls_old_test').teacherIds = [teacher.id];
  });
  const board = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, teacher);
  assert.equal(board.date, todayInput());
  await rejects(pickups.getPickupBoard({ classId: 'cls_old_test' }, teacher), 422, 'classId');
  await rejects(pickups.getPickupBoard({ classId: 'cls_c1_c1', date: '2999-01-01' }, teacher), 422, 'date');
  // Năm đang hoạt động đã bắt đầu thì không xem ngày trước đầu năm (năm chưa bắt đầu thì không chặn).
  if (todayInput() >= '2026-09-05') {
    await rejects(pickups.getPickupBoard({ classId: 'cls_c1_c1', date: '2026-08-20' }, teacher), 422, 'date');
    await rejects(pickups.getPickupResults({ date: '2026-08-20' }, teacher), 422, 'date');
  }
});
