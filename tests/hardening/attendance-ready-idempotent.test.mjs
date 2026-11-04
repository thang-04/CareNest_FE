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

/*
 * FE-BUG-261024-attendance-ready-write-loop: đọc điểm danh không được ghi DB lặp lại. Mỗi lần ghi phát DB_CHANGED_EVENT,
 * useAsync tải lại ⇒ lại ghi ⇒ treo tab (thứ Bảy/Chủ nhật, hoặc đơn báo nghỉ không áp được).
 */
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

test('thứ Bảy: đọc điểm danh lần hai không ghi DB', async () => {
  useClock('2026-10-24T10:00:00+07:00');
  resetDb();
  await repo.getDayInfo('2026-10-24');
  assert.ok(
    readDb().leaveRequests.some((l) => l.status === 'SUBMITTED' && l.fromDate === '2026-10-24'),
    'seed có đơn báo nghỉ phủ hôm nay',
  );
  assert.equal(await writesDuring(() => repo.getDayInfo('2026-10-24')), 0);
});

test('ngày học: đơn báo nghỉ của trẻ đã nghỉ học không làm mỗi lần đọc ghi DB', async () => {
  useClock('2026-10-19T10:00:00+07:00');
  resetDb();
  await repo.getDayInfo('2026-10-19');
  writeDb((db) => {
    const child = db.children.find(
      (ch) => ch.status === 'ACTIVE' && !db.attendance.some((r) => r.childId === ch.id && r.date === '2026-10-20'),
    );
    child.status = 'LEFT';
    db.leaveRequests.push({ id: 'leave-test', childId: child.id, fromDate: '2026-10-19', toDate: '2026-10-19', status: 'SUBMITTED' });
    db.attendance = db.attendance.filter((r) => !(r.childId === child.id && r.date === '2026-10-19'));
  });
  await repo.getDayInfo('2026-10-19');
  assert.equal(await writesDuring(() => repo.getDayInfo('2026-10-19')), 0);
});
