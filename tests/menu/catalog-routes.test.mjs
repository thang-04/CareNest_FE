import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

// Mock DB đọc/ghi localStorage và phát sự kiện trên window: dựng bản giả trước khi nạp module
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { getMenuForRole } = await import('@/layouts/menuConfig');
const { ROLES } = await import('@/models/User');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');
const { migrateNormKeys, hasLegacyNormKeys, GRAM_NORM_COLUMNS, SESSION_NORM_KEYS } = await import('@/utils/menu-planning/nutritionSetup');
const { validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');
const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');

const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
const block = (name, next) => routes.slice(routes.indexOf(`<Route path="${name}">`), routes.indexOf(`<Route path="${next}">`));
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };

beforeEach(() => values.clear());

test('nhà cung cấp ở /menu/suppliers; /kitchen/suppliers* chuyển hướng giữ đường dẫn cũ', () => {
  const menu = block('menu', 'kitchen');
  for (const path of ['suppliers', 'suppliers/:id']) assert.match(menu, new RegExp(`path="${path}" element=\\{only\\(`), path);
  // Thêm/sửa NCC là modal: link form cũ về danh sách / chi tiết
  assert.match(menu, /path="suppliers\/new" element=\{<Navigate to="\/menu\/suppliers" replace \/>\}/);
  assert.match(menu, /path="suppliers\/:id\/edit" element=\{<SupplierRedirect \/>\}/);
  const kitchen = block('kitchen', 'assessment');
  assert.match(kitchen, /path="suppliers" element=\{<Navigate to="\/menu\/suppliers" replace \/>\}/);
  assert.match(kitchen, /path="suppliers\/new" element=\{<Navigate to="\/menu\/suppliers" replace \/>\}/);
  assert.match(kitchen, /path="suppliers\/:id" element=\{<SupplierRedirect \/>\}/);
  assert.match(kitchen, /path="suppliers\/:id\/edit" element=\{<SupplierRedirect \/>\}/);
  assert.ok(!kitchen.includes('<SupplierListPage'), 'không còn màn NCC dưới /kitchen');
  assert.ok(INTEGRATION_MODULES['nutrition-catalog'].routes.includes('/menu/suppliers'));
  assert.ok(!INTEGRATION_MODULES['nutrition-catalog'].routes.includes('/kitchen/suppliers'));
  for (const role of Object.values(ROLES)) {
    const items = getMenuForRole(role).flatMap((m) => m.children || []);
    assert.ok(!items.some((c) => c.to?.startsWith('/kitchen/suppliers')), role);
  }
});

test('giá suất ăn chỉ sửa ở Thiết lập: không còn màn /menu/prices', () => {
  assert.ok(!routes.includes('path="prices'));
  assert.ok(!routes.includes('MealPrice'));
  assert.ok(!existsSync('src/pages/menu-planning/MealPriceListPage.jsx'));
  assert.ok(!existsSync('src/pages/menu-planning/MealPriceFormPage.jsx'));
  for (const role of Object.values(ROLES)) {
    const items = getMenuForRole(role).flatMap((m) => m.children || []);
    assert.ok(!items.some((c) => c.to === '/menu/prices'), role);
  }
  assert.ok(INTEGRATION_MODULES['nutrition-catalog'].routes.includes('/menu/setup'));
});

test('HT xem được thực phẩm, món, thiết lập, NCC (route mở cho PRINCIPAL)', () => {
  const menu = block('menu', 'kitchen');
  for (const path of ['setup', 'foods', 'foods/:id', 'dishes', 'dishes/:id', 'suppliers', 'suppliers/:id']) {
    const line = menu.split('\n').find((l) => l.includes(`path="${path}"`));
    assert.match(line, /only\((LEADERS|CATALOG_READERS),/, path);
  }
  assert.match(routes, /const CATALOG_READERS = LEADERS;/);
});

test('khóa định mức khớp BE: gam theo chất, % năng lượng từng bữa; dữ liệu cũ animal*Share được đổi', () => {
  assert.deepEqual(
    GRAM_NORM_COLUMNS.map((c) => c.key),
    ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'],
  );
  assert.deepEqual(SESSION_NORM_KEYS, { MORNING: 'morningKcalPct', LUNCH: 'lunchKcalPct', AFTERNOON: 'afternoonKcalPct' });
  const legacy = { kcal: [600, 700], animalProteinShare: [50, 60], animalLipidShare: [40, 50] };
  assert.equal(hasLegacyNormKeys(legacy), true);
  assert.deepEqual(migrateNormKeys(legacy), { kcal: [600, 700], animalProteinPct: [50, 60], animalLipidPct: [40, 50] });
  assert.deepEqual(migrateNormKeys({ animalProteinShare: [1, 2], animalProteinPct: [3, 4] }), { animalProteinPct: [3, 4] });
  assert.equal(hasLegacyNormKeys({ kcal: [1, 2] }), false);
});

test('mock: localStorage lưu khóa cũ ⇒ đọc Thiết lập ra khóa mới (đổi một lần)', async () => {
  await repo.listNutritionSetups(VP);
  writeDb((db) => {
    const s = db.nutritionSetups.find((x) => x.ageGroupId === 'ag-4');
    s.norms = { ...s.norms, animalProteinShare: [55, 65] };
    delete s.norms.animalProteinPct;
  });
  const setups = await repo.listNutritionSetups(VP);
  const ag4 = setups.find((x) => x.ageGroupId === 'ag-4');
  assert.deepEqual(ag4.norms.animalProteinPct, [55, 65]);
  assert.ok(!('animalProteinShare' in ag4.norms));
  assert.ok(!readDb().nutritionSetups.some((x) => hasLegacyNormKeys(x.norms)), 'đã ghi lại localStorage');
});

test('kiểm Thiết lập khi nối BE: bữa chỉ đọc không kiểm; bản mới phải từ ngày sau hôm nay', () => {
  const group = { ageGroupId: 'ag-4', enabled: true, price: '30000', meals: [], norms: {} };
  const today = '2026-11-03';
  assert.ok(validateNutritionSetup({ effectiveFrom: today, groups: [group] }, today)['ag-4.meals'], 'mock vẫn đòi bữa gốc');
  const opts = { mealsReadOnly: true, minDate: '2026-11-04' };
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: '2026-11-04', groups: [group] }, today, opts), {});
  assert.equal(
    validateNutritionSetup({ effectiveFrom: today, groups: [group] }, today, opts).effectiveFrom,
    'Bản mới chỉ áp dụng từ ngày sau hôm nay.',
  );
  assert.ok(validateNutritionSetup({ effectiveFrom: '2026-11-04', groups: [{ ...group, price: '' }] }, today, opts)['ag-4.price']);
});
