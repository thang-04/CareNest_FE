import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LEAVE_PART, sessionsAfterLeave } from '../../src/models/attendance/attendanceConstants.js';
import { validateCutoff } from '../../src/utils/school-config/schoolConfigValidation.js';
import { validateAttendanceEntry } from '../../src/utils/attendance/attendanceValidation.js';
import { reconcileAttendanceDraft } from '../../src/utils/attendance/reconcileAttendance.js';

// ATT-12 (BE): buổi sáng = Phụ sáng + Trưa, buổi chiều = Xế
test('nghỉ một buổi: chỉ còn bữa của buổi còn học', () => {
  const sessions = ['MORNING', 'LUNCH', 'AFTERNOON'];
  assert.deepEqual(sessionsAfterLeave(LEAVE_PART.AFTERNOON, sessions), ['MORNING', 'LUNCH']);
  assert.deepEqual(sessionsAfterLeave(LEAVE_PART.MORNING, sessions), ['AFTERNOON']);
  assert.deepEqual(sessionsAfterLeave(undefined, sessions), sessions);
});

// ATT-13: giờ đến muộn nhất buổi chiều phải sau giờ chốt (lỗi theo ô như BE DailyScheduleRules)
test('cấu hình giờ: giờ đến muộn nhất buổi chiều phải sau giờ chốt', () => {
  const year = { name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };
  const base = { time: '08:30', effectiveFrom: '2026-11-19', note: '' };
  assert.equal(validateCutoff({ ...base, latestAfternoonArrival: '14:00' }, year).latestAfternoonArrival, undefined);
  assert.match(
    validateCutoff({ ...base, latestAfternoonArrival: '08:00' }, year).latestAfternoonArrival,
    /Giờ đến muộn nhất buổi chiều phải sau Giờ chốt \(08:30\)/,
  );
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
    fullDayPickupFrom: '15:00',
    pickupEnd: '17:00',
    afternoonEnd: '17:00',
  };
  assert.equal(Object.keys(validateCutoff(base, year)).length, 0);
  assert.match(
    validateCutoff({ ...base, fullDayPickupFrom: '13:00' }, year).fullDayPickupFrom,
    /Mốc tính đủ ngày phải sau Bắt đầu chiều \(13:30\)/,
  );
});

test('điểm danh: trẻ nghỉ sáng có nút Đã đến, trẻ nghỉ chiều khóa bữa xế', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  assert.match(page, /markArrived\(\{ classId, childId: row\.child\.id, date \}, user\)/);
  assert.match(page, /Xế: nghỉ chiều/);
  assert.match(page, /halfPart\(row\) === LEAVE_PART\.MORNING && !reopened/);
  assert.match(page, /Sáng vắng không phép · chiều có mặt/);
  assert.match(page, /isMorningUnexcused\(row\)/);
  assert.match(page, /day\.now >= \(sheet\.afternoonStart \|\| '13:30'\)/);
  assert.match(page, /day\.now < \(sheet\.latestAfternoonArrival \|\| '14:00'\)/);
  // Trước giờ chốt: trẻ nghỉ sáng chỉ gạt bữa xế
  assert.match(page, /label=\{`Ăn bữa xế: \$\{row\.child\.fullName\}`\}/);
});

test('trẻ nghỉ sáng chưa đến vẫn được bật bữa xế; trẻ vắng thường thì không', () => {
  const sessions = ['LUNCH', 'AFTERNOON'];
  assert.deepEqual(validateAttendanceEntry({ status: 'EXCUSED', absentPart: 'MORNING', meals: { AFTERNOON: true } }, { sessions }), {});
  assert.ok(validateAttendanceEntry({ status: 'UNEXCUSED', meals: { AFTERNOON: true } }, { sessions }).meals);
});

// ATT-08 (user chốt 26/11/2026): ngày mở lại chọn Cả ngày / Chỉ sáng / Chỉ chiều; đơn cả ngày vẫn ghi được trẻ đến
test('điểm danh mở lại: chọn buổi một lần bấm, gửi presentPart, đơn cả ngày ghi được Có mặt', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  const api = readFileSync('src/services/attendance/api/attendanceApi.js', 'utf8');
  const mock = readFileSync('src/services/attendance/mock/attendanceMockRepository.js', 'utf8');
  assert.match(page, /label: 'Cả ngày'/);
  assert.match(page, /label: 'Chỉ sáng'/);
  assert.match(page, /label: 'Chỉ chiều'/);
  assert.match(page, /<SelectField/);
  assert.match(page, /label: `Có mặt · \$\{part\.label\}`/);
  assert.match(page, /if \(part === 'ABSENT'\) setStatus\(row, false\);/);
  assert.match(page, /Đến dù có đơn nghỉ/);
  assert.match(page, /Không có suất xế/);
  // Trẻ đã lưu Vắng vẫn chọn lại được khi bảng còn mở; đơn cả ngày chỉ khóa khi chưa mở lại
  assert.match(page, /\{editable && !leaveLocked\(row\) \? \(/);
  assert.match(page, /\(leavePart\(row\) === LEAVE_PART\.FULL_DAY \|\| leavePart\(row\) === LEAVE_PART\.MORNING\) &&\s+!reopened/);
  assert.match(api, /\(\{ childId, status, meals, presentPart \}\) => \(\{ childId, status, meals, presentPart \}\)/);
  assert.match(mock, /e\.presentPart && \(!info\.unlock \|\| e\.status !== ATTENDANCE_STATUS\.PRESENT\)/);
});

test('làm mới nền giữ nháp chọn buổi của trẻ có đơn nghỉ khi đơn không đổi', () => {
  const leave = { id: 9, part: 'FULL_DAY' };
  const sheet = {
    mealSessions: ['LUNCH'],
    children: [{ child: { id: 1 }, leaveRequest: leave, record: { status: 'EXCUSED', meals: {} } }],
  };
  const draft = { 1: { childId: 1, status: 'PRESENT', presentPart: 'FULL_DAY', meals: { LUNCH: true } } };
  assert.equal(reconcileAttendanceDraft(draft, sheet, sheet)[1].presentPart, 'FULL_DAY');
  // Đơn đổi (hủy / gửi mới) ⇒ bỏ nháp, lấy theo sheet mới
  const changedLeave = { ...sheet, children: [{ ...sheet.children[0], leaveRequest: { id: 10, part: 'FULL_DAY' } }] };
  assert.equal(reconcileAttendanceDraft(draft, sheet, changedLeave)[1].status, 'EXCUSED');
});

test('after cutoff: attendance reopening preserves meals and meal correction uses its dedicated API', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  const api = readFileSync('src/services/attendance/api/attendanceApi.js', 'utf8');
  const mock = readFileSync('src/services/attendance/mock/attendanceMockRepository.js', 'utf8');
  assert.match(page, /meals: current\?\.meals \|\| noneIn/);
  assert.match(page, /correctMealParticipation\(\{ classId, childId: row\.child\.id, date, participates \}, user\)/);
  assert.match(page, /editable && !day\?\.baseLocked && !leaveLocked\(row\)/);
  assert.match(page, /editable && day\?\.baseLocked && date === day\?\.today && !leaveLocked\(row\)/);
  assert.match(api, /attendance\/children\/\$\{childId\}\/meal-participation/);
  assert.match(mock, /async correctMealParticipation/);
  assert.match(mock, /count\.status === MEAL_COUNT_STATUS\.CONFIRMED/);
});
