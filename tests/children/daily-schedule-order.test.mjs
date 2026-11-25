import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cutoffOrderErrors, cutoffPastDateError, validateCutoff } from '../../src/utils/school-config/schoolConfigValidation.js';

// PCK-04, ATT-06, ATT-13 (Cần chốt 25/11/2026, phương án A): cùng luật và cùng câu với BE DailyScheduleRules
const year = { name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };
const base = {
  time: '08:30',
  effectiveFrom: '2026-11-25',
  note: '',
  latestAfternoonArrival: '14:00',
  dropoffOpenFrom: '06:30',
  morningStart: '07:00',
  morningEnd: '11:00',
  afternoonStart: '13:30',
  fullDayPickupFrom: '15:00',
  pickupStart: '15:00',
  pickupEnd: '17:00',
  afternoonEnd: '17:00',
};
const order = (patch) => cutoffOrderErrors({ ...base, ...patch });

test('lịch mặc định (mốc tính đủ ngày 15:00) hợp lệ', () => {
  assert.deepEqual(order({}), {});
  assert.deepEqual(validateCutoff(base, year), {});
});

test('bắt đầu sáng bằng giờ mở đón được, sớm hơn thì lỗi ở ô bắt đầu sáng', () => {
  assert.deepEqual(order({ morningStart: '06:30' }), {});
  assert.deepEqual(order({ morningStart: '06:29' }), { morningStart: 'Bắt đầu sáng phải bằng hoặc sau Mở đón trẻ (06:30)' });
});

test('kết thúc sáng phải sau bắt đầu sáng', () => {
  assert.deepEqual(order({ morningStart: '08:00', morningEnd: '08:00', time: '07:30' }), {
    morningEnd: 'Kết thúc sáng phải sau Bắt đầu sáng (08:00)',
  });
});

test('bắt đầu chiều phải sau kết thúc sáng', () => {
  assert.deepEqual(order({ afternoonStart: '11:00' }), { afternoonStart: 'Bắt đầu chiều phải sau Kết thúc sáng (11:00)' });
  assert.deepEqual(order({ afternoonStart: '11:01' }), {});
});

test('mốc tính đủ ngày phải sau bắt đầu chiều', () => {
  assert.deepEqual(order({ fullDayPickupFrom: '13:30' }), {
    fullDayPickupFrom: 'Mốc tính đủ ngày phải sau Bắt đầu chiều (13:30)',
  });
  assert.deepEqual(order({ fullDayPickupFrom: '13:31' }), {});
});

test('bắt đầu trả trẻ bằng mốc tính đủ ngày được, sớm hơn thì lỗi', () => {
  assert.deepEqual(order({ fullDayPickupFrom: '15:00', pickupStart: '15:00' }), {});
  assert.deepEqual(order({ fullDayPickupFrom: '15:30', pickupStart: '15:00' }), {
    pickupStart: 'Bắt đầu trả trẻ phải bằng hoặc sau Mốc tính đủ ngày (15:30)',
  });
});

test('kết thúc trả trẻ phải sau bắt đầu trả trẻ; kết thúc chiều bằng kết thúc trả được', () => {
  assert.deepEqual(order({ pickupEnd: '15:00' }), { pickupEnd: 'Kết thúc trả trẻ phải sau Bắt đầu trả trẻ (15:00)' });
  assert.deepEqual(order({ afternoonEnd: '17:00' }), {});
  assert.deepEqual(order({ afternoonEnd: '16:59' }), {
    afternoonEnd: 'Kết thúc chiều phải bằng hoặc sau Kết thúc trả trẻ (17:00)',
  });
});

test('giờ chốt từ giờ mở đón và trước kết thúc sáng', () => {
  assert.deepEqual(order({ time: '06:30' }), {});
  assert.deepEqual(order({ time: '06:29' }), { time: 'Giờ chốt phải bằng hoặc sau Mở đón trẻ (06:30)' });
  assert.deepEqual(order({ time: '10:59' }), {});
  assert.deepEqual(order({ time: '11:00' }), { time: 'Giờ chốt phải trước Kết thúc sáng (11:00)' });
});

test('giờ đến muộn nhất: sau giờ chốt, từ kết thúc sáng, trước bắt đầu trả trẻ', () => {
  assert.deepEqual(order({ time: '10:30', latestAfternoonArrival: '10:30' }), {
    latestAfternoonArrival: 'Giờ đến muộn nhất buổi chiều phải sau Giờ chốt (10:30)',
  });
  assert.deepEqual(order({ latestAfternoonArrival: '11:00' }), {});
  assert.deepEqual(order({ latestAfternoonArrival: '10:59' }), {
    latestAfternoonArrival: 'Giờ đến muộn nhất buổi chiều phải bằng hoặc sau Kết thúc sáng (11:00)',
  });
  assert.deepEqual(order({ latestAfternoonArrival: '14:59' }), {});
  assert.deepEqual(order({ latestAfternoonArrival: '15:00' }), {
    latestAfternoonArrival: 'Giờ đến muộn nhất buổi chiều phải trước Bắt đầu trả trẻ (15:00)',
  });
});

test('nhiều ô sai cùng lúc: mỗi ô một lỗi, validateCutoff trả đúng các ô đó', () => {
  const expected = {
    afternoonStart: 'Bắt đầu chiều phải sau Kết thúc sáng (11:00)',
    pickupEnd: 'Kết thúc trả trẻ phải sau Bắt đầu trả trẻ (15:00)',
  };
  assert.deepEqual(order({ afternoonStart: '10:00', pickupEnd: '15:00' }), expected);
  assert.deepEqual(validateCutoff({ ...base, afternoonStart: '10:00', pickupEnd: '15:00' }, year), expected);
});

test('ô trống hoặc sai dạng chỉ báo lỗi nhập, không so thứ tự', () => {
  const e = validateCutoff({ ...base, morningEnd: '' }, year);
  assert.deepEqual(e, { morningEnd: 'Nhập giờ kết thúc buổi sáng' });
});

test('ngày áp dụng trước hôm nay bị chặn khi đã có giờ chốt (như BE CUTOFF_DATE_PAST)', () => {
  const today = '2026-11-25';
  assert.equal(cutoffPastDateError('2026-11-24', { hasSetting: true, today }), 'Giờ chốt mới chỉ áp dụng từ hôm nay trở đi');
  assert.equal(cutoffPastDateError('2026-11-25', { hasSetting: true, today }), undefined);
  assert.equal(cutoffPastDateError('2026-11-24', { hasSetting: false, today }), undefined);
  assert.equal(
    validateCutoff({ ...base, effectiveFrom: '2026-11-24' }, year, { hasSetting: true, today }).effectiveFrom,
    'Giờ chốt mới chỉ áp dụng từ hôm nay trở đi',
  );
  assert.equal(validateCutoff({ ...base, effectiveFrom: '2026-09-01' }, year, { hasSetting: false, today }).effectiveFrom, undefined);
});
