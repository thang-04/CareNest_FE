import assert from 'node:assert/strict';
import { test } from 'node:test';
import { monthOfWeek } from '@/utils/assessment/assessmentPeriods';

// OBS-10 (Cần chốt 18/11/2026): phiếu tuần phát thứ Sáu nên tuần vắt hai tháng thuộc tháng chứa thứ Sáu
test('tuần vắt hai tháng thuộc tháng chứa thứ Sáu', () => {
  assert.equal(monthOfWeek('2027-03-29'), '2027-04-01');
  assert.equal(monthOfWeek('2027-03-22'), '2027-03-01');
  assert.equal(monthOfWeek('2027-03-01'), '2027-03-01');
});
