import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { copyPortions, countReplacedCells, duplicateDishForm } = await import('@/utils/menu-planning/recipeCopy');
const { validateDish } = await import('@/utils/menu-planning/menuPlanningValidation');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const AGES = ['ag-2', 'ag-3', 'ag-4', 'ag-5'];
// Lý do lỗi nằm ở message hoặc ở details theo ô (422 kiểm tra trường)
const rejects = (promise, status, text) =>
  assert.rejects(promise, (e) => e.status === status && (!text || text.test(`${e.message} ${JSON.stringify(e.details || {})}`)));
const full = (foodId) => ({ foodId, portions: { 'ag-2': '30', 'ag-3': '40', 'ag-4': '50', 'ag-5': '60' } });
const partial = (foodId) => ({ foodId, portions: { 'ag-2': '', 'ag-3': '40', 'ag-4': '50', 'ag-5': '60' } });

test('BA 03 nhân bản: form bản sao độc lập với món gốc, tên "(bản sao)", để Nháp', () => {
  const dish = {
    name: 'Canh bí',
    type: 'SOUP',
    description: 'Nấu nhỏ lửa',
    ingredients: [{ foodId: 'f1', quantity: 50, portions: { 'ag-2': null, 'ag-3': 40, 'ag-4': 50, 'ag-5': 60 } }],
  };
  const form = duplicateDishForm(dish, AGES, 'DRAFT');
  assert.equal(form.name, 'Canh bí (bản sao)');
  assert.equal(form.status, 'DRAFT');
  assert.deepEqual(form.ingredients[0].portions, { 'ag-2': '', 'ag-3': '40', 'ag-4': '50', 'ag-5': '60' });
  form.ingredients[0].portions['ag-3'] = '99';
  assert.equal(dish.ingredients[0].portions['ag-3'], 40, 'sửa bản sao không đổi món gốc');
});

test('BA 03 chép định lượng: chép nguyên cột; đếm ô đã nhập sẽ bị thay để hỏi trước', () => {
  const rows = [
    { foodId: 'f1', portions: { 'ag-3': '40', 'ag-4': '50' } },
    { foodId: 'f2', portions: { 'ag-3': '10', 'ag-4': '' } },
    { foodId: 'f3', portions: { 'ag-3': '', 'ag-4': '7' } },
    { foodId: 'f4', portions: { 'ag-3': '5', 'ag-4': '5' } },
  ];
  assert.equal(countReplacedCells(rows, 'ag-3', 'ag-4'), 2, 'ô trống và ô cùng số không tính');
  const copied = copyPortions(rows, 'ag-3', 'ag-4');
  assert.deepEqual(
    copied.map((r) => r.portions['ag-4']),
    ['40', '10', '', '5'],
  );
  assert.equal(rows[0].portions['ag-4'], '50', 'không sửa mảng gốc');
  assert.equal(countReplacedCells(copied, 'ag-3', 'ag-4'), 0);
});

test('Nháp: lưu được khi thiếu nhóm; dùng cho thực đơn cần đủ định lượng mọi nhóm đang áp dụng', async () => {
  const [food] = await repo.listFoods({}, VP);
  const base = { name: 'Món nháp thử', type: 'MAIN', ingredients: [partial(food.id)] };
  const draft = await repo.saveDish(null, { ...base, status: 'DRAFT' }, VP);
  assert.equal(draft.status, 'DRAFT');
  await rejects(repo.saveDish(draft.id, { ...base, status: 'ACTIVE' }, VP), 422, /định lượng/);
  await rejects(repo.saveDish(null, { ...base, name: 'Món mới dùng ngay', status: 'ACTIVE' }, VP), 422);
  const active = await repo.saveDish(draft.id, { ...base, ingredients: [full(food.id)], status: 'ACTIVE' }, VP);
  assert.equal(active.status, 'ACTIVE');
  assert.ok(validateDish({ ...base, status: 'ACTIVE' }, [], { requireGroups: [{ id: 'ag-2', name: 'NT' }] }).status);
  assert.ok(!validateDish({ ...base, status: 'DRAFT' }, []).status, 'lưu nháp không đòi đủ nhóm');
  await rejects(repo.saveDish(null, { ...base, name: 'Món rỗng', ingredients: [], status: 'DRAFT' }, VP), 422);
});

test('món đang dùng giữ quy tắc cũ khi sửa; món đã có trong thực đơn không về Nháp', async () => {
  const menus = await repo.listMenus({}, VP);
  const usedId = menus[0].meals[0].items[0].dishId;
  const used = await repo.getDish(usedId, VP);
  await rejects(repo.saveDish(usedId, { ...used, status: 'DRAFT' }, VP), 409);
  const kept = await repo.saveDish(usedId, { ...used, description: 'Sửa mô tả' }, VP);
  assert.equal(kept.status, 'ACTIVE');
});

test('món Nháp không vào được thực đơn mẫu, điều chỉnh ngày, món thay dị ứng; nhân bản trùng tên bị chặn', async () => {
  const [food] = await repo.listFoods({}, VP);
  const draft = await repo.saveDish(null, { name: 'Món nháp chặn', type: 'SOUP', status: 'DRAFT', ingredients: [full(food.id)] }, VP);
  const menus = await repo.listMenus({ ageGroupId: 'ag-4' }, VP);
  const menu = menus.find((m) => m.ageGroupId === 'ag-4');
  const withDraft = menu.meals.map((m, i) => (i ? m : { ...m, items: [...m.items, { dishId: draft.id, portion: 1 }] }));
  await rejects(repo.saveMenu(menu.id, { ...menu, meals: withDraft }, VP), 422, /món nháp/);

  const wm = await repo.saveWeeklyMenu(
    null,
    { ageGroupId: 'ag-4', weekStart: '2027-03-01', days: [{ date: '2027-03-01', menuId: menu.id }] },
    VP,
  );
  const day = wm.days.find((d) => d.date === '2027-03-01');
  const dayMeals = day.meals.map((m, i) => (i ? m : { ...m, items: [...m.items, { dishId: draft.id, portion: 1 }] }));
  await rejects(repo.saveDayAdjustment(wm.id, '2027-03-01', dayMeals, VP), 422, /món nháp/);

  const allergy = (await repo.listAllergyMenus({}, VP)).find((a) => a.replacements.length);
  assert.ok(allergy, 'seed có thực đơn thay thế');
  {
    const replacements = allergy.replacements.map((r, i) => (i ? r : { ...r, replacementDishId: draft.id }));
    await rejects(repo.saveAllergyMenu(allergy.id, { ...allergy, replacements }, VP), 422, /món nháp/);
  }

  const source = await repo.getDish(menu.meals[0].items[0].dishId, VP);
  const copy = duplicateDishForm(source, AGES, 'DRAFT');
  const saved = await repo.saveDish(null, copy, VP);
  assert.equal(saved.name, `${source.name} (bản sao)`);
  assert.notEqual(saved.id, source.id);
  await rejects(repo.saveDish(null, copy, VP), 422);
});

test('chép món từ thư viện tham khảo về ở Nháp', async () => {
  const lib = await repo.listReferenceDishes({}, VP);
  const free = lib.find((d) => !d.inSchool && !d.copied) || lib[lib.length - 1];
  const { dish } = await repo.copyReferenceDish(free.id, VP);
  assert.equal(dish.status, 'DRAFT');
});
