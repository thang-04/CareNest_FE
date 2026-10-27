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
