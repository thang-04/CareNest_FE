import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createFreshGoodsApi, toForecastRequest, toCheckRequest } = await import('@/services/freshGoodsApi');
const { countsToForm, emptyForecastForm, forecastInputKey, roundState, roundToForm, validateForecastForm, validateRoundForm } =
  await import('@/utils/kitchen/freshGoodsForm');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

// Thực phẩm theo DTO sau khi beClient đổi id số sang chuỗi
const RICE = { id: '7', code: 'TP007', name: 'Gạo tẻ', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const EGG = { id: '8', code: 'TP008', name: 'Trứng gà', unit: 'g', purchaseUnit: 'quả', purchaseUnitSize: 50 };

const beForecast = (over = {}) => ({
  id: null,
  campusId: '1',
  periodFrom: '2026-11-03',
  periodTo: '2026-11-04',
  note: null,
  counts: [{ ageGroupId: '2', ageGroupName: 'Mẫu giáo', enrolledCount: 30, expectedCount: 28 }],
  days: [
    { date: '2026-11-03', off: false, planStatus: 'PUBLISHED' },
    { date: '2026-11-04', off: false, planStatus: 'NONE' },
  ],
  lines: [
    {
      food: EGG,
      totalQty: 1500,
      byDate: [
        { date: '2026-11-03', quantity: 1000 },
        { date: '2026-11-04', quantity: 500 },
      ],
    },
  ],
  canManage: true,
  ...over,
});

const beCheck = () => ({
  campusId: '1',
  date: '2026-11-03',
  canManage: true,
  rounds: [
    {
      round: 1,
      available: true,
      unavailableReason: null,
      source: 'FORECAST',
      forecastId: '5',
      recorded: false,
      lines: [
        { food: RICE, expectedQty: 12500, receivedQty: null, result: null, note: null },
        { food: EGG, expectedQty: 1000, receivedQty: 900, result: 'SHORT', note: 'Giao thiếu' },
      ],
    },
    { round: 2, available: false, unavailableReason: 'Chờ số suất ăn được xác nhận', source: 'CONFIRMED_SERVINGS', recorded: false, lines: [] },
  ],
});

// Client giả ghi lại từng lời gọi; trả dữ liệu theo "METHOD /url"
const fakeClient = (responses = {}) => {
  const calls = [];
  const call = (method) => async (url, a, b) => {
    const isBody = method === 'post' || method === 'put' || method === 'patch';
    calls.push({ method, url, body: isBody ? a : undefined, params: isBody ? b?.params : a?.params });
    return responses[`${method.toUpperCase()} ${url}`];
  };
  return { calls, get: call('get'), post: call('post'), put: call('put'), patch: call('patch'), delete: call('delete') };
};

test('danh sách bản dự trù: GET /nutrition/fresh-forecasts?campusId, rỗng thì trả mảng rỗng', async () => {
  const client = fakeClient({ 'GET /nutrition/fresh-forecasts': [{ id: '5', foodCount: 3 }] });
  const api = createFreshGoodsApi({ client });
  assert.deepEqual(await api.listForecasts({ campusId: '1' }), [{ id: '5', foodCount: 3 }]);
  assert.deepEqual(client.calls[0].params, { campusId: '1' });
  assert.deepEqual(await createFreshGoodsApi({ client: fakeClient() }).listForecasts({ campusId: '1' }), []);
});

test('bảng đi chợ: GET /nutrition/day-market, đổi lượng sang đơn vị mua, giữ nguyên tiền BE tính', async () => {
  const beMarket = {
    campusId: '1',
    date: '2026-11-09',
    status: 'READY',
    basis: 'FORECAST',
    confirmedAt: null,
    groups: [
      { ageGroupId: '2', name: 'Mẫu giáo bé', servings: 10, mealPrice: 30000, revenue: 300000 },
      { ageGroupId: '3', name: 'Nhà trẻ', servings: 4, mealPrice: null, revenue: null },
    ],
    lines: [
      {
        food: EGG,
        storage: 'FRESH',
        unitPrice: 3500,
        quantity: 620,
        orderQuantity: 650,
        cost: 43400,
        groups: [
          { ageGroupId: '2', quantity: 500, cost: 35000 },
          { ageGroupId: '3', quantity: 120, cost: 8400 },
        ],
      },
      {
        food: RICE,
        storage: 'DRY',
        unitPrice: 18000,
        quantity: 1500,
        orderQuantity: 1500,
        cost: 27000,
        groups: [
          { ageGroupId: '2', quantity: 1500, cost: 27000 },
          { ageGroupId: '3', quantity: 0, cost: 0 },
        ],
      },
    ],
    totals: {
      servings: 14,
      revenue: 300000,
      cost: 70400,
      freshCost: 43400,
      dryCost: 27000,
      balance: null,
      groups: [
        { ageGroupId: '2', cost: 62000 },
        { ageGroupId: '3', cost: 8400 },
      ],
    },
    menu: [{ session: 'LUNCH', groups: [{ ageGroupId: '2', dishes: ['Cơm', 'Trứng rán'] }] }],
  };
  const client = fakeClient({ 'GET /nutrition/day-market': beMarket });
  const view = await createFreshGoodsApi({ client }).getDayMarket({ campusId: '1', date: '2026-11-09' });
  assert.deepEqual(client.calls[0].params, { campusId: '1', date: '2026-11-09' });
  assert.deepEqual(
    view.lines.map((l) => [l.name, l.unit, l.source, l.quantity, l.amount, l.groups.map((g) => g.quantity), l.groups.map((g) => g.amount)]),
    [
      ['Trứng gà', 'quả', 'MARKET', 13, 43400, [10, 2.4], [35000, 8400]],
      ['Gạo tẻ', 'kg', 'STOCK', 1.5, 27000, [1.5, 0], [27000, 0]],
    ],
  );
  assert.deepEqual(view.groups[0], { ageGroupId: '2', name: 'Mẫu giáo bé', servings: 10, price: 30000, revenue: 300000 });
  assert.deepEqual(
    [view.totals.marketCost, view.totals.stockCost, view.totals.cost, view.totals.revenue, view.totals.balance],
    [43400, 27000, 70400, 300000, null],
  );
  assert.deepEqual(view.menu, [{ code: 'LUNCH', name: 'Bữa trưa', groups: [{ ageGroupId: '2', dishes: ['Cơm', 'Trứng rán'] }] }]);
  assert.equal(view.warnings.length, 1, 'nhóm chưa có giá tiền ăn được nhắc');
  assert.match(view.warnings[0], /Nhà trẻ/);

  const off = { campusId: '1', date: '2026-11-14', status: 'DAY_OFF', basis: null, groups: [], lines: [], totals: { cost: 0 }, menu: [] };
  const holiday = await createFreshGoodsApi({ client: fakeClient({ 'GET /nutrition/day-market': off }) }).getDayMarket({ campusId: '1' });
  assert.equal(holiday.status, 'HOLIDAY');
  assert.deepEqual([holiday.lines, holiday.totals.balance], [[], null]);
  assert.ok(INTEGRATION_MODULES['fresh-goods'].routes.includes('/kitchen/market-day'), 'màn đi chợ thuộc module đã nối BE');
});

test('xem trước: POST preview không gửi counts ở lần đầu, kết quả thêm số theo đơn vị mua', async () => {
  const client = fakeClient({ 'POST /nutrition/fresh-forecasts/preview': beForecast() });
  const api = createFreshGoodsApi({ client });
  const form = { ...emptyForecastForm({ campusId: '1', today: '2026-11-03' }), periodTo: '2026-11-04', note: '  Tuần đầu ' };
  const preview = await api.previewForecast(form);
  assert.deepEqual(client.calls[0].body, { campusId: '1', periodFrom: '2026-11-03', periodTo: '2026-11-04', note: 'Tuần đầu' });
  assert.ok(!('counts' in client.calls[0].body));
  assert.equal(preview.id, null);
  assert.equal(preview.lines[0].purchaseTotal, 30);
  assert.deepEqual(
    preview.lines[0].byDate.map((c) => c.purchaseQuantity),
    [20, 10],
  );
});

test('lưu và tính lại gửi counts đã sửa; xem, xóa đúng đường dẫn', async () => {
  const client = fakeClient({
    'POST /nutrition/fresh-forecasts': beForecast({ id: '5' }),
    'GET /nutrition/fresh-forecasts/5': beForecast({ id: '5', counts: undefined, days: undefined }),
    'DELETE /nutrition/fresh-forecasts/5': undefined,
  });
  const api = createFreshGoodsApi({ client });
  const form = { ...emptyForecastForm({ campusId: '1', today: '2026-11-03' }), counts: countsToForm(beForecast().counts) };
  form.counts[0].expectedCount = '25';
  const saved = await api.saveForecast(form);
  assert.equal(saved.id, '5');
  assert.deepEqual(client.calls[0].body.counts, [{ ageGroupId: '2', expectedCount: 25 }]);
  const detail = await api.getForecast('5');
  assert.deepEqual([detail.counts, detail.days], [[], []], 'thiếu mảng thì chuẩn hóa về rỗng');
  assert.deepEqual(await api.deleteForecast('5'), { id: '5' });
  assert.deepEqual(
    client.calls.map((c) => `${c.method.toUpperCase()} ${c.url}`),
    ['POST /nutrition/fresh-forecasts', 'GET /nutrition/fresh-forecasts/5', 'DELETE /nutrition/fresh-forecasts/5'],
  );
});

test('số trẻ dự kiến không hợp lệ bị chặn trước khi gọi BE', async () => {
  const client = fakeClient();
  const api = createFreshGoodsApi({ client });
  for (const bad of ['', '-1', '2.5', 'abc']) {
    const form = { campusId: '1', periodFrom: '2026-11-03', periodTo: '2026-11-03', counts: [{ ageGroupId: '2', expectedCount: bad }] };
    await assert.rejects(() => api.previewForecast(form), (error) => !!error.details['counts.0'], bad);
  }
  assert.equal(client.calls.length, 0);
  assert.deepEqual(toForecastRequest({ campusId: '1', periodFrom: 'a', periodTo: 'b', counts: [{ ageGroupId: '2', expectedCount: '0' }] }).counts, [
    { ageGroupId: '2', expectedCount: 0 },
  ]);
});

test('form dự trù: kiểm ngày và số trẻ, khóa nhập đổi khi kỳ hoặc số trẻ đổi (không tính ghi chú)', () => {
  const form = { ...emptyForecastForm({ campusId: '1', today: '2026-11-03' }), counts: countsToForm(beForecast().counts) };
  assert.deepEqual(validateForecastForm(form), {});
  assert.deepEqual(Object.keys(validateForecastForm({ ...form, periodFrom: '', periodTo: '31/02' })).sort(), ['periodFrom', 'periodTo']);
  assert.ok(validateForecastForm({ ...form, counts: [{ ...form.counts[0], expectedCount: '' }] })['counts.0']);
  const key = forecastInputKey(form);
  assert.equal(forecastInputKey({ ...form, note: 'khác' }), key);
  assert.notEqual(forecastInputKey({ ...form, periodTo: '2026-11-05' }), key);
  assert.notEqual(forecastInputKey({ ...form, counts: [{ ...form.counts[0], expectedCount: '20' }] }), key);
});

test('kiểm nhận: GET /nutrition/fresh-checks, số cần nhận và thực nhận đổi sang đơn vị mua', async () => {
  const client = fakeClient({ 'GET /nutrition/fresh-checks': beCheck() });
  const check = await createFreshGoodsApi({ client }).getCheck({ campusId: '1', date: '2026-11-03' });
  assert.deepEqual(client.calls[0].params, { campusId: '1', date: '2026-11-03' });
  const [rice, egg] = check.rounds[0].lines;
  assert.deepEqual([rice.purchaseExpectedQty, rice.purchaseReceivedQty], [12.5, null]);
  assert.deepEqual([egg.purchaseExpectedQty, egg.purchaseReceivedQty], [20, 18]);
  assert.equal(check.rounds[1].available, false);
});

test('ghi nhận một lần kiểm: PUT kèm campusId, date, round; thực nhận đổi về đơn vị gốc, bỏ trống thì null', async () => {
  const client = fakeClient({ 'PUT /nutrition/fresh-checks': beCheck() });
  const api = createFreshGoodsApi({ client });
  const { lines } = beCheck().rounds[0];
  const form = {
    note: ' Giao đúng giờ ',
    lines: [
      { foodId: '7', receivedQty: '', result: 'ENOUGH', note: '' },
      { foodId: '8', receivedQty: '18.5', result: 'OVER', note: ' Dư 1 quả ' },
    ],
  };
  await api.saveCheckRound({ campusId: '1', date: '2026-11-03', round: 1, form, lines });
  const put = client.calls.find((c) => c.method === 'put');
  assert.equal(put.url, '/nutrition/fresh-checks');
  assert.deepEqual(put.params, { campusId: '1', date: '2026-11-03', round: 1 });
  assert.deepEqual(put.body, {
    note: 'Giao đúng giờ',
    lines: [
      { foodId: '7', receivedQty: null, result: 'ENOUGH', note: '' },
      { foodId: '8', receivedQty: 925, result: 'OVER', note: 'Dư 1 quả' },
    ],
  });
  assert.throws(() => toCheckRequest({ lines: [{ foodId: '99', result: 'ENOUGH' }] }, lines), (e) => !!e.details['lines.0.foodId']);
});

test('form kiểm nhận: nạp từ BE theo đơn vị mua, mỗi thực phẩm phải có kết quả, trạng thái lần kiểm theo cờ BE', async () => {
  const client = fakeClient({ 'GET /nutrition/fresh-checks': beCheck() });
  const check = await createFreshGoodsApi({ client }).getCheck({ campusId: '1', date: '2026-11-03' });
  const form = roundToForm(check.rounds[0]);
  assert.deepEqual(form.lines, [
    { foodId: '7', receivedQty: '', result: '', note: '' },
    { foodId: '8', receivedQty: '18', result: 'SHORT', note: 'Giao thiếu' },
  ]);
  assert.deepEqual(Object.keys(validateRoundForm(form)), ['lines.0.result']);
  form.lines[0].result = 'ENOUGH';
  assert.deepEqual(validateRoundForm(form), {});
  form.lines[1].receivedQty = '-2';
  assert.ok(validateRoundForm(form)['lines.1.receivedQty']);
  assert.deepEqual(check.rounds.map(roundState), ['PENDING', 'UNAVAILABLE']);
  assert.equal(roundState({ recorded: true, available: false }), 'RECORDED');
});

test('module fresh-goods khai source api với các route hàng tươi, file adapter và route BE đã có trong ảnh chụp', () => {
  const mod = INTEGRATION_MODULES['fresh-goods'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/kitchen/forecast', '/kitchen/fresh-receipts', '/kitchen/market-day']);
  assert.deepEqual(mod.files, ['src/services/freshGoodsApi.js']);
  const snapshot = JSON.parse(readFileSync('docs/integration/be-api-routes.json', 'utf8')).routes;
  for (const route of [
    'GET /nutrition/fresh-forecasts',
    'POST /nutrition/fresh-forecasts/preview',
    'POST /nutrition/fresh-forecasts',
    'GET /nutrition/fresh-forecasts/{x}',
    'DELETE /nutrition/fresh-forecasts/{x}',
    'GET /nutrition/fresh-checks',
    'GET /nutrition/day-market',
    'PUT /nutrition/fresh-checks',
  ])
    assert.ok(snapshot.includes(route), route);
});

test('route hàng tươi chọn trang theo isDemoModule: build BE dùng trang mới, build mock giữ trang demo', () => {
  const routes = readFileSync('src/routes/AppRoutes.jsx', 'utf8');
  assert.match(routes, /const FRESH_GOODS_API = !isDemoModule\('fresh-goods'\);/);
  assert.match(routes, /FRESH_GOODS_API \? <FreshForecastPage \/> : <WeeklyForecastPage \/>/);
  assert.match(routes, /FRESH_GOODS_API \? <FreshCheckPage \/> : <FreshReceiptPage \/>/);
});

test('NUT-11, P-24: bản dự trù kèm hàng khô cần nhập thêm, đổi sang đơn vị mua; BE không trả thì mảng rỗng', async () => {
  const dryLine = { food: RICE, requiredQty: 750, availableQty: 375, shortQty: 375, shortFrom: '2026-11-11' };
  const client = fakeClient({ 'POST /nutrition/fresh-forecasts/preview': beForecast({ dryLines: [dryLine] }) });
  const api = createFreshGoodsApi({ client });
  const preview = await api.previewForecast({ ...emptyForecastForm({ campusId: '1', today: '2026-11-03' }), periodTo: '2026-11-04' });
  assert.deepEqual(
    [preview.dryLines[0].purchaseRequiredQty, preview.dryLines[0].purchaseAvailableQty, preview.dryLines[0].purchaseShortQty],
    [0.75, 0.375, 0.375],
  );
  assert.equal(preview.dryLines[0].shortFrom, '2026-11-11');

  const none = await createFreshGoodsApi({ client: fakeClient({ 'POST /nutrition/fresh-forecasts/preview': beForecast() }) }).previewForecast({
    ...emptyForecastForm({ campusId: '1', today: '2026-11-03' }),
    periodTo: '2026-11-04',
  });
  assert.deepEqual(none.dryLines, []);
});
