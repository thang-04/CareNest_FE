import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toastContent, toastStatusText } from '../../src/utils/toastStatus.js';

test('toast luôn ghi rõ trạng thái theo loại', () => {
  assert.equal(toastStatusText('success'), 'Thành công');
  assert.equal(toastStatusText('error'), 'Thất bại');
  assert.equal(toastStatusText('warning'), 'Cảnh báo');
  assert.equal(toastStatusText('info'), 'Thông báo');
});

test('toast lỗi có mã thì ghi kèm mã; mã 0 là mất kết nối', () => {
  assert.equal(toastStatusText('error', 403), 'Thất bại · Mã 403');
  assert.equal(toastStatusText('error', 0), 'Thất bại · Mất kết nối');
  assert.equal(toastStatusText('success', 200), 'Thành công');
});

test('nhận cả chuỗi lẫn lỗi đã chuẩn hoá { message, status }', () => {
  assert.deepEqual(toastContent('Đã lưu'), { text: 'Đã lưu', code: undefined });
  const err = Object.assign(new Error('Bạn không có quyền'), { status: 403 });
  assert.deepEqual(toastContent(err), { text: 'Bạn không có quyền', code: 403 });
  assert.deepEqual(toastContent(new Error('Lỗi kiểm tra dữ liệu')), { text: 'Lỗi kiểm tra dữ liệu', code: undefined });
});
