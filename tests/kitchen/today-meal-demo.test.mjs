import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

// 00:30 thứ Ba: trước giờ khóa 8:45. Số suất hôm nay chạy như thật (Cần chốt 21/10/2026):
// trước giờ chốt là sổ tạm tính, tới giờ chốt mới tổng hợp, PHT bấm xác nhận thì bếp mới nhận số.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T00:30:00+07:00') });
const TODAY = '2026-10-20';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { completeAttendance } = await import('./complete-attendance.mjs');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };

test('demo: trước giờ chốt sổ hôm nay chỉ tạm tính, chưa ai xác nhận, bếp chưa có suất bàn giao', async () => {
  const { counts } = await attendance.getMealCounts({ date: TODAY }, VP);
  assert.ok(counts.length > 0);
  assert.ok(
    counts.every((c) => c.status === 'OPEN' && !c.id),
    'không tự tổng hợp / xác nhận trước giờ chốt',
  );
  assert.ok(counts.some((c) => c.totals.normal + c.totals.substitute > 0), 'đã có điểm danh mẫu nên có số tạm tính');
  assert.equal(readDb().mealCounts.filter((m) => m.date === TODAY).length, 0);
  const { handovers } = await attendance.getMealHandovers({ date: TODAY }, COOK);
  assert.equal(handovers.length, 0);
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

test('demo: mở lại nhiều lần không tạo trùng điểm danh', async () => {
  const records = readDb().attendance.filter((r) => r.date === TODAY).length;
  await attendance.getMealCounts({ date: TODAY }, VP);
  assert.equal(readDb().attendance.filter((r) => r.date === TODAY).length, records);
});

test('tới giờ chốt: sổ chờ PHT xác nhận; PHT bấm xác nhận thì bếp mới thấy số và suất bàn giao', async () => {
  mock.timers.tick(9 * 3600 * 1000); // 09:30
  const { counts } = await attendance.getMealCounts({ date: TODAY }, VP);
  const c1 = counts.filter((c) => c.campusId === 'c1');
  assert.ok(c1.length > 0);
  assert.ok(c1.every((c) => c.status === 'PENDING_CONFIRMATION'));
  const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
  const before = await kitchen.getConfirmedMealCount({ campusId: 'c1', date: TODAY }, COOK);
  assert.ok(before.every((s) => s.status !== 'CONFIRMED'), 'bếp chưa nhận số khi PHT chưa xác nhận');
  // NUT-02: lớp Chồi 1 chưa điểm danh ⇒ chặn xác nhận, nêu tên lớp; điểm danh đủ rồi mới xác nhận được
  await assert.rejects(attendance.confirmMealCount(c1[0].id, VP), (err) => err.status === 409 && /Chồi 1/.test(err.message));
  completeAttendance({ campusId: 'c1', date: TODAY });
  for (const c of c1) await attendance.confirmMealCount(c.id, VP);
  const after = await kitchen.getConfirmedMealCount({ campusId: 'c1', date: TODAY }, COOK);
  assert.ok(after.length > 0);
  assert.ok(after.every((s) => s.status === 'CONFIRMED'));
  const { handovers } = await attendance.getMealHandovers({ date: TODAY }, COOK);
  assert.ok(handovers.length > 0);
});
