import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { pickupMockRepository: pickups } = await import('@/services/pickup/mock/pickupMockRepository');
const { todayInput } = await import('@/utils/format');

/*
 * Đón trẻ (user chốt 2026-10-27): chỉ trẻ điểm danh Có mặt hôm nay mới Chờ đón và trả được. Trẻ vắng, chưa điểm danh vẫn
 * hiện trên bảng nhưng BE giả từ chối ghi trả (409). Dữ liệu giả của seed, lớp Chồi 1 (cô Minh Anh).
 */
test('chỉ trẻ điểm danh Có mặt mới chờ đón và trả được; trẻ vắng, chưa điểm danh bị từ chối 409', async () => {
  const minhAnh = readDb().users.find((u) => u.email === 'minhanh.le@carenest.edu.vn');
  const today = todayInput();
  await attendance.getDayInfo(today, 'cls_c1_c1', minhAnh);
  // Điểm danh hôm nay của lớp: trẻ 1 Có mặt, trẻ 2 Vắng có phép, trẻ 3 chưa điểm danh
  const [present, absent, unmarked] = writeDb((db) => {
    const kids = db.children.filter((ch) => ch.classId === 'cls_c1_c1' && ch.status === 'ACTIVE').slice(0, 3);
    const ids = kids.map((ch) => ch.id);
    db.attendance = db.attendance.filter((r) => !(ids.includes(r.childId) && r.date === today));
    const mark = (ch, status) =>
      db.attendance.push({ id: `att_test_${ch.id}`, date: today, childId: ch.id, classId: ch.classId, status, meals: {} });
    mark(kids[0], 'PRESENT');
    mark(kids[1], 'EXCUSED');
    return ids;
  });

  const board = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);
  const statusOf = (id) => board.rows.find((r) => r.child.id === id)?.status;
  assert.equal(statusOf(present), 'WAITING');
  assert.equal(statusOf(absent), 'ABSENT');
  assert.equal(statusOf(unmarked), 'UNMARKED');
  assert.equal((await pickups.getPickupChild(unmarked, minhAnh)).status, 'UNMARKED');

  const handOver = (childId) =>
    pickups.recordPickupResult(
      {
        childId,
        verification: 'PHONE_CONFIRMED',
        pickupPersonName: '',
        pickupPersonRelation: '',
        handoverTime: '16:30',
        note: 'Mẹ đồng ý cho bà đón (giả).',
      },
      minhAnh,
    );
  await assert.rejects(handOver(unmarked), (err) => err.status === 409 && /chưa được điểm danh có mặt/.test(err.message));
  await assert.rejects(handOver(absent), (err) => err.status === 409 && /vắng/.test(err.message));
  assert.equal((await handOver(present)).outcome, 'HANDED_OVER');

  const after = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);
  assert.equal(after.rows.find((r) => r.child.id === present).status, 'PICKED_UP');
});
