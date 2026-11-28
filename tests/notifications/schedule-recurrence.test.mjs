import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  daysOf,
  scheduleFieldErrors,
  scheduleFromInitial,
  schedulePayload,
  scheduleRangeLabel,
  scheduleRepeatLabel,
} from '../../src/utils/announcement/scheduleRecurrence.mjs';

test('nhãn lặp: mỗi ngày, nhiều thứ, cách tuần, hằng tháng, và lịch cũ chỉ có dayOfWeek', () => {
  assert.equal(scheduleRepeatLabel({ frequency: 'DAILY' }), 'Mỗi ngày');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [5, 1, 3], intervalWeeks: 1 }), 'Thứ 2, 4, 6 hằng tuần');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [1], intervalWeeks: 2 }), 'Mỗi 2 tuần: Thứ 2');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [2, 7] }), 'Thứ 3 và Chủ nhật hằng tuần');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [7] }), 'Chủ nhật hằng tuần');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [1, 2, 3, 4, 5, 6, 7] }), 'Mọi ngày trong tuần hằng tuần');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', dayOfWeek: 4 }), 'Thứ 5 hằng tuần');
  assert.equal(scheduleRepeatLabel({ frequency: 'MONTHLY', dayOfMonth: 31 }), 'Ngày 31 hằng tháng');
  assert.equal(scheduleRepeatLabel({ frequency: 'MONTHLY' }), 'Chưa chọn ngày trong tháng');
  assert.equal(scheduleRepeatLabel({ frequency: 'WEEKLY', daysOfWeek: [] }), 'Chưa chọn thứ trong tuần');
});

test('khoảng ngày bằng chữ dd/mm/yyyy, rỗng khi không đặt', () => {
  assert.equal(scheduleRangeLabel({ startDate: '2026-11-16', endDate: '2027-01-31' }), 'Từ 16/11/2026 đến 31/01/2027');
  assert.equal(scheduleRangeLabel({ startDate: '2026-11-16' }), 'Từ 16/11/2026');
  assert.equal(scheduleRangeLabel({ endDate: '2027-01-31' }), 'Đến 31/01/2027');
  assert.equal(scheduleRangeLabel({}), '');
});

test('lịch mới mặc định hằng tuần Thứ Hai 08:00 bật; lịch cũ chỉ có dayOfWeek hiện đúng một thứ', () => {
  assert.deepEqual(scheduleFromInitial(null), {
    frequency: 'WEEKLY',
    daysOfWeek: [1],
    intervalWeeks: 1,
    dayOfMonth: '',
    sendTime: '08:00',
    startDate: '',
    endDate: '',
    active: true,
  });
  const legacy = scheduleFromInitial({ frequency: 'WEEKLY', dayOfWeek: 4, sendTime: '07:30:00', active: false });
  assert.deepEqual(legacy.daysOfWeek, [4]);
  assert.equal(legacy.sendTime, '07:30');
  assert.equal(legacy.active, false);
  assert.deepEqual(daysOf({ daysOfWeek: [3, 1, 3, 9, 0], dayOfWeek: 5 }), [1, 3]);
});

test('dữ liệu gửi BE chỉ mang trường của kiểu đã chọn, ngày trống là null, dayOfWeek cũ không gửi nữa', () => {
  const base = {
    frequency: 'DAILY',
    daysOfWeek: [1, 3],
    intervalWeeks: 2,
    dayOfMonth: 5,
    sendTime: '08:00',
    startDate: '',
    endDate: '',
    active: true,
  };
  assert.deepEqual(schedulePayload(base), {
    frequency: 'DAILY',
    daysOfWeek: null,
    intervalWeeks: null,
    dayOfWeek: null,
    dayOfMonth: null,
    sendTime: '08:00',
    startDate: null,
    endDate: null,
    active: true,
  });
  assert.deepEqual(
    schedulePayload({
      ...base,
      frequency: 'WEEKLY',
      daysOfWeek: [5, 1, 3],
      intervalWeeks: '2',
      startDate: '2026-11-16',
      endDate: '2027-01-31',
    }),
    {
      frequency: 'WEEKLY',
      daysOfWeek: [1, 3, 5],
      intervalWeeks: 2,
      dayOfWeek: null,
      dayOfMonth: null,
      sendTime: '08:00',
      startDate: '2026-11-16',
      endDate: '2027-01-31',
      active: true,
    },
  );
  const monthly = schedulePayload({ ...base, frequency: 'MONTHLY', dayOfMonth: '31' });
  assert.equal(monthly.dayOfMonth, 31);
  assert.equal(monthly.daysOfWeek, null);
});

test('kiểm ô nhập gợi ý lỗi theo đúng tên trường BE', () => {
  const ok = {
    frequency: 'WEEKLY',
    daysOfWeek: [1],
    intervalWeeks: 1,
    dayOfMonth: '',
    sendTime: '08:00',
    startDate: '',
    endDate: '',
    active: true,
  };
  assert.deepEqual(scheduleFieldErrors(ok), {});
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, daysOfWeek: [] })), ['daysOfWeek']);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, intervalWeeks: 5 })), ['intervalWeeks']);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, frequency: 'MONTHLY' })), ['dayOfMonth']);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, frequency: 'MONTHLY', dayOfMonth: 32 })), ['dayOfMonth']);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, frequency: 'DAILY', daysOfWeek: [] })), []);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, sendTime: '' })), ['sendTime']);
  assert.deepEqual(Object.keys(scheduleFieldErrors({ ...ok, startDate: '2026-12-10', endDate: '2026-12-01' })), ['endDate']);
});
