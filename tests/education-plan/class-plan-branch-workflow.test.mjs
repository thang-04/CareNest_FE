import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CLASS_DOC, createBlocker, submitBlocker } = await import('../../src/models/education-plan/classPlan.js');

test('theme draft may start before a branch is approved, but submit still requires branch names', () => {
  const identity = { classId: 'c1', yearPlanId: 'team1', themeId: 'theme1' };
  const draft = { ...identity, kind: CLASS_DOC.THEME };

  assert.equal(createBlocker(CLASS_DOC.THEME, identity, { branchPlans: [] }), null);
  assert.match(submitBlocker(CLASS_DOC.THEME, draft, { branchPlans: [], weekPlans: [], yearPlan: { themes: [] } }), /chủ đề nhánh/i);
});

test('week plan cannot be created until the week has a branch name (EDU-14, 13/11/2026)', () => {
  const yearPlan = { themes: [{ id: 'theme1', name: 'Bản thân', start: '2026-09-07', end: '2026-09-18' }], breaks: [] };
  const identity = { classId: 'c1', yearPlanId: 'y1', themeId: 'theme1', weekStart: '2026-09-14' };
  const classThemePlans = [{ classId: 'c1', yearPlanId: 'y1', themeId: 'theme1' }];
  const branch = (name) => ({
    classId: 'c1',
    yearPlanId: 'y1',
    branches: [{ key: 'b1', themeId: 'theme1', name, startDate: '2026-09-07', endDate: '2026-09-18' }],
  });
  const lock = (branchPlans) => createBlocker(CLASS_DOC.WEEK, identity, { branchPlans, classThemePlans, yearPlan });
  assert.equal(lock([]).need, 'branch');
  assert.equal(lock([branch('  ')]).need, 'branch');
  assert.equal(lock([branch('Bé là ai')]), null);
  assert.equal(createBlocker(CLASS_DOC.WEEK, identity, { branchPlans: [branch('Bé là ai')], classThemePlans: [], yearPlan }).need, 'theme');
});
