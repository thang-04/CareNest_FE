import assert from 'node:assert/strict';
import { test } from 'node:test';

const { firstTeachingMonday, weekCount } = await import('@/models/education-plan/goalTable');
const { yearWeeks } = await import('@/models/education-plan/classPlan');

test('chủ đề bắt đầu Thứ 7 / Chủ nhật: tuần học đầu là Thứ Hai kế tiếp', () => {
  assert.equal(firstTeachingMonday('2098-09-07'), '2098-09-08'); // Chủ nhật
  assert.equal(firstTeachingMonday('2098-09-06'), '2098-09-08'); // Thứ 7
  assert.equal(firstTeachingMonday('2098-09-10'), '2098-09-08'); // Thứ 4 vẫn thuộc tuần đó
  // 07/09 (CN) → 25/09 (T5): 3 tuần học, không tính tuần 01/09
  assert.equal(weekCount({ start: '2098-09-07', end: '2098-09-25' }), 3);
});

test('lịch tuần cả năm dùng cùng cách tính với số tuần của chủ đề', () => {
  const plan = { themes: [{ id: 't1', name: 'Trường mầm non', start: '2098-09-07', end: '2098-09-25' }], breaks: [] };
  const weeks = yearWeeks(plan).filter((w) => w.type === 'week');
  assert.deepEqual(
    weeks.map((w) => w.start),
    ['2098-09-08', '2098-09-15', '2098-09-22'],
  );
});

const { themeScheduleIssue, isWholeWeekTheme } = await import('@/models/education-plan/goalTable');

// Tháng 9/2098: Thứ 2 là 08, 15, 22, 29; Thứ 6 là 12, 19, 26
const theme = { id: 't1', name: 'Trường mầm non', start: '2098-09-08', end: '2098-09-26' };

test('EDU-41: nghỉ một ngày thì tuần vẫn là tuần học, ghi ngày nghỉ; nghỉ trọn Thứ 2 → Thứ 6 mới bỏ tuần', () => {
  const oneDay = { themes: [theme], breaks: [{ label: 'Trung thu', start: '2098-09-17', end: '' }] };
  const weeks = yearWeeks(oneDay).filter((w) => w.type === 'week');
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks[1].offDays, [null, null, 'Trung thu', null, null]); // 17/09 là Thứ 4
  assert.equal(weekCount(theme, oneDay.breaks), 3);

  const wholeWeek = [{ label: 'Nghỉ', start: '2098-09-15', end: '2098-09-19' }];
  assert.equal(weekCount(theme, wholeWeek), 2);
  const rows = yearWeeks({ themes: [theme], breaks: wholeWeek });
  assert.deepEqual(
    rows.map((r) => `${r.type}:${r.no ?? r.label}`),
    ['week:1', 'break:Nghỉ', 'week:2'],
  );
});

test('EDU-39/40: chủ đề phải trọn tuần Thứ 2 → Thứ 6 và không trùng thời gian', () => {
  assert.equal(isWholeWeekTheme(theme), true);
  assert.equal(isWholeWeekTheme({ ...theme, start: '2098-09-07' }), false); // Chủ nhật
  assert.equal(themeScheduleIssue([theme, { id: 't2', name: 'Bản thân', start: '2098-09-29', end: '2098-10-17' }]), null);
  assert.match(themeScheduleIssue([{ ...theme, end: '2098-09-25' }]), /Thứ 2 và kết thúc vào Thứ 6/);
  assert.match(
    themeScheduleIssue([theme, { id: 't2', name: 'Bản thân', start: '2098-09-22', end: '2098-10-03' }]),
    /trùng thời gian/,
  );
  // Ngày còn trống (nháp) không báo lỗi lịch
  assert.equal(themeScheduleIssue([{ id: 't3', name: 'Gia đình', start: '', end: '' }]), null);
});
