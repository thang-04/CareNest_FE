import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { resetDb } = await import('@/mocks/mockDatabase');
const { buildDashboardToday, getDashboardToday, activeCutoff } = await import('@/services/dashboard/dashboardSummaryService');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const DATE = '2026-10-20';
const campusName = (id) => ({ c1: 'Campus 1', c2: 'Campus 2' })[id] || id;

const cls = (classId, className, campusId, size, present, excused = 0, unexcused = 0) => ({
  classId,
  className,
  campusId,
  size,
  present,
  excused,
  unexcused,
});
const TODAY = {
  classes: [
    cls('a', 'Lá 1', 'c1', 30, 27, 2, 1),
    cls('b', 'Lá 2', 'c1', 5, 0),
    cls('c', 'Mầm 1', 'c1', 25, 18, 4, 3),
    cls('d', 'Mầm 3', 'c2', 24, 0),
  ],
};
const LAST_WEEK = { classes: [cls('a', 'Lá 1', 'c1', 30, 28), cls('c', 'Mầm 1', 'c1', 25, 24), cls('d', 'Mầm 3', 'c2', 24, 22)] };
const HEALTH = {
  totals: { present: 45, checked: 40, noted: 3 },
  classes: [
    { classId: 'a', className: 'Lá 1', campusId: 'c1', present: 27, checked: 25, noted: 1 },
    { classId: 'c', className: 'Mầm 1', campusId: 'c1', present: 18, checked: 15, noted: 2 },
  ],
  attention: [{ childId: 'k1', childName: 'Nguyễn Văn Bé', classId: 'c' }],
};
const build = (over = {}) =>
  buildDashboardToday({
    date: DATE,
    now: { date: DATE, time: '09:30' },
    today: TODAY,
    lastWeek: LAST_WEEK,
    health: HEALTH,
    cutoff: '08:30',
    campusName,
    ...over,
  });

beforeEach(() => resetDb());

test('AC-6: lớp chưa điểm danh đứng đầu, rồi tỷ lệ có mặt tăng dần', () => {
  const { classes } = build();
  assert.deepEqual(
    classes.map((c) => c.className),
    ['Lá 2', 'Mầm 3', 'Mầm 1', 'Lá 1'],
  );
  assert.equal(classes[2].rate, 72);
});

test('AC-1: thẻ có mặt có so sánh với cùng thứ tuần trước; không có số tuần trước thì không so sánh', () => {
  const withPrev = build().attendance;
  assert.equal(withPrev.present, 45);
  assert.equal(withPrev.total, 84);
  assert.equal(withPrev.lastWeek.date, '2026-10-13');
  assert.equal(withPrev.deltaPoints, 54 - 94);
  assert.equal(build({ lastWeek: null }).attendance.deltaPoints, null);
});

test('AC-3 (ATT-06): sau cut-off báo lớp chưa điểm danh "đã quá"; trước cut-off không báo; chưa cấu hình thì không ghi quá giờ', () => {
  const after = build().attention.find((a) => a.key === 'not-taken');
  assert.equal(after.title, '2 lớp chưa điểm danh, đã quá 08:30');
  assert.equal(after.meta, 'Campus 1: Lá 2 · Campus 2: Mầm 3');
  assert.equal(after.badge, 'Quá giờ');

  const before = build({ now: { date: DATE, time: '08:00' } }).attention.find((a) => a.key === 'not-taken');
  assert.equal(before, undefined);

  const noCutoff = build({ cutoff: null }).attention.find((a) => a.key === 'not-taken');
  assert.equal(noCutoff.title, '2 lớp chưa điểm danh');
  assert.equal(noCutoff.badge, null);
});

test('danh sách lớp trong mục cần chú ý giữ tối đa 4 lớp', () => {
  const many = { classes: ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => cls(String(i), n, 'c1', 10, 0)) };
  const item = build({ today: many }).attention.find((a) => a.key === 'not-taken');
  assert.equal(item.meta, 'A · B · C · D và 2 lớp khác');
});

test('cut-off chỉ có hiệu lực từ ngày áp dụng', () => {
  assert.equal(activeCutoff({ time: '08:30', effectiveFrom: '2026-10-21' }, DATE), null);
  assert.equal(activeCutoff({ time: '08:30', effectiveFrom: '2026-10-01' }, DATE), '08:30');
  assert.equal(activeCutoff(null, DATE), null);
});

test('AC-4: trẻ cần lưu ý chỉ đếm theo lớp, không có tên trẻ trong kết quả', () => {
  const result = build();
  const noted = result.attention.find((a) => a.key === 'health-noted');
  assert.equal(noted.title, '3 trẻ có dấu hiệu cần lưu ý khi khám đầu ngày');
  assert.equal(noted.meta, 'Lá 1 · Mầm 1 (2)');
  assert.ok(!JSON.stringify(result).includes('Nguyễn Văn Bé'));
  assert.equal(result.attention.find((a) => a.key === 'health-unchecked').title, '5 trẻ có mặt chưa được khám đầu ngày');
});

test('AC-5: không có gì bất thường thì danh sách cần chú ý rỗng', () => {
  const calm = { classes: [cls('a', 'Lá 1', 'c1', 30, 30)] };
  const result = build({
    today: calm,
    health: {
      totals: { present: 30, checked: 30, noted: 0 },
      classes: [{ classId: 'a', className: 'Lá 1', campusId: 'c1', present: 30, checked: 30, noted: 0 }],
    },
  });
  assert.deepEqual(result.attention, []);
});

test('AC-1 (AUTH-08): Phó HT chỉ nhận lớp của campus mình qua facade', async () => {
  const result = await getDashboardToday(VP, { campusName });
  assert.ok(result.classes.length > 0);
  assert.ok(result.classes.every((c) => c.campusId === 'c1'));
});

test('AC-2 (AUTH-01): Hiệu trưởng nhận lớp của cả hai campus', async () => {
  const result = await getDashboardToday(PRINCIPAL, { campusName });
  const campuses = new Set(result.classes.map((c) => c.campusId));
  assert.ok(campuses.has('c1') && campuses.has('c2'));
});

test('tuần trước chưa có bản ghi điểm danh thì không so sánh (không tính 0%)', () => {
  const empty = { classes: [cls('a', 'Lá 1', 'c1', 30, 0), cls('c', 'Mầm 1', 'c1', 25, 0)] };
  const att = build({ lastWeek: empty }).attendance;
  assert.equal(att.lastWeek, null);
  assert.equal(att.deltaPoints, null);
});

test('tên lớp đã có chữ "Lớp" không bị lặp trong câu', () => {
  const one = { classes: [cls('a', 'Lớp Chồi 1', 'c1', 20, 0)] };
  const item = build({ today: one }).attention.find((a) => a.key === 'not-taken');
  assert.equal(item.title, 'Lớp Chồi 1 chưa điểm danh, đã quá 08:30');
});
