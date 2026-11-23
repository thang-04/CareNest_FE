import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const { axiosClient } = await import('@/services/http/axiosClient');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');
const policies = {
  year: { creators: ['TEAM_LEADER'], reviewers: ['PRINCIPAL'] },
  branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER'] },
  theme: { creators: ['TEACHER'], reviewers: ['VICE_PRINCIPAL'] },
};
const response = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

test('mock policy rejects multiple creator roles and reviewers below the creator', async () => {
  const { eduConfigMockRepository: repo } = await import('@/services/education-plan/mock/eduConfigMockRepository');
  const principal = { id: 'wf-principal', role: 'PRINCIPAL' };
  for (const policy of [
    { creators: ['TEACHER', 'TEAM_LEADER'], reviewers: ['PRINCIPAL'] },
    { creators: ['VICE_PRINCIPAL'], reviewers: ['TEAM_LEADER'] },
  ]) {
    const cfg = await repo.get(principal);
    await assert.rejects(repo.saveWorkflowPolicy({ ...cfg, workflowPolicy: { ...cfg.workflowPolicy, theme: policy } }, principal),
      { status: 400 });
  }
});

test('mock class approvals follow the configured chain and retain an unavailable final step', async () => {
  const { writeDb, readDb } = await import('@/mocks/mockDatabase');
  const { classPlanMockRepository: repo } = await import('@/services/education-plan/mock/classPlanMockRepository');
  const { withDefaults } = await import('@/models/education-plan/eduConfig');
  const teacher = { id: 'wf-teacher', role: 'TEACHER', status: 'ACTIVE' };
  const vp = { id: 'wf-vp', role: 'VICE_PRINCIPAL', status: 'ACTIVE' };
  const leader = { id: 'wf-leader', role: 'TEAM_LEADER', ageGroupId: 'wf-age', status: 'ACTIVE' };
  for (const [reviewers, users, waiting] of [
    [['VICE_PRINCIPAL'], [teacher, vp, leader], 'VICE_PRINCIPAL'],
    [['TEAM_LEADER', 'VICE_PRINCIPAL'], [teacher, vp, leader], 'TEAM_LEADER'],
    [['TEAM_LEADER', 'VICE_PRINCIPAL'], [teacher, vp], 'VICE_PRINCIPAL'],
    [['TEAM_LEADER'], [teacher], 'TEAM_LEADER'],
  ]) {
    writeDb((db) => {
      const cfg = withDefaults();
      db.eduConfig = { ...cfg, workflowPolicy: { ...cfg.workflowPolicy, theme: { creators: ['TEACHER'], reviewers } } };
      db.users = users;
      db.classes = [{ id: 'wf-class', teacherIds: [teacher.id], homeroomTeacherId: teacher.id, ageGroupId: 'wf-age', schoolYear: 'wf-year' }];
      db.eduGoals = [{ id: 'wf-plan', planLevel: 'TEAM', status: 'APPROVED', ageGroupId: 'wf-age', schoolYear: 'wf-year', themes: [], domains: [] }];
      db.eduClassBranch = [{ id: 'wf-branch', classId: 'wf-class', yearPlanId: 'wf-plan', names: {} }];
      db.eduClassWeek = [];
      db.eduClassTheme = [{ id: 'wf-theme', kind: 'theme', classId: 'wf-class', yearPlanId: 'wf-plan', themeId: 'wf-t', status: 'DRAFT', version: 0, authorIds: [teacher.id] }];
    });
    const sent = await repo.act('theme', 'wf-theme', { action: 'submit' }, teacher, { version: 0 });
    assert.equal(sent.status, 'REVIEW');
    assert.equal(sent.waitingRole, waiting);
    assert.deepEqual(sent.approvals, []);
    await assert.rejects(repo.act('theme', sent.id, { action: 'approve' }, teacher, { version: sent.version }));
    if (!users.includes(vp)) continue;
    if (waiting === 'TEAM_LEADER') {
      await assert.rejects(repo.act('theme', sent.id, { action: 'approve' }, vp, { version: sent.version }));
      await repo.act('theme', sent.id, { action: 'approve' }, leader, { version: sent.version });
    }
    const current = readDb().eduClassTheme[0];
    const issued = await repo.act('theme', current.id, { action: 'approve' }, vp, { version: current.version });
    assert.equal(issued.status, 'APPROVED');
    assert.deepEqual(issued.approvals.map((a) => a.roleKey), waiting === 'TEAM_LEADER' ? ['TEAM_LEADER', 'VICE_PRINCIPAL'] : ['VICE_PRINCIPAL']);
  }
});
// EDU-108: người soạn/duyệt lưu ở tab Phân quyền (PUT /permissions/edu-workflow); trang Cấu hình không ghi policy
test('real adapter reads nested policy, config save never writes workflow policy and reads fresh after reload', async () => {
  const calls = [];
  const workflow = { revision: 7, policies, canConfigure: true };
  const signers = { year: ['VICE_PRINCIPAL'], branch: ['TEAM_LEADER'], week: [] };
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      assert.deepEqual(body.signers, signers);
      assert.equal(body.lateApprovalGraceDays, 3);
      assert.equal(body.lateReturnGraceDays, 4);
      assert.equal(body.workflow, undefined);
      assert.equal(body.workflowPolicy, undefined);
    }
    return response(
      config,
      config.url.endsWith('/workflow-policy') ? workflow : { workflow, signers, ageGroups: [{ id: 3, code: 'ag-3' }], yearCreationScopes: [3] },
    );
  };
  const config = await educationPlanApi.getEduConfig();
  assert.equal(config.canConfigure, true);
  assert.deepEqual(config.yearCreationScopes, ['ag-3']);
  assert.equal(config.workflowRevision, 7);
  assert.equal(educationPlanApi.saveWorkflowPolicy, undefined);
  const configSaved = await educationPlanApi.saveEduConfig({
    ...config, lateApprovalGraceDays: 3, lateReturnGraceDays: 4, signers: { year: [], branch: [], week: [] },
  });
  assert.deepEqual(configSaved.workflowPolicy.branch.creators, ['TEACHER']);
  assert.equal(configSaved.canConfigure, true);
  assert.equal(configSaved.workflowRevision, 7);
  const reloaded = await educationPlanApi.getEduConfig();
  assert.deepEqual(reloaded.workflowPolicy, policies);
  assert.equal(calls.filter((call) => call.method === 'put' && call.url.endsWith('/workflow-policy')).length, 0);
});

test('missing new duration endpoint does not prevent loading the existing education pages', async () => {
  axiosClient.defaults.adapter = async (config) => {
    if (config.url.endsWith('/duration-policy'))
      throw new AxiosError('not found', 'ERR_BAD_REQUEST', config, null, { status: 404, config, headers: {}, data: { desc: 'Not found' } });
    return response(config, config.url.endsWith('/workflow-policy') ? { revision: 1, policies, canConfigure: true } : { ageGroups: [] });
  };
  const loaded = await educationPlanApi.getEduConfig();
  assert.equal(loaded.workflowRevision, 1);
  assert.equal(loaded.durationPolicyAvailable, false);
});
test('duration endpoint permission/server failures are not hidden as compatibility fallback', async () => {
  for (const status of [403, 500]) {
    axiosClient.defaults.adapter = async (config) => {
      if (config.url.endsWith('/duration-policy'))
        throw new AxiosError('failure', 'ERR_BAD_REQUEST', config, null, { status, config, headers: {}, data: { desc: 'Failure' } });
      return response(config, config.url.endsWith('/workflow-policy') ? { revision: 1, policies } : {});
    };
    await assert.rejects(educationPlanApi.getEduConfig(), { status });
  }
});

test('saving legacy settings keeps the new duration section unavailable and sends no duration write', async () => {
  const writes = [];
  axiosClient.defaults.adapter = async (config) => {
    if (config.method === 'put') writes.push(config.url);
    if (config.url.endsWith('/duration-policy'))
      throw new AxiosError('not found', 'ERR_BAD_REQUEST', config, null, { status: 404, config, headers: {}, data: { desc: 'Not found' } });
    return response(config, config.url.endsWith('/workflow-policy') ? { revision: 1, policies } : {});
  };
  const loaded = await educationPlanApi.getEduConfig();
  const saved = await educationPlanApi.saveEduConfig({
    ...loaded,
    durationPolicy: { revision: 1, theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } },
  });
  assert.deepEqual(writes, ['/education-plans/config']);
  assert.equal(saved.durationPolicyAvailable, false);
});
