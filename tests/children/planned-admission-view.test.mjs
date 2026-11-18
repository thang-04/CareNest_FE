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
const { buildSeedSchoolConfig } = await import('@/mocks/schoolConfigSeed');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * CHD-09, CHD-11: trẻ có đăng ký năm sau (db.plannedAdmissions PENDING / PLACED) trả plannedAdmission,
 * chỉ hiện ở danh sách năm đó; mock khớp BE (xếp lớp năm nay 409, nghỉ học hủy đăng ký).
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const NEXT_YEAR = '2027-2028';
const NEXT_CLASS = 'cls_c1_next_x06';
const START_DATE = '2027-09-05';

const seedNextYear = () =>
  writeDb((d) => {
    d.schoolYears = [
      ...(d.schoolYears || buildSeedSchoolConfig().schoolYears),
      { id: NEXT_YEAR, name: NEXT_YEAR, startDate: START_DATE, endDate: '2028-05-31', status: 'PLANNED', prepDate: todayInput() },
    ];
    d.classes.push({ id: NEXT_CLASS, name: 'Lớp năm sau', campusId: 'c1', schoolYear: NEXT_YEAR, capacity: 25, status: 'ACTIVE' });
  });

const guardian = (n) => ({
  fullName: `Phụ huynh năm sau ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 7${String(n).padStart(2, '0')}`,
  idNumber: `9999000007${String(n).padStart(2, '0')}`,
  email: '',
});
const payload = (n, patch = {}) => ({
  child: {
    ...emptyChildInfo(),
    fullName: `Trẻ năm sau ${n}`,
    dateOfBirth: '2023-05-17',
    gender: 'FEMALE',
    guardians: [guardian(n)],
    profile: filledProfile(),
  },
  declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  campusId: 'c1',
  classId: '',
  schoolYearId: NEXT_YEAR,
  startDate: START_DATE,
  ...patch,
});

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('CHD-11: đăng ký năm sau trả plannedAdmission ở hồ sơ và danh sách, trẻ khác trả null', async () => {
  seedNextYear();
  const placed = await children.enrollChild(payload(1, { classId: NEXT_CLASS }), PRINCIPAL);
  const pending = await children.enrollChild(payload(2), PRINCIPAL);
  assert.deepEqual(placed.plannedAdmission, {
    schoolYearId: NEXT_YEAR,
    schoolYearName: NEXT_YEAR,
    campusId: 'c1',
    classId: NEXT_CLASS,
    className: 'Lớp năm sau',
    startDate: START_DATE,
    status: 'PLACED',
  });
  assert.deepEqual(pending.plannedAdmission, {
    schoolYearId: NEXT_YEAR,
    schoolYearName: NEXT_YEAR,
    campusId: 'c1',
    classId: null,
    className: null,
    startDate: START_DATE,
    status: 'PENDING',
  });
  const { child } = await children.getChildDetail(placed.id, PRINCIPAL);
  assert.equal(child.plannedAdmission.status, 'PLACED');
  const all = await children.listChildren({}, PRINCIPAL);
  assert.equal(all.find((c) => c.id === placed.id).plannedAdmission.className, 'Lớp năm sau');
  assert.ok(all.filter((c) => !c.plannedAdmission).length > 0);
  assert.ok(all.filter((c) => !c.plannedAdmission).every((c) => c.plannedAdmission === null));
});

test('CHD-11: đăng ký đã hủy không còn là plannedAdmission', async () => {
  seedNextYear();
  const saved = await children.enrollChild(payload(3), PRINCIPAL);
  writeDb((d) => {
    d.plannedAdmissions.find((a) => a.childId === saved.id).status = 'CANCELLED';
  });
  const { child } = await children.getChildDetail(saved.id, PRINCIPAL);
  assert.equal(child.plannedAdmission, null);
  assert.equal(readDb().plannedAdmissions.length, 1);
});

test('CHD-09, CHD-11: trẻ năm sau chỉ ở danh sách năm đó, có plannedAdmission', async () => {
  seedNextYear();
  const saved = await children.enrollChild(payload(4, { classId: NEXT_CLASS }), PRINCIPAL);
  const pending = await children.enrollChild(payload(5), PRINCIPAL);
  const activeYear = readDb().classes.find((c) => c.id === readDb().children[0].classId).schoolYear;
  const current = await children.listChildren({ schoolYear: activeYear }, PRINCIPAL);
  assert.equal(
    current.some((c) => c.id === saved.id || c.id === pending.id),
    false,
  );
  const next = await children.listChildren({ schoolYear: NEXT_YEAR }, PRINCIPAL);
  assert.deepEqual(next.map((c) => c.id).sort(), [saved.id, pending.id].sort());
  assert.equal(next.find((c) => c.id === saved.id).plannedAdmission.className, 'Lớp năm sau');
  assert.equal(next.find((c) => c.id === pending.id).plannedAdmission.status, 'PENDING');
});

test('CHD-11: xếp lớp năm nay cho trẻ năm sau ⇒ 409', async () => {
  seedNextYear();
  const saved = await children.enrollChild(payload(6), PRINCIPAL);
  const currentClass = readDb().classes.find((c) => c.id === readDb().children[0].classId);
  await assert.rejects(
    children.placeChild(saved.id, { classId: currentClass.id }, PRINCIPAL),
    (err) => err.status === 409 && err.message === 'Trẻ năm sau 6 đã đăng ký cho năm học sắp tới, xếp lớp tại màn Xếp lớp năm học mới',
  );
  assert.equal(readDb().children.find((c) => c.id === saved.id).classId, null);
});

test('CHD-11: cho nghỉ học ⇒ đăng ký CANCELLED, rời danh sách năm sau', async () => {
  seedNextYear();
  const saved = await children.enrollChild(payload(7, { classId: NEXT_CLASS }), PRINCIPAL);
  const left = await children.withdrawChild(saved.id, { leftAt: todayInput(), reason: 'Gia đình đổi ý' }, PRINCIPAL);
  assert.equal(left.plannedAdmission, null);
  assert.equal(readDb().plannedAdmissions.find((a) => a.childId === saved.id).status, 'CANCELLED');
  const next = await children.listChildren({ schoolYear: NEXT_YEAR }, PRINCIPAL);
  assert.equal(
    next.some((c) => c.id === saved.id),
    false,
  );
});
