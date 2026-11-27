import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb } = await import('@/mocks/mockDatabase');
const { buildWeeklyForecast } = await import('@/services/kitchen/mock/weeklyForecast');
const { todayInput } = await import('@/utils/format');
const { addDays, schoolWeekStart } = await import('@/models/menu-planning/menuPlanningConstants');

const CAMPUS = 'c1';
const WEEK = addDays(schoolWeekStart(todayInput()), 70);

const forecastOf = (db) =>
  buildWeeklyForecast(db, {
    campusId: CAMPUS,
    weekStart: WEEK,
    record: null,
    ctx: { today: todayInput(), isSchoolDay: () => true, mealCountOf: () => null, stockOf: () => 0 },
  });

const classRow = (week, classId) => week.classes.find((c) => c.classId === classId);

test('dự trù tuần không tính trẻ không báo ăn, kể cả khi trẻ có mặt (không trừ 2 lần)', () => {
  const db = structuredClone(readDb());
  const before = forecastOf(db);
  const target = db.children.find((ch) => ch.status === 'ACTIVE' && ch.classId && classRow(before, ch.classId)?.registered > 1);
  assert.ok(target, 'có lớp của cơ sở với trẻ đang học');
  const row = classRow(before, target.classId);

  // CHD-13: trẻ không báo ăn có mặt, bản ghi điểm danh có mọi bữa = false
  target.mealRegistered = false;
  db.attendance = [
    ...(db.attendance || []),
    {
      id: 'att_no_meal',
      childId: target.id,
      classId: target.classId,
      campusId: CAMPUS,
      date: before.days[0].date,
      status: 'PRESENT',
      meals: { BREAKFAST: false, LUNCH: false, AFTERNOON: false },
    },
  ];
  const after = forecastOf(db);
  const next = classRow(after, target.classId);

  assert.equal(next.registered, row.registered - 1);
  assert.equal(next.cells[0].suggested, row.cells[0].suggested - 1);
  assert.equal(next.cells[1].suggested, row.cells[1].suggested - 1);
  assert.equal(after.days[0].suggestedTotal, before.days[0].suggestedTotal - 1);
});
