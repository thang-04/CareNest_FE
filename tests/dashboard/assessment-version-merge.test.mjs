import assert from 'node:assert/strict';
import { test } from 'node:test';

const NativeDate = Date;
const NOW = '2026-10-29T03:00:00.000Z';
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [NOW]));
  }
  static now() {
    return NativeDate.parse(NOW);
  }
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { assessmentMockRepository: repo } = await import('@/services/assessment/mock/assessmentMockRepository');
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const CLASS = 'cls_c1_c1';
const TODAY = '2026-10-29';
const ACTIVITY = 'Hoạt động học';

test('EDU-26: contract đánh giá mới giữ mức đã chấm qua lineage V1→V2 và lưu lại được', async () => {
  resetDb();
  await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  const child = readDb().children.find((c) => c.classId === CLASS && c.status === 'ACTIVE');
  const goal = (id, lineageId) => ({ id, lineageId, kind: 'goal', text: id, contents: [] });
  const plan = (id, versionNo, rows) => ({
    id,
    versionNo,
    status: 'APPROVED',
    domains: [{ name: 'Phát triển thể chất', rows }],
  });
  const week = (id, yearPlanId, ids) => ({
    id,
    classId: CLASS,
    yearPlanId,
    status: 'APPROVED',
    weekStart: '2026-10-26',
    weekNo: 9,
    days: ['26', '27', '28', '29', '30'].map((d) => ({ date: `2026-10-${d}` })),
    grid: { hoc: { allWeek: false, days: ['', '', '', 'Hoạt động mẫu', ''] } },
    picks: { 'hoc.3': ids.map((goalId) => ({ goalId })) },
  });
  writeDb((db) => {
    db.eduGoals = [
      plan(
        'review-v1',
        1,
        ['g1', 'g2', 'g3', 'removed'].map((id) => goal(id)),
      ),
      plan('review-v2', 2, [goal('g11', 'g1'), goal('g12', 'g2'), goal('g13', 'g3'), goal('new')]),
    ];
    db.eduClassWeek = [
      week('review-week-v1', 'review-v1', ['g1', 'g2', 'g3', 'removed']),
      week('review-week-v2', 'review-v2', ['g11', 'g12', 'g13', 'new']),
    ];
    db.attendance = [{ classId: CLASS, childId: child.id, date: TODAY, status: 'PRESENT' }];
    db.dailyAssessments = [
      {
        id: 'review-grade',
        classId: CLASS,
        childId: child.id,
        date: TODAY,
        activity: ACTIVITY,
        criteriaMet: ['g1', 'removed'],
        criteriaEffort: ['g2'],
        criteriaNotMet: ['g3'],
        participation: 'TICH_CUC',
        lessonPlanId: 'review-week-v1',
        recordedAt: NOW,
      },
    ];
  });
  const stored = structuredClone(readDb().dailyAssessments);
  const sheet = await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  assert.equal(sheet.lesson.classDocId, 'review-week-v2');
  const activity = sheet.rows[0].activities.find((a) => a.key === ACTIVITY);
  assert.deepEqual(activity.goalsMet, ['g11']);
  assert.deepEqual(activity.goalsEffort, ['g12']);
  assert.deepEqual(activity.goalsNotMet, ['g13']);
  assert.equal(activity.participation, 'TICH_CUC');
  const detail = await repo.getClassAssessmentDetail({ classId: CLASS, period: 'DAY' }, { id: 'u_hung', role: 'PRINCIPAL' });
  const summary = detail.children.find((row) => row.childId === child.id);
  assert.equal(summary.dat, 1);
  assert.equal(summary.canCoGang, 1);
  assert.equal(summary.chuaDat, 1);
  assert.deepEqual(readDb().dailyAssessments, stored);
  await repo.saveDailySkills({ classId: CLASS, date: TODAY, entries: [{ childId: child.id, activities: [activity] }] }, TEACHER);
  assert.deepEqual(readDb().dailyAssessments[0].criteriaMet, ['g11']);
  assert.equal(readDb().dailyAssessments[0].lessonPlanId, 'review-week-v2');
});
