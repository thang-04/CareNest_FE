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

// Chất lượng tháng › Theo tháng: ô tháng cùng hàng tab; không có tháng thì khóa ô và hiện đúng nguyên nhân dưới thanh lọc
test('ô tháng không mở danh sách trống và trạng thái nêu đúng nguyên nhân', () => {
  const page = readFileSync('src/pages/assessment/QualityReportPage.jsx', 'utf8');
  assert.match(page, /<option value="">Chưa có tháng khả dụng<\/option>/);
  assert.match(page, /disabled=\{noMonth \|\| notStarted\}/);
  assert.match(page, /Năm học chưa bắt đầu, bắt đầu từ/);
  assert.match(page, /'Năm học chưa có lớp'/);
  assert.match(page, /Chưa có số liệu/);
  assert.ok(!/<div className="field">\s*<select\s+className=\{`select \$\{monthError/.test(page));
});
