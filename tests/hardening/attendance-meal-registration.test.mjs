import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

// ATT-02a/CHD-13: trẻ không báo ăn không bao giờ có suất ăn khi điểm danh.
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
const { mealsWhenPresent } = await import('@/models/attendance/attendanceConstants');
const { buildDayAttendance } = await import('@/mocks/attendanceSeed');

const RealDate = Date;
const date = '2026-10-19';
let clock;
let cls;
let teacher;
let childIds;

beforeEach(async () => {
  clock = RealDate.parse('2026-10-19T07:30:00+07:00');
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
      db.children.filter((child) => child.classId === row.id && child.status === 'ACTIVE').length >= 2,
  );
  writeDb((d) => {
    d.attendance = d.attendance.filter((r) => r.date !== date);
    d.mealCounts = d.mealCounts.filter((m) => m.date !== date);
    d.mealHandovers = d.mealHandovers.filter((h) => h.date !== date);
    d.leaveRequests = (d.leaveRequests || []).filter((l) => !(l.fromDate <= date && l.toDate >= date));
  });
  childIds = readDb()
    .children.filter((ch) => ch.classId === cls.id && ch.status === 'ACTIVE')
    .map((ch) => ch.id);
  teacher = { id: cls.teacherIds[0], role: 'TEACHER', campusId: cls.campusId };
});
afterEach(() => {
  globalThis.Date = RealDate;
});

test('mealsWhenPresent tắt suất cho trẻ không báo ăn', () => {
  assert.deepEqual(mealsWhenPresent({ mealRegistered: false }, ['LUNCH']), { LUNCH: false });
  assert.deepEqual(mealsWhenPresent({}, ['LUNCH']), { LUNCH: true });
  assert.deepEqual(mealsWhenPresent({ mealRegistered: true }, ['LUNCH']), { LUNCH: true });
});
