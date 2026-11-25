import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync('src/pages/assessment/AssessmentDayUnlockPage.jsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const moduleCss = readFileSync('src/styles/modules/assessment.css', 'utf8');
const overdue = readFileSync('src/components/assessment/OverdueClassesCard.jsx', 'utf8');

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

test('Mở lại đánh giá: lớp quá hạn phân trang 5 dòng, cột ngày/kỳ có bề rộng gọn', () => {
  assert.match(overdue, /const OVERDUE_PAGE_SIZE = 5;/);
  assert.match(overdue, /pageSize=\{OVERDUE_PAGE_SIZE\}/);
  assert.match(page, /dg-unlock-history-period/);
  assert.match(moduleCss, /\.dg-roll-wrap \.dg-roll\.dg-unlock-history \{\s*min-width: 68rem;\s*table-layout: fixed;/);
});
