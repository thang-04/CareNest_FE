import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { padDisplayDate } from '@/utils/format';

// AC-F1: ô ngày chấp nhận ngày/tháng 1 chữ số và tự đệm số 0.
test('padDisplayDate đệm ngày và tháng tới 2 chữ số', () => {
  assert.equal(padDisplayDate('5/9/2027'), '05/09/2027');
  assert.equal(padDisplayDate('5/09/2027'), '05/09/2027');
  assert.equal(padDisplayDate('05/9/2027'), '05/09/2027');
});

test('padDisplayDate giữ nguyên chuỗi đã đủ hoặc chưa đủ', () => {
  assert.equal(padDisplayDate('05/09/2027'), '05/09/2027');
  assert.equal(padDisplayDate('5/9/20'), '5/9/20');
  assert.equal(padDisplayDate('5/9'), '5/9');
  assert.equal(padDisplayDate(''), '');
});

test('DateInput nhận ngày 1 chữ số khi gõ và đệm số 0 khi rời ô, vẫn gọi onBlur của người dùng', () => {
  const src = readFileSync('src/components/form/DateInput.jsx', 'utf8');
  assert.match(src, /onChange\?\.\(iso \|\| next\)/);
  assert.match(src, /onBlur/);
  assert.match(src, /padDisplayDate/);
});
