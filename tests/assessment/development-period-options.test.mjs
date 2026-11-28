import test from 'node:test';
import assert from 'node:assert/strict';

const { periodOptions } = await import('@/utils/assessment/assessmentPeriods');

test('chưa có năm học thật thì không có kỳ (không đoán khoảng)', () => {
  assert.deepEqual(periodOptions('YEAR', '', undefined, '2026-11-22'), []);
  assert.deepEqual(periodOptions('YEAR', '49', undefined, '2026-11-22'), []);
  assert.deepEqual(periodOptions('SEMESTER', '', undefined, '2026-11-22'), []);
  assert.deepEqual(periodOptions('WEEK', 'abc', undefined, '2026-11-22'), []);
});

test('năm học hợp lệ (mock theo nhãn) thì có kỳ', () => {
  const opts = periodOptions('YEAR', '2026-2027', undefined, '2026-11-22');
  assert.deepEqual(opts, [{ start: '2026-09-01', end: '2027-05-31', label: 'Năm học 2026 – 2027' }]);
  // Học kỳ I (đã bắt đầu) và II (chưa bắt đầu không hiện)
  const semesters = periodOptions('SEMESTER', '2026-2027', undefined, '2026-11-22');
  assert.deepEqual(
    semesters.map((o) => o.label),
    ['Học kỳ I'],
  );
});

test('năm học thật (Cấu hình thời gian) ưu tiên hơn nhãn', () => {
  const year = {
    startDate: '2026-09-05',
    endDate: '2027-05-28',
    semester1Start: '2026-09-05',
    semester1End: '2027-01-15',
    semester2Start: '2027-01-18',
    semester2End: '2027-05-28',
  };
  const opts = periodOptions('YEAR', '', year, '2026-11-22');
  assert.equal(opts.length, 1);
  assert.equal(opts[0].start, '2026-09-05');
  assert.equal(opts[0].end, '2027-05-28');
  // Chỉ kỳ đã bắt đầu, mới nhất trước
  assert.deepEqual(
    periodOptions('SEMESTER', '', year, '2026-11-22').map((o) => [o.start, o.end]),
    [['2026-09-05', '2027-01-15']],
  );
  assert.deepEqual(
    periodOptions('SEMESTER', '', year, '2027-02-01').map((o) => o.label),
    ['Học kỳ II', 'Học kỳ I'],
  );
});
