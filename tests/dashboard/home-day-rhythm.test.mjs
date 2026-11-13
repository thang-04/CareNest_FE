import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { buildDashboardToday, buildDayProgress } = await import('@/services/dashboard/dashboardSummaryService');
const { buildLunch } = await import('@/services/dashboard/dashboardService');

const DATE = '2026-11-12';
const campusName = (id) => ({ c1: 'Campus 1', c2: 'Campus 2' })[id] || id;
const cls = (classId, className, campusId, size, present, excused = 0, unexcused = 0) => ({
  classId,
  className,
  campusId,
  size,
  present,
  excused,
  unexcused,
});
const TODAY = {
  classes: [cls('a', 'Lá 1', 'c1', 30, 27, 2, 1), cls('b', 'Lá 2', 'c1', 20, 18, 2), cls('d', 'Mầm 3', 'c2', 24, 0)],
};
const HEALTH = { totals: { present: 45, checked: 40, noted: 3 }, classes: [] };
const today = (over = {}) =>
  buildDashboardToday({
    date: DATE,
    now: { date: DATE, time: '09:30' },
    today: TODAY,
    health: HEALTH,
    cutoff: '08:30',
    campusName,
    ...over,
  });

const COUNTS = [
  { session: 'LUNCH', campusId: 'c1', status: 'CONFIRMED', totals: { normal: 40, substitute: 2 } },
  { session: 'LUNCH', campusId: 'c2', status: 'PENDING_CONFIRMATION', totals: { normal: 20, substitute: 1 } },
  { session: 'BREAKFAST', campusId: 'c1', status: 'CONFIRMED', totals: { normal: 99, substitute: 0 } },
];
const MENU = [
  {
    sessions: [
      {
        session: 'LUNCH',
        menus: [
          { type: 'NORMAL', dishes: [{ name: 'Cơm trắng' }, { name: 'Canh rau' }] },
          { type: 'ALLERGY', dishes: [{ name: 'Cơm trắng' }] },
        ],
      },
    ],
  },
];

test('Hôm nay theo điểm trường: có mặt / sĩ số và số lớp đã điểm danh', () => {
  const { campuses } = today();
  assert.deepEqual(campuses, [
    { campusId: 'c1', name: 'Campus 1', present: 45, total: 50, classes: 2, taken: 2 },
    { campusId: 'c2', name: 'Campus 2', present: 0, total: 24, classes: 1, taken: 0 },
  ]);
});

test('bữa trưa: chỉ cộng bữa trưa, đếm điểm trường đã xác nhận, lọc theo điểm trường người dùng chọn', () => {
  const all = buildLunch({ counts: COUNTS, menu: MENU, campusName });
  assert.equal(all.meals, 63);
  assert.equal(all.campuses, 2);
  assert.equal(all.confirmed, 1);
  assert.deepEqual(all.pendingCampuses, ['Campus 2']);
  assert.deepEqual(all.dishes, ['Cơm trắng', 'Canh rau']);
  assert.equal(all.allergyMenus, 1);
  assert.equal(buildLunch({ counts: COUNTS, menu: MENU, campusId: 'c1' }).meals, 42);
});

test('bữa trưa: nguồn lỗi trả null, không coi là 0', () => {
  const lunch = buildLunch({ counts: null, menu: null });
  assert.equal(lunch.meals, null);
  assert.equal(lunch.menuLoaded, false);
});

test('tiến độ 5 bước theo đúng thứ tự trong ngày', () => {
  const steps = buildDayProgress({ today: today(), lunch: buildLunch({ counts: COUNTS, menu: MENU, campusName }), assessment: null });
  assert.deepEqual(
    steps.map((s) => s.key),
    ['attendance', 'health', 'meal', 'kitchen', 'assessment'],
  );
});

test('bước điểm danh: quá giờ chốt còn lớp chưa điểm danh thì báo "Quá giờ"; trước giờ chốt là "Đang làm"', () => {
  const late = buildDayProgress({ today: today(), lunch: null, assessment: null })[0];
  assert.equal(late.status, 'late');
  assert.equal(late.badge, 'Quá giờ 1 lớp');
  assert.equal(late.value, 2);
  assert.equal(late.total, 3);
  assert.match(late.note, /Hạn 08:30 · Lớp Mầm 3 chưa xong/);
  const early = buildDayProgress({ today: today({ now: { date: DATE, time: '08:00' } }), lunch: null, assessment: null })[0];
  assert.equal(early.status, 'doing');
});

test('bước khám, báo ăn, bếp, đánh giá lấy đúng số nguồn trả', () => {
  const [, health, meal, kitchen, evaluation] = buildDayProgress({
    today: today(),
    lunch: buildLunch({ counts: COUNTS, menu: MENU, campusName }),
    assessment: { totals: { classes: 3, complete: 3 } },
  });
  assert.equal(health.status, 'doing');
  assert.equal(health.note, '3 trẻ có dấu hiệu cần lưu ý');
  assert.equal(meal.value, 63);
  assert.equal(meal.badge, '1/2 điểm trường');
  assert.equal(meal.note, 'Campus 2 chưa xác nhận sĩ số');
  assert.equal(kitchen.status, 'done');
  assert.equal(kitchen.text, 'Đã công bố');
  assert.equal(evaluation.status, 'done');
});

test('nguồn phụ lỗi chỉ làm bước đó "Chưa tải được", các bước khác vẫn có số', () => {
  const steps = buildDayProgress({ today: today(), lunch: buildLunch({ counts: null, menu: null }), assessment: null });
  assert.equal(steps[0].status, 'late');
  assert.equal(steps[2].status, 'unknown');
  assert.equal(steps[3].status, 'unknown');
  assert.equal(steps[4].badge, 'Chưa tải được');
});

test('không có bữa trưa bán trú hôm nay thì bước báo ăn là "Không có"', () => {
  const meal = buildDayProgress({ today: today(), lunch: buildLunch({ counts: [], menu: [] }), assessment: null })[2];
  assert.equal(meal.status, 'none');
  assert.equal(meal.note, 'Hôm nay không có bữa trưa bán trú');
});
