import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb, DB_CHANGED_EVENT } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: repo } = await import('@/services/attendance/mock/attendanceMockRepository');
const { assessmentMockRepository } = await import('@/services/assessment/mock/assessmentMockRepository');

/*
 * Lớp demo Chồi 1 (để giáo viên tự điểm danh) luôn có sẵn một trẻ có mặt hôm nay, kể cả khi mở sau giờ chốt.
 * Đánh giá vẫn bù đủ cả lớp; mọi ready() đọc lần hai không ghi DB (FE-BUG-261024-attendance-ready-write-loop).
 */
const DEMO_CLASS = 'cls_c1_c1';
const RealDate = Date;
const useClock = (iso) => {
  const clock = RealDate.parse(iso);
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
};
afterEach(() => {
  globalThis.Date = RealDate;
});

const writesDuring = async (fn) => {
  let count = 0;
  const onChange = () => (count += 1);
  window.addEventListener(DB_CHANGED_EVENT, onChange);
  try {
    await fn();
  } finally {
    window.removeEventListener(DB_CHANGED_EVENT, onChange);
  }
  return count;
};

const demoRecords = (date) => readDb().attendance.filter((r) => r.classId === DEMO_CLASS && r.date === date);
const demoChildren = () => readDb().children.filter((ch) => ch.classId === DEMO_CLASS && ch.status === 'ACTIVE');

test('ngày học sau giờ chốt: lớp demo có đúng một trẻ có mặt, đọc lần hai không ghi DB', async () => {
  useClock('2026-10-29T14:00:00+07:00');
  resetDb();
  await repo.getDayInfo('2026-10-29');
  const present = demoRecords('2026-10-29').filter((r) => r.status === 'PRESENT');
  assert.equal(present.length, 1);
  assert.ok(Object.values(present[0].meals).length && Object.values(present[0].meals).every(Boolean), 'trẻ có mặt ăn mọi bữa');
  assert.ok(demoRecords('2026-10-29').length < demoChildren().length, 'các trẻ còn lại để giáo viên tự điểm danh');
  assert.equal(await writesDuring(() => repo.getDayInfo('2026-10-29')), 0);
});

test('giáo viên đã điểm danh cả lớp vắng: không tự thêm trẻ có mặt', async () => {
  useClock('2026-10-29T08:00:00+07:00');
  resetDb();
  await repo.getDayInfo('2026-10-29');
  writeDb((db) => {
    db.attendance = db.attendance.filter((r) => !(r.classId === DEMO_CLASS && r.date === '2026-10-29'));
    demoChildren().forEach((ch) =>
      db.attendance.push({ id: `t_${ch.id}`, date: '2026-10-29', childId: ch.id, classId: DEMO_CLASS, campusId: ch.campusId, status: 'UNEXCUSED', meals: {}, history: [] }),
    );
  });
  assert.equal(await writesDuring(() => repo.getDayInfo('2026-10-29')), 0);
  assert.equal(demoRecords('2026-10-29').filter((r) => r.status === 'PRESENT').length, 0);
});

test('mở đánh giá sau điểm danh: bù đủ cả lớp demo, đọc lần hai không ghi DB', async () => {
  useClock('2026-10-29T14:00:00+07:00');
  resetDb();
  await repo.getDayInfo('2026-10-29');
  await assessmentMockRepository.getCriteria();
  assert.equal(demoRecords('2026-10-29').length, demoChildren().length);
  assert.equal(await writesDuring(() => assessmentMockRepository.getCriteria()), 0);
});

test('thứ Bảy: đọc đánh giá lần hai không ghi DB', async () => {
  useClock('2026-10-31T10:00:00+07:00');
  resetDb();
  await assessmentMockRepository.getCriteria();
  assert.equal(await writesDuring(() => assessmentMockRepository.getCriteria()), 0);
});
