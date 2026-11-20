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
