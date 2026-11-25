import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * G94-435 (BUG-54): lỗi lưu ở bước Xem lại & xác nhận. Nguyên nhân 9002 (gửi tên năm học vào trường số của BE) đã sửa ở
 * childrenApi (bed4a64e, children-api-be.test.mjs). Ở trang: lỗi theo ô ⇒ về đúng bước có ô lỗi; lỗi chung không gắn ô
 * (`_form`) ⇒ ở lại bước xác nhận, giữ dữ liệu, chỉ một thông báo.
 */
const src = readFileSync('src/pages/children/EnrollChildPage.jsx', 'utf8');
const save = src.slice(src.indexOf('const save = async'), src.indexOf('if (saved)'));

test('chỉ lỗi theo ô mới chuyển bước, lỗi chung giữ ở bước xác nhận', () => {
  assert.match(save, /const fields = Object\.keys\(err\.details \|\| \{\}\)\.filter\(\(k\) => k !== '_form'\);/);
  assert.match(save, /if \(\[400, 422, 409\]\.includes\(err\.status\) && fields\.length\) \{/);
  assert.match(save, /goTo\(Math\.min\(\.\.\.fields\.map\(stepOfField\)\)\);/);
  assert.equal((save.match(/toast\.error\(/g) || []).length, 1);
});

test('nút lưu khóa trong lúc gửi để không gửi lặp', () => {
  assert.match(save, /setBusy\(true\);/);
  assert.match(src, /<button className="btn btn--primary" onClick=\{save\} disabled=\{busy\}>/);
});
