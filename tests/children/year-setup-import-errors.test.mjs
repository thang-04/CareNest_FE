import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CLASS_COLUMNS, ROOM_COLUMNS, SHEETS, matchRoomClassRows } from '@/utils/school-config/yearSetupImport';
import { LOCATION_TYPES } from '@/models/Location';

const campuses = [{ id: 'c1', name: 'Cơ sở 1', shortName: 'CS1', code: 'CS1' }];
const rooms = [{ id: 'r1', campusId: 'c1', room: 'P101', name: 'Phòng Hoa Mai', capacity: 30, type: LOCATION_TYPES.CLASS }];

// Bảng "Dòng lỗi (không lưu)": lý do nêu điểm trường và giá trị trong file để đối chiếu sửa tệp
test('phòng mới trùng tên phòng đã có ở cùng điểm trường: lỗi nêu điểm trường và tên phòng', () => {
  const sheets = {
    [SHEETS.rooms]: [
      ROOM_COLUMNS,
      ['CS1', 'P102', 'Phòng Hoa Mai', 25],
      ['CS1', 'P101', 'Phòng Hoa Mai', 31],
      ['CS1', 'P101', 'Phòng Hoa Mai', 28],
    ],
    [SHEETS.classes]: [CLASS_COLUMNS],
  };
  const { errors } = matchRoomClassRows(sheets, { campuses, ageGroups: [], rooms, classes: [], schoolYear: 'y1' });
  const reasons = errors.map((e) => e.reason);
  assert.ok(reasons.includes('CS1 đã có phòng tên "Phòng Hoa Mai"'), reasons.join(' | '));
  assert.ok(reasons.includes('Mã phòng "P101" bị lặp trong file'), reasons.join(' | '));
});

test('bảng lỗi dùng tiêu đề tiếng Việt, cột tên theo loại file', () => {
  const panel = readFileSync('src/components/school-config/YearSetupImportPanel.jsx', 'utf8');
  assert.ok(!panel.includes("'Sheet'"));
  assert.match(panel, /'Trang tính', 'Dòng', nameHead, 'Lý do'/);
  assert.match(panel, /isRooms \? 'Phòng \/ lớp' : 'Lớp \/ nhóm tuổi'/);
});

// Màn Phòng ban: nhập chỉ sheet Phòng; tệp xuất (4 cột mẫu + Loại phòng, Trạng thái) nhập lại được, giữ loại phòng
test('nhập phòng ở màn Phòng ban: không cần sheet Lớp, phòng đã có giữ loại phòng', () => {
  const office = { id: 'r2', campusId: 'c1', room: 'VP1', name: 'Văn phòng', capacity: 5, type: LOCATION_TYPES.DEPARTMENT };
  const sheets = {
    [SHEETS.rooms]: [
      [...ROOM_COLUMNS, 'Loại phòng', 'Người phụ trách', 'Trạng thái'],
      ['CS1', 'VP1', 'Văn phòng mới', 6, '', '', 'Đang dùng'],
      ['CS1', 'P201', 'Phòng Lan', 20, 'Lớp học', '', 'Đang dùng'],
    ],
  };
  const { rooms: out, errors } = matchRoomClassRows(sheets, {
    campuses,
    ageGroups: [],
    rooms: [...rooms, office],
    classes: [],
    schoolYear: 'y1',
    roomsOnly: true,
  });
  assert.deepEqual(errors, []);
  assert.equal(out.find((r) => r.form.room === 'VP1').form.type, office.type);
  assert.equal(out.find((r) => r.form.room === 'P201').form.type, LOCATION_TYPES.CLASS);
});

test('nhập phòng ở màn Phòng ban đọc cột Loại phòng; giá trị sai báo lỗi nêu giá trị', () => {
  const sheets = {
    [SHEETS.rooms]: [
      [...ROOM_COLUMNS, 'Loại phòng', 'Người phụ trách', 'Trạng thái'],
      ['CS1', 'B1', 'Bếp chính', 10, 'Bếp', '', 'Đang dùng'],
      ['CS1', 'X1', 'Phòng lạ', 10, 'abc', '', ''],
      ['CS1', 'P301', 'Phòng Đào', 20, '', '', ''],
    ],
  };
  const { rooms: out, errors } = matchRoomClassRows(sheets, {
    campuses,
    ageGroups: [],
    rooms,
    classes: [],
    schoolYear: 'y1',
    roomsOnly: true,
  });
  assert.equal(out.find((r) => r.form.room === 'B1').form.type, LOCATION_TYPES.KITCHEN);
  assert.equal(out.find((r) => r.form.room === 'P301').form.type, LOCATION_TYPES.CLASS);
  assert.deepEqual(
    errors.map((e) => e.reason),
    ['Loại phòng "abc" không hợp lệ'],
  );
});

test('người phụ trách bếp: nhân viên bếp, PHT của điểm trường hoặc Hiệu trưởng; không phải giáo viên', async () => {
  const { isRoomStaff } = await import('@/models/Location');
  const k = LOCATION_TYPES.KITCHEN;
  assert.ok(isRoomStaff({ role: 'KITCHEN_STAFF', campusId: 'c1' }, 'c1', k));
  assert.ok(isRoomStaff({ role: 'VICE_PRINCIPAL', campusId: 'c1' }, 'c1', k));
  assert.ok(isRoomStaff({ role: 'PRINCIPAL' }, 'c1', k));
  assert.ok(!isRoomStaff({ role: 'TEACHER', campusId: 'c1' }, 'c1', k));
  assert.ok(!isRoomStaff({ role: 'VICE_PRINCIPAL', campusId: 'c2' }, 'c1', k));
  assert.ok(!isRoomStaff({ role: 'KITCHEN_STAFF', campusId: 'c1', status: 'LOCKED' }, 'c1', k));
});

test('nhập phòng ở màn Phòng ban đọc Người phụ trách theo họ tên và kiểm quy tắc theo loại phòng', () => {
  const users = [
    { id: 'k1', fullName: 'Lê Bếp', role: 'KITCHEN_STAFF', campusId: 'c1' },
    { id: 't1', fullName: 'Trần Cô', role: 'TEACHER', campusId: 'c1' },
    { id: 't2', fullName: 'Ngô Hai', role: 'TEACHER', campusId: 'c1' },
    { id: 't3', fullName: 'Ngô Hai', role: 'TEACHER', campusId: 'c1' },
  ];
  const head = [...ROOM_COLUMNS, 'Loại phòng', 'Người phụ trách', 'Trạng thái'];
  const sheets = {
    [SHEETS.rooms]: [
      head,
      ['CS1', 'B1', 'Bếp chính', 10, 'Bếp', 'Lê Bếp', ''],
      ['CS1', 'B2', 'Bếp phụ', 10, 'Bếp', 'Trần Cô', ''],
      ['CS1', 'K1', 'Kho', 10, 'Kho', 'Không Ai', ''],
      ['CS1', 'K2', 'Kho 2', 10, 'Kho', 'Ngô Hai', ''],
      ['CS1', 'P401', 'Phòng Mai', 20, 'Lớp học', 'Trần Cô', ''],
    ],
  };
  const { rooms: out, errors } = matchRoomClassRows(sheets, {
    campuses,
    ageGroups: [],
    rooms,
    classes: [],
    schoolYear: 'y1',
    roomsOnly: true,
    users,
  });
  assert.equal(out.find((r) => r.form.room === 'B1').form.managerUserId, 'k1');
  assert.equal(out.find((r) => r.form.room === 'P401').form.managerUserId, '');
  const reasons = errors.map((e) => e.reason);
  assert.ok(reasons.includes('Trần Cô không được phụ trách bếp (chỉ nhân viên bếp, PHT của CS1 hoặc Hiệu trưởng)'), reasons.join(' | '));
  assert.ok(reasons.includes('Không có nhân sự "Không Ai"'), reasons.join(' | '));
  assert.ok(reasons.includes('Có 2 nhân sự tên "Ngô Hai", chọn trực tiếp trên màn hình'), reasons.join(' | '));
});

test('tệp xuất màn Phòng ban (cột như bảng trên màn) nhập lại được theo tên cột', async () => {
  const { ROOM_LIST_COLUMNS } = await import('@/utils/school-config/yearSetupImport');
  const users = [{ id: 'k1', fullName: 'Lê Bếp', role: 'KITCHEN_STAFF', campusId: 'c1' }];
  const sheets = {
    [SHEETS.rooms]: [
      ROOM_LIST_COLUMNS.map((c) => (c === 'Lớp' ? 'Lớp (2026-2027)' : c)),
      ['Cơ sở 1', 'B9', 'Bếp 9', 'Bếp', 12, '', 'Lê Bếp', 'Đang dùng'],
      ['Cơ sở 1', 'P909', 'Phòng 909', 'Lớp học', 22, 'Lá 1', 'GV A', 'Đang dùng'],
    ],
  };
  const { rooms: out, errors } = matchRoomClassRows(sheets, {
    campuses,
    ageGroups: [],
    rooms,
    classes: [],
    schoolYear: 'y1',
    roomsOnly: true,
    users,
  });
  assert.deepEqual(errors, []);
  const kitchen = out.find((r) => r.form.room === 'B9').form;
  assert.equal(kitchen.type, LOCATION_TYPES.KITCHEN);
  assert.equal(Number(kitchen.capacity), 12);
  assert.equal(kitchen.managerUserId, 'k1');
  assert.equal(out.find((r) => r.form.room === 'P909').form.type, LOCATION_TYPES.CLASS);
});
