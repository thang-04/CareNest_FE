import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { parseCsv, parseDateCell, parseNumberCell, rowsToLines } = await import('@/utils/kitchen/stockReceiptImport');

const foods = [
  { id: 1, code: 'TP001', name: 'Gạo tẻ', unitPrice: 18000 },
  { id: 2, code: 'TP010', name: 'Đường kính', unitPrice: null },
];

test('ô ngày và ô số kiểu Việt Nam', () => {
  assert.equal(parseDateCell('30/06/2027'), '2027-06-30');
  assert.equal(parseDateCell('2027-6-3'), '2027-06-03');
  assert.equal(parseDateCell(new Date(2027, 0, 5)), '2027-01-05');
  assert.equal(parseDateCell('sai'), '');
  assert.equal(parseNumberCell('12.500'), '12500');
  assert.equal(parseNumberCell('1,5'), '1.5');
  assert.equal(parseNumberCell(''), '');
});

test('CSV dấu chấm phẩy, có ngoặc kép và BOM', () => {
  const rows = parseCsv('﻿Mã TP;Tên\r\nTP001;"Gạo; tẻ"\r\n');
  assert.deepEqual(rows[0], ['Mã TP', 'Tên']);
  assert.deepEqual(rows[1], ['TP001', 'Gạo; tẻ']);
});

test('dòng file → dòng phiếu: khớp mã hoặc tên không dấu, báo dòng không khớp, bỏ dòng trống', () => {
  const { lines, problems } = rowsToLines(
    [
      ['TP001', '', '50', 'L1', '30/06/2027', ''],
      ['', 'duong kinh', '2,5', 'L2', '', '25.000'],
      ['', '', '', '', '', ''],
      ['', 'Muối', '1', '', '', ''],
    ],
    foods,
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[0].foodId, '1');
  assert.equal(lines[0].unitPrice, '18000', 'giá trống ⇒ lấy giá danh mục');
  assert.equal(lines[1].purchaseQty, '2.5');
  assert.equal(lines[1].unitPrice, '25000');
  assert.deepEqual(problems, ['Dòng 5: không tìm thấy thực phẩm kho khô "Muối"']);
});
