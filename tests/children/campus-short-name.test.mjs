import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Cần chốt 10–11/11/2026: mọi ô chọn điểm trường hiện tên ngắn ("Cơ sở 1"), thiếu tên ngắn mới dùng tên đầy đủ
const pickers = [
  'src/pages/school-config/RoomListPage.jsx',
  'src/pages/attendance/AttendanceSummaryPage.jsx',
  'src/pages/dashboard/PendingApprovalsPage.jsx',
  'src/components/school-config/ClassListSection.jsx',
];
for (const file of pickers) {
  test(`ô chọn điểm trường dùng tên ngắn: ${file}`, () => {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /\{c\.shortName \|\| c\.name\}/);
  });
}

test('màn Điểm trường: menu có Xóa điểm trường và Gỡ PHT', () => {
  const src = readFileSync('src/pages/school-config/CampusListPage.jsx', 'utf8');
  assert.match(src, /label: 'Xóa điểm trường'/);
  assert.match(src, /label: `Gỡ PHT \$\{v\.fullName\}`/);
  assert.match(src, /saveViceAssignment\(schoolYear, unassigning\.vp\.id, \{ campusId: null \}, user\)/);
});
