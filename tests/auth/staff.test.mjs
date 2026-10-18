import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { staffMockRepository: repo } = await import('@/services/account/mock/staffMockRepository');
const { writeDb } = await import('@/mocks/mockDatabase');
const { getMenuForRole } = await import('@/layouts/menuConfig');

const ALL = ['ACCOUNT_MANAGE', 'ACCOUNT_STATUS_MANAGE', 'STAFF_ASSIGNMENT_MANAGE', 'PERMISSION_MANAGE'];
const HT = { id: 'u_hung', role: 'PRINCIPAL', permissions: ALL };
// PHT campus c1 được HT bật thêm quyền cấp tài khoản
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', permissions: ['ACCOUNT_MANAGE', 'ACCOUNT_STATUS_MANAGE', 'STAFF_ASSIGNMENT_MANAGE'] };
const VP_NO_ACCOUNT = { ...VP, permissions: ['STAFF_ASSIGNMENT_MANAGE'] };
const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const keysOf = (role, permissions) =>
  getMenuForRole(role, (code) => permissions.includes(code)).flatMap((m) => (m.children || []).map((c) => c.key));
const newTeacher = (extra) => ({
  username: 'gv.moi',
  fullName: 'Giáo viên Mới',
  email: '',
  role: 'TEACHER',
  temporaryPassword: 'Temp-Pass-1', // carenest:allow-secret
  campusId: '',
  classroomId: '',
  ...extra,
});

beforeEach(() => values.clear());

test('management hub remains in vice principal menu while its staff tab follows permissions', () => {
  assert.ok(keysOf('VICE_PRINCIPAL', ['STAFF_ASSIGNMENT_MANAGE']).includes('peopleHub'));
  assert.ok(keysOf('VICE_PRINCIPAL', []).includes('peopleHub'));
});

test('AUTH-08: vice principal lists only teachers/kitchen assigned in own campus', async () => {
  const all = await repo.searchAccounts({ size: 100 }, HT);
  const own = await repo.searchAccounts({ size: 100 }, VP);
  assert.ok(all.items.some((a) => a.userId === 'u_ngoc'), 'HT thấy GV campus 2');
  assert.ok(!own.items.some((a) => a.userId === 'u_ngoc'), 'PHT campus 1 không thấy GV campus 2');
  assert.ok(!own.items.some((a) => a.role === 'VICE_PRINCIPAL'));
  assert.ok(own.items.some((a) => a.userId === 'u_minhanh'));
  await rejects(repo.searchAccounts({ campusId: 'c2' }, VP), 403);
});

test('AUTH-08: staff-only list excludes parent accounts before pagination', async () => {
  await repo.getCampuses(HT);
  writeDb((db) => db.users.push({ id: 'parent_demo', username: 'parent.demo', fullName: 'Phụ huynh Mẫu', role: 'PARENT', status: 'ACTIVE' }));
  const all = await repo.searchAccounts({ size: 100 }, HT);
  const staff = await repo.searchAccounts({ staffOnly: true, size: 100 }, HT);
  assert.ok(all.items.some((a) => a.role === 'PARENT'));
  assert.ok(staff.items.every((a) => ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'].includes(a.role)));
  assert.ok(staff.totalElements < all.totalElements);
});

test('AUTH-16: campus roster includes empty classrooms and only scoped active assignments', async () => {
  await repo.getCampuses(HT);
  writeDb((db) => db.classes.push({ id: 'cls_empty', campusId: 'c1', name: 'Lớp mới', teacherIds: [] }));
  const roster = await repo.getRoster('c1', HT);
  assert.equal(roster.campusId, 'c1');
  assert.ok(roster.classrooms.some((room) => room.classroomId === 'cls_empty' && room.teachers.length === 0));
  assert.ok(roster.classrooms.some((room) => room.teachers.some((teacher) => teacher.userId === 'u_minhanh')));
  assert.ok(roster.vicePrincipals.every((person) => person.assignmentId && person.status));
  await rejects(repo.getRoster('c2', VP), 403);
});

test('AUTH-15: vice principal must assign new teacher into own campus; principal may skip assignment', async () => {
  await rejects(repo.createAccount(newTeacher(), VP), 400);
  await rejects(repo.createAccount(newTeacher({ classroomId: 'cls_c2_m1' }), VP), 403);
  await rejects(repo.createAccount(newTeacher({ classroomId: 'cls_c1_m1' }), VP_NO_ACCOUNT), 403);

  const created = await repo.createAccount(newTeacher({ classroomId: 'cls_c1_m1' }), VP);
  assert.equal(created.assignment.classroomId, 'cls_c1_m1');
  const unassigned = await repo.createAccount(newTeacher({ username: 'gv.ht' }), HT);
  assert.equal(unassigned.assignment, null);
  await rejects(repo.createAccount(newTeacher({ username: 'gv.ht' }), HT), 409);
});

test('AUTH-16/17: vice principal manages own campus staff only, never self', async () => {
  await repo.updateAccountStatus('u_minhanh', 'INACTIVE', VP);
  assert.equal((await repo.getAccount('u_minhanh', HT)).status, 'INACTIVE');
  await rejects(repo.updateAccountStatus('u_ngoc', 'INACTIVE', VP), 403);
  await rejects(repo.updateAccountStatus('u_lan', 'INACTIVE', VP), 400);
  await rejects(repo.resetTemporaryPassword('u_duc', 'Temp-Pass-1', VP), 403);

  const detail = await repo.getAccount('u_binh', VP);
  const open = detail.assignments.find((a) => !a.validTo);
  await rejects(repo.assignStaff({ userId: 'u_binh', campusId: 'c2' }, VP), 403);
  await rejects(repo.assignStaff({ userId: 'u_binh', campusId: 'c1' }, VP), 409);
  const ended = await repo.endAssignment(open.id, '2026-12-31', VP);
  assert.equal(ended.validTo, '2026-12-31');
});
