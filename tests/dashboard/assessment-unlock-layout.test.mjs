import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync('src/pages/assessment/AssessmentDayUnlockPage.jsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const moduleCss = readFileSync('src/styles/modules/assessment.css', 'utf8');

test('BUG-28: Mở lại đánh giá theo năm học đang chọn, không cố định năm đang diễn ra', () => {
  assert.ok(!/status === 'ACTIVE'\)\s*;?\s*\n\s*const yearStart = activeYear/.test(page));
  assert.match(page, /const \{ schoolYear, schoolYears \} = useSchoolYear\(\)/);
  assert.match(page, /yearClassIds\.has\(String\(u\.classId\)\)/);
  assert.match(page, /key=\{`\$\{kind\}-\$\{schoolYear\}-\$\{filters\.campusId\}`\}/);
});

test('BUG-29: lỗi đỏ trong form một hàng không đẩy ô làm lệch hàng', () => {
  assert.match(css, /\.form-inline \.field__error \{\s*position: absolute;/);
});

test('BUG-30: khung Lọc thêm nổi trên đầu bảng dính', () => {
  assert.match(moduleCss, /\.dg-unlock-filters \.filter-more__panel \{\s*z-index: var\(--z-dropdown\);/);
});
