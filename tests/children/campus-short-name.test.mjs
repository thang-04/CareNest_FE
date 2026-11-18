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
    // Trùng tên ngắn trong năm thì campusOptionLabel ghi kèm mã (BUG-48)
    assert.match(src, /\{c\.shortName \|\| c\.name\}|\{campusOptionLabel\(c, /);
  });
}

test('màn Điểm trường: menu có Xóa điểm trường và Gỡ PHT', () => {
  const src = readFileSync('src/pages/school-config/CampusListPage.jsx', 'utf8');
  assert.match(src, /label: 'Xóa điểm trường'/);
  assert.match(src, /label: `Gỡ PHT \$\{v\.fullName\}`/);
  assert.match(src, /<UnassignViceDialog/);
});

test('chi tiết điểm trường: nút Gỡ PHT dùng chung hộp xác nhận + API, chỉ HT và năm chưa kết thúc', () => {
  const page = readFileSync('src/pages/school-config/CampusDetailPage.jsx', 'utf8');
  assert.match(page, /canAssignVicePrincipal\(user\) &&\s*!yearReadOnly/);
  assert.match(page, /<UnassignViceDialog/);
  const dialog = readFileSync('src/components/school-config/UnassignViceDialog.jsx', 'utf8');
  assert.match(dialog, /saveViceAssignment\(schoolYear, target\.vp\.id, \{ campusId: null \}, user\)/);
});

test('BUG-48: hai điểm trường trùng tên ngắn thì nhãn ghi kèm mã', async () => {
  const { campusOptionLabel } = await import('@/utils/campusLabel');
  const list = [
    { id: 1, code: 'CS-A', name: 'Cơ sở Một', shortName: 'Cơ sở 1' },
    { id: 3, code: 'CS-C', name: 'Cơ sở Ba', shortName: 'Cơ sở 1' },
    { id: 2, code: 'CS-B', name: 'Cơ sở Hai', shortName: 'Cơ sở 2' },
  ];
  assert.equal(campusOptionLabel(list[0], list), 'CS-A – Cơ sở 1');
  assert.equal(campusOptionLabel(list[1], list), 'CS-C – Cơ sở 1');
  assert.equal(campusOptionLabel(list[2], list), 'Cơ sở 2');
});
