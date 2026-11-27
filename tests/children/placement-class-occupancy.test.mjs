import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classFullness } from '@/utils/children/placementClasses';

/*
 * G94-180/CHD-14 (mục 10, 16): thẻ lớp hiện trẻ hẹn vào và khóa lớp đã đủ từ ngày chọn; số do BE trả (occupiedCount).
 */
const read = (f) => readFileSync(f, 'utf8');

test('classFullness chỉ so số BE trả', () => {
  assert.deepEqual(classFullness({ capacity: 25, enrolledCount: 24, occupiedCount: 25 }), { arriving: 1, full: true });
  assert.deepEqual(classFullness({ capacity: 25, enrolledCount: 24, occupiedCount: 24 }), { arriving: 0, full: false });
  assert.deepEqual(classFullness({ capacity: null, enrolledCount: 3, occupiedCount: 9 }), { arriving: 6, full: false });
  assert.deepEqual(classFullness({ capacity: 25, enrolledCount: 10 }), { arriving: 0, full: false });
});

test('thẻ lớp hiện trẻ sắp vào và khóa lớp đã đủ', () => {
  const src = read('src/components/children/ClassPlacementFields.jsx');
  assert.match(src, /Đã đủ/);
  assert.match(src, /\+\$\{arriving\} trẻ sắp vào/);
  assert.match(src, /classFullness\(c\)/);
  assert.match(src, /disabled=\{isDisabled\}/);
});

test('gửi from, childId và đọc lại khi đổi ngày', () => {
  assert.match(read('src/hooks/children/useChildRecords.js'), /usePlacementClasses\(schoolYearId, \{ from, childId \} = \{\}\)/);
  assert.match(
    read('src/pages/children/ClassPlacementPage.jsx'),
    /usePlacementClasses\(undefined, \{ from: effectiveDate, childId: selected\?\.id \}\)/,
  );
  assert.match(read('src/pages/children/EnrollChildPage.jsx'), /usePlacementClasses\(intakeYear\?\.id, \{ from: startDate \}\)/);
  assert.match(read('src/services/children/mock/childrenMockRepository.js'), /occupiedCount/);
});

test('Không xếp lớp từ ngày nghỉ đã hẹn', async () => {
  const { placementDateError } = await import('@/utils/children/startDate');
  const options = { scheduledLeaveOn: '2026-11-30' };
  assert.equal(placementDateError('2026-11-27', options), '');
  assert.equal(placementDateError('2026-11-30', options), 'Trẻ nghỉ học từ 30/11/2026. Hủy lịch nghỉ trước khi xếp lớp từ ngày này');
  const page = read('src/pages/children/ClassPlacementPage.jsx');
  assert.match(page, /Nghỉ từ \{formatDate\(c.scheduledLeaveOn\)/);
  assert.match(page, /addDays\(selected.scheduledLeaveOn, -1\)/);
});
