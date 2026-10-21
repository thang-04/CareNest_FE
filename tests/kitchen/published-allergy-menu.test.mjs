import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { writeDb } = await import('@/mocks/mockDatabase');
const VP = { id: 'demo_vp', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const HT = { id: 'demo_ht', role: 'PRINCIPAL' };
const DATE = '2026-10-20';

before(async () => {
  await repo.getPublishedMenu({ date: DATE, view: 'day' }, VP);
  writeDb((db) => {
    db.foods = [{ id: 'food_demo', name: 'Nguyên liệu mẫu', unit: 'g' }];
    db.dishes = ['rice', 'shrimp', 'egg', 'fish', 'fruit'].map((id) => ({ id, name: `Món ${id}`, ingredients: [] }));
    db.classes = [
      { id: 'class_a', name: 'Lớp mẫu A', campusId: 'c1', ageGroupId: 'ag-3' },
      { id: 'class_b', name: 'Lớp mẫu B', campusId: 'c2', ageGroupId: 'ag-3' },
      { id: 'class_c', name: 'Lớp mẫu C', campusId: 'c1', ageGroupId: 'ag-4' },
    ];
    db.children = [
      { id: 'demo_1', fullName: 'Trẻ mẫu 1', classId: 'class_a', status: 'ACTIVE', allergies: ['Tôm', 'Cá'], secret: 'excluded' }, // carenest:allow-secret – field giả, kiểm tra không lộ ra modal
      { id: 'demo_2', fullName: 'Trẻ mẫu 2', classId: 'class_b', status: 'ACTIVE', allergies: ['Tôm'] },
      { id: 'demo_3', fullName: 'Trẻ mẫu 3', classId: 'class_c', status: 'ACTIVE', allergies: ['Tôm'] },
      { id: 'demo_4', fullName: 'Trẻ mẫu 4', classId: 'class_a', status: 'INACTIVE', allergies: ['Tôm'] },
    ];
    db.nutritionSetups = [
      {
        ageGroupId: 'ag-3',
        meals: [
          { code: 'LUNCH', countAs: 'LUNCH' },
          { code: 'AFTERNOON', countAs: 'AFTERNOON' },
        ],
      },
    ];
    db.weeklyMenus = [
      {
        id: 'week_demo',
        ageGroupId: 'ag-3',
        status: 'PUBLISHED',
        days: [
          {
            date: DATE,
            menuId: 'base_demo',
            meals: [
              { session: 'LUNCH', items: [{ dishId: 'rice' }, { dishId: 'shrimp' }, { dishId: 'fish' }] },
              { session: 'AFTERNOON', items: [{ dishId: 'fruit' }] },
            ],
          },
        ],
      },
    ];
    db.allergyMenus = [
      {
        id: 'alt_1',
        baseMenuId: 'base_demo',
        restrictions: ['Tôm'],
        status: 'ACTIVE',
        replacements: [{ session: 'LUNCH', originalDishId: 'shrimp', replacementDishId: 'egg' }],
      },
      {
        id: 'alt_2',
        baseMenuId: 'base_demo',
        restrictions: ['Tôm', 'Cá'],
        status: 'ACTIVE',
        replacements: [
          { session: 'LUNCH', originalDishId: 'shrimp', replacementDishId: 'fish' },
          { session: 'LUNCH', originalDishId: 'fish', replacementDishId: null },
        ],
      },
      {
        id: 'alt_inactive',
        baseMenuId: 'base_demo',
        restrictions: ['Tôm'],
        status: 'INACTIVE',
        replacements: [{ session: 'LUNCH', originalDishId: 'shrimp', replacementDishId: 'fruit' }],
      },
    ];
  });
});

const normalLunch = (days) =>
  days
    .find((d) => d.date === DATE)
    .sessions.find((s) => s.session === 'LUNCH')
    .menus.find((m) => m.type === 'NORMAL');

test('published menu describes only changed dishes, keeps alternatives separate and represents removals', async () => {
  const days = await repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c1' }, VP);
  const menu = normalLunch(days);
  assert.equal(menu.allergyChanges?.length, 2);
  const [first, second] = menu.allergyChanges;
  assert.equal(first.replacements.length, 1);
  assert.equal(first.replacements[0].originalDish.name, 'Món shrimp');
  assert.equal(first.replacements[0].replacementDish.name, 'Món egg');
  assert.deepEqual(first.restrictions, ['Tôm']);
  assert.equal(second.replacements[0].replacementDish.id, 'fish');
  assert.equal(second.replacements[1].replacementDish, null);
  const afternoon = days[0].sessions.find((s) => s.session === 'AFTERNOON').menus.find((m) => m.type === 'NORMAL');
  assert.deepEqual(afternoon.allergyChanges, [], 'bữa không thay món không lặp lại thực đơn dị ứng');
});

test('allergy roster is scoped in the mock repository and contains only fields needed for cooking', async () => {
  const first = normalLunch(await repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c1' }, VP)).allergyChanges?.[0];
  assert.ok(first, 'có chi tiết dị ứng');
  assert.equal(first.childCount, 1);
  assert.equal(first.classCount, 1);
  assert.deepEqual(first.children, [{ id: 'demo_1', fullName: 'Trẻ mẫu 1', className: 'Lớp mẫu A', allergies: ['Tôm'] }]);
  const other = normalLunch(await repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c2' }, HT)).allergyChanges[0];
  assert.deepEqual(
    other.children.map((c) => c.id),
    ['demo_2'],
  );
  await assert.rejects(repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c2' }, VP), (e) => e.status === 403);
  await assert.rejects(
    repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c1' }, { role: 'TEACHER', campusId: 'c1' }),
    (e) => e.status === 403,
  );
});

test('week view uses the same changes and principal without a campus receives no named roster', async () => {
  const day = normalLunch(await repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c1' }, VP));
  const week = normalLunch(await repo.getPublishedMenu({ date: DATE, view: 'week', campusId: 'c1' }, VP));
  assert.deepEqual(week.allergyChanges, day.allergyChanges);
  const unscoped = normalLunch(await repo.getPublishedMenu({ date: DATE, view: 'day' }, HT));
  assert.deepEqual(unscoped.allergyChanges[0].children, []);
  assert.equal(unscoped.allergyChanges[0].childrenAvailable, false);
});

test('legacy menus preserve the changed dish names without inventing replacement pairs or warnings for unchanged meals', async () => {
  writeDb((db) => {
    db.weeklyMenus = [
      {
        id: 'legacy_week',
        status: 'PUBLISHED',
        days: [
          { id: 'legacy_normal', date: DATE, ageGroupId: 'ag-3', session: 'LUNCH', type: 'NORMAL', dishIds: ['rice', 'shrimp'] },
          { id: 'legacy_allergy', date: DATE, ageGroupId: 'ag-3', session: 'LUNCH', type: 'ALLERGY', dishIds: ['rice', 'egg'] },
          { id: 'legacy_snack', date: DATE, ageGroupId: 'ag-3', session: 'AFTERNOON', type: 'NORMAL', dishIds: ['fruit'] },
          { id: 'legacy_snack_allergy', date: DATE, ageGroupId: 'ag-3', session: 'AFTERNOON', type: 'ALLERGY', dishIds: ['fruit'] },
        ],
      },
    ];
  });
  const days = await repo.getPublishedMenu({ date: DATE, view: 'day', campusId: 'c1' }, VP);
  const change = normalLunch(days).allergyChanges[0];
  assert.deepEqual(change.removedDishes, [{ id: 'shrimp', name: 'Món shrimp' }]);
  assert.deepEqual(change.addedDishes, [{ id: 'egg', name: 'Món egg' }]);
  assert.equal(change.childrenAvailable, false);
  const afternoon = days[0].sessions.find((s) => s.session === 'AFTERNOON').menus.find((m) => m.type === 'NORMAL');
  assert.deepEqual(afternoon.allergyChanges, []);
});
