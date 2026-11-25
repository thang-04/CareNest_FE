import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LEAVE_PART, sessionsAfterLeave } from '../../src/models/attendance/attendanceConstants.js';
import { validateCutoff } from '../../src/utils/school-config/schoolConfigValidation.js';
import { validateAttendanceEntry } from '../../src/utils/attendance/attendanceValidation.js';

// ATT-12 (BE): buổi sáng = Phụ sáng + Trưa, buổi chiều = Xế
test('nghỉ một buổi: chỉ còn bữa của buổi còn học', () => {
  const sessions = ['MORNING', 'LUNCH', 'AFTERNOON'];
  assert.deepEqual(sessionsAfterLeave(LEAVE_PART.AFTERNOON, sessions), ['MORNING', 'LUNCH']);
  assert.deepEqual(sessionsAfterLeave(LEAVE_PART.MORNING, sessions), ['AFTERNOON']);
  assert.deepEqual(sessionsAfterLeave(undefined, sessions), sessions);
});

// ATT-13 (BE CUTOFF_LATEST_ARRIVAL_INVALID): giờ đến muộn nhất buổi chiều phải sau giờ chốt
test('cấu hình giờ: giờ đến muộn nhất buổi chiều phải sau giờ chốt', () => {
  const year = { name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };
  const base = { time: '08:30', effectiveFrom: '2026-11-19', note: '' };
  assert.equal(validateCutoff({ ...base, latestAfternoonArrival: '14:00' }, year).latestAfternoonArrival, undefined);
  assert.match(validateCutoff({ ...base, latestAfternoonArrival: '08:00' }, year).latestAfternoonArrival, /sau giờ chốt 08:30/);
});

test('cấu hình giờ sinh hoạt phải theo đúng thứ tự và có mốc tính đủ ngày', () => {
  const year = { name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };
  const base = {
    time: '08:30',
    effectiveFrom: '2026-11-19',
    dropoffOpenFrom: '06:30',
    morningStart: '07:00',
    morningEnd: '11:00',
    afternoonStart: '13:30',
    pickupStart: '15:00',
    fullDayPickupFrom: '15:30',
    pickupEnd: '17:00',
    afternoonEnd: '17:00',
  };
  assert.equal(Object.keys(validateCutoff(base, year)).length, 0);
  assert.match(
    validateCutoff({ ...base, fullDayPickupFrom: '13:00' }, year).fullDayPickupFrom,
    /mở đón trẻ ≤ bắt đầu sáng < kết thúc sáng < bắt đầu chiều < bắt đầu trả trẻ ≤ mốc tính đủ ngày < kết thúc trả trẻ ≤ kết thúc chiều/,
  );
});

test('điểm danh: trẻ nghỉ sáng có nút Đã đến, trẻ nghỉ chiều khóa bữa xế', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  assert.match(page, /markArrived\(\{ classId, childId: row\.child\.id, date \}, user\)/);
  assert.match(page, /Xế: nghỉ chiều/);
  assert.match(page, /leavePart\(row\) === LEAVE_PART\.MORNING && !reopened/);
  // Trước giờ chốt: trẻ nghỉ sáng chỉ gạt bữa xế
  assert.match(page, /label=\{`Ăn bữa xế: \$\{row\.child\.fullName\}`\}/);
});

test('trẻ nghỉ sáng chưa đến vẫn được bật bữa xế; trẻ vắng thường thì không', () => {
  const sessions = ['LUNCH', 'AFTERNOON'];
  assert.deepEqual(validateAttendanceEntry({ status: 'EXCUSED', absentPart: 'MORNING', meals: { AFTERNOON: true } }, { sessions }), {});
  assert.ok(validateAttendanceEntry({ status: 'UNEXCUSED', meals: { AFTERNOON: true } }, { sessions }).meals);
});
