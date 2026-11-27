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
  assert.deepEqual(
    calls.map((c) => [c.method, c.url]),
    [
      ['post', '/children/1/guardians/2/phone-change-requests'],
      ['get', '/parent-accounts/phone-change-requests'],
      ['post', '/parent-accounts/phone-change-requests/3/approve'],
      ['post', '/parent-accounts/phone-change-requests/4/reject'],
    ],
  );
  assert.deepEqual(JSON.parse(calls[0].data), { newPhone: '0900000001', reason: 'Kiểm thử' });
  assert.deepEqual(calls[1].params, { status: 'PENDING' });
  assert.deepEqual(JSON.parse(calls[3].data), { note: 'Lý do' });
});

test('đổi số demo giữ số cũ đến khi duyệt và loại yêu cầu đã quyết định', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  const { phoneChangeMock: mock } = await import('@/mocks/phoneChangeMock');
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

test('giáo viên có quyền đề xuất gửi được yêu cầu trong lớp mình nhưng không được duyệt', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  const { phoneChangeMock: mock } = await import('@/mocks/phoneChangeMock');
  const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
  const { readDb } = await import('@/mocks/mockDatabase');
  const child = ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE' && c.guardians?.[0]);
  const guardian = child.guardians[0];
  const teacher = { id: 'teacher_phone', role: 'TEACHER', bePermissions: ['CHILD_PROFILE_EDIT'], classIds: [child.classId] };
  const body = { newPhone: '0900000986', reason: 'Kiểm thử quyền đề xuất' };
  const row = mock.requestPhoneChange(child.id, guardian.id, body, teacher);
  assert.equal(row.canDecide, false);
  assert.equal(readDb().children.find((c) => c.id === child.id).guardians[0].phone, guardian.phone);
  assert.throws(
    () => mock.approvePhoneChange(row.id, teacher),
    (e) => e.status === 403,
  );
  assert.throws(
    () => mock.requestPhoneChange(child.id, guardian.id, body, { ...teacher, bePermissions: [] }),
    (e) => e.status === 403,
  );
  assert.throws(
    () => mock.requestPhoneChange(child.id, guardian.id, body, { ...teacher, classIds: ['other_class'] }),
    (e) => e.status === 403,
  );
  const vp = { id: 'vp_phone', role: 'VICE_PRINCIPAL', bePermissions: ['PARENT_ACCOUNT_MANAGE'], locationIds: [child.campusId] };
  assert.equal(mock.listPhoneChangeRequests('PENDING', vp)[0].canDecide, true);
  assert.deepEqual(mock.listPhoneChangeRequests('PENDING', { ...vp, locationIds: ['other_campus'] }), []);
  assert.throws(
    () => mock.approvePhoneChange(row.id, { ...vp, locationIds: ['other_campus'] }),
    (e) => e.status === 403,
  );
});
