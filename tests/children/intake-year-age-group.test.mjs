import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { suggestAgeGroupId } from '@/utils/children/childrenHelpers';

// A8 (user báo 2026-11-22): trẻ sinh 10/03/2026, đổi "Năm học tiếp nhận" ⇒ nhóm tuổi không tính lại theo năm mới,
// ô nhóm tuổi khóa ở "Tất cả nhóm tuổi" và danh sách hiện lớp của mọi nhóm.
const groups = [
  { id: 'ag-0', ageFromMonths: 3, ageToMonths: 13 },
  { id: 'ag-1', ageFromMonths: 13, ageToMonths: 25 },
  { id: 'ag-2', ageFromMonths: 25, ageToMonths: 36 },
];

test('trẻ sinh 10/03/2026: năm 2026-2027 thuộc nhóm 3–12 tháng, năm 2027-2028 thuộc nhóm 13–24 tháng', () => {
  assert.equal(suggestAgeGroupId('2026-03-10', '2026-09-01', groups), 'ag-0');
  assert.equal(suggestAgeGroupId('2026-03-10', '2027-09-01', groups), 'ag-1');
});

test('đổi năm tiếp nhận ⇒ nhóm tuổi tính lại khi nhóm tuổi của năm mới tải xong', () => {
  const page = readFileSync('src/pages/children/EnrollChildPage.jsx', 'utf8');
  assert.match(page, /const \{ ageGroups, loading: ageGroupsLoading \} = useClassOptions\(/);
  assert.match(
    page,
    /useEffect\(\(\) => \{[^}]*setAgeGroupId\(dobAgeGroupId\)[^}]*\}, \[[^\]]*ageGroupsLoading[^\]]*dobAgeGroupId[^\]]*\]\)/,
  );
});

test('câu báo nhóm tuổi chưa có lớp ghi "trong năm học <năm>", không thừa chữ "đang"', () => {
  const fields = readFileSync('src/components/children/ClassPlacementFields.jsx', 'utf8');
  assert.doesNotMatch(fields, /trong năm học đang\s*\{yearLabel\}/);
});
