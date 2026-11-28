import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// G94-426 (BUG-47): nút Xuất Excel cùng hàng bộ lọc Tháng, Điểm trường (căn phải), không chiếm một hàng riêng ở đầu trang.
const src = readFileSync('src/pages/children/GrowthReportPage.jsx', 'utf8');

test('đầu trang không còn nút Xuất Excel', () => {
  const head = src.slice(src.indexOf('const head = ('), src.indexOf('if (monthsError)'));
  assert.doesNotMatch(head, /Xuất Excel/);
});

test('nút Xuất Excel nằm cuối hàng lọc, cao bằng và căn giữa với ô chọn', () => {
  const start = src.indexOf('<div className="filter-bar filter-bar--aligned">');
  assert.ok(start > 0, 'hàng lọc thiếu filter-bar--aligned');
  const bar = src.slice(start, src.indexOf('<div className="stat-grid gr-stats">'));
  assert.match(bar, /<div className="filter-bar__end">\s*<button className="btn" onClick=\{exportExcel\} disabled=\{!shown \|\| busy\}>/);
  assert.match(bar, /Xuất Excel/);
});
