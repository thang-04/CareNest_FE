import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createDryStockApi, toReceiptRequest } = await import('@/services/dryStockApi');
const { toBaseQuantity, toPurchaseQuantity, formatPurchaseQty, formatSignedPurchaseQty } = await import('@/utils/kitchen/stockUnits');
const { emptyReceiptForm, receiptToForm, validateReceiptForm, mapReceiptErrors } = await import('@/utils/kitchen/stockReceiptForm');
const { groupLotsByFood, expiryStatus, daysUntil, personName } = await import('@/utils/kitchen/stockLots');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

// Thực phẩm theo DTO StockFoodRef sau khi beClient đổi id số sang chuỗi
const RICE = { id: '7', code: 'TP007', name: 'Gạo tẻ', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const OIL = { id: '9', code: 'TP009', name: 'Dầu ăn', unit: 'ml', purchaseUnit: 'chai', purchaseUnitSize: 500 };

const beReceipt = (over = {}) => ({
  id: '31',
  campusId: '1',
  supplierId: '3',
  supplierName: 'Nhà cung cấp A',
  receivedDate: '2026-11-03',
  status: 'DRAFT',
  note: '',
  totalValue: 250000,
  lines: [{ id: '51', food: RICE, lotNo: 'L01', expiryDate: '2027-03-01', quantity: 25000, unitPrice: 10000, value: 250000 }],
  canManage: true,
  ...over,
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

test('NUT-11: số nhập theo đơn vị mua đổi về đơn vị gốc khi gửi, và đổi ngược khi hiện', () => {
  assert.equal(toBaseQuantity(25, RICE), 25000);
  assert.equal(toBaseQuantity('2.5', RICE), 2500);
  assert.equal(toBaseQuantity(3, OIL), 1500);
  assert.equal(toPurchaseQuantity(25000, RICE), 25);
  assert.equal(toPurchaseQuantity(750, OIL), 1.5);
  assert.equal(toPurchaseQuantity(1, { purchaseUnitSize: 3 }), 0.333);
  assert.equal(toBaseQuantity(toPurchaseQuantity(12345, RICE), RICE), 12345);
  assert.equal(formatPurchaseQty(2500, RICE), '2,5 kg');
  assert.equal(formatSignedPurchaseQty(-500, OIL), '−1 chai');
  assert.equal(formatSignedPurchaseQty(1500, OIL), '+3 chai');
});

test('tạo phiếu: POST /nutrition/stock/receipts, quantity = số nhập × purchaseUnitSize, đơn giá giữ trên đơn vị mua', async () => {
  const client = fakeClient({ 'POST /nutrition/stock/receipts': beReceipt() });
  const api = createDryStockApi({ client });
  const form = {
    campusId: '1',
    supplierId: '3',
    receivedDate: '2026-11-03',
    note: '  Giao buổi sáng ',
    lines: [
      { key: 'a', foodId: '7', lotNo: ' L01 ', expiryDate: '2027-03-01', purchaseQty: '25', unitPrice: '10000' },
      { key: 'b', foodId: '9', lotNo: 'D05', expiryDate: '2027-01-15', purchaseQty: '2.5', unitPrice: '45000' },
    ],
  };
  const saved = await api.saveReceipt(null, form, { 7: RICE, 9: OIL });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].method, 'post');
  assert.deepEqual(client.calls[0].body, {
    campusId: '1',
    supplierId: '3',
    receivedDate: '2026-11-03',
    note: 'Giao buổi sáng',
    lines: [
      { foodId: '7', lotNo: 'L01', expiryDate: '2027-03-01', quantity: 25000, unitPrice: 10000 },
      { foodId: '9', lotNo: 'D05', expiryDate: '2027-01-15', quantity: 1250, unitPrice: 45000 },
    ],
  });
  // Phiếu trả về có thêm số theo đơn vị mua cho màn hình
  assert.equal(saved.lines[0].purchaseQuantity, 25);
  assert.equal(saved.lines[0].quantity, 25000);
  assert.equal(saved.totalValue, 250000);
  assert.equal(saved.canManage, true);
});

test('sửa nháp: PUT /nutrition/stock/receipts/{id}; thực phẩm không còn trong danh mục báo lỗi theo dòng, không gửi', async () => {
  const client = fakeClient({ 'PUT /nutrition/stock/receipts/31': beReceipt() });
  const api = createDryStockApi({ client });
  const form = { ...emptyReceiptForm({ campusId: '1', today: '2026-11-03' }), supplierId: '3' };
  form.lines = [{ key: 'a', foodId: '7', lotNo: 'L01', expiryDate: '2027-03-01', purchaseQty: '1', unitPrice: '0' }];
  await api.saveReceipt('31', form, { 7: RICE });
  assert.deepEqual([client.calls[0].method, client.calls[0].url], ['put', '/nutrition/stock/receipts/31']);
  assert.equal(client.calls[0].body.lines[0].unitPrice, 0);

  const unknown = { ...form, lines: [{ ...form.lines[0], foodId: '99' }] };
  await assert.rejects(
    () => api.saveReceipt('31', unknown, { 7: RICE }),
    (error) => error.details['lines[0].foodId'] === 'Chọn lại thực phẩm',
  );
  assert.equal(client.calls.length, 1, 'không gọi BE khi thiếu thực phẩm');
  assert.throws(() => toReceiptRequest(unknown, {}), /không còn trong danh mục/);
});

test('xác nhận, hủy (có lý do), xóa nháp, chi tiết, danh sách đúng đường dẫn BE', async () => {
  const client = fakeClient({
    'GET /nutrition/stock/receipts': [beReceipt()],
    'GET /nutrition/stock/receipts/31': beReceipt(),
    'POST /nutrition/stock/receipts/31/confirm': beReceipt({ status: 'CONFIRMED' }),
    'POST /nutrition/stock/receipts/31/cancel': beReceipt({ status: 'CANCELLED', cancelReason: 'Nhập nhầm' }),
    'DELETE /nutrition/stock/receipts/31': undefined,
  });
  const api = createDryStockApi({ client });
  const list = await api.listReceipts({ campusId: '1', from: '2026-11-01', to: '', status: 'DRAFT' });
  assert.deepEqual(client.calls[0].params, { campusId: '1', from: '2026-11-01', status: 'DRAFT' }, 'bỏ tham số rỗng');
  assert.equal(list[0].lines[0].purchaseQuantity, 25);
  assert.equal((await api.getReceipt('31')).id, '31');
  assert.equal((await api.confirmReceipt('31')).status, 'CONFIRMED');
  const cancelled = await api.cancelReceipt('31', '  Nhập nhầm  ');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.deepEqual(client.calls.at(-1).body, { reason: 'Nhập nhầm' });
  assert.deepEqual(await api.deleteReceipt('31'), { id: '31' });
  assert.deepEqual(
    client.calls.map((c) => `${c.method.toUpperCase()} ${c.url}`),
    [
      'GET /nutrition/stock/receipts',
      'GET /nutrition/stock/receipts/31',
      'POST /nutrition/stock/receipts/31/confirm',
      'POST /nutrition/stock/receipts/31/cancel',
      'DELETE /nutrition/stock/receipts/31',
    ],
  );
});

test('tồn theo lô, lịch sử, phần thiếu: tham số đúng và số hiện theo đơn vị mua', async () => {
  const client = fakeClient({
    'GET /nutrition/stock/lots': [
      { id: '1', food: RICE, lotNo: 'L01', expiryDate: '2027-01-01', quantity: 20000, remaining: 12500, unitPrice: 10000 },
      { id: '2', food: OIL, lotNo: 'D05', expiryDate: '2026-12-01', quantity: 5000, remaining: 500, unitPrice: 45000 },
    ],
    'GET /nutrition/stock/movements': {
      items: [
        { id: '8', type: 'DEDUCT', food: RICE, lotId: '1', lotNo: 'L01', quantity: -2500, mealDate: '2026-11-03', reason: null },
        { id: '9', type: 'RECEIPT', food: OIL, lotId: '2', lotNo: 'D05', quantity: 5000, receiptId: '31' },
      ],
      page: 1,
      size: 50,
      totalElements: 51,
      totalPages: 2,
    },
    'GET /nutrition/stock/shortfalls': [{ campusId: '1', mealDate: '2026-11-03', food: RICE, requiredQty: 6000, shortfallQty: 1500 }],
  });
  const api = createDryStockApi({ client });
  const lots = await api.listLots({ campusId: '1', foodId: '', includeEmpty: false });
  assert.deepEqual(client.calls[0].params, { campusId: '1', includeEmpty: false });
  assert.deepEqual(
    lots.map((l) => [l.purchaseQuantity, l.purchaseRemaining]),
    [
      [20, 12.5],
      [10, 1],
    ],
  );
  const page = await api.listMovements({ campusId: '1', type: 'DEDUCT', page: 1 });
  assert.deepEqual(client.calls[1].params, { campusId: '1', type: 'DEDUCT', page: 1, size: 50 });
  assert.equal(page.totalElements, 51);
  assert.deepEqual(
    page.items.map((m) => m.purchaseQuantity),
    [-2.5, 10],
  );
  const [shortfall] = await api.listShortfalls({ campusId: '1' });
  assert.deepEqual([shortfall.purchaseRequiredQty, shortfall.purchaseShortfallQty], [6, 1.5]);
});

test('form phiếu: phiếu BE đổi sang đơn vị mua, kiểm ô bắt buộc, lỗi BE theo dòng map về ô form', () => {
  const form = receiptToForm(beReceipt());
  assert.equal(form.supplierId, '3');
  assert.deepEqual(
    form.lines.map(({ foodId, lotNo, expiryDate, purchaseQty, unitPrice }) => ({ foodId, lotNo, expiryDate, purchaseQty, unitPrice })),
    [{ foodId: '7', lotNo: 'L01', expiryDate: '2027-03-01', purchaseQty: '25', unitPrice: '10000' }],
  );
  assert.deepEqual(validateReceiptForm(form), {});

  const empty = emptyReceiptForm({ campusId: '1', today: '2026-11-03' });
  assert.deepEqual(Object.keys(validateReceiptForm(empty)).sort(), [
    'lines.0.expiryDate',
    'lines.0.foodId',
    'lines.0.lotNo',
    'lines.0.purchaseQty',
    'lines.0.unitPrice',
    'supplierId',
  ]);
  const zero = { ...form, lines: [{ ...form.lines[0], purchaseQty: '0' }] };
  assert.ok(validateReceiptForm(zero)['lines.0.purchaseQty']);
  assert.deepEqual(mapReceiptErrors({ 'lines[1].quantity': 'Sai', supplierId: 'Thiếu', _form: 'Lỗi chung' }), {
    'lines.1.purchaseQty': 'Sai',
    supplierId: 'Thiếu',
    _form: 'Lỗi chung',
  });
});

test('tồn kho: gom lô theo thực phẩm, nhắc hạn dùng, không hiện mã số thay tên người', () => {
  const groups = groupLotsByFood([
    { id: '2', food: OIL, remaining: 500 },
    { id: '1', food: RICE, remaining: 12500 },
    { id: '3', food: RICE, remaining: 2500 },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.food.name, g.remaining, g.lots.map((l) => l.id)]),
    [
      ['Dầu ăn', 500, ['2']],
      ['Gạo tẻ', 15000, ['1', '3']],
    ],
  );
  assert.equal(daysUntil('2026-11-10', '2026-11-03'), 7);
  assert.deepEqual(expiryStatus('2026-11-02', '2026-11-03'), { state: 'EXPIRED', days: -1 });
  assert.equal(expiryStatus('2026-11-03', '2026-11-03').state, 'SOON');
  assert.equal(expiryStatus('2027-03-01', '2026-11-03').state, 'OK');
  assert.equal(expiryStatus('', '2026-11-03').state, 'NONE');
  assert.equal(personName('Nguyễn Thị Mai'), 'Nguyễn Thị Mai');
  assert.equal(personName(42), '');
  assert.equal(personName(null), '');
});

test('module dry-stock khai source api với bốn route kho và file adapter', () => {
  const mod = INTEGRATION_MODULES['dry-stock'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/kitchen/dry-stock', '/kitchen/stock-receipts', '/kitchen/stock-history', '/kitchen/stock-shortfalls']);
  assert.deepEqual(mod.files, ['src/services/dryStockApi.js']);
});
