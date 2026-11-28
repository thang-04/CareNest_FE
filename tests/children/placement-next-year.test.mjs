import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Test log 24/11 mục 3 (Q4=A): header ở năm sắp diễn ra ⇒ Xếp lớp không hiện bảng năm đang học,
 * chỉ có khung báo + nút sang Xếp lớp năm học mới + nút về năm đang hoạt động.
 */
const src = readFileSync('src/pages/children/ClassPlacementPage.jsx', 'utf8');

test('F2.5: năm header khác năm đang hoạt động trả khung báo, đặt trước bảng và Tabs', () => {
  const branch = src.indexOf('schoolYear !== activeYear.id');
  assert.ok(branch >= 0, 'thiếu nhánh schoolYear !== activeYear.id');
  assert.ok(branch < src.indexOf('<Tabs'), 'nhánh phải đứng trước <Tabs');
  const block = src.slice(branch, src.indexOf('<Tabs'));
  assert.match(block, /return/);
  assert.match(block, /to="\/school\/placement"/);
  assert.match(block, /setSchoolYear\(activeYear\.id\)/);
  assert.match(block, /Mở Xếp lớp năm học mới/);
});

test('F2.5: tên năm lấy từ SchoolYearContext, không viết cứng', () => {
  assert.match(src, /schoolYears\.find\(\(y\) => y\.id === schoolYear\)\?\.label/);
  assert.doesNotMatch(src, /2027-2028|2026-2027/);
});
