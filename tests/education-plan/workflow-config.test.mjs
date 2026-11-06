import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
globalThis.window = new EventTarget();
const { axiosClient } = await import('@/services/http/axiosClient');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');
const policies = { year: { creators: ['TEAM_LEADER'], reviewers: ['PRINCIPAL'] }, branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER'] }, theme: { creators: ['TEACHER'], reviewers: ['VICE_PRINCIPAL'] } };
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
      assert.equal(body.signers, undefined);
      assert.equal(body.workflow, undefined);
      assert.equal(body.workflowPolicy, undefined);
    }
    return response(config, config.url.endsWith('/workflow-policy') ? workflow : { workflow, ageGroups: [{ id: 3, code: 'ag-3' }], yearCreationScopes: [3] });
  };
  const config = await educationPlanApi.getEduConfig();
  assert.equal(config.canConfigure, true);
  assert.deepEqual(config.yearCreationScopes, ['ag-3']);
  assert.equal(config.workflowRevision, 7);
  const saved = await educationPlanApi.saveWorkflowPolicy(config);
  assert.equal(saved.workflowRevision, 8);
  await educationPlanApi.saveEduConfig(saved);
  const reloaded = await educationPlanApi.getEduConfig();
  assert.equal(reloaded.workflowRevision, 8);
  assert.deepEqual(reloaded.workflowPolicy, policies);
  assert.equal(calls.filter((call) => call.method === 'put' && call.url.endsWith('/workflow-policy')).length, 1);
});
test('policy conflicts invalidate cache and next read uses server policy and rights', async () => {
  axiosClient.defaults.adapter = async (config) => {
    if (config.method === 'put') throw new AxiosError('conflict', 'ERR_BAD_REQUEST', config, null, { status: 409, config, headers: {}, data: { desc: 'Concurrent update' } });
    return response(config, config.url.endsWith('/workflow-policy') ? { revision: 12, policies, canConfigure: false } : {});
  };
  await assert.rejects(educationPlanApi.saveWorkflowPolicy({ workflowRevision: 8, workflowPolicy: policies }), { status: 409 });
  const reloaded = await educationPlanApi.getEduConfig();
  assert.equal(reloaded.workflowRevision, 12);
  assert.equal(reloaded.canConfigure, false);
});
