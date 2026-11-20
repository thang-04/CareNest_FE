import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Màn Tài khoản phụ huynh:
 * - G94-437 (BUG-56): số liệu, lớp, trẻ theo năm học chọn ở header (đổi năm ⇒ tải lại, không giữ dữ liệu năm cũ).
 */
const read = (f) => readFileSync(f, 'utf8');
const page = read('src/pages/children/ParentActivationPage.jsx');

test('trang gửi năm học ở header cho cấu trúc và danh sách trẻ', () => {
  assert.match(page, /const \{ schoolYear \} = useSchoolYear\(\);/);
  assert.match(page, /useGuardianStructure\(schoolYear\)/);
  assert.match(page, /useCampusGuardianChildren\(campusId, \{ enabled: !structure\.loading, schoolYear \}\)/);
  // Điểm trường đã chọn không thuộc năm mới ⇒ về điểm trường đầu của năm
  assert.match(page, /structure\.campuses\.some\(\(c\) => sameId\(c\.id, campusPick\)\)/);
});

test('hook đổi năm thì tải lại (năm nằm trong khóa truy vấn)', () => {
  const hooks = read('src/hooks/account/useGuardians.js');
  assert.match(hooks, /\[campusId, schoolYear\]/);
  assert.match(hooks, /getGuardianStructure\(user, schoolYear\), \[schoolYear\]/);
});

test('BE giả: lớp và trẻ theo năm học như GET /children?schoolYear', () => {
  const mock = read('src/services/account/mock/guardianMockRepository.js');
  assert.match(mock, /async getStructure\(actor, schoolYear\)/);
  assert.match(mock, /const year = schoolYear \|\| activeYearId\(db\);/);
  assert.match(mock, /children\.listChildren\(\{ schoolYear \}, actor\)/);
});
