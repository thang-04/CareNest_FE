import test from 'node:test';
import assert from 'node:assert/strict';

const { semesterConfirmBlockedNote } = await import('@/utils/assessment/semesterConfirmReason');

test('nút Xác nhận bấm được thì không có lý do', () => {
  assert.equal(semesterConfirmBlockedNote(null), '');
  assert.equal(semesterConfirmBlockedNote(''), '');
});

test('lý do khóa khớp cờ confirmBlockedReason của BE', () => {
  assert.match(semesterConfirmBlockedNote('NOT_ENDED', { endDate: '2026-10-23' }), /Xác nhận được từ ngày kết thúc học kỳ 23\/10\/2026/);
  assert.equal(semesterConfirmBlockedNote('INCOMPLETE', { missing: 3 }), 'Bảng chưa có kết quả mục tiêu nào để xác nhận.');
  assert.equal(semesterConfirmBlockedNote('NOT_HOMEROOM'), 'Chỉ GV chủ nhiệm lớp xác nhận.');
  assert.equal(semesterConfirmBlockedNote('NO_PERMISSION'), 'Chưa có quyền ghi hoặc xác nhận đánh giá.');
  assert.equal(semesterConfirmBlockedNote('DEADLINE_LOCKED'), 'Quá hạn xác nhận, liên hệ PHT hoặc Hiệu trưởng để mở lại.');
  assert.equal(semesterConfirmBlockedNote('YEAR_NOT_ACTIVE'), 'Năm học đã đóng, không xác nhận được.');
  assert.equal(semesterConfirmBlockedNote('CONFIRMED'), 'Bảng đã được xác nhận.');
});

test('INCOMPLETE luôn dùng một câu (bảng chưa có kết quả nào)', () => {
  assert.equal(semesterConfirmBlockedNote('INCOMPLETE', {}), 'Bảng chưa có kết quả mục tiêu nào để xác nhận.');
});
