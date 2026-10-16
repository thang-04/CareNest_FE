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
const { missingPortionGroups } = await import('@/utils/menu-planning/menuCalculations');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const HT = { id: 'u_hung', role: 'PRINCIPAL' };

beforeEach(() => values.clear());

test('thư viện chỉ đọc: có định lượng 4 nhóm, kcal, đánh dấu thực phẩm trường chưa có', async () => {
  const list = await repo.listReferenceDishes({}, HT);
  assert.ok(list.length >= 5);
  const duck = list.find((d) => d.name === 'Vịt om khoai tây');
  assert.deepEqual(Object.keys(duck.ingredients[0].portions), ['ag-2', 'ag-3', 'ag-4', 'ag-5']);
  assert.ok(duck.kcal['ag-4'] > 0);
  assert.equal(duck.ingredients.find((i) => i.foodName === 'Thịt vịt').inCatalog, false);
  assert.equal(duck.ingredients.find((i) => i.foodName === 'Dầu ăn').inCatalog, true);
  assert.equal(
    (await repo.listReferenceDishes({ type: 'SOUP' }, VP)).every((d) => d.type === 'SOUP'),
    true,
  );
});

test('chép món: thêm thực phẩm còn thiếu (chưa có đơn giá), món có định lượng đủ 4 nhóm; chép lại bị chặn', async () => {
  const before = (await repo.listFoods({}, VP)).length;
  const { dish, addedFoods } = await repo.copyReferenceDish('rd02', VP);
  assert.deepEqual(addedFoods.sort(), ['Khoai tây', 'Thịt vịt']);
  const foods = await repo.listFoods({}, VP);
  assert.equal(foods.length, before + 2);
  const duck = foods.find((f) => f.name === 'Thịt vịt');
  assert.equal(duck.unitPrice, null);
  assert.ok(duck.nutrition.kcal > 0);
  assert.deepEqual(missingPortionGroups(dish, ['ag-2', 'ag-3', 'ag-4', 'ag-5']), []);
  assert.equal((await repo.listReferenceDishes({ keyword: 'Vịt om' }, VP))[0].inCatalog, true);
  await assert.rejects(repo.copyReferenceDish('rd02', VP), (e) => e.status === 409);
  await assert.rejects(repo.copyReferenceDish('rd01', HT), (e) => e.status === 403);
});
