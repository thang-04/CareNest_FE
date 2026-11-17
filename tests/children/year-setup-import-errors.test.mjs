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
