import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { USE_MOCK } from '@/config/env';
import { INTEGRATION_MODULES } from '@/config/integrationModules';

const BOARDING_GROUPS = ['boardingToday', 'nutrition', 'kitchenOps', 'stock', 'foodSafety', 'catalog'];
const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');

test('AUTH-21: bếp không có mục bán trú nào trên Web', () => {
  const keys = getMenuForRole(ROLES.KITCHEN_STAFF).map((entry) => entry.key);
  assert.ok(!keys.some((key) => BOARDING_GROUPS.includes(key)), keys.join(','));
});

test('AUTH-21: route bán trú không mở cho bếp', () => {
  const kitchenBlock = routes.slice(routes.indexOf('<Route path="kitchen">'), routes.indexOf('<Route path="assessment">'));
  assert.ok(kitchenBlock.length > 0);
  assert.ok(!kitchenBlock.includes('KITCHEN_STAFF'));
  assert.match(routes, /only\(LEADERS, <MealCountPage \/>\)/);
});

test('NUT-11, NUT-14, NUT-15: không còn màn xuất kho thủ công, chế biến, nhận nguyên liệu cũ', () => {
  for (const path of ['stock-issues', 'preparation', 'ingredient-receipts']) assert.ok(!routes.includes(`path="${path}`), path);
  for (const page of [
    'StockIssueApprovalPage',
    'StockIssuePage',
    'IngredientReceiptPage',
    'MealPreparationStatusPage',
    'MealPreparationUpdatePage',
  ])
    assert.equal(existsSync(`src/pages/kitchen/${page}.jsx`), false, page);
});

test('PHT, HT: khu Bán trú liền nhau, đúng thứ tự, dưới một nhãn', () => {
  for (const role of [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]) {
    const menu = getMenuForRole(role);
    const section = menu.filter((entry) => entry.section === 'Bán trú');
    assert.deepEqual(
      section.map((entry) => entry.key),
      BOARDING_GROUPS,
      role,
    );
    const start = menu.indexOf(section[0]);
    assert.deepEqual(menu.slice(start, start + section.length), section, `${role}: khu bán trú không bị chen mục khác`);
  }
});

test('Bán trú hôm nay: HT, PHT có link thẳng tới /boarding/today, không phải nhóm một mục; bếp không có (AUTH-21)', () => {
  for (const role of [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]) {
    const entry = getMenuForRole(role).find((item) => item.key === 'boardingToday');
    assert.deepEqual([entry.label, entry.to, entry.children], ['Bán trú hôm nay', '/boarding/today', undefined], role);
  }
  const kitchenItems = getMenuForRole(ROLES.KITCHEN_STAFF).flatMap((entry) => (entry.children || []).map((child) => child.to));
  assert.ok(
    !kitchenItems.some((to) => to.startsWith('/boarding') || to.startsWith('/kitchen') || to.startsWith('/menu')),
    kitchenItems.join(','),
  );
});

test('Kho thực phẩm: HT, PHT có bốn mục tồn kho, phiếu nhập, lịch sử, phần thiếu', () => {
  for (const role of [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]) {
    const group = getMenuForRole(role).find((entry) => entry.key === 'stock');
    assert.deepEqual(
      group.children.map((child) => [child.label, child.to]),
      [
        ['Tồn kho khô', '/kitchen/dry-stock'],
        ['Phiếu nhập', '/kitchen/stock-receipts'],
        ['Lịch sử nhập/trừ', '/kitchen/stock-history'],
        ['Phần thiếu chờ bổ sung', '/kitchen/stock-shortfalls'],
      ],
      role,
    );
  }
});

test('route bán trú chọn trang theo isDemoModule: build BE dùng trang mới, build mock giữ trang demo cũ', () => {
  assert.match(routes, /const BOARDING_API = !isDemoModule\('day-board'\);/);
  assert.match(routes, /const MEAL_PLAN_API = !isDemoModule\('meal-plan'\);/);
  assert.match(routes, /const DRY_STOCK_API = !isDemoModule\('dry-stock'\);/);
  assert.match(routes, /BOARDING_API \? <BoardingTodayPage \/> : <KitchenFlowPage \/>/);
  assert.match(routes, /MEAL_PLAN_API \? <WeeklyPlanPage \/> : <WeeklyMenuListPage \/>/);
  // /kitchen và /menu/flow chuyển về hub ở build BE
  assert.match(routes, /path="flow"\s+element=\{BOARDING_API \? <Navigate to="\/boarding\/today" replace \/>/);
  assert.match(routes, /<Route index element=\{BOARDING_API \? <Navigate to="\/boarding\/today" replace \/>/);
  for (const tab of ['stock', 'receipts', 'history', 'shortfalls'])
    assert.match(routes, new RegExp(`<DryStockLedgerPage tab="${tab}" />`), tab);
  assert.match(routes, /<Route path="stock-receipts\/:id" element=\{only\(STOCK_RECEIPT_ROLES, <StockReceiptEditorPage \/>\)\} \/>/);
});

test('NUT-16, NUT-21: HT, PHT có mục bếp hôm nay, lưu mẫu, ảnh bữa, khung giờ ảnh khi nối BE', () => {
  const apiBuild = !USE_MOCK && INTEGRATION_MODULES['kitchen-records']?.source === 'api';
  for (const role of [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]) {
    const items = getMenuForRole(role).flatMap((entry) => (entry.children || []).map((child) => child.to));
    assert.ok(items.includes('/kitchen/published-menu'), role);
    assert.ok(items.includes('/kitchen/food-samples'), role);
    for (const to of ['/kitchen/meal-photos', '/kitchen/photo-windows']) assert.equal(items.includes(to), apiBuild, `${role} ${to}`);
  }
});
