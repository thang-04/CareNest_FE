import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (f) => readFileSync(f, 'utf8');

test('Cấu hình trường: các form không còn dòng gợi ý dưới ô nhập', () => {
  for (const file of [
    'src/pages/school-config/CampusFormPage.jsx',
    'src/pages/school-config/SchoolYearFormPage.jsx',
    'src/components/school-config/RoomFormModal.jsx',
    'src/components/school-config/CopyClassesModal.jsx',
  ]) {
    const src = read(file);
    assert.ok(!/\shint=/.test(src), file);
    assert.ok(!src.includes('field__hint'), file);
  }
  // Lớp: chỉ còn lối thêm phòng khi điểm trường chưa có phòng học
  assert.equal((read('src/components/school-config/ClassFormModal.jsx').match(/\shint=/g) || []).length, 1);
});
