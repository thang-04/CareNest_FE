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
  await api.searchLeaveRequests({ from: '2026-10-01', to: '2026-10-31', classId: '5', schoolYear: 7 });
  assert.equal(calls[0].url, '/leave-requests');
  // Năm học chọn ở đầu trang gửi kèm để xem lại đơn của năm cũ
  assert.deepEqual(calls[0].config.params, {
    from: '2026-10-01',
    to: '2026-10-31',
    campusId: undefined,
    classId: '5',
    schoolYearId: 7,
  });
});

test('teachers and team leaders see the monthly quality report in the assessment menu', () => {
  for (const role of ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL']) {
    assert.ok(keys(getMenuForRole(role, { role })).includes('assessQuality'), role);
  }
});

test('teachers and leaders no longer see monthly evaluations but keep other assessment screens', () => {
  for (const role of ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL']) {
    const menu = keys(getMenuForRole(role, { role }));
    assert.ok(!menu.includes('assessPeriodic'), role);
    for (const key of ['assessSemester', 'assessYearEnd', 'assessQuality', 'assessTickets']) {
      assert.ok(menu.includes(key), `${role}: ${key}`);
    }
  }
});

test('assessment menu follows evaluation periods: day, week, theme, month, semester, year', () => {
  const order = [
    'assessDaily',
    'assessWeeklyComments',
    'assessTickets',
    'assessThemes',
    'assessQuality',
    'assessSemester',
    'assessYearEnd',
    'assessRewards',
    'assessClassRatings',
  ];
  for (const role of ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL']) {
    const menu = keys(getMenuForRole(role, { role }));
    const present = order.filter((k) => menu.includes(k));
    assert.deepEqual(
      present.map((k) => menu.indexOf(k)),
      [...present.map((k) => menu.indexOf(k))].sort((x, y) => x - y),
      role,
    );
    assert.ok(present.includes('assessWeeklyComments'), role);
  }
});
