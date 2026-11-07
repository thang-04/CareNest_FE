import assert from 'node:assert/strict';
import { test } from 'node:test';

const { groupByFlow, flowCheckState, toggleFlow, permissionTableRows } = await import('@/utils/account/permissionMatrix');
const { accountDutyTags } = await import('@/utils/account/accountPermissions');

// Mẫu catalog: bán trú 3 mã độc lập + nhân sự có quan hệ cần-có
const catalog = [
  { code: 'NUTRITION_MANAGE', module: 'meals', action: 'MANAGE', requires: [] },
  { code: 'STOCK_MANAGE', module: 'meals', action: 'MANAGE', requires: [] },
  { code: 'MENU_MANAGE', module: 'meals', action: 'MANAGE', requires: [] },
  { code: 'STAFF_ACCOUNT_VIEW', module: 'account', feature: 'staff', action: 'VIEW', requires: [] },
  { code: 'ACCOUNT_MANAGE', module: 'account', feature: 'staff', action: 'MANAGE', requires: ['STAFF_ACCOUNT_VIEW'] },
].map((permission) => ({
  ...permission,
  feature:
    permission.feature || { NUTRITION_MANAGE: 'meal-catalog', STOCK_MANAGE: 'meal-stock', MENU_MANAGE: 'meal-menu' }[permission.code],
}));
const all = () => true;

test('groupByFlow gom các nhóm bán trú vào một luồng lớn, giữ thứ tự', () => {
  const flows = groupByFlow(permissionTableRows(catalog));
  assert.deepEqual(
    flows.map((flow) => flow.key),
    ['meals', 'staff'],
  );
  const meals = flows[0];
  assert.equal(meals.label, 'Bán trú');
  assert.equal(meals.groups.length, 3);
  assert.deepEqual(meals.codes, ['NUTRITION_MANAGE', 'STOCK_MANAGE', 'MENU_MANAGE']);
});

test('flowCheckState: đủ, một phần, không, và null khi không chỉnh được mã nào', () => {
  const codes = ['NUTRITION_MANAGE', 'STOCK_MANAGE', 'MENU_MANAGE'];
  assert.equal(flowCheckState(codes, codes, all), 'all');
  assert.equal(flowCheckState(codes, ['STOCK_MANAGE'], all), 'some');
  assert.equal(flowCheckState(codes, [], all), 'none');
  assert.equal(
    flowCheckState(codes, codes, () => false),
    null,
  );
  // Chỉ đếm mã chỉnh được: mã cố định không làm ô tổng "một phần"
  assert.equal(
    flowCheckState(codes, ['STOCK_MANAGE'], (code) => code === 'STOCK_MANAGE'),
    'all',
  );
});

test('toggleFlow tick cả luồng thì mọi việc nhỏ ăn theo; bỏ tick thì bỏ hết', () => {
  const codes = ['NUTRITION_MANAGE', 'STOCK_MANAGE', 'MENU_MANAGE'];
  const on = toggleFlow(catalog, [], codes, true, all);
  assert.deepEqual(on.codes, ['MENU_MANAGE', 'NUTRITION_MANAGE', 'STOCK_MANAGE']);
  assert.equal(on.added.length, 3);
  const off = toggleFlow(catalog, on.codes, codes, false, all);
  assert.deepEqual(off.codes, []);
  assert.equal(off.removed.length, 3);
});

test('toggleFlow chỉ đổi mã chỉnh được và giữ quan hệ cần-có của catalog', () => {
  const staffCodes = ['STAFF_ACCOUNT_VIEW', 'ACCOUNT_MANAGE'];
  const on = toggleFlow(catalog, [], staffCodes, true, all);
  assert.deepEqual(on.codes, ['ACCOUNT_MANAGE', 'STAFF_ACCOUNT_VIEW']);
  const onlyManage = toggleFlow(catalog, ['NUTRITION_MANAGE'], staffCodes, true, (code) => code !== 'ACCOUNT_MANAGE');
  assert.ok(onlyManage.codes.includes('STAFF_ACCOUNT_VIEW'));
  assert.ok(!onlyManage.codes.includes('ACCOUNT_MANAGE'));
  assert.ok(onlyManage.codes.includes('NUTRITION_MANAGE'), 'mã ngoài luồng giữ nguyên');
});

test('accountDutyTags: tag dinh dưỡng chỉ cho Phó hiệu trưởng có NUTRITION_MANAGE từ BE', () => {
  assert.deepEqual(accountDutyTags({ role: 'VICE_PRINCIPAL', bePermissions: ['NUTRITION_MANAGE'] }), [
    { key: 'nutrition', label: 'Phụ trách dinh dưỡng' },
  ]);
  assert.deepEqual(accountDutyTags({ role: 'VICE_PRINCIPAL', bePermissions: ['MENU_MANAGE'] }), []);
  assert.deepEqual(accountDutyTags({ role: 'PRINCIPAL', bePermissions: ['NUTRITION_MANAGE'] }), []);
  assert.deepEqual(accountDutyTags({ role: 'VICE_PRINCIPAL' }), [], 'mock không có bePermissions');
  assert.deepEqual(accountDutyTags(null), []);
});
