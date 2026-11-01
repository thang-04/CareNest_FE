import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const docs = await import('@/utils/education-plan/classPlanDoc');

test('EDU-47: mẫu Word điền sẵn chủ đề theo tuần, để trống tên nhánh và không xuất lịch/nháp', () => {
  assert.equal(typeof docs.branchTemplateFile, 'function');
  const weeks = [
    { start: '2026-09-07', theme: { name: 'A & B' }, name: 'Tên nháp không được xuất' },
    { start: '2026-09-14', theme: { name: 'A & B' } },
    { start: '2026-09-21', theme: { name: '<Chủ đề>' } },
  ];
  const before = structuredClone(weeks);
  const file = docs.branchTemplateFile(weeks);
  assert.equal(file.name, 'Mẫu nhập chủ đề nhánh');
  assert.match(file.html, /<th>Chủ đề<\/th><th>Chủ đề nhánh<\/th>/);
  assert.equal((file.html.match(/<td>A &amp; B<\/td><td>&nbsp;<\/td>/g) || []).length, 2);
  assert.match(file.html, /<td>&lt;Chủ đề&gt;<\/td><td>&nbsp;<\/td>/);
  assert.doesNotMatch(file.html, /2026-09|Tên nháp không được xuất|Người duyệt/);
  assert.deepEqual(weeks, before);
});

test('EDU-47: mẫu khi không có tuần vẫn có bảng trống đúng định dạng', () => {
  assert.equal(typeof docs.branchTemplateFile, 'function');
  const file = docs.branchTemplateFile([]);
  assert.match(file.html, /<th>Chủ đề<\/th><th>Chủ đề nhánh<\/th>/);
  assert.match(file.html, /<td><\/td><td>&nbsp;<\/td>/);
  assert.doesNotMatch(file.html, /undefined|null/);
});
