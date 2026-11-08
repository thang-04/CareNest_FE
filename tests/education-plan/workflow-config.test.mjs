import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
globalThis.window = new EventTarget();
const { axiosClient } = await import('@/services/http/axiosClient');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');
const policies = {
  year: { creators: ['TEAM_LEADER'], reviewers: ['PRINCIPAL'] },
  branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER'] },
  theme: { creators: ['TEACHER'], reviewers: ['VICE_PRINCIPAL'] },
};
const response = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });
test('real adapter reads nested policy, saves expected revision separately and reads fresh after reload', async () => {
  const calls = [];
  let workflow = { revision: 7, policies, canConfigure: true };
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      if (config.url.endsWith('/workflow-policy')) {
        assert.deepEqual(body, { revision: 7, policies });
        workflow = { ...workflow, revision: 8 };
        return response(config, workflow);
      }
      assert.deepEqual(body.signers, {
        year: policies.year.reviewers,
        branch: policies.branch.reviewers,
        week: policies.theme.reviewers,
      });
      assert.equal(body.workflow, undefined);
      assert.equal(body.workflowPolicy, undefined);
    }
    return response(
      config,
      config.url.endsWith('/workflow-policy') ? workflow : { workflow, ageGroups: [{ id: 3, code: 'ag-3' }], yearCreationScopes: [3] },
    );
  };
  const config = await educationPlanApi.getEduConfig();
  assert.equal(config.canConfigure, true);
  assert.deepEqual(config.yearCreationScopes, ['ag-3']);
  assert.equal(config.workflowRevision, 7);
  const saved = await educationPlanApi.saveWorkflowPolicy(config);
  assert.equal(saved.workflowRevision, 8);
  const configSaved = await educationPlanApi.saveEduConfig({ ...saved, signers: { year: [], branch: [], week: [] } });
  assert.deepEqual(configSaved.workflowPolicy.branch.creators, ['TEACHER']);
  assert.equal(configSaved.canConfigure, true);
  assert.equal(configSaved.workflowRevision, 8);
  const reloaded = await educationPlanApi.getEduConfig();
  assert.equal(reloaded.workflowRevision, 8);
  assert.deepEqual(reloaded.workflowPolicy, policies);
  assert.equal(calls.filter((call) => call.method === 'put' && call.url.endsWith('/workflow-policy')).length, 1);
});
test('policy conflicts invalidate cache and next read uses server policy and rights', async () => {
  axiosClient.defaults.adapter = async (config) => {
    if (config.method === 'put')
      throw new AxiosError('conflict', 'ERR_BAD_REQUEST', config, null, {
        status: 409,
        config,
        headers: {},
        data: { desc: 'Concurrent update' },
      });
    return response(config, config.url.endsWith('/workflow-policy') ? { revision: 12, policies, canConfigure: false } : {});
  };
  await assert.rejects(educationPlanApi.saveWorkflowPolicy({ workflowRevision: 8, workflowPolicy: policies }), { status: 409 });
  const reloaded = await educationPlanApi.getEduConfig();
  assert.equal(reloaded.workflowRevision, 12);
  assert.equal(reloaded.canConfigure, false);
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
