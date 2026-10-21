import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

// 00:30 thứ Ba: trước giờ khóa 8:45, luồng thật chưa có số suất
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T00:30:00+07:00') });
const TODAY = '2026-10-20';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };

test('demo: số suất hôm nay đã được Phó HT xác nhận ngay khi mở app, bếp thấy suất cần bàn giao', async () => {
  const { counts } = await attendance.getMealCounts({ date: TODAY }, VP);
  assert.ok(counts.length > 0);
  assert.ok(
    counts.every((c) => c.status === 'CONFIRMED'),
    'mọi bữa hôm nay đã xác nhận',
  );
  assert.ok(counts.every((c) => c.totals.normal + c.totals.substitute > 0));
  const { handovers } = await attendance.getMealHandovers({ date: TODAY }, COOK);
  assert.ok(handovers.length > 0);
});

test('demo: lớp Chồi 1 của giáo viên demo vẫn để trống điểm danh hôm nay', () => {
  const db = readDb();
  // Chỉ còn bản ghi "phụ huynh báo nghỉ" của seed nghỉ phép, không có bản ghi giáo viên điểm danh
  assert.deepEqual(
    db.attendance.filter((r) => r.date === TODAY && r.classId === 'cls_c1_c1' && !r.leaveRequestId),
    [],
  );
  assert.ok(db.attendance.some((r) => r.date === TODAY && r.classId === 'cls_c1_m1'));
});

test('demo: mở lại nhiều lần không tạo trùng số suất hay điểm danh', async () => {
  const before = readDb();
  const counts = before.mealCounts.filter((m) => m.date === TODAY).length;
  const records = before.attendance.filter((r) => r.date === TODAY).length;
  await attendance.getMealCounts({ date: TODAY }, VP);
  const after = readDb();
  assert.equal(after.mealCounts.filter((m) => m.date === TODAY).length, counts);
  assert.equal(after.attendance.filter((r) => r.date === TODAY).length, records);
});

test('demo: sang ngày mới, bếp mở app trước vẫn thấy số suất hôm nay đã xác nhận', async () => {
  // DB lưu từ hôm trước: chưa có điểm danh / số suất của ngày hôm nay
  writeDb((db) => {
    db.mealCounts = db.mealCounts.filter((m) => m.date !== TODAY);
    db.mealHandovers = db.mealHandovers.filter((h) => h.date !== TODAY);
    db.attendance = db.attendance.filter((r) => r.date !== TODAY);
    db.todayMealDemoDate = '2026-10-19';
  });
  const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
  const sessions = await kitchen.getConfirmedMealCount({ campusId: 'c1', date: TODAY }, COOK);
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((s) => s.status === 'CONFIRMED'));
});
