import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluationPath } from '@/utils/assessment/assessmentPeriods';
import { SECTIONS } from '@/utils/assessment/breadcrumbs';

test('màn Đánh giá tháng đã xóa: không còn route, trang, mục breadcrumb', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.ok(!/path="periodic/.test(routes));
  assert.ok(!existsSync('src/pages/assessment/PeriodicEvaluationListPage.jsx'));
  assert.ok(!existsSync('src/pages/assessment/PeriodicEvaluationDetailPage.jsx'));
  assert.equal(SECTIONS.periodic, undefined);
  // Nhận xét chung của lớp theo tháng vẫn giữ
  assert.ok(existsSync('src/components/assessment/ClassMonthlyCommentCard.jsx'));
});

test('hồ sơ phát triển: đánh giá tháng cũ không còn link chi tiết, học kỳ và cuối năm vẫn có', () => {
  assert.equal(evaluationPath({ id: '1', periodType: 'MONTH' }), null);
  assert.equal(evaluationPath({ id: '2', periodType: 'SEMESTER' }), '/assessment/semester/2');
  assert.equal(evaluationPath({ id: '3', periodType: 'YEAR' }), '/assessment/year-end/3');
});
