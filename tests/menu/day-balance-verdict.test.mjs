import assert from 'node:assert/strict';
import { test } from 'node:test';

const { verdictDeltaOf, verdictGaugesOf } = await import('@/utils/menu-planning/dayBalance');

const evaluation = (over = {}) => ({
  totals: { kcal: 1415 },
  rows: [
    { key: 'kcal', value: 1415, min: 1150, max: 1330, status: 'HIGH' },
    { key: 'protein', percent: 12, min: 13, max: 20, status: 'LOW' },
    { key: 'lipid', percent: 28, min: 25, max: 35, status: 'OK' },
    { key: 'glucid', percent: 60, min: 52, max: 60, status: 'OK' },
  ],
  cost: 30000,
  mealPrice: 35000,
  foodBudget: 33000,
  budgetTolerancePct: 5,
  quantityStatus: 'HIGH',
  qualityStatus: 'LOW',
  moneyStatus: 'LOW',
  ...over,
});

test('lượng: thực tế, khoảng đạt và số kcal cần giảm lấy từ dòng kcal BE trả', () => {
  const { quantity } = verdictGaugesOf(evaluation());
  assert.deepEqual([quantity.value, quantity.min, quantity.max, quantity.gap], [1415, 1150, 1330, 85]);
  assert.ok(quantity.scale.from < quantity.scale.to && quantity.scale.value > quantity.scale.to, 'vạch nằm bên phải vùng đạt');
});

test('tiền: khoảng đạt là ngân sách thực phẩm ± biên, chênh tính tới mép dưới', () => {
  const { money } = verdictGaugesOf(evaluation());
  assert.equal(money.min, 31350);
  assert.equal(Math.round(money.max), 34650);
  assert.equal(money.gap, 1350);
});

test('chất: mỗi phần P:L:G giữ % và trạng thái BE trả', () => {
  const { quality } = verdictGaugesOf(evaluation());
  assert.deepEqual(
    quality.parts.map((p) => [p.label, p.value, p.status]),
    [
      ['Đạm', 12, 'LOW'],
      ['Béo', 28, 'OK'],
      ['Đường', 60, 'OK'],
    ],
  );
});

test('đạt hoặc thiếu định mức thì không có số cần sửa, thiếu số liệu thì không vẽ thanh', () => {
  const ok = verdictGaugesOf(evaluation({ quantityStatus: 'OK' }));
  assert.equal(ok.quantity.gap, null);
  const noNorm = verdictGaugesOf(evaluation({ rows: [{ key: 'kcal', value: 1000 }], foodBudget: null, mealPrice: null }));
  assert.equal(noNorm.quantity.scale, null);
  assert.equal(noNorm.money.scale, null);
  assert.equal(verdictGaugesOf(null), null);
});

test('lần sửa vừa rồi: chênh calo và chi phí so với bản trước, không đổi thì null', () => {
  const before = evaluation();
  const after = evaluation({ totals: { kcal: 1375 }, cost: 30600 });
  assert.deepEqual(verdictDeltaOf(after, before), { kcal: -40, cost: 600 });
  assert.equal(verdictDeltaOf(before, before), null);
  assert.equal(verdictDeltaOf(after, null), null);
});
