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

// EDU-110: người soạn/duyệt suy từ ma trận vai trò (PUT /role-permissions); trang Cấu hình không ghi policy
test('real adapter reads nested policy, config save never writes workflow policy and reads fresh after reload', async () => {
  const calls = [];
  const workflow = { revision: 7, policies, canConfigure: true };
  const signers = { year: ['VICE_PRINCIPAL'], branch: ['TEAM_LEADER'], week: [] };
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      assert.deepEqual(body.signers, signers);
      // EDU-109: không còn gửi số ngày ân hạn
      assert.equal(body.lateApprovalGraceDays, undefined);
      assert.equal(body.lateReturnGraceDays, undefined);
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
