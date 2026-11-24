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
 * G94-180/CHD-03 (user 24/11): cho nghỉ học chỉ chọn hôm nay hoặc ngày học kế tiếp; hôm nay khóa khi trẻ đã có điểm danh trong ngày.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
const modalSrc = readFileSync('src/components/children/WithdrawChildModal.jsx', 'utf8');

const activeChild = () => ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE');

beforeEach(() => {
  mock.timers.reset();
  storage.clear();
  resetDb();
});

test('hôm nay là thứ Sáu và trẻ có điểm danh ⇒ todayAllowed=false, nextSchoolDay nhảy qua thứ 7, chủ nhật', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 27, 12, 0, 0) });
  const child = activeChild();
  writeDb((d) => {
    d.attendance = [...(d.attendance || []), { id: 'att_x', childId: child.id, date: '2026-11-27', status: 'PRESENT' }];
  });
  const options = await children.getLeaveOptions(child.id, PRINCIPAL);
  assert.equal(options.today, '2026-11-27');
  assert.equal(options.todayAllowed, false);
  assert.match(options.todayBlockedReason, /điểm danh/);
  assert.equal(options.nextSchoolDay, '2026-11-30');
});

test('trẻ chưa có dữ liệu trong ngày ⇒ todayAllowed=true, không có lý do', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  writeDb((d) => {
    d.attendance = (d.attendance || []).filter((r) => r.childId !== child.id);
  });
  const options = await children.getLeaveOptions(child.id, PRINCIPAL);
  assert.equal(options.todayAllowed, true);
  assert.equal(options.todayBlockedReason, null);
  assert.equal(options.nextSchoolDay, '2026-11-26');
});

test('withdrawChild ngày đã qua ⇒ lỗi leftAt "Ngày nghỉ học không được trước hôm nay"', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-20', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => err.details?.leftAt === 'Ngày nghỉ học không được trước hôm nay',
  );
});

test('withdrawChild ngày không phải hôm nay / ngày học kế tiếp ⇒ lỗi leftAt', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-30', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => /^Chỉ chọn hôm nay hoặc ngày học kế tiếp \(26\/11\/2026\)/.test(err.details?.leftAt),
  );
});

test('withdrawChild hôm nay khi trẻ đã có điểm danh ⇒ lỗi leftAt, chọn ngày học kế tiếp thì được', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 25, 12, 0, 0) });
  const child = activeChild();
  writeDb((d) => {
    d.attendance = [...(d.attendance || []), { id: 'att_y', childId: child.id, date: '2026-11-25', status: 'PRESENT' }];
  });
  await assert.rejects(
    () => children.withdrawChild(child.id, { leftAt: '2026-11-25', reason: 'Chuyển nhà' }, PRINCIPAL),
    (err) => /Thực hiện nghỉ học từ ngày học tiếp theo/.test(err.details?.leftAt),
  );
  const left = await children.withdrawChild(child.id, { leftAt: '2026-11-26', reason: 'Chuyển nhà' }, PRINCIPAL);
  assert.equal(left.leftAt, '2026-11-26');
});

test('modal không còn type="date", dùng useLeaveOptions, có LoadingState/ErrorState và toast "nghỉ học từ"', () => {
  assert.doesNotMatch(modalSrc, /type="date"/);
  assert.match(modalSrc, /useLeaveOptions\(/);
  assert.match(modalSrc, /LoadingState/);
  assert.match(modalSrc, /ErrorState/);
  assert.match(modalSrc, /nghỉ học từ \$\{formatDate\(leftAt\)\}/);
  assert.match(modalSrc, /confirmDisabled=\{[^}]*loading/);
});
