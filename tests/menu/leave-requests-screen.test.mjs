import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { getMenuForRole } = await import('@/layouts/menuConfig');
const { createAttendanceBeApi } = await import('@/services/attendance/api/attendanceApi');

const keys = (menu) => menu.flatMap((e) => [e.key, ...(e.children || []).map((c) => c.key)]);

test('teachers and leaders see the parent leave list in the attendance menu', () => {
  for (const role of ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL']) {
    assert.ok(keys(getMenuForRole(role, { role })).includes('leaveRequests'), role);
  }
  assert.ok(!keys(getMenuForRole('KITCHEN_STAFF', { role: 'KITCHEN_STAFF' })).includes('leaveRequests'));
});

test('leave list calls GET /leave-requests with the chosen filters', async () => {
  const calls = [];
  const api = createAttendanceBeApi({ get: async (url, config) => (calls.push({ url, config }), []) });
  await api.searchLeaveRequests({ from: '2026-10-01', to: '2026-10-31', classId: '5' });
  assert.equal(calls[0].url, '/leave-requests');
  assert.deepEqual(calls[0].config.params, { from: '2026-10-01', to: '2026-10-31', campusId: undefined, classId: '5' });
});
