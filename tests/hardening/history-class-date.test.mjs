import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readableClassDate } from '@/utils/historyDate';

test('lớp lịch sử không mở ngày sau ngày cuối được xem', () => {
  const history = { historicalReadOnly: true, lastReadableDate: '2026-10-27' };
  assert.equal(readableClassDate(history, '2026-11-20'), '2026-10-27');
  assert.equal(readableClassDate(history, '2026-10-20'), '2026-10-20');
  assert.equal(readableClassDate(history, ''), '2026-10-27');
});

test('lớp đang dạy giữ ngày đã chọn', () => {
  assert.equal(readableClassDate({ historicalReadOnly: false }, '2026-11-20'), '2026-11-20');
  assert.equal(readableClassDate({}, ''), undefined);
});
