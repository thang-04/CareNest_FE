import assert from 'node:assert/strict';
import { test } from 'node:test';

const { BE_ERROR_FIELDS } = await import('@/services/http/beErrorFields');

test('GV dạy thay đã có lớp trùng ngày: lỗi hiện dưới ô Giáo viên dạy thay', () => {
  assert.equal(BE_ERROR_FIELDS[2334], 'userId');
  // Cùng ô với các lỗi chọn giáo viên dạy thay khác
  assert.equal(BE_ERROR_FIELDS[2332], BE_ERROR_FIELDS[2334]);
});
