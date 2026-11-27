import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childPhotoSource } from '../../src/utils/children/childPhoto.js';

test('lấy ảnh theo hồ sơ trẻ khi response không kèm đường dẫn ảnh', () => {
  assert.equal(childPhotoSource({ id: 12 }), '/children/12/photo');
  assert.equal(childPhotoSource({ childId: 7, id: 900 }), '/children/7/photo');
});

test('giữ giá trị BE đã trả; null là hồ sơ chưa có ảnh nên không gọi', () => {
  assert.equal(childPhotoSource({ id: 12, photoUrl: null }), null);
  assert.equal(childPhotoSource({ id: 12, photoUrl: '/children/12/photo' }), '/children/12/photo');
});

test('không có mã trẻ dạng số (dữ liệu demo, chỉ có tên) thì không gọi', () => {
  assert.equal(childPhotoSource({ fullName: 'An' }), null);
  assert.equal(childPhotoSource({ id: 'ch-1' }), null);
  assert.equal(childPhotoSource(null), null);
});
