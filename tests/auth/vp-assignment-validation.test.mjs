import assert from 'node:assert/strict';
import { test } from 'node:test';

const { validateVpAssignment } = await import('@/utils/school-config/schoolConfigValidation');

const campuses = [
  { id: 1, shortName: 'Cơ sở 1', status: 'ACTIVE' },
  { id: 2, shortName: 'Cơ sở 2', status: 'ACTIVE' },
  { id: 3, shortName: 'Cơ sở cũ', status: 'INACTIVE' },
];
const rules = { campuses, currentCampusId: 1, requireChange: true };

test('AUTH-02: phân công PHT phải chọn điểm trường còn hoạt động', () => {
  assert.equal(validateVpAssignment({ campusId: '' }, rules).campusId, 'Chọn điểm trường phụ trách');
  assert.match(validateVpAssignment({ campusId: '3' }, rules).campusId, /ngừng hoạt động/);
  assert.match(validateVpAssignment({ campusId: '9' }, rules).campusId, /không còn trong danh sách/);
});

test('AUTH-26: điểm trường đã có Phó hiệu trưởng khác thì không xếp thêm, nói rõ ai đang giữ', () => {
  const takenBy = (id) => (String(id) === '2' ? 'Cao Bích' : '');
  assert.match(validateVpAssignment({ campusId: '2' }, { ...rules, takenBy }).campusId, /Cơ sở 2 đã có Cao Bích phụ trách/);
  assert.deepEqual(validateVpAssignment({ campusId: '2' }, { ...rules, requireChange: false, takenBy: () => '' }), {});
});

test('AUTH-02: đổi điểm trường mà chọn lại đúng điểm trường đang phụ trách thì báo, không lưu vô ích', () => {
  // select trả chuỗi, dữ liệu gốc là số: vẫn nhận ra cùng điểm trường
  assert.match(validateVpAssignment({ campusId: '1' }, rules).campusId, /đang phụ trách điểm trường này/);
  assert.deepEqual(validateVpAssignment({ campusId: '2' }, rules), {});
  // Bản mock còn giao việc trong cùng hộp nên giữ điểm trường cũ vẫn hợp lệ
  assert.deepEqual(validateVpAssignment({ campusId: '1' }, { ...rules, requireChange: false }), {});
  assert.deepEqual(validateVpAssignment({ campusId: '1' }), {});
});
