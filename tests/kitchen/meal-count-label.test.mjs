import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { MEAL_COUNT_TITLE } from '@/models/attendance/attendanceConstants';

const findItem = (entries, to) => entries.flatMap((entry) => [entry, ...(entry.children || [])]).find((item) => item.to === to);

test('AC-10: mục menu Sổ suất ăn dùng cùng tên với tiêu đề, breadcrumb của màn', () => {
  const item = findItem(getMenuForRole(ROLES.PRINCIPAL), '/attendance/meal-count');
  assert.equal(item?.label, MEAL_COUNT_TITLE);
  const page = readFileSync('src/pages/attendance/MealCountPage.jsx', 'utf8');
  assert.match(page, /attendanceCrumbs\(MEAL_COUNT_TITLE/);
  assert.match(page, /page__title">\{kitchen \? `\$\{MEAL_COUNT_TITLE\}/);
});

test('AC-10: không còn tên cũ "Sổ báo ăn" trên giao diện', () => {
  const files = [
    'src/pages/attendance/MealCountPage.jsx',
    'src/components/attendance/MealRegisterCard.jsx',
    'src/components/attendance/DayLockAlert.jsx',
    'src/pages/attendance/AttendanceSummaryPage.jsx',
    'src/pages/kitchen/ConfirmedMealCountPage.jsx',
    'src/pages/dashboard/VicePrincipalDashboard.jsx',
    'src/utils/kitchen/breadcrumbs.js',
    'src/services/http/beErrorMessages.js',
  ];
  files.forEach((file) => assert.ok(!/sổ báo ăn/i.test(readFileSync(file, 'utf8')), file));
});

test('AC-10: điểm danh giáo viên chỉ còn một nút lưu chính', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  assert.ok(!page.includes('Lưu trẻ đang chọn'));
  assert.equal(page.match(/<Save size=\{16\} \/> Lưu điểm danh/g)?.length, 1);
});
