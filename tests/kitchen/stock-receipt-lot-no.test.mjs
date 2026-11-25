import assert from 'node:assert/strict';
import { test } from 'node:test';

const { autoLotNo } = await import('@/utils/kitchen/stockReceiptForm');

test('số lô tự sinh L{yyMMdd}-{mã thực phẩm} từ ngày nhập', () => {
  assert.equal(autoLotNo('2026-11-25', 'TP001'), 'L261125-TP001');
  assert.equal(autoLotNo('2027-01-05', ' TP012 '), 'L270105-TP012');
});

test('thiếu ngày nhập hoặc mã thực phẩm thì không sinh số lô', () => {
  assert.equal(autoLotNo('', 'TP001'), '');
  assert.equal(autoLotNo('2026-11-25', ''), '');
  assert.equal(autoLotNo('25/11/2026', 'TP001'), '');
});
