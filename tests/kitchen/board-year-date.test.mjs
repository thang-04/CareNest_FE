import assert from 'node:assert/strict';
import { test } from 'node:test';

const { boardDateInYear } = await import('@/utils/boarding/boardYearDate');

const YEAR = { startDate: '2025-09-05', endDate: '2026-05-31' };

test('ngày đã chọn nằm trong năm học thì giữ nguyên', () => {
  assert.equal(boardDateInYear('2026-01-15', YEAR, '2026-11-19'), '2026-01-15');
});

test('năm đã kết thúc: ngày ngoài năm chuyển về ngày cuối năm học', () => {
  assert.equal(boardDateInYear('2025-07-01', YEAR, '2026-11-19'), '2026-05-31');
  assert.equal(boardDateInYear('', YEAR, '2026-11-19'), '2026-05-31');
});

test('năm sắp diễn ra: chưa tới năm thì chuyển về ngày đầu năm học', () => {
  assert.equal(boardDateInYear('', YEAR, '2025-08-01'), '2025-09-05');
});

test('hôm nay trong năm học: ngày ngoài năm chuyển về hôm nay', () => {
  assert.equal(boardDateInYear('2027-01-01', YEAR, '2026-03-10'), '2026-03-10');
});

test('chưa có khoảng ngày của năm học thì giữ ngày đã chọn, không có thì hôm nay', () => {
  assert.equal(boardDateInYear('2025-07-01', null, '2026-11-19'), '2025-07-01');
  assert.equal(boardDateInYear('', { startDate: null, endDate: null }, '2026-11-19'), '2026-11-19');
});
