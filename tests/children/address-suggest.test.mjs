import test from 'node:test';
import assert from 'node:assert/strict';
import { VN_PROVINCES, filterVnProvinces, districtsOfVnProvince } from '../../src/data/vnAdministrative.js';

test('vn-administrative: đủ 63 tỉnh, mỗi tỉnh có danh sách quận/huyện', () => {
  assert.equal(VN_PROVINCES.length, 63);
  for (const p of VN_PROVINCES) {
    assert.ok(p.code, `tỉnh thiếu code: ${p.name}`);
    assert.ok(p.name, `tỉnh thiếu name: ${p.code}`);
    assert.ok(Array.isArray(p.districts) && p.districts.length > 0, `tỉnh không có quận/huyện: ${p.name}`);
  }
});

test('filterVnProvinces: trống trả đủ 63, "ha" khớp tỉnh và huyện', () => {
  assert.equal(filterVnProvinces('').length, 63);
  assert.equal(filterVnProvinces(null).length, 63);
  const ha = filterVnProvinces('ha');
  assert.ok(ha.some((p) => p.name === 'TP Hà Nội'));
  assert.ok(ha.some((p) => p.name === 'TP Hải Phòng'));
});

test('filterVnProvinces: không dấu khớp "Ha", "hai phong" chỉ còn TP Hải Phòng', () => {
  assert.ok(filterVnProvinces('Ha').some((p) => p.name === 'TP Hà Nội'));
  assert.deepEqual(filterVnProvinces('hai phong').map((p) => p.name), ['TP Hải Phòng']);
});

test('districtsOfVnProvince: tỉnh đã chọn trả đúng danh sách huyện, tỉnh lạ trả rỗng', () => {
  const ph = districtsOfVnProvince('TP Hải Phòng');
  assert.ok(ph.includes('Quận Lê Chân'));
  assert.deepEqual(districtsOfVnProvince('Naylon'), []);
});
