import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// BE V151 (Cần chốt 22/10/2026): điểm trường theo năm học; ô lọc của HT lấy đủ điểm trường của năm đang chọn
for (const file of [
  'src/pages/attendance/AttendanceSummaryPage.jsx',
  'src/pages/attendance/LeaveRequestsPage.jsx',
  'src/pages/attendance/MealCountPage.jsx',
  'src/pages/attendance/AttendanceDayUnlockPage.jsx',
  'src/pages/assessment/AssessmentDayUnlockPage.jsx',
  'src/pages/assessment/WeeklyCommentsPage.jsx',
]) {
  test(`ô lọc điểm trường lấy điểm trường của năm: ${file}`, () => {
    assert.match(readFileSync(file, 'utf8'), /useYearCampuses\(PERMISSIONS\.[A-Z_]+\)/);
  });
}

test('thêm / xóa điểm trường gửi năm học đang chọn', () => {
  const api = readFileSync('src/services/school-config/api/schoolConfigApi.js', 'utf8');
  assert.match(api, /axiosClient\.post\('\/campuses', form, \{ params: \{ schoolYearId: schoolYear \|\| undefined \} \}\)/);
  assert.match(api, /axiosClient\.delete\(`\/campuses\/\$\{id\}`, \{ params: \{ schoolYearId: schoolYear \|\| undefined \} \}\)/);
  const form = readFileSync('src/pages/school-config/CampusFormPage.jsx', 'utf8');
  assert.match(form, /deleteCampus\(campus\.id, user, schoolYear\)/);
});

test('Mở lại điểm danh: lọc điểm trường, đặt lại bộ lọc xóa cả điểm trường, năm không hoạt động chỉ xem', () => {
  const page = readFileSync('src/pages/attendance/AttendanceDayUnlockPage.jsx', 'utf8');
  assert.match(page, /const EMPTY_FILTERS = \{ campusId: '', classId: ''/);
  assert.match(page, /<CampusFilter[\s\S]*?campuses=\{campusOptions\}/);
  assert.match(page, /onClick=\{\(\) => setFilter\(\{ campusId: '', classId: ''/);
  assert.match(page, /disabled=\{busy \|\| !yearOpen/);
  assert.match(page, /yearClassIds\.has\(String\(item\.classId\)\)/);
});

test('Nhận xét tuần: lớp theo điểm trường đang chọn', () => {
  const page = readFileSync('src/pages/assessment/WeeklyCommentsPage.jsx', 'utf8');
  assert.match(page, /options=\{campusClasses\.map/);
});

test('Lọc thêm: đóng khi bấm ra ngoài hoặc Esc, trả focus về nút', () => {
  const src = readFileSync('src/components/ui/FilterMore.jsx', 'utf8');
  assert.match(src, /addEventListener\('pointerdown'/);
  assert.match(src, /!rootRef\.current\.contains\(e\.target\)/);
  assert.match(src, /e\.key !== 'Escape'/);
  assert.match(src, /summaryRef\.current\?\.focus\(\)/);
});

test('Sức khỏe trong ngày: ô điểm trường theo năm đang chọn, PHT nhiều điểm trường cũng lọc được', () => {
  const page = readFileSync('src/pages/attendance/DailyHealthOverviewPage.jsx', 'utf8');
  assert.match(page, /useYearCampuses\(PERMISSIONS\.ATTENDANCE_VIEW\)/);
  assert.match(page, /yearCampuses \? \{ \.\.\.baseMd, campuses: yearCampuses \} : baseMd/);
  assert.match(page, /user\?\.role === ROLES\.PRINCIPAL \|\| \(yearCampuses\?\.length \|\| 0\) > 1/);
});

test('Thiết lập năm học: chép ngày nghỉ lễ và giờ đến muộn nhất, báo số đợt nghỉ đã chép', async () => {
  const { COPY_PARTS, copySummary } = await import('@/utils/school-config/yearSetup');
  assert.ok(COPY_PARTS.some((p) => p.key === 'HOLIDAYS'));
  assert.match(COPY_PARTS.find((p) => p.key === 'CUTOFF').label, /giờ đến muộn nhất/);
  assert.equal(copySummary({ copiedClasses: [], holidays: 3 }), '3 đợt nghỉ lễ');
});

test('Cấu hình theo năm: lưu nhóm tuổi, phòng, trạng thái điểm trường gửi năm học đang chọn', () => {
  const api = readFileSync('src/services/school-config/api/schoolConfigApi.js', 'utf8');
  assert.match(api, /axiosClient\.put\(`\/age-groups\/\$\{id\}`, form, \{ params: \{ schoolYearId \} \}\)/);
  assert.match(api, /patch\(`\/campuses\/\$\{id\}\/status`, \{ status \}, \{ params: \{ schoolYearId \} \}\)/);
  const md = readFileSync('src/services/masterDataService.js', 'utf8');
  assert.match(md, /axiosClient\.put\(`\/locations\/\$\{id\}`, form, \{ params: \{ schoolYearId \} \}\)/);
});
