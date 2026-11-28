import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROOM_LIST_COLUMNS, SHEETS, matchRoomClassRows } from '@/utils/school-config/yearSetupImport';

const source = (path) => readFileSync(path, 'utf8');

test('xuất màn Phòng ban rồi nhập lại không đổi gì thì không báo cập nhật, kể cả phòng học đang có người phụ trách', () => {
  const rooms = [{ id: 5, campusId: 1, type: 'CLASS', room: 'P101', name: 'Phòng 101', capacity: 25, managerUserId: 9, note: '' }];
  const sheet = [ROOM_LIST_COLUMNS, ['Cơ sở 1', 'P101', 'Phòng 101', 'Lớp học', 25, 'Lớp Mầm 1', 'Cô A', 'Đang dùng']];
  const result = matchRoomClassRows(
    { [SHEETS.rooms]: sheet },
    { campuses: [{ id: 1, name: 'Cơ sở 1' }], ageGroups: [], rooms, classes: [], schoolYear: '2026-2027', roomsOnly: true },
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rooms.length, 0);
  assert.equal(result.unchanged, 1);
});

test('tệp không đổi gì thì hộp nhập nói dữ liệu đã giống, không báo tệp trống', () => {
  const panel = source('src/components/school-config/YearSetupImportPanel.jsx');
  assert.match(panel, /result\.unchanged/);
  assert.match(panel, /giống dữ liệu hiện có/);
});

test('file xuất tài khoản nhân sự đặt đúng tên sheet mà màn nhập đọc', () => {
  assert.match(
    source('src/components/school-config/StaffAccountsBeView.jsx'),
    /exportWithPreview\(staffExportRows\(all\), [^;]*sheetName: STAFF_SHEET/,
  );
});

test('Excel đánh giá cuối chủ đề không lặp chữ "Lớp" trước tên lớp', () => {
  assert.doesNotMatch(source('src/pages/assessment/ThemeEvaluationPage.jsx'), /Lớp \$\{ev\.className\}/);
});

test('xếp loại nhóm lớp: cột "Tên lớp", kèm tên ngắn điểm trường', () => {
  const page = source('src/pages/assessment/ClassRatingsPage.jsx');
  assert.match(page, /headers: \['STT', 'Tên lớp',/);
  assert.match(page, /return c\?\.shortName \|\| c\?\.name \|\| '';/);
});
