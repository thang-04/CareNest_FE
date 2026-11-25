import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// G94-425 (BUG-46): ô lọc lớp chỉ khi người xem có từ hai lớp trong năm; một lớp ⇒ nhãn "Lớp · N trẻ"; GV chưa phân công ⇒ báo.
const src = readFileSync('src/pages/children/ChildrenListPage.jsx', 'utf8');

test('một lớp trong phạm vi ⇒ không ô lọc lớp, hiện tên lớp và số trẻ', () => {
  assert.match(src, /const singleClass = yearOptions\.length === 1 \? yearOptions\[0\] : null;/);
  assert.match(src, /\{yearOptions\.length > 1 && \(\s*<select className="select" value=\{classId\} aria-label="Lớp"/);
  assert.match(src, /<strong>\{singleClass\.name\}<\/strong> · \{singleClassCount\} trẻ/);
});

test('giáo viên chưa được phân công lớp trong năm ⇒ câu báo thay ô lọc', () => {
  assert.match(src, /const noClassAssigned = isTeacherRole\(user\) && !classesLoading && yearOptions\.length === 0;/);
  assert.match(src, /Bạn chưa được phân công lớp trong năm học này\./);
});
