import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CLASS_DOC, createBlocker, submitBlocker } = await import('../../src/models/education-plan/classPlan.js');

test('theme draft may start before a branch is approved, but submit still requires branch names', () => {
  const identity = { classId: 'c1', yearPlanId: 'team1', themeId: 'theme1' };
  const draft = { ...identity, kind: CLASS_DOC.THEME };

  assert.equal(createBlocker(CLASS_DOC.THEME, identity, { branchPlans: [] }), null);
  assert.match(submitBlocker(CLASS_DOC.THEME, draft, { branchPlans: [], weekPlans: [], yearPlan: { themes: [] } }), /chủ đề nhánh/i);
});
