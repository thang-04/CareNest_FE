import assert from 'node:assert/strict';
import { test } from 'node:test';

const { STAFF_COLUMNS, matchStaffRows, normalizePhone, toCreatePayload, validateStaffAccount, staffExportRows } = await import(
  '@/utils/school-config/staffImport'
);

const campuses = [
  { id: '1', name: 'Cơ sở 1', shortName: 'CS1' },
  { id: '2', name: 'Cơ sở 2', shortName: 'CS2' },
];

test('SĐT di động Việt Nam: chuẩn hóa +84, dấu cách, mất số 0 đầu; từ chối máy bàn và đầu số lạ', () => {
  assert.equal(normalizePhone('+84 912.345.678'), '0912345678');
  assert.equal(normalizePhone('84912345678'), '0912345678');
  assert.equal(normalizePhone('912345678'), '0912345678');
  assert.equal(normalizePhone('0355 123 456'), '0355123456');
  assert.equal(normalizePhone('02253123456'), '');
  assert.equal(normalizePhone('0123456789'), '');
  assert.equal(normalizePhone('09123'), '');
});

test('AUTH-15: form tạo bắt buộc họ tên, SĐT, vai trò, điểm trường; không còn chọn lớp; email đúng định dạng', () => {
  const empty = validateStaffAccount({ role: 'TEACHER' }, { campuses, teacherCampusRequired: true });
  assert.deepEqual(Object.keys(empty).sort(), ['campusId', 'fullName', 'phone']);
  const vp = validateStaffAccount({ fullName: 'A', phone: '0912345678', email: 'x@', role: 'VICE_PRINCIPAL' }, { campuses });
  assert.deepEqual(Object.keys(vp).sort(), ['campusId', 'email']);
  assert.deepEqual(
    validateStaffAccount({ fullName: 'A'.repeat(151), phone: '0912345678', role: 'KITCHEN_STAFF', campusId: '1' }, { campuses }),
    { fullName: 'Họ tên tối đa 150 ký tự' },
  );
  const unknown = validateStaffAccount({ fullName: 'A', phone: '0912345678', role: 'TEACHER', campusId: '9' }, { campuses });
  assert.equal(unknown.campusId, 'Điểm trường không tồn tại');
});

test('AUTH-15: Hiệu trưởng tạo GV được bỏ trống điểm trường; PHT, bếp vẫn bắt buộc', () => {
  const base = { fullName: 'A', phone: '0912345678' };
  assert.deepEqual(validateStaffAccount({ ...base, role: 'TEACHER' }, { campuses }), {});
  assert.ok(validateStaffAccount({ ...base, role: 'KITCHEN_STAFF' }, { campuses }).campusId);
  assert.ok(validateStaffAccount({ ...base, role: 'TEACHER' }, { campuses, teacherCampusRequired: true }).campusId);
});

test('AUTH-15: payload POST /accounts chỉ gửi điểm trường, không có classroomId; SĐT chuẩn hóa, email trống thành null', () => {
  const teacher = { fullName: ' Lan ', phone: '+84912345678', email: '', role: 'TEACHER', campusId: '1', classroomId: '11' };
  assert.deepEqual(toCreatePayload(teacher), {
    phone: '0912345678',
    fullName: 'Lan',
    email: null,
    role: 'TEACHER',
    assignment: { campusId: '1' },
  });
  assert.equal(toCreatePayload({ fullName: 'Lan', phone: '0912345678', role: 'TEACHER', campusId: '' }).assignment, null);
  assert.deepEqual(toCreatePayload({ fullName: 'B', phone: '0912345679', role: 'KITCHEN_STAFF', campusId: '2' }).assignment, {
    campusId: '2',
  });
});

test('nhập Excel: file mẫu không còn cột Lớp; dòng hợp lệ, lỗi từng dòng, trùng trong file và với hệ thống', () => {
  assert.deepEqual(STAFF_COLUMNS, ['Họ tên', 'Số điện thoại', 'Email', 'Vai trò', 'Điểm trường']);
  const rows = [
    STAFF_COLUMNS,
    ['Nguyễn Lan', '0912345678', 'lan@x.vn', 'Giáo viên', 'CS2'],
    ['', '', '', '', ''],
    ['Trần B', '0912345678', '', 'Nhân viên bếp', 'CS1'],
    ['Lê C', '0987654321', 'old@x.vn', 'Phó hiệu trưởng', 'CS1'],
    ['Phạm D', '0911111111', '', 'Hiệu trưởng', 'CS9'],
  ];
  const { items, errors, ignoredColumns } = matchStaffRows(rows, { campuses, existing: [{ phone: '0900000000', email: 'old@x.vn' }] });
  assert.equal(items.length, 1);
  assert.equal(items[0].form.campusId, '2');
  assert.equal(items[0].form.classroomId, undefined);
  assert.deepEqual(ignoredColumns, []);
  assert.deepEqual(
    errors.map((e) => e.row),
    [4, 5, 6],
  );
  assert.match(errors[0].reason, /trùng trong file/);
  assert.match(errors[1].reason, /Email old@x.vn/);
  assert.match(errors[2].reason, /Vai trò "Hiệu trưởng"/);
  assert.match(errors[2].reason, /Không có điểm trường "CS9"/);
});

test('AUTH-15: file mẫu cũ còn cột Lớp vẫn nhập được, cột Lớp bị bỏ qua và được báo lại', () => {
  const rows = [
    [...STAFF_COLUMNS, 'Lớp'],
    ['Nguyễn Lan', '0912345678', '', 'Giáo viên', 'CS1', 'Mầm 1'],
  ];
  const { items, errors, ignoredColumns } = matchStaffRows(rows, { campuses });
  assert.equal(errors.length, 0);
  assert.equal(items.length, 1);
  assert.deepEqual(ignoredColumns, ['Lớp']);
  assert.deepEqual(toCreatePayload(items[0].form).assignment, { campusId: '1' });
});

test('nhập Excel: GV không có điểm trường hợp lệ khi người nhập là Hiệu trưởng', () => {
  const rows = [STAFF_COLUMNS, ['Nguyễn Lan', '0912345678', '', 'Giáo viên', '']];
  assert.equal(matchStaffRows(rows, { campuses }).items.length, 1);
  assert.equal(matchStaffRows(rows, { campuses, teacherCampusRequired: true }).errors.length, 1);
});

test('nhập Excel: sai dòng tiêu đề hoặc thiếu sheet thì báo lỗi, không tạo gì', () => {
  assert.equal(matchStaffRows([['Tên', 'SĐT']], { campuses }).errors[0].row, 1);
  assert.match(matchStaffRows(null, { campuses }).errors[0].reason, /Thiếu sheet/);
});

test('xuất Excel: cột file mẫu trước, thêm lớp đang dạy và trạng thái', () => {
  const [head, row] = staffExportRows([
    { fullName: 'A', phone: '0912345678', email: '', role: 'TEACHER', campusNames: ['CS1'], classNames: ['Mầm 1'], status: 'INACTIVE' },
  ]);
  assert.deepEqual(head, [...STAFF_COLUMNS, 'Lớp đang dạy', 'Trạng thái']);
  assert.deepEqual(row, ['A', '0912345678', '', 'Giáo viên', 'CS1', 'Mầm 1', 'Đã vô hiệu hóa']);
});
