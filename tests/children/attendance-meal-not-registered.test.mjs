import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// CHD-13 (Cần chốt 18/11/2026): trẻ không báo ăn vẫn có nút "Tham gia ăn" nhưng gạt về Không và khóa
test('điểm danh: trẻ không báo ăn có nút Tham gia ăn tắt và khóa, kèm chữ Không báo ăn', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  const i = page.indexOf('row.child.mealRegistered === false ?');
  assert.ok(i > 0);
  const branch = page.slice(i, page.indexOf(') : editable', i));
  assert.match(branch, /<Switch[^>]*disabled[^>]*checked=\{false\}/);
  assert.match(branch, /Không báo ăn/);
});
