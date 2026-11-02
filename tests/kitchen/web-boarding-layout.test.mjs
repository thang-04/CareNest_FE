import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';

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

test('PHT, HT: sáu nhóm bán trú theo đúng thứ tự', () => {
  for (const role of [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL]) {
    const keys = getMenuForRole(role)
      .map((entry) => entry.key)
      .filter((key) => BOARDING_GROUPS.includes(key));
    assert.deepEqual(keys, BOARDING_GROUPS, role);
  }
});
