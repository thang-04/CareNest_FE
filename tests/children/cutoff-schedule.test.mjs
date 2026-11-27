import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCutoffSchedule } from '../../src/utils/school-config/cutoffSchedule.js';
import { cutoffTimingError } from '../../src/utils/school-config/schoolConfigValidation.js';

// Lịch sử mới lưu đứng trước (như BE). Giờ đã hẹn ngày nào thì tới ngày đó áp dụng
const history = [
  { time: '08:45', effectiveFrom: '2026-11-29' },
  { time: '09:00', effectiveFrom: '2026-12-01' },
  { time: '08:30', effectiveFrom: '2026-09-01' },
];

test('giờ đang áp dụng và các lịch hẹn tách theo ngày, lưu sau không che lịch hẹn', () => {
  const { current, upcoming } = splitCutoffSchedule(history, '2026-11-29');
  assert.equal(current.time, '08:45');
  assert.deepEqual(
    upcoming.map((h) => [h.effectiveFrom, h.time]),
    [['2026-12-01', '09:00']],
  );
});

test('lịch hẹn xếp theo ngày; cùng ngày lấy bản lưu sau', () => {
  const rows = [{ time: '08:50', effectiveFrom: '2026-12-01' }, ...history];
  const { current, upcoming } = splitCutoffSchedule(rows, '2026-11-28');
  assert.equal(current.time, '08:30');
  assert.deepEqual(
    upcoming.map((h) => h.time),
    ['08:45', '08:50'],
  );
});

test('năm chưa bắt đầu: chưa có giờ đang áp dụng, chỉ có lịch sắp áp dụng', () => {
  const { current, upcoming } = splitCutoffSchedule([{ time: '08:30', effectiveFrom: '2027-09-01' }], '2026-11-28');
  assert.equal(current, null);
  assert.equal(upcoming.length, 1);
});

const year = { name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };

test('lần đặt đầu tiên phải áp dụng từ đầu năm học', () => {
  const form = { time: '08:30', effectiveFrom: '2026-10-01' };
  assert.match(cutoffTimingError(form, year, { hasSetting: false }), /01\/09\/2026/);
  assert.equal(cutoffTimingError({ ...form, effectiveFrom: '2026-09-01' }, year, { hasSetting: false }), undefined);
});

test('không đổi giờ chốt giữa ngày: đã qua giờ cũ hoặc giờ mới thì phải hẹn từ ngày mai', () => {
  const context = { hasSetting: true, today: '2026-11-28', currentTime: '08:30' };
  const form = { time: '09:00', effectiveFrom: '2026-11-28' };
  assert.match(cutoffTimingError(form, year, { ...context, nowTime: '08:30' }), /ngày mai/);
  assert.equal(cutoffTimingError(form, year, { ...context, nowTime: '08:29' }), undefined);
  assert.equal(cutoffTimingError({ ...form, effectiveFrom: '2026-11-29' }, year, { ...context, nowTime: '10:00' }), undefined);
});
