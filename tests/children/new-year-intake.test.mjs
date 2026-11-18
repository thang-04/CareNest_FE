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
 * CHD-11 / CFG-YR-05: tiếp nhận vào năm sau chỉ khi năm PLANNED đã tới ngày mở chuẩn bị (BE trả 2412).
 * Mock cấu hình trường không lưu prepDate nên test tự seed năm 2027-2028 vào db.schoolYears.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const NEXT_YEAR = '2027-2028';
const NEXT_CLASS = 'cls_c1_next_x06';
const START_DATE = '2027-09-05';

const dayShift = (days) => {
  const d = new Date(`${todayInput()}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const seedNextYear = (prepDate) =>
  writeDb((d) => {
    d.schoolYears = [
      ...(d.schoolYears || buildSeedSchoolConfig().schoolYears),
      { id: NEXT_YEAR, name: NEXT_YEAR, startDate: START_DATE, endDate: '2028-05-31', status: 'PLANNED', prepDate },
    ];
    d.classes.push({ id: NEXT_CLASS, name: 'Lớp năm sau', campusId: 'c1', schoolYear: NEXT_YEAR, capacity: 25, status: 'ACTIVE' });
  });

const guardian = (n) => ({
  fullName: `Phụ huynh năm sau ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 8${String(n).padStart(2, '0')}`,
  idNumber: `9999000008${String(n).padStart(2, '0')}`,
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

test('CHD-11: năm sau chưa tới ngày mở chuẩn bị ⇒ 409, không tạo trẻ', async () => {
  seedNextYear(dayShift(30));
  const before = readDb().children.length;
  await assert.rejects(
    children.enrollChild(payload(1), PRINCIPAL),
    (err) => err.status === 409 && /^Năm học 2027-2028 chưa tới ngày mở chuẩn bị \(\d{2}\/\d{2}\/\d{4}\)$/.test(err.message),
  );
  assert.equal(readDb().children.length, before);
  assert.equal((readDb().plannedAdmissions || []).length, 0);
});

test('CHD-11: từ ngày mở chuẩn bị ⇒ trẻ Chờ xếp lớp, đăng ký PLACED, ngày bắt đầu', async () => {
  seedNextYear(todayInput());
  const saved = await children.enrollChild(payload(2, { classId: NEXT_CLASS }), PRINCIPAL);
  assert.equal(saved.status, 'PENDING_PLACEMENT');
  assert.equal(saved.classId, null);
  const [admission] = readDb().plannedAdmissions.filter((a) => a.childId === saved.id);
  assert.equal(admission.schoolYearId, NEXT_YEAR);
  assert.equal(admission.classId, NEXT_CLASS);
  assert.equal(admission.status, 'PLACED');
  assert.equal(admission.startDate, START_DATE);
});

test('CHD-11: phụ huynh mới của trẻ năm sau được tạo tài khoản như thường', async () => {
  seedNextYear(todayInput());
  const saved = await children.enrollChild(payload(3), PRINCIPAL);
  assert.deepEqual(
    saved.guardianAccounts.map((a) => a.result),
    ['CREATED'],
  );
});
