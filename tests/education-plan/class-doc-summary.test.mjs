import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const { classDocSummary, mixedPage } = await import('@/models/education-plan/classDocSummary.mjs');

test('edu-list-paging: bản gọn bỏ nội dung soạn, giữ quyền/trạng thái, lịch sử 5 mục cuối', () => {
  const doc = {
    id: 'sp_1_1',
    kind: 'semester',
    classId: '1',
    status: 'REVIEW',
    permissions: { canApprove: true },
    names: { '2026-09-07': 'Nhánh' },
    grid: { a: 1 },
    history: Array.from({ length: 8 }, (_, i) => ({ at: i })),
  };
  const summary = classDocSummary(doc);
  assert.deepEqual(Object.keys(summary).sort(), ['classId', 'history', 'id', 'kind', 'permissions', 'status']);
  assert.deepEqual(
    summary.history.map((h) => h.at),
    [3, 4, 5, 6, 7],
  );
});

test('mixedPage: kế hoạch năm/tổ đứng trước, tài liệu lớp lấy đúng lát trang BE', () => {
  // 3 kế hoạch năm/tổ, trang 0 cỡ 5: 3 kế hoạch + 2 tài liệu đầu (trang BE 0, mục 0–2)
  assert.deepEqual(mixedPage(3, 0, 5), { headItems: [0, 3], docRequests: [{ page: 0, from: 0, to: 2 }] });
  // Trang 1: tài liệu thứ 2–6 ⇒ hai trang BE
  assert.deepEqual(mixedPage(3, 1, 5), {
    headItems: [3, 3],
    docRequests: [
      { page: 0, from: 2, to: 5 },
      { page: 1, from: 0, to: 2 },
    ],
  });
  // Không có kế hoạch năm/tổ: trùng trang BE
  assert.deepEqual(mixedPage(0, 2, 5), { headItems: [0, 0], docRequests: [{ page: 2, from: 0, to: 5 }] });
  // Trang chỉ có kế hoạch năm/tổ
  assert.deepEqual(mixedPage(12, 1, 5), { headItems: [5, 10], docRequests: [] });
});

test('trang danh sách dạng bảng không tải cả gói tài liệu lớp; 3 trang bảng phân trang 5 dòng', () => {
  const layout = readFileSync(new URL('../../src/components/education-plan/EducationPlanLayout.jsx', import.meta.url), 'utf8');
  // Chỉ trang của một lớp tải tài liệu (của đúng lớp đó); mọi trang khác chỉ tải lớp/nhân sự
  assert.match(layout, /lightDocs = classId == null/);
  for (const page of ['PlanReviewQueuePage', 'OverduePlansPage', 'GoalListPage']) {
    const src = readFileSync(new URL(`../../src/pages/education-plan/${page}.jsx`, import.meta.url), 'utf8');
    assert.match(src, /const PAGE_SIZE = 5;/, page);
    assert.match(src, /<Pagination\b/, page);
  }
  const queue = readFileSync(new URL('../../src/pages/education-plan/PlanReviewQueuePage.jsx', import.meta.url), 'utf8');
  assert.match(queue, /getClassDocSummaries\(/);
  // Tên/số chủ đề BE trả sẵn ở bản gọn ⇒ hàng chờ không tải chi tiết kế hoạch tổ
  assert.match(queue, /d\.themeName/);
  assert.doesNotMatch(queue, /useGoalDetails/);
  // edu-list-paging: danh sách kế hoạch năm/tổ và trang quá hạn phân trang ở BE, không cắt trang ở client
  const goals = readFileSync(new URL('../../src/pages/education-plan/GoalListPage.jsx', import.meta.url), 'utf8');
  const overdue = readFileSync(new URL('../../src/pages/education-plan/OverduePlansPage.jsx', import.meta.url), 'utf8');
  assert.match(goals, /getGoalPage\(/);
  assert.match(goals, /getGoalStats\(/);
  assert.match(overdue, /getOverdueBoard\(/);
  for (const src of [goals, overdue]) assert.doesNotMatch(src, /paginate\(/);
  assert.doesNotMatch(queue, /refreshClassDocs/);
});
