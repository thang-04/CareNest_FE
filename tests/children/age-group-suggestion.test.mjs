import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { suggestAgeGroupId } from '@/utils/children/childrenHelpers';
import { addMonthsIso, fullMonthsBetween } from '@/utils/children/childAge';

/*
 * G94-180/CHD-13 (nghiệp vụ chốt 2026-11-22): nhóm tuổi chỉ để gợi ý, tính tháng tròn từ ngày sinh tới ngày bắt đầu năm học như
 * bảng xếp lớp năm mới của BE (YearTransitionServiceImpl.fitsAgeGroup); trẻ vẫn xếp được lớp khác nhóm tuổi.
 */
const GROUPS = [
  { id: 'nt', ageFromMonths: 24, ageToMonths: 36 },
  { id: 'mgb', ageFromMonths: 36, ageToMonths: 48 },
  { id: 'mgn', ageFromMonths: 48, ageToMonths: 60 },
  { id: 'mgl', ageFromMonths: 60, ageToMonths: 72 },
];

test('tháng tròn như ChronoUnit.MONTHS.between, cộng tháng như LocalDate.plusMonths', () => {
  assert.equal(fullMonthsBetween('2024-09-05', '2027-09-01'), 35);
  assert.equal(fullMonthsBetween('2024-09-01', '2027-09-01'), 36);
  assert.equal(fullMonthsBetween('2024-01-31', '2024-02-29'), 0);
  assert.equal(addMonthsIso('2026-08-31', 3), '2026-11-30');
  assert.equal(addMonthsIso('2026-08-22', 3), '2026-11-22');
});

test('bé sinh 05/09/2024, năm bắt đầu 01/09/2027 ⇒ 35 tháng ⇒ Nhà trẻ (khớp BE); sinh 01/09/2024 ⇒ 36 tháng ⇒ Mẫu giáo bé', () => {
  assert.equal(suggestAgeGroupId('2024-09-05', '2027-09-01', GROUPS), 'nt');
  assert.equal(suggestAgeGroupId('2024-09-01', '2027-09-01', GROUPS), 'mgb');
});

test('cảnh báo vàng khi chọn lớp khác nhóm tuổi nói rõ vẫn xếp được', () => {
  const src = readFileSync('src/components/children/ClassPlacementFields.jsx', 'utf8');
  assert.match(src, /Theo tháng tuổi tại ngày bắt đầu năm học, trẻ thuộc nhóm/);
  assert.match(src, /Vẫn xếp được lớp\s+khác nhóm tuổi\./);
});
