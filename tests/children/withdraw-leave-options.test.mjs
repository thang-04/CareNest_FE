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

/*
 * G94-180/CHD-03 (user 25/11): cho nghỉ học chọn ngày bất kỳ từ hôm nay tới hết năm học; ngày sau hôm nay = đặt lịch nghỉ
 * (trẻ vẫn ACTIVE); hôm nay khóa khi trẻ đã có dữ liệu trong ngày.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const modalSrc = readFileSync('src/components/children/WithdrawChildModal.jsx', 'utf8');

const activeChild = () => ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE');
const noAttendance = (child) =>
  writeDb((d) => {
    d.attendance = (d.attendance || []).filter((r) => r.childId !== child.id);
  });

beforeEach(() => {
  mock.timers.reset();
  storage.clear();
  resetDb();
});

test('hôm nay có điểm danh ⇒ todayAllowed=false, minDate là ngày mai, maxDate là hết năm học', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 27, 12, 0, 0) });
  const child = activeChild();
  writeDb((d) => {
    d.attendance = [...(d.attendance || []), { id: 'att_x', childId: child.id, date: '2026-11-27', status: 'PRESENT' }];
  });
  const options = await children.getLeaveOptions(child.id, PRINCIPAL);
  assert.equal(options.today, '2026-11-27');
  assert.equal(options.todayAllowed, false);
  assert.match(options.todayBlockedReason, /điểm danh/);
  assert.equal(options.minDate, '2026-11-28');
  assert.equal(options.maxDate, '2027-05-31');
  assert.equal('nextSchoolDay' in options, false);
});

test('trẻ chưa có dữ liệu trong ngày ⇒ todayAllowed=true, minDate là hôm nay', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  noAttendance(child);
  const options = await children.getLeaveOptions(child.id, PRINCIPAL);
  assert.equal(options.todayAllowed, true);
  assert.equal(options.todayBlockedReason, null);
  assert.equal(options.minDate, '2026-11-25');
  assert.equal(options.maxDate, '2027-05-31');
});

test('withdrawChild ngày đã qua ⇒ lỗi leftAt "Ngày nghỉ học không được trước hôm nay"', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-20', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => err.details?.leftAt === 'Ngày nghỉ học không được trước hôm nay',
  );
});

test('withdrawChild sau hết năm học ⇒ lỗi leftAt có ngày kết thúc năm học', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2027-06-01', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => err.details?.leftAt === 'Ngày nghỉ học phải trong năm học (tới 31/05/2027)',
  );
});

test('withdrawChild hôm nay khi trẻ đã có điểm danh ⇒ lỗi leftAt, chọn ngày sau thì đặt lịch', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  writeDb((d) => {
    d.attendance = [...(d.attendance || []), { id: 'att_y', childId: child.id, date: '2026-11-25', status: 'PRESENT' }];
  });
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-25', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => /Thực hiện nghỉ học từ ngày học tiếp theo/.test(err.details?.leftAt),
  );
  const scheduled = await children.withdrawChild(child.id, { leftAt: '2026-11-26', reason: 'Chuyển nhà' }, PRINCIPAL);
  assert.equal(scheduled.status, 'ACTIVE');
  assert.equal(scheduled.scheduledLeaveOn, '2026-11-26');
});

test('withdrawChild hôm nay ⇒ nghỉ ngay (LEFT), không có lịch', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  noAttendance(child);
  const left = await children.withdrawChild(child.id, { leftAt: '2026-11-25', reason: 'Chuyển nhà' }, PRINCIPAL);
  assert.equal(left.status, 'LEFT');
  assert.equal(left.leftAt, '2026-11-25');
  assert.ok(!left.scheduledLeaveOn);
});

for (const [name, date] of [
  ['thứ Bảy', '2026-11-28'],
  ['ngày cách 3 tuần', '2026-12-16'],
]) {
  test(`withdrawChild ${name} ⇒ trẻ vẫn ACTIVE, có scheduledLeaveOn và scheduledLeaveReason`, async () => {
    mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
    const child = activeChild();
    const view = await children.withdrawChild(child.id, { leftAt: date, reason: 'Chuyển nhà' }, PRINCIPAL);
    assert.equal(view.status, 'ACTIVE');
    assert.equal(view.scheduledLeaveOn, date);
    assert.equal(view.scheduledLeaveReason, 'Chuyển nhà');
    assert.ok(!view.leftAt);
  });
}

test('withdrawChild khi đã có lịch nghỉ ⇒ lỗi leftAt yêu cầu hủy lịch trước', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  await children.withdrawChild(child.id, { leftAt: '2026-12-16', reason: 'Chuyển nhà' }, PRINCIPAL);
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-12-20', reason: 'Đổi ý' }, PRINCIPAL),
    (err) => err.details?.leftAt === 'Trẻ đã có lịch nghỉ học từ 16/12/2026. Hủy lịch nghỉ trước khi chọn ngày khác',
  );
});

test('modal dùng DateInput với min/max từ leave-options, không còn radio', () => {
  assert.doesNotMatch(modalSrc, /type="date"|ChoiceGroup|Radio/);
  assert.match(modalSrc, /<DateInput/);
  assert.match(modalSrc, /min=\{options\.minDate\}/);
  assert.match(modalSrc, /max=\{options\.maxDate\}/);
  assert.match(modalSrc, /useLeaveOptions\(/);
  assert.match(modalSrc, /LoadingState/);
  assert.match(modalSrc, /ErrorState/);
  assert.match(modalSrc, /confirmDisabled=\{[^}]*loading/);
  assert.match(modalSrc, /error=\{errors\.leftAt \|\| dateError/);
});

test('modal gợi ý khoảng ngày, chỉ chọn từ ngày mai khi todayAllowed=false, giải thích lịch nghỉ', () => {
  assert.match(modalSrc, /Chọn từ \$\{formatDate\(options\.minDate\)\} tới \$\{formatDate\(options\.maxDate\)\} \(hết năm học\)/);
  assert.match(modalSrc, /!options\.todayAllowed/);
  assert.match(modalSrc, /todayBlockedReason/);
  assert.doesNotMatch(modalSrc, /chỉ chọn được từ ngày mai/);
  assert.match(modalSrc, /Không còn ngày nào chọn được trong năm học này/);
  assert.match(modalSrc, /options\.todayAllowed \|\| leftAt > options\.today/);
  assert.match(modalSrc, /Trẻ vẫn học tới hết ngày \$\{formatDate\(/);
  assert.match(modalSrc, /hệ thống tự chuyển sang Đã nghỉ học từ ngày đã chọn\./);
});
