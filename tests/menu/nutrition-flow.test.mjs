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

test('PHT: sáu nhóm bán trú theo việc', () => {
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'boardingToday'), ['boardingToday']);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'nutrition'), ['weeklyMenus', 'menus', 'nutrition']);
  // PHT xem Bếp hôm nay như HT (GET /nutrition/kitchen/day cho HT, PHT)
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'kitchenOps'), ['mealCount', 'publishedMenu', 'forecast', 'freshReceipts']);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'stock'), ['dryStock', 'stockReceipts', 'stockHistory', 'stockShortfalls']);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'foodSafety'), ['foodSamples']);
  assert.deepEqual(keysOf(ROLES.VICE_PRINCIPAL, 'catalog'), ['foods', 'dishes', 'nutritionSetup', 'suppliers']);
  assert.deepEqual(
    menuGroup(ROLES.VICE_PRINCIPAL).children.map((entry) => entry.to),
    ['/menu/weekly', '/menu/menus', '/menu/nutrition'],
  );
});

test('HT: thực đơn tuần, sổ suất, kho chỉ xem; bếp không có mục bán trú trên Web', () => {
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'nutrition'), ['weeklyMenus']);
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'kitchenOps'), ['mealCount', 'publishedMenu', 'forecast', 'freshReceipts']);
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'stock'), ['dryStock', 'stockReceipts', 'stockHistory', 'stockShortfalls']);
  assert.deepEqual(keysOf(ROLES.PRINCIPAL, 'catalog'), ['foods', 'dishes', 'nutritionSetup', 'suppliers']);
  assert.deepEqual(
    menuGroup(ROLES.PRINCIPAL, 'catalog').children.map((c) => c.to),
    ['/menu/foods', '/menu/dishes', '/menu/setup', '/menu/suppliers'],
  );
  assert.equal(menuGroup(ROLES.KITCHEN_STAFF, 'kitchenOps'), undefined);
});

test('không còn mục xuất kho, kiểm kê kho hay luồng chế biến/bàn giao cũ trên sidebar', () => {
  for (const role of Object.values(ROLES)) {
    const items = getMenuForRole(role).flatMap((m) => m.children || []);
    assert.ok(!items.some((c) => c.label === 'Duyệt xuất kho' || c.label === 'Xuất kho'), role);
    assert.ok(
      !items.some((c) =>
        ['/kitchen/stock-issues', '/kitchen/stock-counts', '/kitchen/preparation/update', '/attendance/meal-handover'].includes(c.to),
      ),
      role,
    );
  }
});

test('PHT chưa được giao mảng thực đơn: ẩn nhóm thực đơn và các mục danh mục, giữ NCC và sổ suất', () => {
  const user = { role: ROLES.VICE_PRINCIPAL, campusId: 'c1', areas: { menu: 'NONE' } };
  const entries = getMenuForRole(user.role, user);
  assert.ok(!entries.some((entry) => entry.key === 'nutrition'));
  assert.deepEqual(
    menuGroupOf(entries, 'catalog').children.map((c) => c.key),
    ['suppliers'],
    'vẫn xem được NCC khi lập phiếu nhập',
  );
  assert.deepEqual(
    menuGroupOf(entries, 'boardingToday').children.map((c) => c.key),
    ['boardingToday'],
  );
  assert.ok(menuGroupOf(entries, 'kitchenOps').children.some((c) => c.key === 'mealCount'));
  assert.deepEqual(
    entries.find((entry) => entry.key === 'attendance').children.map((entry) => entry.key),
    ['attendanceSummary', 'attendanceDayUnlocks', 'dailyHealthOverview'],
  );
});

test('không còn mục Quy trình thực đơn và Việc hôm nay: "Bán trú hôm nay" thay cho cả hai', () => {
  for (const role of Object.values(ROLES)) {
    const keys = getMenuForRole(role).flatMap((m) => (m.children || []).map((c) => c.key));
    assert.ok(!keys.includes('menuFlow') && !keys.includes('kitchenDay'), role);
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
