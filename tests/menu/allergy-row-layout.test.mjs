import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const { byId } = await import('@/utils/menu-planning/menuCalculations');
const { dayAllergyNotes, weekRows, weekSections } = await import('@/utils/menu-planning/weekGridLayout');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const SRC = new URL('../../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), 'utf8');

beforeEach(() => values.clear());

const loadCatalog = async () => {
  const c = await repo.getCatalog(VP);
  return { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
};

test('bảng tuần gom theo bữa: mỗi bữa một nhóm có tên bữa; bữa trưa tách loại món, bản chỉ xem ẩn loại món cả tuần không dùng', async () => {
  const catalog = await loadCatalog();
  const menu = catalog.menus.find((m) => m.ageGroupId === 'ag-4' && m.meals.some((x) => x.session === 'LUNCH'));
  const days = [{ date: '2026-10-26', menuId: menu.id, meals: menu.meals }];
  const all = weekSections(catalog.nutritionSetups, 'ag-4', days, catalog.dishById, { keepEmpty: true });
  const view = weekSections(catalog.nutritionSetups, 'ag-4', days, catalog.dishById, { keepEmpty: false });

  const lunch = all.find((s) => s.session === 'LUNCH');
  assert.ok(lunch && /trưa/i.test(lunch.label), 'nhóm bữa trưa mang tên bữa');
  assert.ok(lunch.rows.length >= 5, 'bản đang soạn giữ đủ loại món để thêm món');
  const usedTypes = new Set(
    menu.meals.filter((x) => x.session === 'LUNCH').flatMap((x) => x.items.map((i) => catalog.dishById[i.dishId]?.type)),
  );
  const viewLunch = view.find((s) => s.session === 'LUNCH');
  assert.ok(
    viewLunch.rows.every((r) => usedTypes.has(r.type)),
    'bản chỉ xem chỉ còn loại món có dùng',
  );
  for (const s of all.filter((x) => x.session !== 'LUNCH'))
    assert.deepEqual(
      s.rows.map((r) => r.label),
      ['Món'],
    );
  assert.deepEqual(
    all.map((s) => s.session),
    weekRows(catalog.nutritionSetups, 'ag-4', days, catalog.dishById)
      .map((r) => r.session)
      .filter((v, i, a) => a.indexOf(v) === i),
    'thứ tự bữa theo Thiết lập',
  );
});

test('lưu ý cả tuần gom theo nội dung, kèm các ngày bị ảnh hưởng; lỗi nặng lên trước', async () => {
  const { groupIssues } = await import('@/utils/menu-planning/menuChecks');
  const milk = 'Có món chứa sữa bò (12 trẻ dị ứng), chưa có suất thay thế';
  const grouped = groupIssues([
    { date: '2026-10-26', tone: 'warn', text: 'Ít chất béo, nhiều tinh bột' },
    { date: '2026-10-26', tone: 'warn', text: milk },
    { date: '2026-10-27', tone: 'warn', text: milk },
    { date: '2026-10-29', tone: 'bad', text: 'Hơi ít năng lượng (thiếu khoảng 60 kcal)' },
    { date: '2026-10-29', tone: 'warn', text: milk },
  ]);
  assert.deepEqual(grouped[0], { tone: 'bad', text: 'Hơi ít năng lượng (thiếu khoảng 60 kcal)', dates: ['2026-10-29'] });
  assert.deepEqual(grouped.find((g) => g.text === milk).dates, ['2026-10-26', '2026-10-27', '2026-10-29']);
  assert.equal(grouped.length, 3);
});

test('ghi chú dị ứng gom theo ngày và bữa: số trẻ, món gốc, suất thay thế hoặc "chưa có suất thay thế"', async () => {
  const catalog = await loadCatalog();
  const menu = catalog.menus.find((m) => m.ageGroupId === 'ag-4' && m.meals.length);
  const dishes = menu.meals.flatMap((m) => m.items.map((i) => ({ session: m.session, dish: catalog.dishById[i.dishId] })));
  const hit = dishes.find(({ dish }) => dishAllergensOf(dish, catalog).length);
  assert.ok(hit, 'seed cần một món có chất gây dị ứng');
  const allergen = dishAllergensOf(hit.dish, catalog)[0];
  const day = { date: '2026-10-26', menuId: menu.id, meals: menu.meals };
  const allergyRows = [{ allergen, childCount: 7 }];

  const none = dayAllergyNotes({ day, session: hit.session, catalog, allergyRows, allergyMenus: [] });
  assert.ok(none.some((n) => n.dish === hit.dish.name && n.text === `7 trẻ ${allergen.toLowerCase()} · chưa có suất thay thế`));

  const swap = catalog.dishes.find((d) => d.id !== hit.dish.id);
  const allergyMenus = [
    {
      baseMenuId: menu.id,
      restrictions: [allergen],
      replacements: [{ session: hit.session, originalDishId: hit.dish.id, replacementDishId: swap.id }],
    },
  ];
  const withSwap = dayAllergyNotes({ day, session: hit.session, catalog, allergyRows, allergyMenus });
  assert.ok(withSwap.some((n) => n.dish === hit.dish.name && n.text === `7 trẻ ${allergen.toLowerCase()} → ${swap.name}`));

  assert.deepEqual(dayAllergyNotes({ day, session: hit.session, catalog, allergyRows: [], allergyMenus }), []);
  assert.deepEqual(dayAllergyNotes({ day: { ...day, holiday: true }, session: hit.session, catalog, allergyRows, allergyMenus }), []);
});

const dishAllergensOf = (dish, catalog) => [
  ...new Set((dish?.ingredients || []).flatMap((i) => catalog.foodById[i.foodId]?.allergens || [])),
];

test('ô món không còn chứa ghi chú dị ứng: thực đơn tuần, thực đơn đã công bố (tuần) và thực đơn trong ngày ở bếp', () => {
  assert.doesNotMatch(read('components/menu-planning/WeekGrid.jsx'), /td-week__allergy"/);
  // Ô có danh sách món (kb-dishes) không được chứa luôn khối thay đổi dị ứng
  const cellWithChanges = /<ul className="kb-dishes[^"]*">[\s\S]{0,600}?<\/ul>\s*<AllergyMenuChanges/;
  assert.doesNotMatch(read('pages/kitchen/PublishedMenuPage.jsx'), cellWithChanges);
  assert.doesNotMatch(read('pages/kitchen/KitchenFlowPage.jsx'), cellWithChanges);
});
