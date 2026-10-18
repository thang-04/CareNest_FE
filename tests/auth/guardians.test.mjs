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

const { guardianMockRepository: repo } = await import('@/services/account/mock/guardianMockRepository');
const { normalizePhone } = await import('@/utils/account/guardianValidation');

const HT = { id: 'u_hung', role: 'PRINCIPAL', permissions: ['PARENT_ACCOUNT_MANAGE'] };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', permissions: ['PARENT_ACCOUNT_MANAGE'] };
const VP_OFF = { ...VP, permissions: [] };
const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const form = (extra) => ({ phone: '+84 901 234 567', fullName: 'Phụ huynh Mới', relationship: 'MOTHER', ...extra });

beforeEach(() => values.clear());

test('phone normalization matches BE rule', () => {
  assert.equal(normalizePhone('+84 901.234-567'), '0901234567');
  assert.equal(normalizePhone('84901234567'), '0901234567');
  assert.equal(normalizePhone('12345'), null);
});

test('AUTH-08: vice principal sees only children of own campus; needs permission', async () => {
  const all = await repo.searchChildren({ size: 500 }, HT);
  const own = await repo.searchChildren({ size: 500 }, VP);
  assert.ok(all.totalElements > own.totalElements, 'HT thấy nhiều trẻ hơn PHT một campus');
  await rejects(repo.searchChildren({ campusId: 'c2' }, VP), 403);
  await rejects(repo.searchChildren({}, VP_OFF), 403);
});

test('AUTH-18: new phone creates account with one-time password; same phone only links', async () => {
  const [first, second] = (await repo.searchChildren({ size: 500 }, VP)).items;
  const created = await repo.addGuardian(first.id, form(), VP);
  assert.equal(created.username, '0901234567');
  assert.equal(created.newAccount, true);
  assert.match(created.temporaryPassword, /^[A-Za-z2-9]{10}$/);

  const linked = await repo.addGuardian(second.id, form({ fullName: 'Tên khác' }), VP);
  assert.equal(linked.newAccount, false);
  assert.equal(linked.temporaryPassword, null);
  await rejects(repo.addGuardian(first.id, form(), VP), 409);
  assert.equal(
    (await repo.listGuardians(first.id, VP)).some((g) => g.username === '0901234567'),
    true,
  );
});

test('AUTH-18/19: out-of-campus child denied; remove keeps account; reset returns new password', async () => {
  const otherCampus = (await repo.searchChildren({ campusId: 'c2', size: 1 }, HT)).items[0];
  await rejects(repo.addGuardian(otherCampus.id, form(), VP), 403);

  const child = (await repo.searchChildren({ size: 1 }, VP)).items[0];
  const created = await repo.addGuardian(child.id, form({ phone: '0909 111 222' }), VP);
  const reset = await repo.resetParentPassword(created.userId, VP);
  assert.notEqual(reset.temporaryPassword, created.temporaryPassword);
  await repo.removeGuardian(child.id, created.userId, VP);
  assert.equal(
    (await repo.listGuardians(child.id, VP)).some((g) => g.userId === created.userId),
    false,
  );
  // Không còn trẻ liên kết trong campus ⇒ PHT không quản lý tài khoản này nữa; HT vẫn được
  await rejects(repo.updateParentStatus(created.userId, 'INACTIVE', VP), 403);
  const locked = await repo.updateParentStatus(created.userId, 'INACTIVE', HT);
  assert.equal(locked.status, 'INACTIVE');
});

test('AUTH-18: searchChildren includes guardians array for inline actions', async () => {
  const result = await repo.searchChildren({ size: 10 }, HT);
  const withGuardians = result.items.find((c) => c.guardianCount > 0);
  assert.ok(withGuardians, 'Phải có trẻ có phụ huynh trong seed');
  assert.ok(Array.isArray(withGuardians.guardians), 'guardians phải là mảng');
  assert.equal(withGuardians.guardians.length, withGuardians.guardianCount);
  assert.ok(withGuardians.guardians[0].fullName, 'Phụ huynh phải có họ tên');
  assert.ok(withGuardians.guardians[0].username, 'Phụ huynh phải có username');
});
