import assert from 'node:assert/strict';
import { beforeEach, afterEach, test } from 'node:test';
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.window = new EventTarget();
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: repo } = await import('@/services/attendance/mock/attendanceMockRepository');
const { isAttendanceUnlockActive } = await import('@/utils/attendance/attendanceUnlock');
const { canUnlockAttendanceDay } = await import('@/utils/attendance/attendancePermissions');
const { activeYearId } = await import('@/mocks/roomManagers');
const RealDate = Date;
let clock;
let cls;
let vp;
let teacher;
let principal;
const date = '2026-10-19';
const rejectStatus = (status) => (error) => error.status === status;
beforeEach(async () => {
  clock = RealDate.parse('2026-10-19T10:00:00+07:00');
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } };
  resetDb();
  await repo.getDayInfo(date);
  const db = readDb();
  cls = db.classes.find((row) => row.campusId === 'c1' && row.schoolYear === activeYearId(db) && row.teacherIds?.length && db.children.some((child) => child.classId === row.id && child.status === 'ACTIVE'));
  vp = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: cls.campusId };
  principal = db.users.find((user) => user.role === 'PRINCIPAL');
  teacher = { id: cls.teacherIds[0], role: 'TEACHER', campusId: cls.campusId };
});
afterEach(() => { globalThis.Date = RealDate; });
const payload = (patch = {}) => ({ classId: cls.id, date, validUntil: new Date(clock + 3600000).toISOString(), reason: 'Lớp demo quên lưu điểm danh', ...patch });

test('HT mọi campus, PHT chỉ campus mình và giáo viên không được mở', async () => {
  assert.equal(canUnlockAttendanceDay({ campusId: 'c2' }, principal), true);
  assert.equal(canUnlockAttendanceDay({ campusId: 'c2' }, vp), false);
  await assert.rejects(repo.unlockAttendanceDay(payload(), teacher), rejectStatus(403));
  await assert.rejects(repo.unlockAttendanceDay(payload(), { ...vp, campusId: 'c2' }), rejectStatus(403));
  const result = await repo.unlockAttendanceDay(payload(), vp);
  assert.equal(result.classId, cls.id);
  assert.equal((await repo.listAttendanceDayUnlocks(vp)).length, 1);
  assert.equal((await repo.listAttendanceDayUnlocks({ ...vp, campusId: 'c2' })).length, 0);
  await assert.rejects(repo.unlockAttendanceDay(payload(), vp), rejectStatus(409));
});
test('chặn lý do trống, thời hạn, ngày cũ và lớp năm học cũ', async () => {
  for (const patch of [{ reason: ' ' }, { validUntil: new Date(clock - 1).toISOString() }, { validUntil: new Date(clock + 8 * 86400000).toISOString() }, { date: '2026-10-16' }]) await assert.rejects(repo.unlockAttendanceDay(payload(patch), vp), rejectStatus(422));
  writeDb((db) => { db.classes.find((row) => row.id === cls.id).schoolYear = 'old-year'; });
  await assert.rejects(repo.unlockAttendanceDay(payload(), vp), rejectStatus(422));
});
test('hết hạn hoặc sang ngày mới tự khóa, dù validUntil ở ngày sau', async () => {
  const unlock = await repo.unlockAttendanceDay(payload({ validUntil: new Date(clock + 2 * 86400000).toISOString() }), vp);
  assert.equal((await repo.getDayInfo(date, cls.id, teacher)).locked, false);
  assert.equal(isAttendanceUnlockActive(unlock, new Date(clock + 86400000)), false);
  clock += 86400000;
  assert.equal((await repo.getDayInfo(date, cls.id, teacher)).locked, true);
});
test('xác nhận lại đồng bộ phiếu chưa nhận, giữ phiếu đã nhận và snapshot chốt', async () => {
  const counts = (await repo.getMealCounts({ date, campusId: cls.campusId }, vp)).counts;
  const target = counts.find((count) => count.classes.some((line) => line.classId === cls.id));
  await repo.confirmMealCount(target.id, vp);
  const original = structuredClone(readDb().mealCounts.find((count) => count.id === target.id).classes);
  writeDb((db) => {
    const count = db.mealCounts.find((row) => row.id === target.id);
    count.pendingClasses = structuredClone(count.classes);
    count.pendingClasses.find((line) => line.classId === cls.id).normal += 3;
    count.needsReconfirmation = true;
    const other = db.mealHandovers.find((row) => row.mealCountId === count.id && row.classId !== cls.id);
    if (other) { other.status = 'CONFIRMED'; other.received = { ...other.expected }; }
  });
  const confirmed = structuredClone(readDb().mealHandovers.filter((row) => row.mealCountId === target.id && row.status === 'CONFIRMED'));
  await repo.confirmMealCount(target.id, vp);
  const db = readDb();
  const count = db.mealCounts.find((row) => row.id === target.id);
  const handover = db.mealHandovers.find((row) => row.mealCountId === target.id && row.classId === cls.id);
  assert.deepEqual(handover.expected, { normal: count.classes.find((line) => line.classId === cls.id).normal, substitute: count.classes.find((line) => line.classId === cls.id).substitute });
  assert.deepEqual(count.confirmedSnapshots[0].classes, original);
  assert.deepEqual(db.mealHandovers.filter((row) => row.mealCountId === target.id && row.status === 'CONFIRMED'), confirmed);
  await assert.rejects(repo.confirmMealCount(target.id, vp), rejectStatus(409));
});
