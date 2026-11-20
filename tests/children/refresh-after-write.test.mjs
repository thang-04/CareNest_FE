import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Nối BE thật, ghi qua axiosClient không phát sự kiện đổi dữ liệu như mock (useAsync refreshOnDataChange chỉ nghe mock)
 * ⇒ trang tự tải lại sau khi ghi thành công, không đợi người dùng tải lại trang.
 */
const read = (f) => readFileSync(f, 'utf8');
const bodyOf = (src, start) => {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `thiếu ${start}`);
  // Thân hàm tới hàm kế tiếp cùng cấp (dòng bắt đầu bằng "  const ")
  const next = src.indexOf('\n  const ', from + start.length);
  return src.slice(from, next < 0 ? undefined : next);
};

test('G94-396 (BUG-25): chuyển, xếp lớp xong tải lại lớp hiện tại của trẻ và sĩ số lớp', () => {
  const src = read('src/pages/children/ClassPlacementPage.jsx');
  assert.match(src, /const \{ classes, reload: reloadClasses \} = usePlacementClasses\(\);/);
  const doPlace = bodyOf(src, 'const doPlace = async');
  assert.match(doPlace, /await placeChild\([\s\S]*reload\(\{ silent: true \}\);[\s\S]*reloadClasses\(\{ silent: true \}\);[\s\S]*catch/);
});

test('G94-438 (BUG-57): hủy, đóng, mở lại đợt khám xong tải lại trạng thái, nút, lịch sử', () => {
  const src = read('src/pages/children/HealthCheckDetailPage.jsx');
  // hủy, đóng sớm cùng đi qua run(); mở lại có luồng riêng
  assert.match(bodyOf(src, 'const run = async'), /toast\.success\([\s\S]*reload\(\{ silent: true \}\);[\s\S]*catch/);
  assert.match(src, /const doCancel = \(\) => run\(/);
  assert.match(src, /const doClose = \(\) =>\s*run\(/);
  assert.match(bodyOf(src, 'const doReopen = async'), /await reopenHealthCheck\([\s\S]*reload\(\{ silent: true \}\);[\s\S]*catch/);
});

test('G94-438 (BUG-57): danh sách nhập theo lớp dựng lại khi trạng thái đợt đổi (hết quyền nhập sau khi hủy)', () => {
  const src = read('src/pages/children/HealthCheckDetailPage.jsx');
  const rosters = src.match(/<Roster [^>]*>/g) || [];
  assert.ok(rosters.length >= 2, 'thiếu Roster');
  for (const r of rosters.filter((x) => x.includes('key='))) assert.match(r, /key=\{`\$\{c\.classId\}-\$\{campaign\.status\}`\}/);
});
