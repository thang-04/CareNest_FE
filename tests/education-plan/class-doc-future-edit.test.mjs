import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const { validateFutureClassEdit, hasFutureClassContent } = await import('@/services/education-plan/mock/classDocFutureEdit');

const week = () => ({
  kind: 'week',
  themeId: 'theme',
  weekStart: '2026-11-09',
  prep: 'Cũ',
  days: Array.from({ length: 5 }, (_, i) => ({ date: `2026-11-${String(9 + i).padStart(2, '0')}`, aims: 'Cũ' })),
  grid: { hoc: { common: 'Chung', days: ['Cũ', 'Cũ', 'Cũ', 'Cũ', 'Cũ'] } },
});

test('EDU-64: future day/grid edits are allowed while past days and shared content stay locked', () => {
  const old = week();
  const next = structuredClone(old);
  next.days[2].aims = 'Mới';
  next.grid.hoc.days[2] = 'Mới';
  next.picks = { 'hoc.2': [{ id: 'a' }] };
  assert.deepEqual(validateFutureClassEdit('week', old, next, {}, '2026-11-10'), ['theme']);
  next.days[1].aims = 'Sai';
  assert.throws(() => validateFutureClassEdit('week', old, next, {}, '2026-11-10'));
  next.days[1].aims = 'Cũ';
  next.prep = 'Sai';
  assert.throws(() => validateFutureClassEdit('week', old, next, {}, '2026-11-10'));
});

test('EDU-64: branch changes target only their future theme and cannot remove past names', () => {
  const plan = {
    themes: [
      { id: 'past', start: '2026-11-09', end: '2026-11-13' },
      { id: 'future', start: '2026-11-16', end: '2026-11-20' },
    ],
  };
  const old = { names: { '2026-11-09': 'Cũ', '2026-11-16': 'Tương lai' } };
  const next = structuredClone(old);
  next.names['2026-11-16'] = 'Mới';
  assert.deepEqual(validateFutureClassEdit('branch', old, next, plan, '2026-11-10'), ['future']);
  delete next.names['2026-11-09'];
  assert.throws(() => validateFutureClassEdit('branch', old, next, plan, '2026-11-10'));
  assert.equal(hasFutureClassContent('theme', { themeId: 'past' }, plan, '2026-11-10'), false);
  assert.equal(hasFutureClassContent('theme', { themeId: 'future' }, plan, '2026-11-10'), true);
});

test('EDU-64: forged day dates do not unlock a past day', () => {
  const old = week();
  const next = structuredClone(old);
  next.days[0].date = '2027-01-01';
  assert.throws(() => validateFutureClassEdit('week', old, next, {}, '2026-11-10'));
});

test('typing in a future cell never backfills goal picks into locked cells', async () => {
  const { emptyWeekPlan, linkTypedActivities } = await import('@/models/education-plan/classPlan');
  const doc = emptyWeekPlan({ classId: 'c', yearPlanId: 'p', weekStart: '2026-11-09', themeId: 't' });
  doc.grid.hoc.days[0].topic = 'Đếm số lượng đồ vật';
  doc.grid.hoc.days[2].topic = 'Đếm số lượng đồ vật';
  linkTypedActivities(doc, [{ id: 'a', text: 'Đếm số lượng đồ vật', goalIds: ['g'], slots: ['hoc'] }], (day) => day === 2);
  assert.equal(doc.picks?.['hoc.0'], undefined);
  assert.deepEqual(doc.picks?.['hoc.2']?.[0]?.goalIds, ['g']);
});

test('EDU-64: saving a published future theme reopens only that dossier and archives its approval', async () => {
  const { writeDb, readDb } = await import('@/mocks/mockDatabase');
  const { classPlanMockRepository: repo } = await import('@/services/education-plan/mock/classPlanMockRepository');
  const teacher = { id: 'future-teacher', role: 'TEACHER' };
  const root = {
    id: 'future-root',
    kind: 'theme',
    classId: 'future-class',
    yearPlanId: 'future-plan',
    themeId: 'future-theme',
    status: 'APPROVED',
    version: 0,
    approvals: [{ userId: 'vp' }],
    printSnapshot: { proof: true },
    environment: 'Cũ',
  };
  writeDb((db) => {
    db.users = [teacher];
    db.classes = [{ id: root.classId, teacherIds: [teacher.id], homeroomTeacherId: teacher.id, ageGroupId: 'future-age' }];
    db.eduGoals = [
      {
        id: root.yearPlanId,
        planLevel: 'TEAM',
        status: 'APPROVED',
        themes: [{ id: root.themeId, start: '2099-11-09', end: '2099-11-13' }],
        domains: [],
      },
    ];
    db.eduClassTheme = [root, { ...root, id: 'other-root', themeId: 'other-theme' }];
    db.eduClassBranch = [];
    db.eduClassWeek = [{ ...root, id: 'future-week', kind: 'week', weekStart: '2099-11-09' }];
  });
  const saved = await repo.saveDoc('theme', { ...root, environment: 'Mới' }, teacher);
  assert.equal(saved.status, 'DRAFT');
  assert.equal(saved.printSnapshot, null);
  assert.deepEqual(saved.history[0].previousPrintSnapshot, { proof: true });
  assert.equal(readDb().eduClassWeek[0].status, 'DRAFT');
  assert.equal(readDb().eduClassTheme[1].status, 'APPROVED');
  assert.equal(readDb().eduClassTheme[1].version, 0);
});
