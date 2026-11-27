import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const { axiosClient } = await import('@/services/http/axiosClient');
const { phoneChangeApi: api } = await import('@/services/account/api/phoneChangeApi');

test('yêu cầu đổi số điện thoại và quyết định dùng đúng API', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return { status: 200, headers: {}, config, data: { code: 200, data: {} } };
  };
  await api.requestPhoneChange(1, 2, { newPhone: '0900000001', reason: 'Kiểm thử' });
  await api.listPhoneChangeRequests('PENDING');
  await api.approvePhoneChange(3);
  await api.rejectPhoneChange(4, 'Lý do');
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [
    ['post', '/children/1/guardians/2/phone-change-requests'],
    ['get', '/parent-accounts/phone-change-requests'],
    ['post', '/parent-accounts/phone-change-requests/3/approve'],
    ['post', '/parent-accounts/phone-change-requests/4/reject'],
  ]);
  assert.deepEqual(JSON.parse(calls[0].data), { newPhone: '0900000001', reason: 'Kiểm thử' });
  assert.deepEqual(calls[1].params, { status: 'PENDING' });
  assert.deepEqual(JSON.parse(calls[3].data), { note: 'Lý do' });
});

test('đổi số demo giữ số cũ đến khi duyệt và loại yêu cầu đã quyết định', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const { phoneChangeMock: mock } = await import('@/services/account/mock/phoneChangeMock');
  const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
  const { readDb } = await import('@/mocks/mockDatabase');
  const actor = { id: 'demo', role: 'PRINCIPAL' };
  const child = ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE' && c.guardians?.[0]);
  const g = child.guardians[0];
  const currentPhone = () => readDb().children.find((c) => c.id === child.id).guardians[0].phone;
  const newPhone = '0900000987';
  const row = mock.requestPhoneChange(child.id, g.id, { newPhone, reason: 'Kiểm thử' }, actor);
  assert.equal(currentPhone(), g.phone);
  assert.equal(mock.listPhoneChangeRequests('PENDING', actor)[0].canDecide, true);
  assert.throws(() => mock.rejectPhoneChange(row.id, '', actor));
  mock.approvePhoneChange(row.id, actor);
  assert.equal(currentPhone(), newPhone);
  assert.equal(mock.listPhoneChangeRequests('PENDING', actor).length, 0);
});
