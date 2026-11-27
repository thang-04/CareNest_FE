import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevClock, devClockHeaders, devNow, DEV_TOOLS_ENABLED } from '../../src/utils/devClock.js';
import { isDayLocked, schoolNow } from '../../src/utils/attendance/attendanceTime.js';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};

const REAL = Date.parse('2026-11-15T03:00:00Z');

test('build không bật VITE_DEV_TOOLS: luôn giờ thật, không gửi header', () => {
  assert.equal(DEV_TOOLS_ENABLED, false);
  assert.deepEqual(devClockHeaders(), {});
  assert.ok(Math.abs(devNow().getTime() - Date.now()) < 1000);
});

test('tắt Dev Mode: setTo bị bỏ qua', () => {
  const clock = createDevClock({ enabled: false, storage: memoryStorage(), realNow: () => REAL });
  clock.setTo(new Date('2026-12-01T01:30:00Z'));
  assert.equal(clock.isActive(), false);
  assert.equal(clock.nowMs(), REAL);
});

test('bật Dev Mode: giờ giả lập chạy tiếp theo giờ thật và gửi X-Dev-Now', () => {
  let real = REAL;
  const storage = memoryStorage();
  const clock = createDevClock({ enabled: true, storage, realNow: () => real });
  clock.setTo(new Date('2026-12-01T01:30:00Z'));
  assert.equal(clock.isActive(), true);
  assert.equal(clock.now().toISOString(), '2026-12-01T01:30:00.000Z');
  real += 60_000;
  assert.equal(clock.now().toISOString(), '2026-12-01T01:31:00.000Z');
  assert.deepEqual(clock.headers(), { 'X-Dev-Now': '2026-12-01T01:31:00.000Z' });

  // Tải lại trang: đọc lại độ lệch đã lưu
  const reloaded = createDevClock({ enabled: true, storage, realNow: () => real });
  assert.equal(reloaded.now().toISOString(), '2026-12-01T01:31:00.000Z');

  reloaded.clear();
  assert.equal(reloaded.isActive(), false);
  assert.deepEqual(reloaded.headers(), {});
  assert.equal(createDevClock({ enabled: true, storage, realNow: () => real }).isActive(), false);
});

test('ba trường hợp khóa ngày điểm danh theo giờ giả lập (giờ trường)', () => {
  const cutoff = '09:00';
  const day = '2026-12-01';
  const at = (iso) => schoolNow(new Date(iso));
  assert.equal(isDayLocked(day, cutoff, at('2026-11-30T10:00:00+07:00')), false, 'chưa đến ngày');
  assert.equal(isDayLocked(day, cutoff, at('2026-12-01T08:59:00+07:00')), false, 'đang mở');
  assert.equal(isDayLocked(day, cutoff, at('2026-12-01T09:00:00+07:00')), true, 'quá giờ chốt');
});
