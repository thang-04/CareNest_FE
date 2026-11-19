import assert from 'node:assert/strict';
import { test } from 'node:test';

const { validateReceiptForm, receiptNoteError } = await import('@/utils/kitchen/stockReceiptForm');

const form = (note) => ({
  campusId: '1',
  supplierId: '2',
  receivedDate: '2026-11-19',
  note,
  lines: [{ foodId: '3', lotNo: 'L1', expiryDate: '2027-01-01', purchaseQty: '1', unitPrice: '1000' }],
});

test('ghi chú đúng 500 ký tự thì hợp lệ', () => {
  assert.equal(receiptNoteError('a'.repeat(500)), undefined);
  assert.deepEqual(validateReceiptForm(form('a'.repeat(500))), {});
});

test('ghi chú 501 ký tự báo lỗi và chặn lưu', () => {
  assert.equal(receiptNoteError('a'.repeat(501)), 'Ghi chú không được vượt quá 500 ký tự');
  assert.equal(validateReceiptForm(form('a'.repeat(501))).note, 'Ghi chú không được vượt quá 500 ký tự');
});

test('ghi chú trống thì hợp lệ', () => {
  assert.equal(receiptNoteError(undefined), undefined);
  assert.equal(validateReceiptForm(form('')).note, undefined);
});
