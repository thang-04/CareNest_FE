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
const { notificationMockRepository: notifications } = await import('@/mocks/notificationMockRepository');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { assessmentMockRepository: assessment } = await import('@/services/assessment/mock/assessmentMockRepository');

const HT = { id: 'u_hung', role: 'PRINCIPAL' };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };

test('mỗi tài khoản demo có vài thông báo, có cả chưa đọc; nạp lại không trùng', async () => {
  for (const userId of ['u_hung', 'u_lan', 'u_duc', 'u_ha', 'u_minhanh', 'u_an', 'u_mai', 'u_binh']) {
    const list = await notifications.list(userId);
    assert.ok(list.length >= 2, `${userId} có ${list.length} thông báo`);
    assert.ok(
      list.some((n) => !n.read),
      `${userId} có thông báo chưa đọc`,
    );
  }
  const total = readDb().notifications.length;
  await notifications.list('u_hung');
  assert.equal(readDb().notifications.length, total);
});

test('DB cũ đã có thông báo vẫn được bổ sung thông báo demo một lần', async () => {
  writeDb((db) => {
    db.notifications = db.notifications.filter((n) => !n.id.startsWith('n_demo_'));
    delete db.mockSeedVersions.notifications;
  });
  assert.ok((await notifications.list('u_minhanh')).some((n) => n.id.startsWith('n_demo_')));
});

test('lịch sử mở lại ngày điểm danh và đánh giá có dữ liệu cho cả hai điểm trường', async () => {
  // Chỉ PHT mở lại điểm danh (BA) ⇒ mỗi PHT thấy lịch sử của campus mình
  const att = [
    ...(await attendance.listAttendanceDayUnlocks(VP)),
    ...(await attendance.listAttendanceDayUnlocks({ id: 'u_duc', role: 'VICE_PRINCIPAL', campusId: 'c2' })),
  ];
  assert.deepEqual([...new Set(att.map((u) => u.campusId))].sort(), ['c1', 'c2']);
  const asm = await assessment.listAssessmentDayUnlocks(HT);
  assert.ok(asm.length >= 2);
});

test('lớp Chồi 1 của giáo viên demo có đánh giá cuối năm và đề xuất khen thưởng', () => {
  const db = readDb();
  assert.ok(db.yearEndEvaluations.some((e) => e.classId === 'cls_c1_c1'));
  assert.ok(db.rewardProposals.some((p) => p.classId === 'cls_c1_c1' && p.createdBy === 'u_minhanh'));
});

test('hàng chờ duyệt của Phó HT có chủ đề nhánh chờ duyệt', () => {
  const db = readDb();
  const pending = db.eduClassBranch.filter((b) => b.status === 'PENDING_VP');
  assert.ok(pending.some((b) => db.classes.find((c) => c.id === b.classId)?.campusId === VP.campusId));
  assert.ok(
    pending.every((b) => !b.history.some((h) => h.by === 'Giáo viên lớp Chồi 3')),
    'tên người gửi lấy từ giáo viên của lớp',
  );
});
