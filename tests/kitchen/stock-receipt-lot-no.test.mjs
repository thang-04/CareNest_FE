import assert from 'node:assert/strict';
import { test } from 'node:test';

const { autoLotNo, uniqueLotNo, isAutoLotNo } = await import('@/utils/kitchen/stockReceiptForm');

test('số lô gợi ý thêm đuôi -2, -3… khi đã có, không phân biệt hoa thường', () => {
  const base = 'L261125-TP001';
  assert.equal(uniqueLotNo(base, new Set()), base);
  assert.equal(uniqueLotNo(base, new Set(['l261125-tp001'])), 'L261125-TP001-2');
  assert.equal(uniqueLotNo(base, new Set(['l261125-tp001', 'l261125-tp001-2'])), 'L261125-TP001-3');
  assert.equal(uniqueLotNo('', new Set()), '');
});

test('nhận ra số lô còn là bản tự sinh (gốc hoặc kèm đuôi số), số lô gõ tay thì không', () => {
  const base = 'L261125-TP001';
  assert.equal(isAutoLotNo(base, base), true);
  assert.equal(isAutoLotNo('L261125-TP001-2', base), true);
  assert.equal(isAutoLotNo('L261125-TP001-A', base), false);
  assert.equal(isAutoLotNo('LO-NCC-77', base), false);
  assert.equal(isAutoLotNo('', ''), false);
});

test('số lô tự sinh L{yyMMdd}-{mã thực phẩm} từ ngày nhập', () => {
  assert.equal(autoLotNo('2026-11-25', 'TP001'), 'L261125-TP001');
  assert.equal(autoLotNo('2027-01-05', ' TP012 '), 'L270105-TP012');
});

test('thiếu ngày nhập hoặc mã thực phẩm thì không sinh số lô', () => {
  assert.equal(autoLotNo('', 'TP001'), '');
  assert.equal(autoLotNo('2026-11-25', ''), '');
  assert.equal(autoLotNo('25/11/2026', 'TP001'), '');
});
