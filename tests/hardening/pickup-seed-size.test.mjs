import assert from 'node:assert/strict';
import { test } from 'node:test';

// localStorage giả có hạn mức gần trình duyệt (~5 triệu ký tự), như tests/menu/assessment-seed-size.test.mjs
const QUOTA = 5_000_000;
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => {
    if (String(v).length > QUOTA) throw new DOMException('quota', 'QuotaExceededError');
    values.set(k, String(v));
  },
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { pickupMockRepository: pickups } = await import('@/services/pickup/mock/pickupMockRepository');
const { DEMO_CLASS_IDS } = await import('@/mocks/demoClasses');
const { todayInput } = await import('@/utils/format');

/*
 * FE-BUG-261023-pickup-seed-quota: lần đầu mở Đón trẻ ghi lịch sử đón mẫu của mọi lớp (~350 nghìn ký tự) làm DB demo
 * vượt hạn mức ⇒ 507 "Bộ nhớ trình duyệt đã đầy". Lịch sử mẫu chỉ còn cho lớp demo (dữ liệu giả).
 */
test('lịch sử đón trẻ mẫu chỉ thuộc lớp demo và đủ nhỏ; lớp demo vẫn có lịch sử', async () => {
  const minhAnh = readDb().users.find((u) => u.email === 'minhanh.le@carenest.edu.vn');
  await attendance.getDayInfo(todayInput(), 'cls_c1_c1', minhAnh);
  await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);

  const db = readDb();
  assert.ok(db.attendance?.length > 0, 'có điểm danh mẫu');
  assert.ok(db.pickups.length > 0, 'vẫn có lịch sử đón để demo');
  assert.deepEqual(
    [...new Set(db.pickups.map((p) => p.classId))].filter((id) => !DEMO_CLASS_IDS.has(id)),
    [],
  );
  const size = JSON.stringify(db.pickups).length;
  assert.ok(size < 100_000, `lịch sử đón mẫu ${size} ký tự, cần < 100.000`);

  const pastDay = [...new Set(db.pickups.filter((p) => p.classId === 'cls_c1_c1').map((p) => p.date))].sort().at(-1);
  const board = await pickups.getPickupBoard({ classId: 'cls_c1_c1', date: pastDay }, minhAnh);
  assert.ok(board.rows.some((r) => r.status === 'PICKED_UP'), 'lớp demo có trẻ đã đón ở ngày trước');
});
