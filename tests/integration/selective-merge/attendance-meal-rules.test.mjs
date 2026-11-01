import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

// Mock điểm danh/sổ báo ăn (BE giả) theo ATT-02, ATT-09, NUT-02 (user chốt 2026-11-01).
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: repo } = await import('@/services/attendance/mock/attendanceMockRepository');
const { activeYearId } = await import('@/mocks/roomManagers');
const { completeAttendance } = await import('../../kitchen/complete-attendance.mjs');

const RealDate = Date;
const date = '2026-10-19';
let clock;
let cls;
let vp;
let teacher;
let childIds;
const rejectStatus = (status) => (error) => error.status === status;
const setClock = (iso) => {
  clock = RealDate.parse(iso);
};

beforeEach(async () => {
  setClock('2026-10-19T07:30:00+07:00'); // trước giờ chốt 08:45
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
  resetDb();
  await repo.getDayInfo(date);
  const db = readDb();
  cls = db.classes.find(
    (row) =>
      row.campusId === 'c1' &&
      row.schoolYear === activeYearId(db) &&
      row.teacherIds?.length &&
      db.children.some((child) => child.classId === row.id && child.status === 'ACTIVE'),
  );
  // Bỏ điểm danh/sổ có sẵn của ngày thử để đi đúng luồng
  writeDb((d) => {
    d.attendance = d.attendance.filter((r) => r.date !== date);
    d.mealCounts = d.mealCounts.filter((m) => m.date !== date);
    d.mealHandovers = d.mealHandovers.filter((h) => h.date !== date);
    d.leaveRequests = (d.leaveRequests || []).filter((l) => !(l.fromDate <= date && l.toDate >= date));
  });
  childIds = readDb()
    .children.filter((ch) => ch.classId === cls.id && ch.status === 'ACTIVE')
    .map((ch) => ch.id);
  vp = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: cls.campusId };
  teacher = { id: cls.teacherIds[0], role: 'TEACHER', campusId: cls.campusId };
});
afterEach(() => {
  globalThis.Date = RealDate;
});

test('ATT-02: có mặt là ăn đủ các bữa của nhóm tuổi, bỏ qua meals client gửi', async () => {
  await repo.saveClassAttendance({ classId: cls.id, date, entries: [{ childId: childIds[0], status: 'PRESENT', meals: {} }] }, teacher);
  const record = readDb().attendance.find((r) => r.childId === childIds[0] && r.date === date);
  assert.ok(Object.keys(record.meals).length > 0);
  assert.ok(Object.values(record.meals).every(Boolean), 'mọi bữa của nhóm tuổi đều được tính');
});

test('ATT-09: giáo viên gửi Vắng có phép khi chưa có báo nghỉ ⇒ 422 kèm lỗi dòng; Vắng không phép lưu được', async () => {
  await assert.rejects(
    repo.saveClassAttendance({ classId: cls.id, date, entries: [{ childId: childIds[0], status: 'EXCUSED' }] }, teacher),
    (err) => err.status === 422 && !!err.details?.[childIds[0]]?.status,
  );
  await repo.saveClassAttendance({ classId: cls.id, date, entries: [{ childId: childIds[0], status: 'UNEXCUSED' }] }, teacher);
  assert.equal(readDb().attendance.find((r) => r.childId === childIds[0] && r.date === date).status, 'UNEXCUSED');
});

test('NUT-02: còn trẻ chưa điểm danh thì chặn xác nhận; điều chỉnh chỉ suất thay thế', async () => {
  setClock('2026-10-19T10:00:00+07:00'); // sau giờ chốt: sổ được tổng hợp
  const { counts } = await repo.getMealCounts({ date }, vp);
  const target = counts.find((c) => c.id && c.classes.some((line) => line.classId === cls.id));
  assert.ok(
    target.classes.some((line) => line.missing > 0),
    'sổ trả số trẻ chưa điểm danh từng lớp',
  );
  await assert.rejects(repo.confirmMealCount(target.id, vp), rejectStatus(409));

  const base = { campusId: cls.campusId, date, session: target.session, classId: cls.id, note: 'Trẻ dị ứng nặng' };
  await assert.rejects(repo.adjustMealDay({ ...base, normal: 5, substitute: 1 }, vp), rejectStatus(422));
  const before = target.classes.find((line) => line.classId === cls.id);
  const [adjusted] = await repo.adjustMealDay({ ...base, normal: null, substitute: before.substitute + 2 }, vp);
  const line = adjusted.classes.find((l) => l.classId === cls.id);
  assert.equal(line.substitute, before.substitute + 2);
  assert.equal(line.normal, before.normal, 'suất thường không đổi qua điều chỉnh');

  completeAttendance({ campusId: cls.campusId, date });
  const confirmed = await repo.confirmMealCount(target.id, vp);
  assert.equal(confirmed.status, 'CONFIRMED');
});

test('NUT-02: điều chỉnh suất thay thế không bị điểm danh mở lại ghi đè', async () => {
  completeAttendance({ campusId: cls.campusId, date });
  setClock('2026-10-19T10:00:00+07:00');
  const { counts } = await repo.getMealCounts({ date }, vp);
  const target = counts.find((c) => c.id && c.classes.some((l) => l.classId === cls.id));
  await repo.adjustMealDay(
    { campusId: cls.campusId, date, session: target.session, classId: cls.id, normal: null, substitute: 4, note: 'Dị ứng' },
    vp,
  );
  await repo.unlockAttendanceDay(
    { classId: cls.id, date, validUntil: new RealDate(clock + 3600000).toISOString(), reason: 'Sửa điểm danh' },
    vp,
  );
  await repo.saveClassAttendance({ classId: cls.id, date, entries: [{ childId: childIds[0], status: 'UNEXCUSED' }] }, teacher);
  const stored = readDb().mealCounts.find((m) => m.id === target.id);
  const line = (stored.pendingClasses || stored.classes).find((l) => l.classId === cls.id);
  assert.equal(line.substitute, 4);
});
