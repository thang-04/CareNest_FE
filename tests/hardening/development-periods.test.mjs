import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentPeriods } from '../../src/utils/assessment/developmentPeriods.js';
const year = {
  startDate: '2026-09-05',
  endDate: '2027-05-15',
  semester1Start: '2026-09-05',
  semester1End: '2027-01-15',
  semester2Start: '2027-01-18',
  semester2End: '2027-05-15',
};
test('học kỳ dùng đúng cấu hình HT và không tự tách tại ngày 31/12', () => {
  assert.deepEqual(developmentPeriods('SEMESTER', year, '2026-11-23'), [{ start: '2026-09-05', end: '2027-01-15', label: 'Học kỳ I' }]);
  assert.equal(developmentPeriods('SEMESTER', { startDate: year.startDate, endDate: year.endDate }, '2026-11-23').length, 0);
});
test('kỳ tương lai và cấu hình thiếu ngày kết thúc không tạo truy vấn sai', () => {
  assert.equal(developmentPeriods('SEMESTER', { ...year, semester1End: null }, '2026-11-23').length, 0);
  assert.equal(developmentPeriods('YEAR', year, '2026-09-04').length, 0);
});
test('tháng và tuần đầu/cuối nằm trong mốc năm học thực tế', () => {
  const months = developmentPeriods('MONTH', year, '2027-06-01');
  assert.equal(months.at(-1).start, '2026-09-05');
  assert.equal(months[0].end, '2027-05-15');
  const weeks = developmentPeriods('WEEK', year, '2027-06-01');
  assert.ok(weeks.every((p) => p.start >= year.startDate && p.end <= year.endDate && p.start <= p.end));
});
