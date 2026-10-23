import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
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
  await attendance.getDayInfo(todayInput(), 'cls_c1_c1', minhAnh);
  const board = await pickups.getPickupBoard({ classId: 'cls_c1_c1' }, minhAnh);
  const [a, b, c] = board.rows.filter((r) => r.status === 'WAITING').map((r) => r.child.id);
  assert.ok(a && b && c, 'có ít nhất 3 trẻ chờ đón');

  const declined = { childId: a, verification: 'PHONE_DECLINED', pickupPersonName: '', pickupPersonRelation: '', note: '  ' };
  await rejectsNote(pickups.recordPickupResult(declined, minhAnh));
  const saved = await pickups.recordPickupResult({ ...declined, note: 'Gọi mẹ 2 lần, không nghe máy (giả).' }, minhAnh);
  assert.equal(saved.outcome, 'NOT_HANDED_OVER');

  const confirmed = {
    childId: b,
    verification: 'PHONE_CONFIRMED',
    pickupPersonName: 'Người đón (giả)',
    pickupPersonRelation: 'Khác',
    handoverTime: '16:30',
    note: '',
  };
  await rejectsNote(pickups.recordPickupResult(confirmed, minhAnh));
  const handed = await pickups.recordPickupResult({ ...confirmed, note: 'Mẹ đồng ý cho người này đón (giả).' }, minhAnh);
  assert.equal(handed.outcome, 'HANDED_OVER');

  const child = readDb().children.find((x) => x.id === c);
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
