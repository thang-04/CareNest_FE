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

const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { checkDayMenu } = await import('@/utils/menu-planning/menuChecks');
const { byId } = await import('@/utils/menu-planning/menuCalculations');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const TODAY = '2026-10-15';
const catalogOf = async () => {
  const c = await repo.getCatalog(VP);
  return { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
};

beforeEach(() => values.clear());

test('kiểm tra tự động: lời thường, số liệu để riêng; thiếu bữa đứng đầu', async () => {
  const catalog = await catalogOf();
  const menu = catalog.menus.find((m) => m.ageGroupId === 'ag-4');
  const full = checkDayMenu({ meals: menu.meals, ageGroupId: 'ag-4', catalog, date: TODAY });
  assert.ok(full.checks.some((c) => /năng lượng/i.test(c.text)));
  assert.ok(full.checks.some((c) => /tiền ăn/.test(c.text)));
  // Không còn ký hiệu kỹ thuật kiểu "Đạm : béo : bột 14,9 : 24,5" hay khoảng kcal trong lời nhắn
  assert.ok(full.checks.every((c) => !/ : |–/.test(c.text)));
  assert.deepEqual(
    full.numbers.map((n) => n.label),
    ['Năng lượng', 'Đạm · béo · tinh bột', 'Tiền ăn'],
  );
  assert.equal(full.numbers[0].norm, '615–726 kcal');
  assert.equal(full.numbers[2].norm, 'tối đa 30.000 đ');
  assert.notEqual(full.status.label, 'Thiếu bữa');
  const half = checkDayMenu({ meals: [menu.meals[0]], ageGroupId: 'ag-4', catalog, date: TODAY });
  assert.deepEqual(half.status, { tone: 'red', label: 'Thiếu bữa' });
  assert.equal(half.checks[0].tone, 'bad');
});

test('món có chất trẻ dị ứng: báo số trẻ và đã/chưa có suất thay thế', async () => {
  const catalog = await catalogOf();
  const fishDish = catalog.dishes.find((d) => d.name === 'Cá basa sốt cà chua');
  const meals = [{ session: 'LUNCH', items: [{ dishId: fishDish.id, portion: 1 }] }];
  const rows = [{ allergen: 'Cá', childCount: 2 }];
  const without = checkDayMenu({ meals, ageGroupId: 'ag-4', catalog, date: TODAY, allergyRows: rows });
  assert.ok(without.problems.some((c) => c.text === 'Có món chứa cá (2 trẻ dị ứng), chưa có suất thay thế' && c.tone === 'warn'));
  const withSub = checkDayMenu({
    meals,
    ageGroupId: 'ag-4',
    catalog,
    date: TODAY,
    allergyRows: rows,
    allergyMenus: [{ restrictions: ['Cá'] }],
  });
  assert.ok(withSub.checks.some((c) => /đã có suất thay thế/.test(c.text) && c.tone === 'ok'));
});

test('AI soạn mẫu trả bản nháp có lý do và điều kiện gửi kèm', async () => {
  const d = await repo.generateAiSuggestion({ kind: 'DAILY', ageGroupId: 'ag-4', season: 'Thu', wishes: 'ít chiên rán' }, VP);
  assert.equal(d.status, 'PENDING_REVIEW');
  assert.ok(d.reasons.length >= 2);
  assert.deepEqual(d.conditions, { season: 'Thu', wishes: 'ít chiên rán', noRepeatDays: null });
  assert.ok(d.meals.every((m) => m.items.length));
});

test('AI soạn mẫu: chọn tổ hợp đạt kiểm tra tự động khi món hiện có ghép được', async () => {
  const d = await repo.generateAiSuggestion({ kind: 'DAILY', ageGroupId: 'ag-4' }, VP);
  const catalog = await catalogOf();
  const problems = checkDayMenu({ meals: d.meals, ageGroupId: 'ag-4', catalog, date: TODAY }).problems;
  if (problems.length) assert.ok(d.reasons.some((r) => /chưa ghép được/.test(r)));
  else assert.ok(d.reasons.includes('Đủ chất và trong tiền ăn.'));
});
