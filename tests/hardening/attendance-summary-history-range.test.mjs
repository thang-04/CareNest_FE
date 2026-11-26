import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * GV hết phân công xem tổng hợp điểm danh lớp cũ: BE chỉ cho đọc trong khoảng đã dạy (G94-180),
 * nên khoảng mặc định 14 ngày tới hôm nay bị 403. Màn đưa khoảng về ngày cuối còn quyền đọc (lastReadableDate).
 */
const page = readFileSync('src/pages/attendance/AttendanceSummaryPage.jsx', 'utf8');

test('lớp chỉ xem lịch sử: khoảng mặc định về ngày cuối còn quyền đọc', () => {
  assert.match(page, /selectedClass\?\.historicalReadOnly \? selectedClass\.lastReadableDate : null/);
  assert.match(page, /if \(!lastReadable \|\| range\.to <= lastReadable\) return;/);
  assert.match(page, /setRange\(\{ from: lastReadable, to: lastReadable \}\)/);
});

test('lớp chỉ xem lịch sử: "Đến ngày" không chọn quá ngày cuối còn quyền đọc', () => {
  assert.match(page, /max=\{lastReadable \|\| today\}/);
});
