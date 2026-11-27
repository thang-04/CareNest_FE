import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Màn Tài khoản phụ huynh:
 * - G94-437 (BUG-56): số liệu, lớp, trẻ theo năm học chọn ở header (đổi năm ⇒ tải lại, không giữ dữ liệu năm cũ);
 * - G94-436 (BUG-55): luôn giữ thanh điểm trường của năm, kể cả khi điểm trường đang chọn chưa có trẻ, đang tải hoặc lỗi.
 */
const read = (f) => readFileSync(f, 'utf8');
const page = read('src/pages/children/ParentActivationPage.jsx');

test('trang gửi năm học ở header cho cấu trúc và danh sách trẻ', () => {
  assert.match(page, /const \{ schoolYear \} = useSchoolYear\(\);/);
  assert.match(page, /useGuardianStructure\(schoolYear\)/);
  assert.match(page, /useCampusGuardianChildren\(campusId, \{\s*enabled: !structure\.loading[^}]*schoolYear,?\s*\}\)/);
  // CP-22: xem mọi điểm trường của năm, không dùng quyền kích hoạt để lọc phạm vi đọc.
  assert.match(page, /const campuses = structure\.campuses;/);
  assert.match(page, /const canManage = \(child\) => !yearLocked && !!child\.canManage;/);
  assert.match(page, /campuses\.some\(\(c\) => sameId\(c\.id, campusPick\)\)/);
});

test('thanh điểm trường hiện ở mọi trạng thái, câu báo khi điểm trường chưa có trẻ', () => {
  assert.match(page, /const campusTabs =/);
  assert.equal((page.match(/<div className="pa-state-panel__campuses">\{campusTabs\}<\/div>/g) || []).length, 3);
  assert.match(page, /'Cơ sở này chưa có trẻ trong năm học đang chọn\.'/);
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
