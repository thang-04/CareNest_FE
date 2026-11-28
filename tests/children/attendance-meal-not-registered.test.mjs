import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');

// CHD-13 (Cần chốt 18/11/2026): trẻ không báo ăn không có nút Tham gia ăn, cột ăn hiện "—" như trẻ vắng
test('điểm danh: trẻ không báo ăn hoặc chưa có mặt thì cột Tham gia ăn hiện —, không có nút', () => {
  const i = page.indexOf('<td className="center">');
  const cell = page.slice(i, page.indexOf('</td>', i));
  assert.match(
    cell,
    /entry\.status !== ATTENDANCE_STATUS\.PRESENT \|\| mealState === 'UNREGISTERED' \? \(\s*<span className="muted">—<\/span>/,
  );
  assert.doesNotMatch(cell, /label="Không báo ăn"|>Không báo ăn</);
});

// Ô Trẻ: nhãn "Không báo ăn" / dị ứng cùng hàng với tên trẻ
test('điểm danh: nhãn Không báo ăn và Dị ứng nằm ở ô Trẻ', () => {
  const tags = page.slice(page.indexOf('dd-reception__nameline'), page.indexOf('dd-reception__tags'));
  assert.match(tags, /label="Không báo ăn"/);
  assert.match(tags, /Dị ứng: \$\{row\.child\.allergies\.join/);
  assert.match(tags, /row\.child\.hasAllergy/);
});
