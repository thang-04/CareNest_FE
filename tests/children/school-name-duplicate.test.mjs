import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCampus, validateClass } from '../../src/utils/school-config/schoolConfigValidation.js';

// Như BE (CAMPUS_NAME_EXISTS 2106, CLASS_NAME_EXISTS 2209): 2 dấu cách, gõ dấu tổ hợp, hoa thường vẫn là trùng
const decomposed = 'CƠ SỞ 1'.normalize('NFD');
test('tên điểm trường: trùng khi chỉ khác dấu cách, kiểu gõ dấu, hoa thường', () => {
  const others = [{ code: 'CS-A', name: 'Cơ sở 1' }];
  const base = { code: 'CS-C', shortName: 'C', address: 'Thượng Hồng' };
  for (const name of ['Cơ  sở 1', ` ${decomposed} `]) {
    assert.equal(validateCampus({ ...base, name }, others).name, 'Tên điểm trường đã tồn tại');
  }
  // Khác chữ (bỏ dấu) là tên khác
  assert.equal(validateCampus({ ...base, name: 'Co so 1' }, others).name, undefined);
});

test('tên lớp: trùng trong cùng năm + điểm trường, khác điểm trường thì được', () => {
  const others = [{ name: 'Lớp Mầm 1', schoolYear: 'y1', campusId: 'c1' }];
  const form = { name: 'Lớp  MẦM 1', schoolYear: 'y1', campusId: 'c1' };
  assert.equal(validateClass(form, others).name, 'Điểm trường đã có lớp cùng tên trong năm học này');
  assert.equal(validateClass({ ...form, campusId: 'c2' }, others).name, undefined);
});
