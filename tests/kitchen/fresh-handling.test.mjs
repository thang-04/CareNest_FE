import assert from 'node:assert/strict';
import { test } from 'node:test';

const { toCheckRequest, createFreshGoodsApi } = await import('@/services/freshGoodsApi');
const { handlingToForm, validateHandlingForm, handlingSlipRows, differenceOf } = await import('@/utils/kitchen/freshHandling');

const PORK = { id: '7', name: 'Thịt', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const MILK = { id: '8', name: 'Sữa', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const RICE = { id: '9', name: 'Rau', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 };
const beRound = {
  round: 2,
  available: true,
  handlingRequired: true,
  lines: [
    { food: PORK, expectedQty: 11000, round1Qty: 12000, supplier: { id: '3', name: 'NCC A' } },
    { food: MILK, expectedQty: 9000, round1Qty: 8500, supplier: null },
    { food: RICE, expectedQty: 2000, round1Qty: 2000, supplier: null },
  ],
};

const load = async () => {
  const client = { get: async () => ({ rounds: [beRound] }) };
  return (await createFreshGoodsApi({ client }).getCheck({ campusId: '1', date: '2026-11-23' })).rounds[0];
};

test('form xử lý chênh lệch: gợi ý trả phần thừa, gọi thêm phần thiếu, dòng đủ để trống', async () => {
  const round = await load();
  assert.equal(differenceOf(round.lines[0]), 1);
  assert.equal(differenceOf(round.lines[1]), -0.5);
  const form = handlingToForm(round);
  assert.deepEqual(
    form.lines.map((l) => [l.foodId, l.handlingAction, l.handlingQty, l.supplierId]),
    [
      ['7', 'RETURN', '1', '3'],
      ['8', 'ORDER_MORE', '0.5', ''],
      ['9', '', '', ''],
    ],
  );
  assert.deepEqual(validateHandlingForm(form, round.lines), {});
});

test('kiểm ô: dòng lệch phải chọn cách xử lý, số gọi thêm / trả lại phải hợp lệ', async () => {
  const round = await load();
  const form = handlingToForm(round);
  form.lines[0].handlingAction = '';
  form.lines[1].handlingQty = '0';
  assert.deepEqual(Object.keys(validateHandlingForm(form, round.lines)), ['lines.0.handlingAction', 'lines.1.handlingQty']);
  form.lines[0] = { ...form.lines[0], handlingAction: 'RETURN', handlingQty: '13' };
  form.lines[1] = { ...form.lines[1], handlingAction: 'KEEP', handlingQty: '' };
  assert.deepEqual(Object.keys(validateHandlingForm(form, round.lines)), ['lines.0.handlingQty']);
});

test('thân yêu cầu gửi cách xử lý theo đơn vị gốc, không tự gửi kết quả', async () => {
  const round = await load();
  const form = handlingToForm(round);
  form.lines[1].handlingAction = 'KEEP';
  const body = toCheckRequest(form, round.lines);
  assert.deepEqual(body.lines[0], {
    foodId: '7',
    receivedQty: null,
    result: null,
    note: '',
    supplierId: 3,
    handlingAction: 'RETURN',
    handlingQty: 1000,
  });
  assert.deepEqual([body.lines[1].handlingAction, body.lines[1].handlingQty], ['KEEP', null]);
  assert.deepEqual([body.lines[2].handlingAction, body.lines[2].handlingQty], [null, null]);
});

test('phiếu chênh lệch chỉ gồm dòng gọi thêm và trả lại', async () => {
  const round = await load();
  const rows = handlingSlipRows(handlingToForm(round), round.lines);
  assert.deepEqual(
    rows.map((r) => [r.food.name, r.action, r.quantity, r.supplier]),
    [
      ['Thịt', 'RETURN', 1, 'NCC A'],
      ['Sữa', 'ORDER_MORE', 0.5, ''],
    ],
  );
});
