import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

globalThis.window = new EventTarget();

const { createNutritionCatalogApi } = await import('@/services/nutritionCatalogApi');
const { createDemoSource } = await import('@/services/demoSource');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

// Dữ liệu giả theo DTO BE /nutrition/* sau khi beClient đổi id số sang chuỗi
const ALLERGENS = [
  { id: '1', code: 'SHRIMP', name: 'Tôm' },
  { id: '4', code: 'EGG', name: 'Trứng' },
  { id: '5', code: 'MILK', name: 'Sữa bò' },
];
const AGE_GROUPS = [
  { id: '11', code: 'ag-2', sortOrder: 1, mealSessions: ['MORNING', 'LUNCH', 'AFTERNOON'] },
  { id: '12', code: 'ag-3', sortOrder: 2, mealSessions: ['LUNCH', 'AFTERNOON'] },
  { id: '13', code: 'ag-4', sortOrder: 3, mealSessions: ['LUNCH', 'AFTERNOON'] },
  { id: '14', code: 'ag-5', sortOrder: 4, mealSessions: ['LUNCH', 'AFTERNOON'] },
];
// Cấu hình nhóm tuổi ag-4: bản đã hiệu lực (khóa) và bản hẹn ngày sau (sửa được); các nhóm khác chưa có bản nào
const config = (over) => ({
  ageGroupId: '13',
  mealPrice: 30000,
  kcalMin: 615,
  kcalMax: 726,
  proteinPctMin: 13,
  proteinPctMax: 20,
  lipidPctMin: 25,
  lipidPctMax: 35,
  glucidPctMin: 52,
  glucidPctMax: 60,
  animalProteinGMin: null,
  animalProteinGMax: null,
  animalLipidGMin: 10,
  animalLipidGMax: 14,
  lunchKcalPctMin: 40,
  lunchKcalPctMax: 50,
  dailyKcalNeed: 1300,
  normBasis: 'TT 28/2016',
  ...over,
});
const VERSIONS = {
  13: [
    config({ id: '41', effectiveFrom: '2099-01-01', mealPrice: 32000, editable: true }),
    config({ id: '40', effectiveFrom: '2026-09-01', editable: false }),
  ],
};
const beFood = {
  id: '7',
  code: 'TP007',
  name: 'Trứng gà',
  foodGroup: 'EGG_DAIRY',
  unit: 'g',
  purchaseUnit: 'quả',
  purchaseUnitSize: 50,
  unitPrice: 3500,
  kcal: 166,
  protein: 14.8,
  lipid: 11.6,
  glucid: 0.5,
  calcium: 55,
  iron: 2.7,
  nutrientSource: 'Bảng TPVN',
  nutrientSourceVersion: '2017',
  wastePct: 12,
  storage: 'FRESH',
  note: '',
  status: 'ACTIVE',
  allergens: [ALLERGENS[1]],
};
const beDish = {
  id: '30',
  code: 'MA030',
  name: 'Trứng hấp',
  dishType: 'MAIN',
  description: '',
  reference: false,
  status: 'ACTIVE',
  ingredients: [
    { foodId: '7', foodCode: 'TP007', foodName: 'Trứng gà', unit: 'g', ageGroupId: '11', gramsPerChild: 20 },
    { foodId: '7', foodCode: 'TP007', foodName: 'Trứng gà', unit: 'g', ageGroupId: '13', gramsPerChild: 30 },
  ],
  nutritionByAgeGroup: [{ ageGroupId: '13', kcal: 50, protein: 4, lipid: 3, glucid: 0, cost: 2100 }],
  allergens: [ALLERGENS[1]],
};

let calls;
let favorites;
const client = {};
const respond = (method, url, body) => {
  calls.push({ method, url, body });
  if (url === '/nutrition/allergens') return ALLERGENS;
  if (url === '/age-groups') return AGE_GROUPS;
  if (url === '/nutrition/foods' && method === 'get') return [beFood];
  if (url === '/nutrition/foods/import')
    return { created: body.items.filter((it) => it.id == null).length, updated: body.items.filter((it) => it.id != null).length };
  const versions = url.match(/^\/nutrition\/age-group-configs\/(\d+)\/versions$/);
  if (versions) return VERSIONS[versions[1]] || [];
  if (url === '/nutrition/age-group-configs' && method === 'get') return [VERSIONS[13][1]];
  if (url === '/nutrition/age-group-configs/batch') return body.items.map((it, i) => ({ id: String(60 + i), ...it, editable: true }));
  if (url.startsWith('/nutrition/age-group-configs')) return { id: '50', ...body, editable: true };
  if (/^\/nutrition\/foods\/\d+\/status$/.test(url)) return { ...beFood, status: body.status };
  if (url.startsWith('/nutrition/foods')) return method === 'get' ? beFood : { ...beFood, ...body, allergens: [ALLERGENS[1]] };
  if (url === '/nutrition/dishes' && method === 'get') return [beDish];
  if (/^\/nutrition\/dishes\/\d+\/status$/.test(url)) return { ...beDish, status: body.status };
  if (url.startsWith('/nutrition/dishes')) return method === 'get' ? beDish : { ...beDish, id: '31', status: 'ACTIVE' };
  if (/^\/nutrition\/suppliers\/\d+\/status$/.test(url)) return { id: '3', name: 'NCC', phone: '0900000001', status: body.status };
  if (url.startsWith('/nutrition/suppliers'))
    return method === 'get'
      ? [{ id: '3', name: 'NCC thực phẩm', phone: '0900000001', address: '', idCard: null, deliveryPerson: 'Anh giao', status: 'ACTIVE' }]
      : { id: '3', ...body, status: 'ACTIVE' };
  throw new Error(`Chưa giả lập ${method} ${url}`);
};
['get', 'post', 'put', 'patch'].forEach((method) => {
  client[method] = async (url, a, b) => respond(method, url, method === 'get' ? a?.params : a, b);
});
const storage = () => ({ getItem: (k) => favorites.get(k) ?? null, setItem: (k, v) => favorites.set(k, String(v)) });

let api;
beforeEach(() => {
  calls = [];
  favorites = new Map();
  api = createNutritionCatalogApi({ client, storage });
});

test('thực phẩm BE → dạng FE: nhóm, dinh dưỡng, nguồn số liệu, tên chất dị ứng, đơn vị kho = đơn vị mua', async () => {
  const [food] = await api.listFoods({ group: 'EGG_DAIRY', keyword: '' });
  assert.deepEqual(calls[0], { method: 'get', url: '/nutrition/foods', body: { foodGroup: 'EGG_DAIRY' } });
  assert.equal(food.group, 'EGG_DAIRY');
  assert.deepEqual(food.nutrition, {
    kcal: 166,
    protein: 14.8,
    lipid: 11.6,
    glucid: 0.5,
    // NUT-26: BE có canxi, sắt; chất BE chưa có số liệu ⇒ null
    calcium: 55,
    phosphorus: null,
    iron: 2.7,
    vitaminA: null,
    vitaminB1: null,
    vitaminB2: null,
    vitaminPp: null,
    vitaminC: null,
  });
  assert.deepEqual([food.nutrientSource, food.nutrientSourceVersion], ['Bảng TPVN', '2017']);
  assert.deepEqual(food.allergens, ['Trứng']);
  assert.deepEqual([food.stockUnit, food.purchaseToStock, food.stockUnitSize], ['quả', 1, 50]);
  assert.equal(food.favorite, false);
  assert.deepEqual(await api.listFoods({ allergen: 'Tôm' }), [], 'lọc chất dị ứng ở client');
});

test('lưu thực phẩm: tên dị ứng → allergenIds, nutrition → trường phẳng, nguồn số liệu gửi kèm; đổi trạng thái bằng PATCH', async () => {
  const [food] = await api.listFoods({});
  calls = [];
  await api.saveFood(food.id, {
    ...food,
    allergens: ['Trứng', 'Sữa bò'],
    purchaseToStock: 2,
    stockUnitSize: 50,
    purchaseUnitSize: '',
    status: 'INACTIVE',
  });
  const put = calls.find((c) => c.method === 'put');
  assert.equal(put.url, '/nutrition/foods/7');
  assert.deepEqual(put.body.allergenIds, ['4', '5']);
  assert.equal(put.body.foodGroup, 'EGG_DAIRY');
  assert.equal(put.body.purchaseUnitSize, 100, 'g/ml của đơn vị mua tính từ hai tỷ lệ của form');
  assert.deepEqual([put.body.kcal, put.body.glucid], [166, 0.5]);
  assert.deepEqual([put.body.nutrientSource, put.body.nutrientSourceVersion], ['Bảng TPVN', '2017']);
  assert.ok(!('status' in put.body));
  assert.equal(put.body.code, 'TP007', 'giữ mã cũ');
  assert.deepEqual(calls.at(-1), { method: 'patch', url: '/nutrition/foods/7/status', body: { status: 'INACTIVE' } });
  assert.equal(calls.filter((c) => c.url === '/nutrition/allergens').length, 1);
  await api.saveFood(food.id, { ...food, allergens: ['Tôm'] });
  assert.equal(calls.filter((c) => c.url === '/nutrition/allergens').length, 1, 'danh sách chất dị ứng nạp một lần');
});

test('lỗi validation BE theo tên trường BE được đổi sang ô của form FE', async () => {
  const failing = {
    ...client,
    put: async () => {
      throw Object.assign(new Error('Dữ liệu chưa hợp lệ'), { status: 400, details: { foodGroup: 'x', nutrientSource: 'y' } });
    },
  };
  const bad = createNutritionCatalogApi({ client: failing, storage });
  await assert.rejects(
    bad.saveFood('7', { name: 'A', group: 'MEAT', allergens: [] }),
    (e) => e.details.group === 'x' && e.details.nutrientSource === 'y',
  );
});

test('xóa thực phẩm, món, nhà cung cấp = PATCH Ngừng sử dụng (không xóa cứng)', async () => {
  await api.deleteFood('7');
  await api.deleteDish('30');
  await api.deleteSupplier({ id: '3' });
  assert.deepEqual(
    calls.map((c) => `${c.method.toUpperCase()} ${c.url} ${c.body?.status}`),
    [
      'PATCH /nutrition/foods/7/status INACTIVE',
      'PATCH /nutrition/dishes/30/status INACTIVE',
      'PATCH /nutrition/suppliers/3/status INACTIVE',
    ],
  );
});

test('lưu hàng loạt: một POST /import {items:[{id?, data}]}, dòng sửa ghép vào bản hiện tại → {created, updated}', async () => {
  const res = await api.saveFoodsBulk([
    { key: 'r2', data: { name: 'Bí xanh', group: 'VEGETABLE', nutrientSource: 'Bảng TPVN', nutrition: { kcal: 14 } } },
    { key: '7', id: '7', data: { unitPrice: 4000, nutrition: { kcal: 170 } } },
  ]);
  assert.deepEqual(res, { created: 1, updated: 1 });
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    ['get /nutrition/foods', 'get /nutrition/allergens', 'post /nutrition/foods/import'],
    'đọc danh sách một lần, ghi một lần; không GET/PUT từng dòng',
  );
  const [created, updated] = calls.at(-1).body.items;
  assert.ok(!('id' in created));
  assert.deepEqual([created.data.purchaseUnit, created.data.purchaseUnitSize, created.data.storage], ['kg', 1000, 'FRESH']);
  assert.equal(updated.id, 7);
  assert.deepEqual([updated.data.unitPrice, updated.data.kcal, updated.data.protein, updated.data.purchaseUnitSize], [4000, 170, 14.8, 50]);
});

test('lưu hàng loạt: lỗi BE theo dòng items[i] → ô của dòng đó', async () => {
  const failing = createNutritionCatalogApi({
    client: {
      ...client,
      post: async () => {
        throw Object.assign(new Error('Dữ liệu nhập chưa lưu vì có lỗi'), { details: { 'items[1].data.foodGroup': 'Không hợp lệ' } });
      },
    },
    storage,
  });
  const error = await failing
    .saveFoodsBulk([
      { key: 'r2', data: { name: 'Bí', group: 'VEGETABLE', nutrientSource: 'x' } },
      { key: 'r3', data: { name: 'Su', group: 'X', nutrientSource: 'x' } },
    ])
    .catch((e) => e);
  assert.deepEqual(error.details, { 'r3.group': 'Không hợp lệ' });
});

test('"Hay dùng" chỉ lưu ở trình duyệt', async () => {
  await api.setFoodFavorite('7', true);
  const [food] = await api.listFoods({});
  assert.equal(food.favorite, true);
  assert.ok(!calls.some((c) => c.method !== 'get'));
});

test('món BE: dòng theo nhóm tuổi ⇔ portions theo id nhóm tuổi FE; ô trống/0 không gửi', async () => {
  const dish = await api.getDish('30');
  assert.equal(dish.type, 'MAIN');
  assert.deepEqual(dish.ingredients, [{ foodId: '7', foodName: 'Trứng gà', portions: { 'ag-2': 20, 'ag-4': 30 }, quantity: 30 }]);
  assert.deepEqual(dish.allergens, ['Trứng']);
  assert.equal(dish.nutritionByAgeGroup[0].ageGroupId, 'ag-4');

  calls = [];
  await api.saveDish(null, {
    name: 'Trứng hấp',
    type: 'MAIN',
    description: '',
    status: 'DRAFT',
    ingredients: [
      { foodId: '7', portions: { 'ag-2': '20', 'ag-3': '', 'ag-4': '0', 'ag-5': 35 } },
      { foodId: '', portions: { 'ag-2': '5' } },
    ],
  });
  const post = calls.find((c) => c.method === 'post');
  assert.deepEqual(post.body, {
    name: 'Trứng hấp',
    dishType: 'MAIN',
    description: '',
    ingredients: [
      { foodId: '7', ageGroupId: '11', gramsPerChild: 20 },
      { foodId: '7', ageGroupId: '14', gramsPerChild: 35 },
    ],
  });
  assert.deepEqual(
    calls.at(-1),
    { method: 'patch', url: '/nutrition/dishes/31/status', body: { status: 'INACTIVE' } },
    'Nháp ⇒ Ngừng sử dụng',
  );
});

test('danh sách món: chỉ món của trường, một lần GET /nutrition/dishes (BE trả đủ chi tiết, không gọi từng món)', async () => {
  const dishes = await api.listDishes({ type: 'MAIN' });
  assert.deepEqual(calls[0].body, { dishType: 'MAIN', reference: false });
  assert.deepEqual(
    calls.filter((c) => c.url.startsWith('/nutrition/dishes')).map((c) => c.url),
    ['/nutrition/dishes'],
  );
  assert.deepEqual(dishes[0].ingredients, [{ foodId: '7', foodName: 'Trứng gà', portions: { 'ag-2': 20, 'ag-4': 30 }, quantity: 30 }]);
  assert.deepEqual(dishes[0].allergens, ['Trứng']);
  assert.equal(dishes[0].nutritionByAgeGroup[0].ageGroupId, 'ag-4');
  assert.deepEqual(await api.listDishes({ status: 'DRAFT' }), []);
});

test('nhà cung cấp: người giao hàng ↔ contactName; BE không trả CCCD ⇒ không có khóa idCard', async () => {
  const [s] = await api.getSuppliers({ keyword: 'NCC', status: '' });
  assert.deepEqual(calls[0].body, { keyword: 'NCC' });
  assert.equal(s.contactName, 'Anh giao');
  assert.equal(s.code, 'NCC003', 'BE chưa có mã NCC: sinh từ id');
  assert.ok(!('idCard' in s));
  assert.equal(s.receiptCount, null);
  calls = [];
  await api.saveSupplier({
    id: null,
    name: 'NCC mới',
    phone: '0900000002',
    contactName: 'Chị giao',
    idCard: '012345678901',
    status: 'ACTIVE',
  });
  assert.deepEqual(calls[0].body, {
    name: 'NCC mới',
    phone: '0900000002',
    address: '',
    deliveryPerson: 'Chị giao',
    idCard: '012345678901',
  });
  assert.equal(calls.length, 1, 'trạng thái không đổi ⇒ không PATCH');
});

test('build nối BE: danh mục, kế hoạch tuần, kho khô, hàng tươi, bếp hôm nay/lưu mẫu/ảnh bữa, bán trú hôm nay dùng BE (không nhãn demo); thực đơn mẫu, bếp khác vẫn demo', () => {
  const source = createDemoSource({ useMock: false, modules: INTEGRATION_MODULES, loadUsers: () => [] });
  ['/menu/foods', '/menu/foods/7/edit', '/menu/dishes/new', '/menu/setup', '/menu/suppliers', '/menu/suppliers/3'].forEach((path) =>
    assert.equal(source.demoModuleOfPath(path), null, path),
  );
  [
    '/menu/weekly',
    '/kitchen/dry-stock',
    '/kitchen/stock-receipts',
    '/kitchen/stock-receipts/new',
    '/kitchen/stock-receipts/9',
    '/kitchen/stock-history',
    '/kitchen/stock-shortfalls',
    '/kitchen/forecast',
    '/kitchen/forecast/new',
    '/kitchen/forecast/5',
    '/kitchen/fresh-receipts',
    '/boarding/today',
    '/kitchen/published-menu',
    '/kitchen/food-samples',
    '/kitchen/meal-photos',
    '/kitchen/photo-windows',
  ].forEach((path) => assert.equal(source.demoModuleOfPath(path), null, path));
  assert.equal(source.demoModuleOfPath('/menu/menus'), 'menu-planning');
  assert.equal(source.demoModuleOfPath('/kitchen/missing-food'), 'kitchen');
  const mock = {};
  const real = {};
  assert.equal(source.sourceOf('nutrition-catalog', mock, real), real);
  const mockBuild = createDemoSource({ useMock: true, modules: INTEGRATION_MODULES, loadUsers: () => [] });
  assert.equal(mockBuild.sourceOf('nutrition-catalog', mock, real), mock);
});

test('cấu hình nhóm tuổi BE → Thiết lập: id nhóm FE theo code, giá/ngày, định mức theo khóa FE, bữa chỉ đọc, phiên bản khóa/sửa được', async () => {
  const setups = await api.listNutritionSetups();
  assert.deepEqual(
    setups.map((x) => x.ageGroupId),
    ['ag-2', 'ag-3', 'ag-4', 'ag-5'],
  );
  const ag4 = setups.find((x) => x.ageGroupId === 'ag-4');
  assert.equal(ag4.price, 32000, 'form lấy bản mới nhất');
  assert.equal(ag4.mealsReadOnly, true);
  assert.deepEqual(ag4.meals, [
    { code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' },
    { code: 'AFTERNOON', name: 'Bữa chiều', countAs: 'AFTERNOON' },
  ]);
  assert.ok(
    ag4.meals.every((m) => !('unitPrice' in m)),
    'không có đơn giá từng bữa (NUT-19)',
  );
  assert.deepEqual(ag4.norms, {
    kcal: [615, 726],
    protein: [13, 20],
    lipid: [25, 35],
    glucid: [52, 60],
    animalLipidG: [10, 14],
    lunchKcalPct: [40, 50],
  });
  assert.ok(!('animalProteinG' in ag4.norms), 'khoảng null = chưa đặt');
  assert.equal(ag4.dailyKcalNeed, 1300, 'nhu cầu năng lượng cả ngày (NUT-25)');
  assert.deepEqual(
    ag4.versions.map((v) => [v.effectiveFrom, v.editable]),
    [
      ['2099-01-01', true],
      ['2026-09-01', false],
    ],
  );
  assert.equal(ag4.basis, 'TT 28/2016');
  const ag2 = setups.find((x) => x.ageGroupId === 'ag-2');
  assert.deepEqual([ag2.price, ag2.versions, ag2.meals.length], ['', [], 3]);
});

test('lưu Thiết lập lên BE: một POST /batch chứa mọi nhóm đổi; khóa FE → kcalMin…afternoonKcalPctMax; không đổi ⇒ bỏ qua', async () => {
  const norms = {
    kcal: ['615', '726'],
    protein: ['13', '20'],
    lipid: ['25', '35'],
    glucid: ['52', '60'],
    animalProteinG: ['12', '16'],
    animalLipidG: ['10', '14'],
    lunchKcalPct: ['40', '50'],
    calcium: ['350', ''],
    vitaminA: ['270', '450'],
  };
  const group = (ageGroupId, over = {}) => ({
    ageGroupId,
    enabled: true,
    price: '32000',
    meals: [],
    norms,
    dailyKcalNeed: '1300',
    ...over,
  });
  calls = [];
  const result = await api.saveNutritionSetups({
    effectiveFrom: '2099-01-01',
    basis: 'TT 28/2016',
    groups: [group('ag-4'), group('ag-2', { norms: { kcal: ['', ''] }, price: '28000' })],
  });
  const writes = calls.filter((c) => c.method !== 'get');
  assert.deepEqual(
    writes.map((c) => `${c.method} ${c.url}`),
    ['post /nutrition/age-group-configs/batch'],
    'một lần gọi cho mọi nhóm (BE lưu tất cả hoặc không nhóm nào)',
  );
  assert.equal(result.saved, 2);
  const [ag4, ag2] = writes[0].body.items;
  assert.deepEqual(ag4, {
    ageGroupId: '13',
    effectiveFrom: '2099-01-01',
    mealPrice: 32000,
    normBasis: 'TT 28/2016',
    dailyKcalNeed: 1300,
    kcalMin: 615,
    kcalMax: 726,
    proteinPctMin: 13,
    proteinPctMax: 20,
    lipidPctMin: 25,
    lipidPctMax: 35,
    glucidPctMin: 52,
    glucidPctMax: 60,
    animalProteinGMin: 12,
    animalProteinGMax: 16,
    plantProteinGMin: null,
    plantProteinGMax: null,
    animalLipidGMin: 10,
    animalLipidGMax: 14,
    plantLipidGMin: null,
    plantLipidGMax: null,
    glucidGMin: null,
    glucidGMax: null,
    morningKcalPctMin: null,
    morningKcalPctMax: null,
    lunchKcalPctMin: 40,
    lunchKcalPctMax: 50,
    afternoonKcalPctMin: null,
    afternoonKcalPctMax: null,
    // NUT-26: vi chất cùng tên trường BE; số sau để trống = chỉ cần đạt tối thiểu
    calciumMin: 350,
    calciumMax: null,
    phosphorusMin: null,
    phosphorusMax: null,
    ironMin: null,
    ironMax: null,
    vitaminAMin: 270,
    vitaminAMax: 450,
    vitaminB1Min: null,
    vitaminB1Max: null,
    vitaminB2Min: null,
    vitaminB2Max: null,
    vitaminPpMin: null,
    vitaminPpMax: null,
    vitaminCMin: null,
    vitaminCMax: null,
  });
  assert.equal(ag2.ageGroupId, '11');
  assert.equal(ag2.mealPrice, 28000);
  assert.equal(ag2.kcalMin, null, 'ô trống ⇒ null (chưa đặt)');

  calls = [];
  const unchanged = { ...norms, animalProteinG: ['', ''], calcium: ['', ''], vitaminA: ['', ''] };
  const none = await api.saveNutritionSetups({
    effectiveFrom: '2099-02-01',
    basis: 'TT 28/2016',
    groups: [group('ag-4', { norms: unchanged })],
  });
  assert.ok(!calls.some((c) => c.method !== 'get'), 'giống bản mới nhất ⇒ không ghi');
  assert.equal(none.saved, 0);

  calls = [];
  await api.saveNutritionSetups({
    effectiveFrom: '2099-02-01',
    basis: 'TT 28/2016',
    groups: [group('ag-4', { norms: unchanged }), group('ag-3', { price: '33000' })],
  });
  const batch = calls.filter((c) => c.method !== 'get');
  assert.equal(batch.length, 1);
  assert.deepEqual(
    batch[0].body.items.map((it) => `${it.ageGroupId} ${it.effectiveFrom}`),
    ['12 2099-02-01'],
    'chỉ gửi nhóm đổi',
  );
});

test('lưu Thiết lập lên BE: lỗi items[i].x của /batch → ô của đúng nhóm tuổi; lỗi chung giữ nguyên', async () => {
  const failing = createNutritionCatalogApi({
    client: {
      ...client,
      post: async () => {
        throw Object.assign(new Error('Dữ liệu không hợp lệ'), {
          details: {
            'items[1].kcalMin': 'Phải ≥ 0',
            'items[0].mealPrice': 'Bắt buộc',
            effectiveFrom: 'Đã áp dụng',
          },
        });
      },
    },
    storage,
  });
  const error = await failing
    .saveNutritionSetups({
      effectiveFrom: '2099-01-01',
      basis: '',
      groups: [
        { ageGroupId: 'ag-2', price: '', norms: {} },
        { ageGroupId: 'ag-4', price: '1', norms: { kcal: ['-1', '700'] } },
      ],
    })
    .catch((e) => e);
  assert.deepEqual(error.details, {
    'ag-4.norms.kcal': 'Phải ≥ 0',
    'ag-2.price': 'Bắt buộc',
    effectiveFrom: 'Đã áp dụng',
  });
});

test('kiểm tra thực đơn: danh mục BE ⇒ định mức, bữa, giá/ngày từ cấu hình BE đang hiệu lực; mock giữ nguyên', async () => {
  const { loadMenuCatalog } = await import('@/services/menu-planning/menuPlanningService');
  const mockCatalog = {
    foods: [{ id: 'f1' }],
    dishes: [{ id: 'd1' }],
    menus: [],
    allergyMenus: [],
    mealPrices: [{ ageGroupId: 'ag-4', price: 99000, effectiveFrom: '2020-01-01' }],
    nutritionSetups: [{ ageGroupId: 'ag-4', norms: { kcal: [1, 2] } }],
    norms: { 'ag-4': { kcal: [1, 2] } },
  };
  const menuRepo = { getCatalog: async () => mockCatalog };

  calls = [];
  const demo = await loadMenuCatalog({ menuRepo, catalogApi: api, usesApi: false, today: '2026-11-03' });
  assert.equal(demo, mockCatalog, 'mock: giữ nguyên định mức, giá mẫu');
  assert.equal(calls.length, 0, 'mock: không gọi BE');

  const live = await loadMenuCatalog({ menuRepo, catalogApi: api, usesApi: true, today: '2026-11-03' });
  assert.deepEqual(
    calls.filter((c) => c.url === '/nutrition/age-group-configs').map((c) => c.body),
    [{ date: '2026-11-03' }],
  );
  assert.deepEqual(live.foods, mockCatalog.foods, 'thực phẩm, món, thực đơn vẫn từ nguồn thực đơn');
  assert.deepEqual(live.dishes, mockCatalog.dishes);
  assert.equal(live.pricePerDay, true);
  assert.deepEqual(live.mealPrices, [{ id: '40', ageGroupId: 'ag-4', price: 30000, effectiveFrom: '2026-09-01', effectiveTo: null }]);
  assert.deepEqual(live.norms['ag-4'].kcal, [615, 726]);
  assert.equal(live.norms['ag-4'].animalProteinG, undefined, 'khoảng chưa đặt ⇒ không có khóa');
  assert.deepEqual(live.norms['ag-2'], {}, 'nhóm chưa có cấu hình ⇒ chưa đặt định mức');
  assert.deepEqual(
    live.nutritionSetups.find((x) => x.ageGroupId === 'ag-4').meals.map((m) => m.code),
    ['LUNCH', 'AFTERNOON'],
  );
});

test('catalog nối BE: dữ liệu thực đơn và cấu hình nhóm tuổi tải song song, không chờ nối tiếp', async () => {
  const { loadMenuCatalog } = await import('@/services/menu-planning/menuPlanningService');
  const started = [];
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const menuRepo = {
    getCatalog: async () => {
      started.push('menu');
      await gate;
      return { foods: [], dishes: [], menus: [] };
    },
  };
  const catalogApi = {
    getEffectiveSetups: async () => {
      started.push('setups');
      return { norms: {} };
    },
  };
  const pending = loadMenuCatalog({ menuRepo, catalogApi, usesApi: true, today: '2026-11-03' });
  await Promise.resolve();
  assert.deepEqual(started.sort(), ['menu', 'setups'], 'cấu hình bắt đầu tải khi dữ liệu thực đơn chưa về');
  release();
  assert.deepEqual((await pending).norms, {});
});

test('kiểm tra tiền ăn tuần: giá BE theo ngày ⇒ so từng ngày; mock ⇒ tổng tuần so giá × số ngày', async () => {
  const { weekBudgetCheck } = await import('@/utils/menu-planning/menuChecks');
  const days = [
    { date: '2026-11-09', cost: 29000 },
    { date: '2026-11-10', cost: 31000 },
  ];
  const mealPrices = [{ ageGroupId: 'ag-4', price: 30000, effectiveFrom: '2026-09-01', effectiveTo: null }];
  const perDay = weekBudgetCheck({ days, ageGroupId: 'ag-4', weekStart: '2026-11-09', catalog: { mealPrices, pricePerDay: true } });
  assert.equal(perDay.level, 'warn', 'một ngày vượt giá/ngày dù tổng tuần không vượt');
  assert.match(perDay.text, /^1 ngày vượt tiền ăn \/ ngày: Thứ Ba 10\/11/);
  const okDays = weekBudgetCheck({
    days: [days[0]],
    ageGroupId: 'ag-4',
    weekStart: '2026-11-09',
    catalog: { mealPrices, pricePerDay: true },
  });
  assert.equal(okDays.level, 'ok');
  const weekly = weekBudgetCheck({ days, ageGroupId: 'ag-4', weekStart: '2026-11-09', catalog: { mealPrices } });
  assert.equal(weekly.level, 'ok', 'mock: tổng 60.000 = 30.000 × 2 ngày');
  assert.match(weekly.text, /ngân sách tuần/);
  const none = weekBudgetCheck({ days, ageGroupId: 'ag-2', weekStart: '2026-11-09', catalog: { mealPrices, pricePerDay: true } });
  assert.equal(none.level, 'warn');
});
