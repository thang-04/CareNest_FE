import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createMealPlanApi } = await import('@/services/mealPlanApi');
const { applyHolidays, holidayNames, toPlanRequest } = await import('@/utils/menu-planning/mealPlanGrid');

const DAYS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
const draft = (over = {}) => ({
  days: DAYS.map((date) => ({ date, off: false, note: '', items: [{ session: 'LUNCH', block: 'KG', dishId: '1' }], ...over[date] })),
});

test('listWeekHolidays chỉ gọi năm học chứa tuần và lọc đợt nghỉ chạm thứ Hai–thứ Sáu', async () => {
  const calls = [];
  const client = {
    get: async (url) => {
      calls.push(url);
      if (url === '/school-years')
        return [
          { id: '1', startDate: '2025-09-01', endDate: '2026-05-31' },
          { id: '2', startDate: '2026-09-01', endDate: '2027-05-31' },
        ];
      return [
        { startDate: '2026-11-20', endDate: '2026-11-20', name: 'Ngày Nhà giáo' },
        { startDate: '2026-11-21', endDate: '2026-11-22', name: 'Cuối tuần' },
        { startDate: '2027-01-01', endDate: '2027-01-01', name: 'Tết Dương lịch' },
      ];
    },
  };
  const out = await createMealPlanApi({ client }).listWeekHolidays('2026-11-16');
  assert.deepEqual(calls, ['/school-years', '/school-years/2/holidays']);
  assert.deepEqual(
    out.map((h) => h.name),
    ['Ngày Nhà giáo'],
  );
});

test('holidayNames gắn tên đợt nghỉ cho ngày trong khoảng', () => {
  const names = holidayNames(draft(), [{ startDate: '2026-11-19', endDate: '2026-11-25', name: 'Nghỉ giữa kỳ' }]);
  assert.deepEqual(names, { '2026-11-19': 'Nghỉ giữa kỳ', '2026-11-20': 'Nghỉ giữa kỳ' });
});

test('applyHolidays tự đánh dấu nghỉ, giữ lý do người dùng đã nhập, không đổi ngày khác', () => {
  const base = draft({ '2026-11-20': { note: 'Họp phụ huynh' } });
  const next = applyHolidays(base, { '2026-11-19': 'Nghỉ giữa kỳ', '2026-11-20': 'Nghỉ giữa kỳ' });
  assert.equal(next.days[3].off, true);
  assert.equal(next.days[3].note, 'Nghỉ giữa kỳ');
  assert.equal(next.days[4].note, 'Họp phụ huynh');
  assert.equal(next.days[0].off, false);
  // Ngày nghỉ không gửi món lên BE
  assert.deepEqual(toPlanRequest(next).days[3].items, []);
});

test('applyHolidays không có gì đổi thì trả lại đúng bản nháp (không làm bẩn)', () => {
  const base = draft({ '2026-11-19': { off: true, note: 'Đã nghỉ' } });
  assert.equal(applyHolidays(base, { '2026-11-19': 'Nghỉ giữa kỳ' }), base);
  assert.equal(applyHolidays(base, {}), base);
  assert.equal(applyHolidays(null, { '2026-11-19': 'x' }), null);
});
