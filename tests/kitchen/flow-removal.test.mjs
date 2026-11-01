import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { completeAttendance } = await import('./complete-attendance.mjs');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };

const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

test('Bếp mới không thêm API chế biến; giữ nguyên API điểm danh của dev', () => {
  for (const name of ['getMealPreparations', 'updateMealPreparation']) assert.equal(kitchen[name], undefined, name);
  for (const name of ['getMealHandovers', 'confirmHandover', 'reportHandoverShortage', 'supplementHandover'])
    assert.equal(typeof attendance[name], 'function', name);
  assert.equal(attendance.confirmMealCountDay, undefined, 'không kéo theo API chốt ngày của incoming');
});

test('Dữ liệu mẫu của bếp không tạo bảng chế biến', async () => {
  await kitchen.getDryStock(VP);
  assert.equal(readDb().mealPreparations, undefined);
});

test('PHT tiếp tục chốt từng bữa qua API hiện tại; bếp không xóa dữ liệu bàn giao cũ', async () => {
  // Ngày đã khóa nhưng ngoài các ngày mẫu đã chốt sẵn ⇒ còn sĩ số chờ PHT xác nhận
  let pending = null;
  for (let n = 1; n <= 30 && !pending; n += 1) {
    const { counts } = await attendance.getMealCounts({ date: isoDaysAgo(n) }, VP);
    pending = counts.find((c) => c.id && c.status === 'PENDING_CONFIRMATION') || null;
  }
  assert.ok(pending, 'cần một sĩ số chờ xác nhận trong 30 ngày gần nhất');

  const before = structuredClone(readDb().mealHandovers);
  // NUT-02: còn trẻ chưa điểm danh thì chưa xác nhận được
  await assert.rejects(attendance.confirmMealCount(pending.id, VP), (err) => err.status === 409);
  completeAttendance({ campusId: pending.campusId, date: pending.date });
  const confirmed = await attendance.confirmMealCount(pending.id, VP);
  assert.equal(confirmed.status, 'CONFIRMED');
  await kitchen.getKitchenDay({ campusId: pending.campusId, date: pending.date }, VP);
  for (const row of before) assert.ok(readDb().mealHandovers.some((item) => item.id === row.id));
});
