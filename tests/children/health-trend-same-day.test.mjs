import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oneMeasurementPerDay } from '../../src/utils/children/healthTrend.js';

test('cùng ngày: giữ phiếu khám thay vì số đo kỳ cân đo', () => {
  const rows = [
    { id: 10, date: '2026-11-01', heightCm: 100 },
    { id: 9, date: '2026-11-01', heightCm: 101, exam: {}, examStatus: 'CONCLUDED' },
  ];
  assert.deepEqual(
    oneMeasurementPerDay(rows).map((m) => m.id),
    [9],
  );
});

test('cùng ngày cùng loại: giữ id lớn hơn', () => {
  const rows = [
    { id: 7, date: '2026-11-01' },
    { id: 5, date: '2026-11-01' },
  ];
  assert.deepEqual(
    oneMeasurementPerDay(rows).map((m) => m.id),
    [7],
  );
});

test('ngày khác nhau: giữ đủ, tăng dần', () => {
  const rows = [
    { id: 2, date: '2026-11-03' },
    { id: 1, date: '2026-11-01' },
    { id: 3, date: '2026-11-02' },
  ];
  assert.deepEqual(
    oneMeasurementPerDay(rows).map((m) => m.id),
    [1, 3, 2],
  );
});

test('HealthTrendPage dùng oneMeasurementPerDay', () => {
  assert.match(readFileSync('src/pages/children/HealthTrendPage.jsx', 'utf8'), /oneMeasurementPerDay\(/);
});
