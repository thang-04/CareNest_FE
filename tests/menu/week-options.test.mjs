import assert from 'node:assert/strict';
import { test } from 'node:test';

const { weekOptions, weekShortLabel } = await import('../../src/utils/week.js');
const { dishNutrition } = await import('../../src/utils/menu-planning/menuStatistics.js');
const { validateForecastForm } = await import('../../src/utils/kitchen/freshGoodsForm.js');

test('danh sách tuần phủ năm học, nhóm theo tháng và đánh dấu tuần này', () => {
  const weeks = weekOptions({ start: '2026-09-02', end: '2026-10-02', value: '2026-09-14', thisWeek: '2026-09-14' });
  assert.equal(weeks[0].value, '2026-08-31');
  assert.equal(weeks.at(-1).value, '2026-09-28');
  assert.equal(weeks[0].group, 'Tháng 8/2026');
  assert.equal(weeks.find((w) => w.value === '2026-09-14').hint, 'Tuần này');
  assert.equal(weeks.filter((w) => w.hint).length, 1);
});

test('tuần đang xem ngoài năm học vẫn có trong danh sách', () => {
  const weeks = weekOptions({ start: '2026-09-07', end: '2026-09-18', value: '2026-11-02' });
  assert.equal(weeks.at(-1).value, '2026-11-02');
});

test('thiếu ngày năm học thì lấy các tuần quanh tuần đang xem', () => {
  const weeks = weekOptions({ value: '2026-11-02' });
  assert.ok(weeks.some((w) => w.value === '2026-11-02'));
  assert.ok(weeks.length > 20);
});

test('nhãn tuần ngắn không kèm năm', () => {
  assert.equal(weekShortLabel('2026-11-09'), '09/11 – 13/11');
});

test('dinh dưỡng món đọc theo id hoặc mã nhóm tuổi', () => {
  const dish = { nutritionByAgeGroup: [{ ageGroupId: 'ag-4', kcal: 120 }, { ageGroupId: 3, kcal: 90 }] };
  assert.equal(dishNutrition(dish, { id: 9, code: 'ag-4' }).kcal, 120);
  assert.equal(dishNutrition(dish, { id: '3' }).kcal, 90);
  assert.equal(dishNutrition(dish, { id: 7 }), null);
  assert.equal(dishNutrition(undefined, { id: 7 }), null);
});

test('kỳ dự trù báo lỗi khi ngày kết thúc trước ngày bắt đầu', () => {
  assert.ok(validateForecastForm({ periodFrom: '2026-11-12', periodTo: '2026-11-08' }).periodTo);
  assert.deepEqual(validateForecastForm({ periodFrom: '2026-11-09', periodTo: '2026-11-09' }), {});
});
