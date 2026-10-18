import assert from 'node:assert/strict';
import { test } from 'node:test';

const { axiosClient } = await import('@/services/http/axiosClient');
const { staffApi } = await import('@/services/account/api/staffApi');

test('staff client sends staff-only list filter and campus roster request', async () => {
  const calls = [];
  const original = axiosClient.get;
  axiosClient.get = async (...args) => { calls.push(args); return {}; };
  try {
    await staffApi.searchAccounts({ staffOnly: true, page: 1, size: 20 });
    await staffApi.getRoster('c1');
    assert.equal(calls[0][0], '/accounts');
    assert.equal(calls[0][1].params.staffOnly, true);
    assert.deepEqual(calls[1], ['/staff-assignments/roster', { params: { campusId: 'c1' } }]);
  } finally {
    axiosClient.get = original;
  }
});
