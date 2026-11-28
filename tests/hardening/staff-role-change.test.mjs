import assert from 'node:assert/strict';
import { test } from 'node:test';

const { staffRoleChangeRows, staffRoleChoices, staffEditCampusId, toProfilePayload, toRoleChangePayload, validateStaffEdit } =
  await import('@/utils/school-config/staffImport');

const principal = { id: '1', role: 'PRINCIPAL' };
const vice = { id: '2', role: 'VICE_PRINCIPAL' };
const teacher = { userId: 10, role: 'TEACHER', status: 'ACTIVE', workCampusId: 3 };

test('Hiệu trưởng đổi được giữa 3 vai trò nhân sự; PHT chỉ Giáo viên và Bếp', () => {
  assert.deepEqual(staffRoleChoices(teacher, principal).roles, ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF']);
  assert.deepEqual(staffRoleChoices(teacher, vice).roles, ['TEACHER', 'KITCHEN_STAFF']);
});

test('Tài khoản bị vô hiệu hóa, Hiệu trưởng hoặc của chính mình thì khóa ô vai trò kèm lý do', () => {
  for (const account of [
    { ...teacher, status: 'INACTIVE' },
    { ...teacher, role: 'PRINCIPAL' },
    { ...teacher, userId: 1 },
  ]) {
    const { roles, lockedReason } = staffRoleChoices(account, principal);
    assert.deepEqual(roles, []);
    assert.ok(lockedReason);
  }
});

test('Cơ sở điền sẵn: cơ sở công tác của GV, nếu không có thì điểm trường đang được phân công', () => {
  assert.equal(staffEditCampusId(teacher), '3');
  assert.equal(staffEditCampusId({ role: 'KITCHEN_STAFF', activeAssignments: [{ campusId: 5 }] }), '5');
  assert.equal(staffEditCampusId({ role: 'KITCHEN_STAFF' }), '');
});

test('Đổi vai trò: bắt buộc cơ sở với mọi vai trò mới, email theo vai trò mới', () => {
  const form = { fullName: 'A', email: '', role: 'VICE_PRINCIPAL', workCampusId: '' };
  const e = validateStaffEdit(form, 'KITCHEN_STAFF');
  assert.ok(e.email);
  assert.ok(e.workCampusId);
  assert.deepEqual(validateStaffEdit({ ...form, role: 'KITCHEN_STAFF', workCampusId: '1' }, 'TEACHER'), {});
});

test('Body đổi vai trò gửi vai trò mới kèm điểm trường', () => {
  assert.deepEqual(toRoleChangePayload({ role: 'KITCHEN_STAFF', workCampusId: '4' }), {
    role: 'KITCHEN_STAFF',
    assignment: { campusId: '4' },
  });
});

test('Lưu hồ sơ trước khi đổi vai trò: theo vai trò cũ, GV giữ nguyên cơ sở công tác', () => {
  const form = { fullName: 'A', email: 'a@x.vn', role: 'KITCHEN_STAFF', workCampusId: '4' };
  assert.equal(toProfilePayload(form, 'TEACHER', 3).workCampusId, 3);
  // GV cũ chưa có cơ sở: BE bắt buộc gửi
  assert.equal(toProfilePayload(form, 'TEACHER', null).workCampusId, '4');
  // Vai trò cũ không phải GV: BE từ chối workCampusId
  assert.equal('workCampusId' in toProfilePayload({ ...form, role: 'TEACHER' }, 'KITCHEN_STAFF'), false);
});

const account = { fullName: 'Lan', email: 'lan@x.vn', role: 'TEACHER', campusNames: ['CS1'], duties: ['Dạy Mầm 1', 'Dạy Chồi 2'] };
const sameProfile = { fullName: 'Lan', email: 'lan@x.vn' };

test('Bảng trước / sau luôn có vai trò, cơ sở, phụ trách; PHT nhận điểm trường mới', () => {
  const rows = staffRoleChangeRows(account, { ...sameProfile, role: 'VICE_PRINCIPAL' }, 'CS2');
  assert.deepEqual(
    rows.map((r) => [r.label, r.before, r.after]),
    [
      ['Vai trò', 'Giáo viên', 'Phó hiệu trưởng'],
      ['Cơ sở công tác', 'CS1', 'CS2'],
      ['Đang phụ trách', 'Dạy Mầm 1, Dạy Chồi 2', 'Phụ trách CS2'],
    ],
  );
});

test('Phụ trách sau khi đổi: bếp theo điểm trường, giáo viên chưa có lớp', () => {
  const duty = (role) => staffRoleChangeRows(account, { ...sameProfile, role }, 'CS1')[2].after;
  assert.equal(duty('KITCHEN_STAFF'), 'Bếp tại CS1');
  assert.equal(duty('TEACHER'), 'Chưa có lớp');
});

test('Họ tên, email chỉ lên bảng khi có sửa; ô trống ghi rõ', () => {
  const blank = { fullName: 'Lan', email: '', role: 'KITCHEN_STAFF', campusNames: [], duties: [] };
  const rows = staffRoleChangeRows(blank, { fullName: 'Lan Anh', email: 'a@x.vn', role: 'TEACHER' }, 'CS1');
  assert.deepEqual(
    rows.slice(3).map((r) => [r.label, r.before, r.after]),
    [
      ['Họ tên', 'Lan', 'Lan Anh'],
      ['Email', 'Chưa có', 'a@x.vn'],
    ],
  );
  assert.equal(rows[1].before, 'Chưa có');
  assert.equal(rows[2].before, 'Chưa được phân công');
  // Email để trống ⇒ BE giữ email cũ, không phải thay đổi
  assert.equal(staffRoleChangeRows(account, { fullName: 'Lan', email: '', role: 'KITCHEN_STAFF' }, 'CS1').length, 3);
});
