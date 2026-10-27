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
 * "Gọi phụ huynh" ở Đón trẻ (user chốt 2026-10-23): nội dung cuộc gọi bắt buộc cho cả Trả trẻ và Không trả; khớp ảnh không cần.
 * Dữ liệu giả của seed, lớp Chồi 1 (cô Minh Anh).
 */
const rejectsNote = (promise) => assert.rejects(promise, (err) => err.status === 422 && !!err.details?.note);

test('gọi phụ huynh: thiếu nội dung cuộc gọi ⇒ 422 note; có nội dung thì ghi nhận; khớp ảnh không cần ghi chú', async () => {
  const minhAnh = readDb().users.find((u) => u.email === 'minhanh.le@carenest.edu.vn');
  const today = todayInput();
  await attendance.getDayInfo(today, 'cls_c1_c1', minhAnh);
  // Chỉ trẻ điểm danh Có mặt mới chờ đón (user chốt 2026-10-27): ghi Có mặt cho trẻ chưa điểm danh hôm nay
  writeDb((db) => {
    db.children
      .filter((ch) => ch.classId === 'cls_c1_c1' && ch.status === 'ACTIVE')
      .filter((ch) => !db.attendance.some((r) => r.childId === ch.id && r.date === today))
      .forEach((ch) =>
        db.attendance.push({ id: `att_test_${ch.id}`, date: today, childId: ch.id, classId: ch.classId, status: 'PRESENT', meals: {} }),
      );
  });
  const board = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);
  const [a, b, c] = board.rows.filter((r) => r.status === 'WAITING').map((r) => r.child.id);
  assert.ok(a && b && c, 'có ít nhất 3 trẻ chờ đón');

  const declined = { childId: a, verification: 'PHONE_DECLINED', pickupPersonName: '', pickupPersonRelation: '', note: '  ' };
  await rejectsNote(pickups.recordPickupResult(declined, minhAnh));
  const saved = await pickups.recordPickupResult({ ...declined, note: 'Gọi mẹ 2 lần, không nghe máy (giả).' }, minhAnh);
  assert.equal(saved.outcome, 'NOT_HANDED_OVER');

  // Trả trẻ ghi ngay trong modal (user chốt 2026-10-24): không có họ tên/quan hệ người đón, người đón nằm trong nội dung cuộc gọi.
  const confirmed = {
    childId: b,
    verification: 'PHONE_CONFIRMED',
    pickupPersonName: '',
    pickupPersonRelation: '',
    handoverTime: '16:30',
    note: '',
  };
  await rejectsNote(pickups.recordPickupResult(confirmed, minhAnh));
  const handed = await pickups.recordPickupResult({ ...confirmed, note: 'Mẹ đồng ý cho chú Hùng đón (giả).' }, minhAnh);
  assert.equal(handed.outcome, 'HANDED_OVER');
  assert.equal(handed.pickupPersonName, '');
  assert.ok(handed.handedOverAt);
  const board2 = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);
  assert.equal(board2.rows.find((r) => r.child.id === b).status, 'PICKED_UP');

  const child = readDb().children.find((x) => x.id === c);
  await assert.rejects(
    pickups.recordPickupResult({ childId: c, verification: 'PHOTO_MATCH', pickupPersonName: '', handoverTime: '16:35' }, minhAnh),
    (err) => err.status === 422 && !!err.details?.pickupPersonName,
  );
  const photo = await pickups.recordPickupResult(
    {
      childId: c,
      verification: 'PHOTO_MATCH',
      pickupPersonName: child.guardians[0].fullName,
      pickupPersonRelation: child.guardians[0].relation,
      handoverTime: '16:35',
      note: '',
    },
    minhAnh,
  );
  assert.equal(photo.outcome, 'HANDED_OVER');
});
