import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Chất lượng tháng › Cả năm: mỗi phạm vi chỉ một lần (Cả năm học / Học kỳ I / Học kỳ II)
test('ô chọn kỳ không lặp "Cả năm học" khi mục trống đã là cả năm', () => {
  const select = readFileSync('src/components/form/SemesterSelect.jsx', 'utf8');
  assert.match(select, /yearOption \|\| o\.key !== SEMESTER_KEYS\.YEAR/);
  for (const file of ['src/pages/assessment/QualityReportPage.jsx', 'src/components/assessment/EvaluationListView.jsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /emptyLabel="Cả năm học"\s+yearOption=\{false\}/, file);
  }
});
