import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, mock, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { resetDb, writeDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { CHILD_HISTORY_ACTION_LABELS } = await import('@/models/children/childrenConstants');
const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi } = await import('@/services/children/api/childrenApi');

/*
 * G94-180/CHD-03 (user 25/11): trẻ có lịch nghỉ vẫn ACTIVE; hủy lịch trả trẻ về như chưa hẹn; tới ngày thì chuyển Đã nghỉ học.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const listSrc = readFileSync('src/pages/children/ChildrenListPage.jsx', 'utf8');
const profileSrc = readFileSync('src/pages/children/ChildProfilePage.jsx', 'utf8');
const modalSrc = readFileSync('src/components/children/CancelScheduledLeaveModal.jsx', 'utf8');
const serviceSrc = readFileSync('src/services/children/childrenService.js', 'utf8');
const hookSrc = readFileSync('src/hooks/children/useChildRecords.js', 'utf8');

const activeChild = () => ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE');
const NOW = () => mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });

beforeEach(() => {
  mock.timers.reset();
  storage.clear();
  resetDb();
});

test('mock hủy lịch: trẻ hết scheduledLeaveOn/Reason, vẫn ACTIVE, lịch sử có LEAVE_CANCELLED; lịch xuất hiện ở danh sách', async () => {
  NOW();
  const child = activeChild();
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  const listed = (await children.listChildren({}, PRINCIPAL)).find((c) => c.id === child.id);
  assert.equal(listed.scheduledLeaveOn, '2026-12-16');
  const view = await children.cancelScheduledLeave(child.id, PRINCIPAL);
  assert.equal(view.status, 'ACTIVE');
  assert.ok(!view.scheduledLeaveOn);
  assert.ok(!view.scheduledLeaveReason);
  assert.deepEqual(
    view.history.map((h) => h.action).filter((a) => a.startsWith('LEAVE_')),
    ['LEAVE_SCHEDULED', 'LEAVE_CANCELLED'],
  );
  // hủy lại khi không còn lịch ⇒ lỗi
  await assert.rejects(() => children.cancelScheduledLeave(child.id, PRINCIPAL));
});

test('mock áp lịch tới ngày: scheduledLeaveOn <= hôm nay ⇒ LEFT, leftAt = ngày hẹn, lịch được xóa', async () => {
  NOW();
  const child = activeChild();
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 11, 18, 12, 0, 0) });
  const list = await children.listChildren({}, PRINCIPAL);
  const after = list.find((c) => c.id === child.id);
  assert.equal(after.status, 'LEFT');
  assert.equal(after.leftAt, '2026-12-16');
  assert.equal(after.leftReason, 'Chuyển nhà');
  assert.ok(!after.scheduledLeaveOn);
  assert.ok(after.history.some((h) => h.action === 'WITHDRAWN'));
});

test('mock chưa tới ngày hẹn ⇒ trẻ vẫn ACTIVE', async () => {
  NOW();
  const child = activeChild();
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  const list = await children.listChildren({}, PRINCIPAL);
  assert.equal(list.find((c) => c.id === child.id).status, 'ACTIVE');
});

test('mock: đã có lịch nghỉ thì mọi lần cho nghỉ (kể cả hôm nay) bị chặn bằng lỗi ô leftAt', async () => {
  NOW();
  const child = activeChild();
  writeDb((d) => {
    d.attendance = (d.attendance || []).filter((r) => r.childId !== child.id);
  });
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-25', reason: 'Đổi ý' }, PRINCIPAL),
    (err) => err.details?.leftAt === 'Trẻ đã có lịch nghỉ học từ 16/12/2026. Hủy lịch nghỉ trước khi chọn ngày khác',
  );
});

test('nhãn lịch sử LEAVE_SCHEDULED / LEAVE_CANCELLED', () => {
  assert.equal(CHILD_HISTORY_ACTION_LABELS.LEAVE_SCHEDULED, 'Hẹn nghỉ học');
  assert.equal(CHILD_HISTORY_ACTION_LABELS.LEAVE_CANCELLED, 'Hủy lịch nghỉ học');
});

test('childrenApi.cancelScheduledLeave gọi DELETE /children/{id}/scheduled-leave', async () => {
  const calls = [];
  const original = axiosClient.delete;
  axiosClient.delete = async (url) => {
    calls.push(url);
    return { data: { success: true, data: { id: 11, status: 'ACTIVE' } } };
  };
  try {
    await childrenApi.cancelScheduledLeave('11');
  } finally {
    axiosClient.delete = original;
  }
  assert.deepEqual(calls, ['/children/11/scheduled-leave']);
});

test('facade có cancelScheduledLeave', () => {
  assert.match(serviceSrc, /export const cancelScheduledLeave = \(childId, user\) => repo\.cancelScheduledLeave\(childId, user\);/);
});

test('danh sách: "Nghỉ từ dd/mm/yyyy" dưới nhãn, thao tác "Hủy lịch nghỉ" thay "Cho nghỉ học", cùng quyền canWithdrawChild', () => {
  assert.match(listSrc, /Nghỉ từ \{formatDate\(c\.scheduledLeaveOn\)\}/);
  assert.match(listSrc, /canWithdrawChild\(c, user\) &&\s*\(c\.scheduledLeaveOn\s*\?/);
  assert.match(listSrc, /label: 'Hủy lịch nghỉ'/);
  assert.match(listSrc, /label: 'Cho nghỉ học'/);
  assert.match(listSrc, /<CancelScheduledLeaveModal/);
});

test('hồ sơ: thông báo lịch nghỉ + nút "Hủy lịch nghỉ" cùng quyền, reload khi xong', () => {
  assert.match(profileSrc, /Lịch nghỉ học: từ \{formatDate\(child\.scheduledLeaveOn\)\}/);
  assert.match(profileSrc, /Lý do: \{child\.scheduledLeaveReason\}/);
  assert.match(profileSrc, /canWithdrawChild\(child, user\)/);
  assert.match(profileSrc, /Hủy lịch nghỉ/);
  assert.match(profileSrc, /<CancelScheduledLeaveModal/);
  assert.match(profileSrc, /reload\(\{ silent: true \}\)/);
});

test('hộp hủy: ConfirmationModal, tiêu đề, nội dung, gọi facade, toast lỗi', () => {
  assert.match(modalSrc, /<ConfirmationModal/);
  assert.match(modalSrc, /`Hủy lịch nghỉ học của \$\{child\.fullName\}\?`/);
  assert.match(modalSrc, /Trẻ tiếp tục học như chưa cho nghỉ\. Quyết định Nghỉ học trên bảng xếp lớp năm mới cũng bị bỏ\./);
  assert.match(modalSrc, /cancelScheduledLeave\(child\.id, user\)/);
  assert.match(modalSrc, /toast\.error\(err, 'Không hủy được lịch nghỉ'\)/);
});

test('JSDoc useLeaveOptions không còn nextSchoolDay', () => {
  assert.doesNotMatch(hookSrc, /nextSchoolDay/);
});

test('hủy lịch: ghi chú "Lịch nghỉ học từ ..." không có tiền tố Lý do; hủy khi không có lịch ⇒ 409', async () => {
  NOW();
  const { profileHistoryRows } = await import('@/utils/children/profileHistory');
  const child = activeChild();
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  const view = await children.cancelScheduledLeave(child.id, PRINCIPAL);
  const rows = profileHistoryRows(view.history);
  assert.equal(rows.find((r) => r.note.startsWith('Lịch nghỉ học từ')).noteText, 'Lịch nghỉ học từ 16/12/2026');
  assert.equal(rows.find((r) => r.note === 'Chuyển nhà').noteText, 'Lý do: Chuyển nhà');
  await assert.rejects(
    () => children.cancelScheduledLeave(child.id, PRINCIPAL),
    (err) => err.status === 409 && err.message === 'Trẻ không có lịch nghỉ học chưa tới ngày',
  );
});

test('xếp lớp từ ngày nghỉ trở đi bị từ chối khi trẻ có lịch nghỉ', async () => {
  NOW();
  const child = ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE' && c.classId);
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  await assert.rejects(
    () => children.placeChild(child.id, { classId: 'x', reason: 'r', effectiveDate: '2026-12-16' }, PRINCIPAL),
    (err) => err.details?.effectiveDate === 'Trẻ nghỉ học từ 16/12/2026. Hủy lịch nghỉ trước khi xếp lớp từ ngày này',
  );
});
