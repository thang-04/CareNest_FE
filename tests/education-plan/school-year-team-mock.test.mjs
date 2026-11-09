import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = new EventTarget();
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
const { educationPlanMockRepository: repo } = await import('../../src/services/education-plan/mock/educationPlanMockRepository.js');
const { readDb, writeDb } = await import('../../src/mocks/mockDatabase.js');
const { eduConfigMockRepository: configRepo } = await import('../../src/services/education-plan/mock/eduConfigMockRepository.js');
const { inheritAnnual } = await import('../../src/models/education-plan/planLevel.mjs');
const vp = { id: 'synthetic-vp', name: 'PHT kiểm thử', fullName: 'PHT kiểm thử', role: 'VICE_PRINCIPAL' };
const ht = { id: 'synthetic-ht', name: 'HT kiểm thử', fullName: 'HT kiểm thử', role: 'PRINCIPAL' };
const tl = { id: 'synthetic-tl', name: 'TL kiểm thử', fullName: 'TL kiểm thử', role: 'TEAM_LEADER', ageGroupId: 'ag-3' };
test('annual PHT→HT; TEAM inheritance keeps source and permits only per-content ticks', async () => {
  await repo.getAll(vp);
  const root = {
    id: 'test-annual',
    code: 'TEST',
    planLevel: 'SCHOOL_YEAR',
    schoolYear: '2098 – 2099',
    ageGroupId: 'ag-3',
    title: 'Kế hoạch kiểm thử',
    status: 'DRAFT',
    themes: [{ id: 'theme-test', name: 'Chủ đề', abbr: 'CD', start: '2098-09-01', end: '2098-09-12' }],
    domains: [
      {
        id: 'domain-test',
        name: 'Phát triển thể chất',
        rows: [
          {
            id: 'goal-test',
            kind: 'goal',
            text: 'Mục tiêu kiểm thử',
            displayLabel: 'Mục tiêu 01',
            contents: [{ id: 'content-test', text: 'Nội dung kiểm thử', themes: [] }],
          },
        ],
      },
    ],
    branchTemplates: [],
    breaks: [],
  };
  let annual = await repo.saveGoal(root, { actor: vp });
  assert.equal(annual.domains[0].rows[0].displayLabel, 'Mục tiêu 01');
  const oldClient = structuredClone(annual);
  delete oldClient.domains[0].rows[0].displayLabel;
  annual = await repo.saveGoal(oldClient, { actor: vp });
  assert.equal(annual.domains[0].rows[0].displayLabel, 'Mục tiêu 01');
  annual.domains[0].rows[0].displayLabel = '';
  annual = await repo.saveGoal(annual, { actor: vp });
  assert.equal(annual.domains[0].rows[0].displayLabel, null);
  annual.domains[0].rows[0].displayLabel = 'Mục tiêu 01';
  annual = await repo.saveGoal(annual, { actor: vp });
  assert.equal(annual.permissions.canEdit, true);
  const invalidSchedule = structuredClone(annual);
  const wrongWeekday = new Date(`${root.themes[0].start}T00:00:00Z`);
  if (wrongWeekday.getUTCDay() === 1) wrongWeekday.setUTCDate(wrongWeekday.getUTCDate() + 1);
  invalidSchedule.branchTemplates = [
    {
      id: 'bad-schedule',
      themeId: root.themes[0].id,
      name: 'Lệch thứ',
      startDate: wrongWeekday.toISOString().slice(0, 10),
      endDate: root.themes[0].end,
    },
  ];
  const invalidDraft = await repo.saveGoal(invalidSchedule, { actor: vp });
  assert.equal(invalidDraft.branchTemplates.length, 1);
  await assert.rejects(repo.saveGoal({ ...invalidDraft, status: 'REVIEW' }, { actor: vp, action: 'submit' }), /Thứ 2/);
  assert.equal(readDb().eduGoals.find((plan) => plan.id === root.id).status, 'DRAFT');
  annual = await repo.saveGoal({ ...annual, status: 'REVIEW' }, { actor: vp, action: 'submit' });
  assert.equal(annual.waitingRole, 'PRINCIPAL');
  await assert.rejects(repo.saveGoal({ ...annual, status: 'APPROVED' }, { actor: vp, action: 'approve' }));
  annual = await repo.saveGoal({ ...annual, status: 'APPROVED' }, { actor: ht, action: 'approve' });
  assert.equal(annual.status, 'APPROVED');
  let team = await repo.saveGoal({ ...root, ...inheritAnnual(annual), id: 'test-team', code: 'TEAM', status: 'DRAFT' }, { actor: tl });
  assert.equal(team.domains[0].rows[0].displayLabel, 'Mục tiêu 01');
  const oldTeamClient = structuredClone(team);
  delete oldTeamClient.domains[0].rows[0].displayLabel;
  team = await repo.saveGoal(oldTeamClient, { actor: tl });
  assert.equal(team.domains[0].rows[0].displayLabel, 'Mục tiêu 01');
  const badLabel = structuredClone(team);
  badLabel.domains[0].rows[0].displayLabel = 'Đã đổi 99';
  await assert.rejects(repo.saveGoal(badLabel, { actor: tl }));
  team.domains[0].rows[0].contents[0].themes = ['theme-test'];
  team = await repo.saveGoal(team, { actor: tl });
  assert.deepEqual(team.domains[0].rows[0].contents[0].themes, ['theme-test']);
  const bad = structuredClone(team);
  bad.domains[0].rows[0].text = 'Sửa trái phép';
  await assert.rejects(repo.saveGoal(bad, { actor: tl }));
  assert.equal(readDb().eduGoals.find((g) => g.id === 'test-annual').domains[0].rows[0].text, 'Mục tiêu kiểm thử');
  await assert.rejects(repo.deleteGoal(team.id, team.revision, vp));
  assert.ok(readDb().eduGoals.some((g) => g.id === team.id));
});
test('duration only HT can save; stale revisions rejected and existing snapshots retained', async () => {
  const cfg = await configRepo.get(ht);
  const next = { ...cfg, durationPolicy: { ...cfg.durationPolicy, branch: { minWeeks: 2, maxWeeks: 3 } } };
  await assert.rejects(configRepo.save(next, vp));
  const old = structuredClone(readDb().eduGoals.find((g) => g.id === 'test-team').durationPolicySnapshot);
  const saved = await configRepo.save(next, ht);
  assert.equal(saved.durationPolicy.branch.minWeeks, 2);
  assert.deepEqual(readDb().eduGoals.find((g) => g.id === 'test-team').durationPolicySnapshot, old);
  await assert.rejects(configRepo.save({ ...saved, durationPolicy: { ...cfg.durationPolicy, branch: { minWeeks: 3, maxWeeks: 4 } } }, ht));
});
test('PHT cannot delete TEAM even if configured as its creator; other deletion rules stay intact', async () => {
  writeDb((db) => {
    db.eduConfig.workflowPolicy.year = { creators: ['VICE_PRINCIPAL'], reviewers: ['PRINCIPAL'] };
    db.eduGoals.push({ id: 'test-legacy-delete', status: 'DRAFT', schoolYear: '2098 – 2099', ageGroupId: 'ag-3', domains: [], themes: [] });
  });
  const docs = await repo.getAll(vp);
  assert.equal(docs.goals.find((g) => g.id === 'test-legacy-delete').permissions.canDelete, false);
  await assert.rejects(repo.deleteGoal('test-legacy-delete', 0, vp));
});

test('editing legacy TEAM without snapshot does not apply new duration limits retroactively', async () => {
  const current = readDb().eduGoals.find((g) => g.id === 'test-legacy-delete');
  const saved = await repo.saveGoal({ ...current, title: 'Cập nhật bản cũ' }, { actor: vp });
  assert.equal(saved.durationPolicySnapshot.mode, 'LEGACY_UNBOUNDED');
});

test('TEAM review resolve checks distinct review ID/source/revision/lease, persists progress and blocks unresolved submit', async () => {
  const item = { id: 'review-team', planLevel: 'TEAM', title: 'Tổ rà soát tổng hợp', schoolYear: '2098 – 2099', ageGroupId: 'ag-3',
    status: 'DRAFT', revision: 0, curriculumSourcePlanId: null, themes: [{ id: 'current-theme' }],
    domains: [{ name: 'Phát triển thể chất', rows: [{ id: 'review-goal', kind: 'goal', text: 'Mục tiêu', contents: [{ id: 'content-11', text: 'Nội dung', themes: ['gone-theme'] }] }] }],
    reviewItems: [{ reviewItemId: 'review-91', itemId: 'content-11', itemKind: 'CONTENT', sourcePlanId: null, reason: 'Liên kết mất', resolved: false }],
    newItems: [{ itemKind: 'GOAL', itemId: 'new-goal' }] };
  writeDb((db) => db.eduGoals.push(item));
  const edit = { sessionId: 'review-session', revision: 0, requestId: 'request-91' };
  let current = await repo.startEditingGoal(item.id, vp, edit);
  await assert.rejects(repo.resolveGoalReview(item.id, 'content-11', null, edit, vp));
  await assert.rejects(repo.resolveGoalReview(item.id, 'review-91', 'stale-source', edit, vp));
  await assert.rejects(repo.resolveGoalReview(item.id, 'review-91', null, { ...edit, sessionId: 'old-session' }, vp));
  await assert.rejects(repo.resolveGoalReview(item.id, 'review-91', null, edit, vp));
  current.domains[0].rows[0].contents[0].themes = ['current-theme'];
  current = await repo.saveGoal(current, { actor: vp, edit });
  edit.revision = current.revision; edit.requestId = 'request-92';
  await assert.rejects(repo.saveGoal({ ...current, status: 'REVIEW', reviewItems: [] }, { actor: vp, edit, action: 'submit' }));
  await assert.rejects(repo.resolveGoalReview(item.id, 'review-91', null, { ...edit, revision: -1 }, vp));
  const resolved = await repo.resolveGoalReview(item.id, 'review-91', null, edit, vp);
  assert.equal(resolved.reviewItems[0].resolved, true);
  const reopened = await repo.getGoalSource(item.id, vp);
  assert.equal(reopened.reviewItems[0].reviewItemId, 'review-91');
  assert.equal(reopened.reviewItems[0].resolved, true); assert.deepEqual(reopened.newItems, item.newItems);
  for (const actor of [vp, ht, tl]) await assert.rejects(repo.deleteGoal(item.id, resolved.revision, actor));
});
