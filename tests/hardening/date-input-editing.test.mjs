import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeDateInput, parseDisplayDate } from '@/utils/format';

test('ô ngày giữ đúng đoạn khi sửa riêng ngày hoặc tháng', () => {
  assert.equal(normalizeDateInput('15/09/2026'), '15/09/2026');
  assert.equal(normalizeDateInput('05/10/2026'), '05/10/2026');
  assert.equal(parseDisplayDate(normalizeDateInput('15/10/2026')), '2026-10-15');
});

test('ô ngày vẫn tự chèn dấu khi gõ hoặc dán tám chữ số', () => {
  assert.equal(normalizeDateInput('05092026'), '05/09/2026');
  assert.equal(normalizeDateInput('0509'), '05/09');
});

test('ô ngày không dồn chữ số khi đoạn đang sửa chưa đủ hai số', () => {
  assert.equal(normalizeDateInput('1/09/2026'), '1/09/2026');
  assert.equal(normalizeDateInput('05/1/2026'), '05/1/2026');
});

test('ô ngày giữ dấu "/" khi gõ ngày, tháng một chữ số', () => {
  const typed = ['5', '5/', '5/9', '5/9/', '5/9/2', '5/9/2026'].map(normalizeDateInput);
  assert.deepEqual(typed, ['5', '5/', '5/9', '5/9/', '5/9/2', '5/9/2026']);
  assert.equal(parseDisplayDate('5/9/2026'), '2026-09-05');
  assert.equal(normalizeDateInput('12/052026'), '12/05/2026');
  assert.equal(parseDisplayDate('31/2/2026'), null);
});
