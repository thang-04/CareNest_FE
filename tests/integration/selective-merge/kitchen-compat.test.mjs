import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb, applyMockSeedMigration } = await import('@/mocks/mockDatabase');
const { attendanceMockRepository: attendance } = await import('@/services/attendance/mock/attendanceMockRepository');
const { kitchenMockRepository: kitchen } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { getMealPreparations, updateMealPreparation } = await import('@/services/kitchen/kitchenService');
const { buildWeeklyForecast } = await import('@/services/kitchen/mock/weeklyForecast');
const { computeMarket } = await import('@/services/kitchen/mock/marketList');
const { MEAL_SESSIONS, ALL_MEAL_SESSIONS } = await import('@/models/kitchen/kitchenConstants');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const COOK = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
beforeEach(() => resetDb());

const initialize = async () => {
  await attendance.getDayInfo(todayInput());
  const date = readDb().mealCounts.find((count) => count.campusId === 'c1' && count.status === 'CONFIRMED').date;
  await kitchen.getKitchenDay({ campusId: 'c1', date }, VP);
  return date;
};

test('giữ contract session legacy để không đổi điều kiện bàn giao MORNING trong attendance', () => {
  assert.deepEqual(MEAL_SESSIONS, ['LUNCH', 'AFTERNOON']);
  assert.deepEqual(ALL_MEAL_SESSIONS, ['MORNING', 'LUNCH', 'AFTERNOON']);
  assert.equal(attendance.confirmMealCountDay, undefined);
  assert.equal(typeof attendance.confirmMealCount, 'function');
});

test('bếp đọc đúng số chốt từng bữa từ attendance, gồm MORNING và không phụ thuộc có menu', async () => {
  const date = await initialize();
  const snapshot = structuredClone(readDb().mealCounts.filter((count) => count.campusId === 'c1' && count.date === date));
  assert.ok(snapshot.some((count) => count.session === 'MORNING'));
  writeDb((db) => {
    db.weeklyMenus = db.weeklyMenus.filter((menu) => menu.ageGroupId !== 'ag-2');
  });
  const actual = await kitchen.getConfirmedMealCount({ campusId: 'c1', date }, VP);
  for (const source of snapshot) {
    const row = actual.find((item) => item.session === source.session);
    assert.ok(row);
    assert.equal(row.status, source.status);
    assert.deepEqual(
      row.classes.map(({ classId, normal, substitute }) => ({ classId, normal, substitute })),
      source.classes.map(({ classId, normal, substitute }) => ({ classId, normal, substitute })),
    );
    assert.equal(
      row.totals.normal + row.totals.substitute,
      source.classes.reduce((sum, item) => sum + item.normal + item.substitute, 0),
    );
  }
});

const forecastFixture = (session) => ({
  schoolYears: [{ id: 'test-year', status: 'ACTIVE' }],
  ageGroups: [{ id: 'test-age', mealSessions: [session] }],
  classes: [{ id: 'test-class', campusId: 'c1', ageGroupId: 'test-age', schoolYear: 'test-year', name: 'Lớp demo' }],
  children: [{ id: 'test-child', classId: 'test-class', status: 'ACTIVE' }],
  foods: [],
  dishes: [],
  weeklyMenus: [],
  mealPrices: [],
  nutritionSetups: [],
});

for (const session of ['MORNING', 'AFTERNOON']) {
  test(`dự trù nhóm chỉ ăn ${session} không đòi LUNCH, không cộng trùng các bữa`, () => {
    const db = forecastFixture(session);
    const view = buildWeeklyForecast(db, {
      campusId: 'c1',
      weekStart: '2026-11-02',
      record: null,
      ctx: {
        today: '2026-11-02',
        isSchoolDay: () => true,
        stockOf: () => 0,
        mealCountOf: () => ({
          status: 'CONFIRMED',
          confirmedAt: '2026-11-02T02:00:00Z',
          classes: [{ classId: 'test-class', normal: 7, substitute: 1 }],
        }),
      },
    });
    assert.equal(view.days[0].confirmed, true);
    assert.equal(view.days[0].total, 8);
    assert.equal(view.days[0].confirmedAt, '2026-11-02T02:00:00Z');
    assert.equal(view.classes[0].cells[0].value, 8);
  });
}

test('dự trù chưa chốt tôn trọng Có mặt nhưng Không tham gia ăn và bỏ qua childMealPlans cũ', () => {
  const db = forecastFixture('AFTERNOON');
  db.childMealPlans = [{ childId: 'test-child', mealsPerDay: 1 }];
  db.attendance = [
    { childId: 'test-child', classId: 'test-class', campusId: 'c1', date: '2026-11-02', status: 'PRESENT', meals: { AFTERNOON: false } },
  ];
  const input = {
    campusId: 'c1',
    weekStart: '2026-11-02',
    record: null,
    ctx: { today: '2026-11-02', isSchoolDay: () => true, stockOf: () => 0, mealCountOf: () => null },
  };
  assert.equal(buildWeeklyForecast(db, input).days[0].total, 0);
  db.attendance[0].meals.AFTERNOON = true;
  assert.equal(buildWeeklyForecast(db, input).days[0].total, 1);
});

test('phiếu đi chợ không cảnh báo bữa không cấu hình', () => {
  const market = computeMarket(forecastFixture('AFTERNOON'), { date: '2026-11-02', classById: {}, counts: { AFTERNOON: null } });
  assert.ok(market.checks.some((row) => /Bữa chiều chưa chốt/.test(row.text)));
  assert.ok(!market.checks.some((row) => /Bữa phụ sáng|Bữa trưa/.test(row.text)));
});

test('doanh thu cùng campus không bỏ nhóm chỉ ăn sáng và không cộng trùng bữa', () => {
  const db = forecastFixture('MORNING');
  db.ageGroups.push({ id: 'lunch-age', mealSessions: ['LUNCH', 'AFTERNOON'] });
  db.classes.push({ id: 'lunch-class', campusId: 'c1', ageGroupId: 'lunch-age' });
  db.mealPrices = [
    { ageGroupId: 'test-age', effectiveFrom: '2026-01-01', price: 10 },
    { ageGroupId: 'lunch-age', effectiveFrom: '2026-01-01', price: 20 },
  ];
  const count = (classId, normal) => ({ status: 'CONFIRMED', classes: [{ classId, normal, substitute: 0 }] });
  const market = computeMarket(db, {
    date: '2026-11-02',
    classById: Object.fromEntries(db.classes.map((row) => [row.id, row])),
    counts: { MORNING: count('test-class', 3), LUNCH: count('lunch-class', 5), AFTERNOON: count('lunch-class', 5) },
  });
  assert.equal(market.revenue.total, 130);
  assert.equal(market.revenue.parts.length, 2);
});

test('phiếu kho PENDING_APPROVAL cũ giữ trạng thái, số đã xuất bằng 0 và không bị trừ kho lại', async () => {
  const date = await initialize();
  writeDb((db) => {
    db.stockIssues = db.stockIssues.filter((issue) => !(issue.campusId === 'c1' && issue.date === date));
    db.stockIssues.push({
      id: 'legacy-pending',
      code: 'DEMO-LEGACY',
      campusId: 'c1',
      date,
      status: 'PENDING_APPROVAL',
      items: [{ foodId: db.foods[0].id, requiredQty: 2 }],
      history: [],
    });
  });
  const before = structuredClone(readDb().foodStock);
  const { issues } = await kitchen.getStockIssues({ campusId: 'c1', from: date, to: date }, VP);
  const legacy = issues.find((issue) => issue.id === 'legacy-pending');
  assert.equal(legacy.status, 'PENDING_APPROVAL');
  assert.equal(legacy.items[0].issuedQty, 0);
  assert.deepEqual(readDb().foodStock, before);
});

test('migration không seed lại collection rỗng đã lưu và chạy lặp không ghi đè bản ghi', () => {
  const db = { rows: [] };
  applyMockSeedMigration(db, 'test', 1, { rows: [{ id: 'new' }], missing: [{ id: 'initial' }] });
  assert.deepEqual(db.rows, []);
  assert.deepEqual(db.missing, [{ id: 'initial' }]);
  applyMockSeedMigration(db, 'test', 2, { missing: [{ id: 'replacement' }] });
  assert.deepEqual(db.missing, [{ id: 'initial' }]);
});

test('widget cũ nhận đúng wrapper record, luồng bàn giao cũ vẫn hoàn tất được khi đã READY', async () => {
  const date = await initialize();
  writeDb((db) => {
    db.mealPreparations = [{ id: 'legacy-prep', campusId: 'c1', date, session: 'LUNCH', status: 'COOKING', history: [] }];
  });
  const rows = await getMealPreparations({ campusId: 'c1', date }, VP);
  const lunch = rows.find((row) => row.session === 'LUNCH');
  assert.ok(lunch.hasMenu);
  assert.equal(lunch.record.status, 'COOKING');
  await assert.rejects(
    updateMealPreparation({ date, session: 'LUNCH', status: 'READY_FOR_HANDOVER' }, VP),
    (error) => error.status === 403,
  );
  const ready = await updateMealPreparation({ date, session: 'LUNCH', status: 'READY_FOR_HANDOVER' }, COOK);
  assert.equal(ready.status, 'READY_FOR_HANDOVER');
  assert.equal(readDb().mealPreparations.length, 1);
  const target = readDb().mealHandovers.find((row) => row.campusId === 'c1' && row.date === date && row.session === 'LUNCH');
  assert.ok(target);
  writeDb((db) => {
    const row = db.mealHandovers.find((item) => item.id === target.id);
    row.status = 'READY';
  });
  const cls = readDb().classes.find((row) => row.id === target.classId);
  const saved = await attendance.confirmHandover(target.id, target.expected, { id: cls.teacherIds[0], role: 'TEACHER', campusId: 'c1' });
  assert.equal(saved.status, 'CONFIRMED');
});

test('bếp mới không tự mở chế biến legacy khi database chưa từng có luồng đó', async () => {
  const date = await initialize();
  assert.equal(readDb().mealPreparations, undefined);
  assert.deepEqual(await getMealPreparations({ campusId: 'c1', date }, VP), []);
  await assert.rejects(updateMealPreparation({ date, session: 'LUNCH', status: 'COOKING' }, COOK), (error) => error.status === 409);
});
