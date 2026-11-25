import test from 'node:test';
import assert from 'node:assert/strict';

const { clipToReadRanges, inReadRanges, isPastClass, latestReadRange } = await import('@/utils/attendance/attendancePermissions');

// Hai đợt rời: 05–06/10 và 12–16/10; 07–11/10 là khoảng cấm giữa hai đợt
const RANGES = [
  { start: '2026-10-05', end: '2026-10-06' },
  { start: '2026-10-12', end: '2026-10-16' },
];
const PAST = { id: '4', name: 'Mầm 2', teaches: false, canRecord: false, readRanges: RANGES };
const CURRENT = { id: '5', name: 'Mầm 3', teaches: true, canRecord: true, readRanges: [] };

test('lớp cũ: teaches=false kèm readRanges; lớp đang dạy không phải lớp cũ', () => {
  assert.equal(isPastClass(PAST), true);
  assert.equal(isPastClass(CURRENT), false);
  assert.equal(isPastClass({ teaches: false, readRanges: [] }), false);
});

test('ngày xem được: trong đợt; khoảng giữa hai đợt và sau đợt thì không', () => {
  assert.equal(inReadRanges(PAST, '2026-10-05'), true);
  assert.equal(inReadRanges(PAST, '2026-10-16'), true);
  assert.equal(inReadRanges(PAST, '2026-10-08'), false);
  assert.equal(inReadRanges(PAST, '2026-10-19'), false);
  // Lớp đang dạy không giới hạn theo đợt
  assert.equal(inReadRanges(CURRENT, '2026-10-08'), true);
});

test('đợt gần nhất = đợt bắt đầu muộn nhất (mặc định của màn điểm danh / tổng hợp)', () => {
  assert.deepEqual(latestReadRange(PAST), RANGES[1]);
  assert.equal(latestReadRange(CURRENT), null);
});

test('cắt khoảng tổng hợp: chọn đợt gần nhất có giao, không gộp min–max các đợt', () => {
  assert.deepEqual(clipToReadRanges(RANGES, '2026-10-01', '2026-10-31'), { from: '2026-10-12', to: '2026-10-16' });
  assert.deepEqual(clipToReadRanges(RANGES, '2026-10-01', '2026-10-09'), { from: '2026-10-05', to: '2026-10-06' });
  // Chỉ chạm khoảng cấm ⇒ không gọi API
  assert.equal(clipToReadRanges(RANGES, '2026-10-07', '2026-10-11'), null);
  assert.equal(clipToReadRanges(RANGES, '2026-10-19', '2026-10-31'), null);
  // Không có đợt (lớp đang dạy) ⇒ giữ nguyên
  assert.deepEqual(clipToReadRanges([], '2026-10-01', '2026-10-31'), { from: '2026-10-01', to: '2026-10-31' });
});
