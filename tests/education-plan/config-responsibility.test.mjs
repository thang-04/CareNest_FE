import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const { withDefaults, DEFAULT_WORKFLOW_POLICY, WORKFLOW_ROLES } = await import('@/models/education-plan/eduConfig');
const { toUiEduConfig } = await import('@/services/education-plan/api/yearPlanMapper');

const principalUser = { id: 1, role: 'PRINCIPAL', fullName: 'Demo Principal' };
const vicePrincipalUser = { id: 2, role: 'VICE_PRINCIPAL', fullName: 'Demo VP' };
const teacherUser = { id: 3, role: 'TEACHER', fullName: 'Demo Teacher' };

test('toUiEduConfig map chính xác workflowPolicy và workflowRevision từ backend response', () => {
  const beResponse = {
    domains: [{ name: 'Thể chất', standard: true }],
    workflowPolicy: {
      year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] },
      branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
      theme: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
    },
    workflowRevision: 5,
    signers: { year: ['VICE_PRINCIPAL'] },
  };
  const uiConfig = toUiEduConfig(beResponse);
  assert.equal(uiConfig.workflowRevision, 5);
  assert.deepEqual(uiConfig.workflowPolicy.year.creators, ['TEAM_LEADER']);
  assert.deepEqual(uiConfig.workflowPolicy.year.reviewers, ['VICE_PRINCIPAL']);
});
