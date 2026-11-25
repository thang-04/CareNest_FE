import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attendanceText,
  dayRange,
  historyChildren,
  historyOfDate,
  recordedText,
  stayText,
  weekRange,
  weeklyCommentsOf,
} from '@/utils/assessment/transferredHistory';

const child = {
  childId: '1',
  childName: 'Bé A',
  stays: [{ classId: '9', className: 'Mầm 1', from: '2026-09-01', to: '2026-10-15' }],
  days: [{ day: { date: '2026-10-14', className: 'Mầm 1' }, recordedByName: 'Cô B', recordedAt: '2026-10-14T02:30:00Z' }],
  attendance: [
    { date: '2026-10-14', status: 'PRESENT', absentPart: 'MORNING' },
    { date: '2026-10-13', status: 'EXCUSED', absentPart: null },
  ],
  health: [{ date: '2026-10-14', temperature: 37.2, symptoms: ['COUGH'] }],
  weeklyComments: [
    { weekStart: '2026-10-12', content: 'Tuần tốt' },
    { weekStart: '2026-10-05', content: 'Tuần trước' },
  ],
};

test('khoảng xem: một ngày, hoặc thứ Hai..Chủ nhật của tuần', () => {
  assert.deepEqual(dayRange('2026-10-14'), { from: '2026-10-14', to: '2026-10-14' });
  assert.equal(dayRange(''), null);
  assert.deepEqual(weekRange('2026-10-12'), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(weekRange('2026-10-15'), { from: '2026-10-12', to: '2026-10-18' });
  assert.equal(weekRange(''), null);
});

test('chọn đúng mục của ngày / tuần, không lấy ngày khác', () => {
  const h = historyOfDate(child, '2026-10-14');
  assert.equal(h.day.recordedByName, 'Cô B');
  assert.equal(h.attendance.length, 1);
  assert.equal(h.health.length, 1);
  const empty = historyOfDate(child, '2026-10-16');
  assert.equal(empty.day, null);
  assert.deepEqual(empty.attendance, []);
  assert.deepEqual(
    weeklyCommentsOf(child, '2026-10-12').map((c) => c.content),
    ['Tuần tốt'],
  );
  assert.deepEqual(historyOfDate({}, '2026-10-14'), { day: null, attendance: [], health: [] });
});

test('nhãn: khoảng học lớp cũ, điểm danh nửa buổi, người ghi', () => {
  assert.equal(stayText(child.stays[0]), 'Học lớp Mầm 1 từ 01/09 đến 15/10');
  assert.equal(attendanceText(child.attendance[0]), 'Nghỉ sáng · buổi còn lại: có mặt');
  assert.equal(attendanceText({ status: 'UNEXCUSED', absentPart: 'AFTERNOON' }), 'Nghỉ chiều · buổi còn lại: vắng không phép');
  assert.equal(attendanceText(child.attendance[1]), 'Vắng có phép');
  assert.equal(recordedText({ className: 'Mầm 1', name: 'Cô B' }), 'Lớp Mầm 1, người ghi Cô B');
  assert.equal(recordedText({ name: 'Cô C', nameLabel: 'người gửi' }), 'người gửi Cô C');
  assert.equal(recordedText({}), '');
});

test('BE không trả trẻ ⇒ danh sách rỗng (màn không hiện khung)', () => {
  assert.deepEqual(historyChildren(null), []);
  assert.deepEqual(historyChildren({ children: [] }), []);
  assert.equal(historyChildren({ children: [child] }).length, 1);
});
