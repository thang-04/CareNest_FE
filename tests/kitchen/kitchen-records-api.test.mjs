import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createKitchenRecordsApi } = await import('@/services/kitchenRecordsApi');
const records = await import('@/utils/kitchen/kitchenRecords');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

const RICE = { id: '7', code: 'TP007', name: 'Gạo tẻ', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const EGG = { id: '8', code: 'TP008', name: 'Trứng gà', unit: 'g', purchaseUnit: 'quả', purchaseUnitSize: 50 };

// Client giả ghi lại từng lời gọi; trả dữ liệu theo "METHOD /url"
const fakeClient = (responses = {}) => {
  const calls = [];
  const call = (method) => async (url, a, b) => {
    const isBody = method === 'post' || method === 'put';
    calls.push({ method, url, body: isBody ? a : undefined, params: isBody ? b?.params : a?.params });
    return responses[`${method.toUpperCase()} ${url}`];
  };
  const getBlob = async (url) => {
    calls.push({ method: 'blob', url });
    return responses[`BLOB ${url}`];
  };
  return { calls, get: call('get'), post: call('post'), put: call('put'), getBlob };
};

const sample = (over = {}) => ({
  id: '3',
  campusId: '1',
  date: '2026-11-03',
  session: 'LUNCH',
  sampledAt: '2026-11-03T03:30:00Z',
  dishes: [{ id: '9', code: 'M009', name: 'Canh bí' }],
  note: '',
  status: 'RECORDED',
  disposalStatus: 'NONE',
  canApprove: true,
  ...over,
});

test('bếp hôm nay: GET kitchen/day với campusId, date; thiếu mảng thì chuẩn hóa về rỗng', async () => {
  const client = fakeClient({ 'GET /nutrition/kitchen/day': { campusId: '1', date: '2026-11-03', menuStatus: 'DRAFT', menu: null } });
  const day = await createKitchenRecordsApi({ client }).getKitchenDay({ campusId: '1', date: '2026-11-03' });
  assert.deepEqual(client.calls[0].params, { campusId: '1', date: '2026-11-03' });
  assert.deepEqual([day.menu, day.servings, day.foods], [[], [], []]);
  assert.equal(day.menuStatus, 'DRAFT');
});

test('lưu mẫu: danh sách theo khoảng ngày, duyệt lưu mẫu và duyệt hủy mẫu đúng đường dẫn', async () => {
  const client = fakeClient({
    'GET /nutrition/food-samples': [sample({ dishes: undefined })],
    'POST /nutrition/food-samples/3/approve': sample({ status: 'APPROVED' }),
    'POST /nutrition/food-samples/3/approve-disposal': sample({ status: 'APPROVED', disposalStatus: 'APPROVED' }),
  });
  const api = createKitchenRecordsApi({ client });
  const list = await api.listSamples({ campusId: '1', from: '2026-10-04', to: '2026-11-03' });
  assert.deepEqual(client.calls[0].params, { campusId: '1', from: '2026-10-04', to: '2026-11-03' });
  assert.deepEqual(list[0].dishes, []);
  assert.equal((await api.approveSample('3')).status, 'APPROVED');
  assert.equal((await api.approveDisposal('3')).disposalStatus, 'APPROVED');
  assert.deepEqual(
    client.calls.slice(1).map((c) => `${c.method.toUpperCase()} ${c.url}`),
    ['POST /nutrition/food-samples/3/approve', 'POST /nutrition/food-samples/3/approve-disposal'],
  );
  assert.deepEqual(await createKitchenRecordsApi({ client: fakeClient() }).listSamples({ campusId: '1' }), []);
});

test('lỗi 403 khi duyệt được giữ nguyên để màn hiện thông điệp BE', async () => {
  const forbidden = Object.assign(new Error('Bạn không có quyền duyệt lưu mẫu, hủy mẫu ở điểm trường này'), { status: 403 });
  const client = { post: async () => Promise.reject(forbidden) };
  await assert.rejects(
    () => createKitchenRecordsApi({ client }).approveSample('3'),
    (error) => error.status === 403,
  );
});

test('ảnh bữa: danh sách theo điểm trường và ngày; nội dung tải dạng blob qua client', async () => {
  const blob = { size: 4 };
  const client = fakeClient({
    'GET /nutrition/meal-photos': [{ id: '4', session: 'LUNCH' }],
    'BLOB /nutrition/meal-photos/4/content': blob,
  });
  const api = createKitchenRecordsApi({ client });
  assert.deepEqual(await api.listPhotos({ campusId: '1', date: '2026-11-03' }), [{ id: '4', session: 'LUNCH' }]);
  assert.deepEqual(client.calls[0].params, { campusId: '1', date: '2026-11-03' });
  assert.equal(await api.getPhotoBlob('4'), blob);
});

test('khung giờ ảnh: GET đọc, PUT chỉ gửi bữa đã điền, chặn giờ sai trước khi gọi BE', async () => {
  const client = fakeClient({
    'GET /nutrition/meal-photo-windows': [{ session: 'LUNCH', startTime: '10:00:00', endTime: '11:30:00' }],
    'PUT /nutrition/meal-photo-windows': [{ session: 'LUNCH', startTime: '10:00:00', endTime: '12:00:00' }],
  });
  const api = createKitchenRecordsApi({ client });
  const form = records.windowsToForm(await api.getWindows());
  assert.deepEqual(
    form.map((row) => [row.session, row.startTime, row.endTime, row.configured]),
    [
      ['MORNING', '', '', false],
      ['LUNCH', '10:00', '11:30', true],
      ['AFTERNOON', '', '', false],
    ],
  );
  form[1].endTime = '12:00';
  await api.saveWindows(form);
  assert.deepEqual(client.calls[1].body, { windows: [{ session: 'LUNCH', startTime: '10:00', endTime: '12:00' }] });

  const before = client.calls.length;
  form[1].endTime = '09:00';
  await assert.rejects(
    () => api.saveWindows(form),
    (error) => !!error.details['windows.1.endTime'],
  );
  form[1].endTime = '';
  await assert.rejects(
    () => api.saveWindows(form),
    (error) => !!error.details['windows.1.endTime'],
  );
  await assert.rejects(
    () => api.saveWindows(records.windowsToForm([])),
    (error) => !!error.details._form,
  );
  assert.equal(client.calls.length, before, 'form sai không gọi BE');
});

test('kiểm ô khung giờ: bắt đầu phải trước kết thúc, đúng HH:mm, để trống cả hai là bỏ qua', () => {
  const row = (startTime, endTime) => [{ session: 'LUNCH', startTime, endTime }];
  assert.deepEqual(records.validateWindowsForm(row('10:00', '11:00')), {});
  assert.deepEqual(records.validateWindowsForm(row('', '')), {});
  assert.ok(records.validateWindowsForm(row('11:00', '11:00'))['windows.0.endTime']);
  assert.ok(records.validateWindowsForm(row('25:00', '11:00'))['windows.0.startTime']);
  assert.ok(records.validateWindowsForm(row('10:00', ''))['windows.0.endTime']);
});

test('bếp hôm nay: món theo bữa × khối, suất theo lớp nhóm theo bữa, lượng thực phẩm đổi sang đơn vị mua', () => {
  const menu = [
    { session: 'AFTERNOON', menuBlock: 'KINDERGARTEN', dishes: [{ id: '2', name: 'Sữa chua' }] },
    { session: 'LUNCH', menuBlock: 'KINDERGARTEN', dishes: [{ id: '1', name: 'Cơm' }] },
    { session: 'LUNCH', menuBlock: 'NURSERY', dishes: [{ id: '3', name: 'Cháo' }] },
  ];
  assert.deepEqual(records.menuBlocks(menu), ['NURSERY', 'KINDERGARTEN']);
  const rows = records.menuBySession(menu);
  assert.deepEqual(
    rows.map((r) => r.session),
    ['LUNCH', 'AFTERNOON'],
  );
  assert.equal(rows[0].byBlock.NURSERY[0].name, 'Cháo');

  const servings = records.servingsBySession([
    { session: 'AFTERNOON', classroomId: '1', classroomName: 'Lớp A', normal: 20, substitute: 1 },
    { session: 'LUNCH', classroomId: '1', classroomName: 'Lớp A', normal: 21, substitute: 0 },
    { session: 'LUNCH', classroomId: '2', classroomName: 'Lớp B', normal: 18, substitute: 2 },
  ]);
  assert.deepEqual(
    servings.map((g) => [g.session, g.classes.length]),
    [
      ['LUNCH', 2],
      ['AFTERNOON', 1],
    ],
  );

  const foods = records.foodNeedRows([
    { food: EGG, storage: 'DRY', quantity: 1000 },
    { food: RICE, storage: 'FRESH', quantity: 12500 },
  ]);
  assert.deepEqual(
    foods.map((f) => [f.food.name, f.storage, f.purchaseQuantity]),
    [
      ['Gạo tẻ', 'FRESH', 12.5],
      ['Trứng gà', 'DRY', 20],
    ],
  );
});

test('hàng chờ duyệt: việc kế tiếp theo cờ canApprove của BE, lọc chờ duyệt, in chỉ bản đã duyệt', () => {
  assert.equal(records.nextApproval(sample()), 'sample');
  assert.equal(records.nextApproval(sample({ status: 'APPROVED', disposalStatus: 'RECORDED' })), 'disposal');
  assert.equal(records.nextApproval(sample({ canApprove: false })), null, 'không có cờ thì không hiện nút');
  assert.equal(records.nextApproval(sample({ status: 'APPROVED' })), null);
  assert.equal(records.isPendingApproval(sample({ status: 'APPROVED', disposalStatus: 'RECORDED' })), true);
  assert.equal(records.isPendingApproval(sample({ status: 'APPROVED', disposalStatus: 'APPROVED' })), false);

  const list = [
    sample({ id: '1', date: '2026-11-01', status: 'APPROVED' }),
    sample({ id: '2', date: '2026-11-03', session: 'LUNCH' }),
    sample({ id: '3', date: '2026-11-03', session: 'AFTERNOON', status: 'APPROVED' }),
  ];
  assert.deepEqual(
    records.sortSamples(list).map((s) => s.id),
    ['3', '2', '1'],
  );
  assert.deepEqual(
    records.printableSamples(list).map((s) => s.id),
    ['3', '1'],
  );
  assert.equal(records.daysBefore('2026-03-01', 1), '2026-02-28');
});

test('module kitchen-records: source api, route Web, file adapter và route BE có trong ảnh chụp', () => {
  const mod = INTEGRATION_MODULES['kitchen-records'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/kitchen/published-menu', '/kitchen/food-samples', '/kitchen/meal-photos', '/kitchen/photo-windows']);
  assert.deepEqual(mod.files, ['src/services/kitchenRecordsApi.js']);
  const snapshot = JSON.parse(readFileSync('docs/integration/be-api-routes.json', 'utf8')).routes;
  for (const route of [
    'GET /nutrition/kitchen/day',
    'GET /nutrition/food-samples',
    'POST /nutrition/food-samples/{x}/approve',
    'POST /nutrition/food-samples/{x}/approve-disposal',
    'GET /nutrition/meal-photos',
    'GET /nutrition/meal-photos/{x}/content',
    'GET /nutrition/meal-photo-windows',
    'PUT /nutrition/meal-photo-windows',
  ])
    assert.ok(snapshot.includes(route), route);
});

test('route bếp chọn trang theo isDemoModule: build BE dùng trang mới, build mock giữ trang demo', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.match(routes, /const KITCHEN_RECORDS_API = !isDemoModule\('kitchen-records'\);/);
  assert.match(routes, /KITCHEN_RECORDS_API \? <KitchenTodayPage \/> : <PublishedMenuPage \/>/);
  assert.match(routes, /KITCHEN_RECORDS_API \? <FoodSampleQueuePage \/> : <FoodSampleLogPage \/>/);
  assert.match(routes, /KITCHEN_RECORDS_API && <Route path="meal-photos"/);
  assert.match(routes, /KITCHEN_RECORDS_API && <Route path="photo-windows"/);
});
