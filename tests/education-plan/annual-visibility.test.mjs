import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
const { educationPlanMockRepository: repo } = await import('../../src/services/education-plan/mock/educationPlanMockRepository.js');
const { writeDb } = await import('../../src/mocks/mockDatabase.js');
const { EDU_SEED_VERSION } = await import('../../src/mocks/educationPlanSeed.js');
const tl = { id: 'synthetic-leader', role: 'TEAM_LEADER', ageGroupId: 'ag-3' };
const vp = { id: 'synthetic-vp', role: 'VICE_PRINCIPAL' };
const seed = () =>
  writeDb((db) => {
    db.eduSeedVersion = EDU_SEED_VERSION;
    db.users = [tl, { id: 'leader-4', role: 'TEAM_LEADER', ageGroupId: 'ag-4' }];
    db.eduGoals = ['ag-3', 'ag-4'].flatMap((age) =>
      ['DRAFT', 'REVIEW', 'APPROVED'].map((status) => ({
        id: age + status,
        code: age + status,
        ageGroupId: age,
        status,
        planLevel: 'SCHOOL_YEAR',
        schoolYear: '2098 – 2099',
        domains: [],
      })),
    );
    db.eduConfig ||= {};
    db.eduConfig.workflowPolicy = {
      ...db.eduConfig.workflowPolicy,
      schoolYear: { creators: ['VICE_PRINCIPAL'], reviewers: ['PRINCIPAL'] },
      year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] },
    };
  });
test('EDU-60: annual list/source/detail and diff do not expose drafts or other assigned ages', async () => {
  seed();
  assert.deepEqual(
    (await repo.getAll(tl)).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').map((g) => g.id),
    ['ag-3APPROVED'],
  );
  assert.deepEqual(
    (await repo.listGoalSources({ planLevel: 'SCHOOL_YEAR' }, tl)).map((g) => g.id),
    ['ag-3APPROVED'],
  );
  await assert.rejects(repo.getGoalSource('ag-3DRAFT', tl), { status: 403, errorCode: 7004 });
  await assert.rejects(repo.getGoalSource('ag-4APPROVED', tl), { status: 403, errorCode: 7004 });
  await assert.rejects(repo.getGoalSource('missing', tl), { status: 404 });
  await assert.rejects(repo.getGoalChanges('ag-3APPROVED', 'ag-3DRAFT', tl), { status: 403, errorCode: 7004 });
  assert.deepEqual((await repo.getAll({ ...tl, ageGroupId: null })).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR'), []);
});
test('EDU-60/Q1=A: management sees all ages, independent annual rights retain drafts', async () => {
  seed();
  assert.equal((await repo.getAll(vp)).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').length, 6);
  writeDb((db) => {
    db.eduConfig.workflowPolicy.schoolYear = { creators: ['TEAM_LEADER'], reviewers: ['PRINCIPAL'] };
    db.eduConfig.workflowPolicy.year = { creators: ['VICE_PRINCIPAL'], reviewers: ['PRINCIPAL'] };
  });
  assert.deepEqual(
    (await repo.getAll(vp)).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').map((g) => g.id),
    ['ag-3APPROVED', 'ag-4APPROVED'],
  );
  assert.equal((await repo.getAll(tl)).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').length, 3);
  assert.equal((await repo.getAll({ ...vp, role: 'TEACHER', ageGroupId: null })).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').length, 0);
});

test('EDU-60: management role excluded from annual policy does not widen a team-leader reviewer scope', async () => {
  seed();
  writeDb((db) => {
    db.eduConfig.workflowPolicy.schoolYear = { creators: ['TEACHER'], reviewers: ['TEAM_LEADER'] };
    db.eduConfig.workflowPolicy.year = { creators: ['VICE_PRINCIPAL'], reviewers: ['PRINCIPAL'] };
  });
  const mixed = { ...tl, roles: ['VICE_PRINCIPAL'] };
  assert.deepEqual(
    (await repo.getAll(mixed)).goals.filter((g) => g.planLevel === 'SCHOOL_YEAR').map((g) => g.id),
    ['ag-3REVIEW', 'ag-3APPROVED', 'ag-4APPROVED'],
  );
});
