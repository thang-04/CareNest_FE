import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { FLOW_STEPS, flowSummary } from '@/utils/menu-planning/nutritionFlow';

const menuGroup = (role, key = 'nutrition') => getMenuForRole(role).find((m) => m.key === key);
const TODAY = '2026-10-15';
const NEXT_WEEK = '2026-10-19';
const AGES = ['ag-2', 'ag-3', 'ag-4', 'ag-5'];
const food = (over = {}) => ({ status: 'ACTIVE', unitPrice: 1000, nutrition: { kcal: 1, protein: 1, lipid: 1, glucid: 1 }, ...over });
const price = (ageGroupId) => ({ ageGroupId, effectiveFrom: '2026-01-01', effectiveTo: null, price: 30000 });
const keysOf = (role, key) => menuGroup(role, key).children.map((c) => c.key);
const menuGroupOf = (entries, key) => entries.find((m) => m.key === key);

test('PHT: sidebar dinh dưỡng – kho theo bốn nhóm của BA', () => {
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'catalog'), ['foods', 'dishes']);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'nutrition'), ['menuFlow', 'nutritionSetup', 'menus', 'weeklyMenus', 'nutrition']);
  // NCC của PHT ở nhóm Kho: nhóm Danh mục bị ẩn khi PHT không có mảng thực đơn nhưng vẫn lập phiếu nhập
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'stock'), [
    'kitchenDay',
    'stockReceipts',
    'suppliers',
    'dryStock',
    'stockIssues',
    'freshReceipts',
  ]);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'foodReport'), ['foodSamples', 'forecast']);
  assert.deepEqual(
    menuGroup(ROLES.VICE_PRINCIPAL).children.map((entry) => entry.to),
    ['/menu/flow', '/menu/setup', '/menu/menus', '/menu/weekly', '/menu/nutrition'],
  );
});

test('HT: thiết lập, thực đơn tuần, kho chỉ xem; bếp: thực đơn công bố, sổ báo ăn, xuất kho', () => {
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'nutrition'), ['nutritionSetup', 'weeklyMenus', 'publishedMenu']);
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'stock'), ['dryStock', 'stockIssues', 'freshReceipts']);
  // BA 01: HT quản lý NCC trong nhóm Danh mục; thực phẩm, món là của PHT
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'catalog'), ['suppliers']);
  assert.deepEqual(keysOf(ROLES.KITCHEN_STAFF, 'nutrition'), ['publishedMenu', 'confirmedMealCount']);
  assert.deepEqual(keysOf(ROLES.KITCHEN_STAFF, 'stock'), ['kitchenDay', 'stockIssues', 'freshReceipts']);
});

test('không còn nhãn Duyệt xuất kho, mục kiểm kê kho hay luồng chế biến/bàn giao cũ trên sidebar', () => {
  for (const role of Object.values(ROLES)) {
    const items = getMenuForRole(role).flatMap((m) => m.children || []);
    assert.ok(!items.some((c) => c.label === 'Duyệt xuất kho'), role);
    assert.ok(
      !items.some((c) => ['/kitchen/stock-counts', '/kitchen/preparation/update', '/attendance/meal-handover'].includes(c.to)),
      role,
    );
  }
});

test('ẩn Danh mục và Dinh dưỡng khi PHT chưa được giao mảng; giữ nhóm điểm danh đã duyệt', () => {
  const user = { role: ROLES.VICE_PRINCIPAL, campusId: 'c1', areas: { menu: 'NONE' } };
  const entries = getMenuForRole(user.role, user);
  assert.ok(!entries.some((entry) => ['catalog', 'nutrition'].includes(entry.key)));
  assert.ok(
    menuGroupOf(entries, 'stock').children.some((c) => c.key === 'suppliers'),
    'vẫn xem được NCC khi lập phiếu nhập',
  );
  assert.deepEqual(
    entries.find((entry) => entry.key === 'attendance').children.map((entry) => entry.key),
    ['attendanceSummary', 'mealCount', 'attendanceDayUnlocks', 'dailyHealthOverview'],
  );
});

test('HT và bếp không thấy mục Quy trình', () => {
  for (const role of [ROLES.PRINCIPAL, ROLES.KITCHEN_STAFF]) {
    const keys = getMenuForRole(role).flatMap((m) => (m.children || []).map((c) => c.key));
    assert.ok(!keys.includes('menuFlow'), role);
  }
});

test('6 bước, mục cuối là trang Khẩu phần & đi chợ của bếp', () => {
  assert.equal(FLOW_STEPS.length, 6);
  assert.equal(FLOW_STEPS.at(-1).to, '/kitchen/required-quantity');
});

test('dữ liệu đủ thì các bước báo xong', () => {
  const s = flowSummary({
    mealPrices: AGES.map(price),
    foods: [food()],
    dishes: [{ status: 'ACTIVE', ingredients: [{ foodId: 'f1', quantity: 10 }] }],
    menus: [{ status: 'ACTIVE' }],
    weeklyMenus: AGES.map((ageGroupId) => ({ ageGroupId, weekStart: NEXT_WEEK, status: 'PUBLISHED' })),
    today: TODAY,
  });
  for (const k of ['setup', 'foods', 'dishes', 'menus', 'weekly']) assert.equal(s[k].tone, 'ok', k);
  assert.equal(s.market.tone, null);
});

test('nhóm tắt ở Thiết lập không bị tính là thiếu giá', () => {
  const s = flowSummary({
    mealPrices: AGES.slice(1).map(price),
    nutritionSetups: [{ ageGroupId: 'ag-2', enabled: false }],
    today: TODAY,
  });
  assert.equal(s.setup.text, '3 nhóm tuổi đang áp dụng');
});

test('thiếu dữ liệu thì báo cần xem kèm số lượng', () => {
  const s = flowSummary({
    mealPrices: [price('ag-4')],
    foods: [food({ unitPrice: null }), food({ nutrition: { kcal: null } }), food({ status: 'INACTIVE', unitPrice: null })],
    dishes: [{ status: 'ACTIVE', ingredients: [] }],
    menus: [],
    weeklyMenus: [],
    today: TODAY,
  });
  assert.equal(s.setup.text, '3 nhóm tuổi chưa có giá suất ăn');
  assert.equal(s.foods.text, '2 thực phẩm thiếu đơn giá hoặc dinh dưỡng');
  assert.equal(s.dishes.text, '1 món chưa có thành phần');
  assert.equal(s.menus.tone, 'warn');
  assert.match(s.weekly.text, /chưa soạn$/);
});

test('tuần sau có bản nháp thì báo đang làm, xuất bản một phần thì báo cần xem', () => {
  const draft = flowSummary({ weeklyMenus: [{ ageGroupId: 'ag-4', weekStart: NEXT_WEEK, status: 'DRAFT' }], today: TODAY });
  assert.equal(draft.weekly.tone, 'info');
  const partial = flowSummary({ weeklyMenus: [{ ageGroupId: 'ag-4', weekStart: NEXT_WEEK, status: 'PUBLISHED' }], today: TODAY });
  assert.equal(partial.weekly.text, 'Tuần 19/10: mới xuất bản 1/4 nhóm tuổi');
});
