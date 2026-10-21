import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const constants = await import('@/models/menu-planning/menuPlanningConstants');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { byId, compareToNorm, isNormConfigured } = await import('@/utils/menu-planning/menuCalculations');
const { checkDayMenu } = await import('@/utils/menu-planning/menuChecks');
const { validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const TODAY = '2026-10-20';

beforeEach(() => values.clear());

const catalogOf = async () => {
  const c = await repo.getCatalog(VP);
  return { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
};

test('không còn chuẩn dinh dưỡng hay hệ số khẩu phần hard-code trong constants', () => {
  assert.equal(constants.NUTRITION_NORMS, undefined);
  assert.equal(constants.PORTION_FACTORS, undefined);
});

test('chưa nhập chuẩn tạm: mọi chất NA, không áp chuẩn mặc định', () => {
  const totals = { kcal: 650, protein: 25, lipid: 25, glucid: 90 };
  assert.ok(compareToNorm(totals, 'ag-4', false, {}).every((r) => r.status === 'NA' && r.min == null));
  assert.equal(isNormConfigured({ kcal: [600, 700], protein: [13, 20], lipid: [25, 35] }), false);
  assert.equal(isNormConfigured({ kcal: [600, 700], protein: [13, 20], lipid: [25, 35], glucid: ['', 60] }), false);
});

test('ngày đủ món nhưng nhóm tuổi chưa có chuẩn tạm ⇒ "Chưa đủ dữ liệu đánh giá", không bao giờ "Đủ chất"', async () => {
  const catalog = await catalogOf();
  const menu = catalog.menus.find((m) => m.ageGroupId === 'ag-4' && m.meals.length);
  const withNorm = checkDayMenu({ meals: menu.meals, ageGroupId: 'ag-4', catalog, date: TODAY });
  const noNorm = checkDayMenu({ meals: menu.meals, ageGroupId: 'ag-4', catalog: { ...catalog, norms: {} }, date: TODAY });
  assert.notEqual(withNorm.status.label, 'Chưa đủ dữ liệu đánh giá');
  assert.equal(noNorm.status.label, 'Chưa đủ dữ liệu đánh giá');
  assert.ok(noNorm.problems.some((p) => p.text.startsWith('Chưa nhập chuẩn tạm')));
  assert.ok(!noNorm.checks.some((p) => p.text === 'Đủ năng lượng'));
});

test('seed: nhóm 5–6 tuổi để trống chuẩn tạm để demo trạng thái chưa đánh giá', async () => {
  const catalog = await catalogOf();
  assert.equal(isNormConfigured(catalog.norms['ag-4']), true);
  assert.equal(isNormConfigured(catalog.norms['ag-5']), false);
});

test('thiết lập: để trống cả bốn chuẩn tạm hợp lệ; nhập dở một khoảng thì báo lỗi', () => {
  const group = (norms) => ({
    ageGroupId: 'ag-4',
    enabled: true,
    price: '30000',
    meals: [
      { code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' },
      { code: 'AFTERNOON', name: 'Bữa chiều', countAs: 'AFTERNOON' },
    ],
    norms,
  });
  const empty = { kcal: ['', ''], protein: ['', ''], lipid: ['', ''], glucid: ['', ''] };
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: TODAY, groups: [group(empty)] }, TODAY), {});
  const partial = { ...empty, kcal: ['600', ''] };
  assert.ok(validateNutritionSetup({ effectiveFrom: TODAY, groups: [group(partial)] }, TODAY)['ag-4.norms.kcal']);
});
