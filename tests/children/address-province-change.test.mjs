import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { changeProvince, wardLocked } from '@/utils/children/childAddress';

// G94-434 (BUG-53): đổi tỉnh/thành nơi ở ⇒ xóa phường/xã cũ; chưa có tỉnh/thành ⇒ khóa ô phường/xã. Tiếp nhận và Sửa hồ sơ dùng chung.
const address = { province: 'TP Hải Phòng', ward: 'Phường Thượng Hồng', street: 'Số 1' };

test('đổi sang tỉnh/thành khác ⇒ xóa phường/xã, giữ số nhà', () => {
  assert.deepEqual(changeProvince(address, 'TP Hà Nội'), { province: 'TP Hà Nội', ward: '', street: 'Số 1' });
});

test('bỏ chọn tỉnh/thành ⇒ xóa phường/xã và khóa ô đến khi chọn lại', () => {
  const next = changeProvince(address, '');
  assert.equal(next.ward, '');
  assert.equal(wardLocked(next), true);
  assert.equal(wardLocked(address), false);
  assert.equal(wardLocked({ province: '   ', ward: '' }), true);
});

test('cùng tỉnh/thành (khác hoa thường, khoảng trắng) ⇒ giữ phường/xã', () => {
  assert.equal(changeProvince(address, ' tp hải phòng ').ward, 'Phường Thượng Hồng');
});

test('ô Tỉnh/thành dùng changeProvince, ô Phường/xã khóa theo wardLocked ở cả hai dạng form', () => {
  const src = readFileSync('src/components/children/ChildProfileFields.jsx', 'utf8');
  assert.equal((src.match(/onChange=\{setProvince\}/g) || []).length, 2);
  assert.equal((src.match(/disabled=\{noProvince\}/g) || []).length, 2);
  assert.doesNotMatch(src, /setAddress\('province'/);
});
