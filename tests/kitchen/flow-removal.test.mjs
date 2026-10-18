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

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };

const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

test('Bếp không còn API chế biến, điểm danh không còn API bàn giao suất ăn', () => {
  for (const name of ['getMealPreparations', 'updateMealPreparation']) assert.equal(kitchen[name], undefined, name);
  for (const name of ['getMealHandovers', 'confirmHandover', 'reportHandoverShortage', 'supplementHandover'])
    assert.equal(attendance[name], undefined, name);
});

test('Dữ liệu mẫu của bếp không tạo bảng chế biến', async () => {
  await kitchen.getDryStock(VP);
  assert.equal(readDb().mealPreparations, undefined);
});

test('PHT chốt số suất không sinh bàn giao suất ăn', async () => {
  // Ngày đã khóa nhưng ngoài các ngày mẫu đã chốt sẵn ⇒ còn sĩ số chờ PHT xác nhận
  let pending = null;
  for (let n = 1; n <= 30 && !pending; n += 1) {
    const { counts } = await attendance.getMealCounts({ date: isoDaysAgo(n) }, VP);
    pending = counts.find((c) => c.id && c.status === 'PENDING_CONFIRMATION') || null;
  }
  assert.ok(pending, 'cần một sĩ số chờ xác nhận trong 30 ngày gần nhất');

  const confirmed = await attendance.confirmMealCountDay({ campusId: pending.campusId, date: pending.date }, VP);
  assert.ok(confirmed.every((c) => c.status === 'CONFIRMED'));
  assert.equal(readDb().mealHandovers, undefined);
});
