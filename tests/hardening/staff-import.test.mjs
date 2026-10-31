import assert from 'node:assert/strict';
import { test } from 'node:test';

const { STAFF_COLUMNS, matchStaffRows, normalizePhone, toCreatePayload, validateStaffAccount, staffExportRows } = await import(
  '@/utils/school-config/staffImport'
);

const campuses = [
  { id: '1', name: 'Cơ sở 1', shortName: 'CS1' },
  { id: '2', name: 'Cơ sở 2', shortName: 'CS2' },
];
const classes = [
  { id: '11', name: 'Mầm 1', campusId: '1' },
  { id: '21', name: 'Mầm 1', campusId: '2' },
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

test('form tạo: bắt buộc họ tên, SĐT, vai trò và điểm trường / lớp theo vai trò; email đúng định dạng', () => {
  const empty = validateStaffAccount({ role: 'TEACHER' }, { campuses, classes });
  assert.deepEqual(Object.keys(empty).sort(), ['classroomId', 'fullName', 'phone']);
  const vp = validateStaffAccount({ fullName: 'A', phone: '0912345678', email: 'x@', role: 'VICE_PRINCIPAL' }, { campuses, classes });
  assert.deepEqual(Object.keys(vp).sort(), ['campusId', 'email']);
  assert.deepEqual(
    validateStaffAccount({ fullName: 'A'.repeat(151), phone: '0912345678', role: 'KITCHEN_STAFF', campusId: '1' }, { campuses }),
    {
      fullName: 'Họ tên tối đa 150 ký tự',
    },
  );
});

test('payload POST /accounts: GV gắn lớp, PHT/bếp gắn điểm trường, SĐT chuẩn hóa, email trống thành null', () => {
  assert.deepEqual(toCreatePayload({ fullName: ' Lan ', phone: '+84912345678', email: '', role: 'TEACHER', classroomId: '11' }), {
    phone: '0912345678',
    fullName: 'Lan',
    email: null,
    role: 'TEACHER',
    assignment: { classroomId: '11' },
  });
  assert.deepEqual(toCreatePayload({ fullName: 'B', phone: '0912345679', role: 'KITCHEN_STAFF', campusId: '2' }).assignment, {
    campusId: '2',
  });
});

test('nhập Excel: dòng hợp lệ, lớp tìm theo điểm trường, lỗi từng dòng, trùng trong file và với hệ thống', () => {
  const rows = [
    STAFF_COLUMNS,
    ['Nguyễn Lan', '0912345678', 'lan@x.vn', 'Giáo viên', 'CS2', 'Mầm 1'],
    ['', '', '', '', '', ''],
    ['Trần B', '0912345678', '', 'Nhân viên bếp', 'CS1', ''],
    ['Lê C', '0987654321', 'old@x.vn', 'Phó hiệu trưởng', 'CS1', ''],
    ['Phạm D', '0911111111', '', 'Hiệu trưởng', 'CS9', ''],
    ['Đỗ E', '0922222222', '', 'Giáo viên', 'CS1', 'Lớp lạ'],
  ];
  const { items, errors } = matchStaffRows(rows, { campuses, classes, existing: [{ phone: '0900000000', email: 'old@x.vn' }] });
  assert.equal(items.length, 1);
  assert.equal(items[0].form.classroomId, '21');
  assert.deepEqual(
    errors.map((e) => e.row),
    [4, 5, 6, 7],
  );
  assert.match(errors[0].reason, /trùng trong file/);
  assert.match(errors[1].reason, /Email old@x.vn/);
  assert.match(errors[2].reason, /Vai trò "Hiệu trưởng"/);
  assert.match(errors[2].reason, /Không có điểm trường "CS9"/);
  assert.match(errors[3].reason, /Không có lớp "Lớp lạ"/);
});

test('nhập Excel: sai dòng tiêu đề hoặc thiếu sheet thì báo lỗi, không tạo gì', () => {
  assert.equal(matchStaffRows([['Tên', 'SĐT']], { campuses, classes }).errors[0].row, 1);
  assert.match(matchStaffRows(null, { campuses, classes }).errors[0].reason, /Thiếu sheet/);
});

test('xuất Excel cùng cột file mẫu, thêm trạng thái', () => {
  const [head, row] = staffExportRows([
    { fullName: 'A', phone: '0912345678', email: '', role: 'TEACHER', campusNames: ['CS1'], classNames: ['Mầm 1'], status: 'INACTIVE' },
  ]);
  assert.deepEqual(head, [...STAFF_COLUMNS, 'Trạng thái']);
  assert.deepEqual(row, ['A', '0912345678', '', 'Giáo viên', 'CS1', 'Mầm 1', 'Đã vô hiệu hóa']);
});
