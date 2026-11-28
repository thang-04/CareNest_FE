import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { legacyStatisticsTarget } from '@/utils/menu-planning/menuStatistics';

test('link cũ /menu/statistics theo tuần/ngày mở Cân đối khẩu phần cùng ngữ cảnh', () => {
  assert.equal(legacyStatisticsTarget('?week=2026-11-09&date=2026-11-10'), '/menu/nutrition?week=2026-11-09&date=2026-11-10');
  assert.equal(legacyStatisticsTarget('?date=2026-11-10'), '/menu/nutrition?date=2026-11-10');
  assert.equal(legacyStatisticsTarget(''), '/menu/nutrition');
});

test('link cũ /menu/statistics theo mẫu mở trang mẫu thực đơn', () => {
  assert.equal(legacyStatisticsTarget('?template=12'), '/menu/templates/12');
  assert.equal(legacyStatisticsTarget('?template=12&week=2026-11-09'), '/menu/templates/12');
});

test('route statistics chỉ còn chuyển hướng, không nạp trang Định lượng & đi chợ', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.match(routes, /<Route path="statistics" element={<LegacyStatisticsRedirect \/>} \/>/);
  assert.ok(!routes.includes('MenuStatisticsPage'));
});

test('kế hoạch tuần: link "Đi chợ" dưới mỗi ngày mở Đi chợ theo ngày của ngày đó', () => {
  const page = readFileSync('src/pages/menu-planning/WeeklyPlanPage.jsx', 'utf8');
  assert.ok(page.includes('`/kitchen/market-day?date=${day.date}`'));
  assert.ok(!page.includes('statisticsHref'));
});
