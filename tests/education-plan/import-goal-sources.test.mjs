import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.window = new EventTarget();
const values = new Map();
globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const { educationPlanMockRepository: repo } = await import('@/services/education-plan/mock/educationPlanMockRepository');
const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { EDU_SEED_VERSION } = await import('@/mocks/educationPlanSeed');
const vp = { id: 'vp-demo', role: 'VICE_PRINCIPAL' };
const leader = { id: 'tl-demo', role: 'TEAM_LEADER', ageGroupId: 'ag-4' };
const source = (id, ageGroupId, schoolYear = '2026 – 2027') => ({
  id,
  ageGroupId,
  schoolYear,
  title: id,
  status: 'DRAFT',
  revision: 3,
  code: 'DEMO',
  domains: [
    {
      id: 'd1',
      name: 'Demo',
      rows: [{ id: 'r1', kind: 'goal', text: 'Demo goal', contents: [{ id: 'c1', text: 'Demo content', themes: ['t1'] }] }],
    },
  ],
});
const seed = () =>
  writeDb((db) => {
    db.eduSeedVersion = EDU_SEED_VERSION;
    db.eduGoals = [source('a', 'ag-4'), source('b', 'ag-3'), source('c', 'ag-4', '2025 – 2026')];
  });

test('mock VP lists across age groups with year, age and exclude filters and summary shape', async () => {
  seed();
  const all = await repo.listGoalSources({ schoolYear: '2026 – 2027' }, vp);
  assert.deepEqual(
    all.map((s) => s.id),
    ['a', 'b'],
  );
  assert.deepEqual(all[0], {
    id: 'a',
    code: 'DEMO',
    title: 'a',
    schoolYear: '2026 – 2027',
    ageGroupId: 'ag-4',
    status: 'DRAFT',
    revision: 3,
    goalCount: 1,
  });
  assert.deepEqual(await repo.listGoalSources({ ageGroupId: 'ag-4', excludeId: 'a', schoolYear: '2025 – 2026' }, vp), [
    { ...all[0], id: 'c', title: 'c', schoolYear: '2025 – 2026' },
  ]);
  assert.deepEqual(await repo.listGoalSources({ schoolYear: '1900 – 1901' }, vp), []);
});

test('mock TL sources stay within responsible group including forged detail IDs', async () => {
  seed();
  assert.deepEqual(
    (await repo.listGoalSources({ ageGroupId: 'ag-3' }, leader)).map((s) => s.id),
    ['a', 'c'],
  );
  await assert.rejects(repo.getGoalSource('b', leader), { status: 403 });
  await assert.rejects(repo.getGoalSource('missing', vp), { status: 404 });
  await assert.rejects(repo.listGoalSources({}, null), { status: 403 });
  await assert.rejects(repo.getGoalSource('a', { role: 'TEACHER', ageGroupId: 'ag-4' }), { status: 403 });
});

test('mock source snapshots are isolated reads without mutation, locks or status changes', async () => {
  seed();
  const before = JSON.stringify(readDb());
  const snapshot = await repo.getGoalSource('a', leader);
  snapshot.domains[0].rows[0].contents[0].themes.push('changed');
  await repo.listGoalSources({}, vp);
  const fresh = await repo.getGoalSource('a', leader);
  assert.deepEqual(fresh.domains[0].rows[0].contents[0].themes, ['t1']);
  assert.equal(JSON.stringify(readDb()), before);
});
