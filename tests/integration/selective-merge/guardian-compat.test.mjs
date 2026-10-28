import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) };
globalThis.window = new EventTarget();
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { guardianMockRepository: repo } = await import('@/services/account/mock/guardianMockRepository');
const { migrateGuardianAccounts, healthNotificationRecipients } = await import('@/services/account/mock/guardianCompatibility');
const { authMockRepository: auth, DEMO_PASSWORD } = await import('@/mocks/authMockRepository');
const { normalizePhone } = await import('@/utils/account/guardianValidation');
let vp;
let child;
const form = (patch = {}) => ({ fullName: 'Liên hệ minh họa', phone: '0987654321', email: '', relationship: 'MOTHER', idNumber: '999987654321', ...patch });
const rejectStatus = (status) => (error) => error.status === status;
// Phụ huynh nhập ở hồ sơ trẻ rồi kích hoạt (AUTH-20); thêm phụ huynh kèm tạo tài khoản ngay đã bỏ (user chốt 2026-10-28, C-4 A).
const addAndActivate = async (childId, f, actor) => {
  writeDb((db) => { db.children.find((row) => row.id === childId).guardians.push({ fullName: f.fullName, relation: 'Mẹ', phone: f.phone, idNumber: f.idNumber, email: f.email, accountStatus: 'NOT_ACTIVATED' }); });
  return (await repo.activateGuardians(childId, actor)).find((row) => row.phone === normalizePhone(f.phone));
};
beforeEach(async () => {
  resetDb();
  const user = readDb().users.find((row) => row.role === 'VICE_PRINCIPAL' && row.campusId === 'c1');
  vp = (await auth.login({ email: user.email, password: DEMO_PASSWORD })).user;
  const rows = await repo.searchChildren({ campusId: 'c1' }, vp);
  child = rows.items.find((row) => row.canManage);
  assert.ok(child);
});
test('UI structure/scope giữ campus legacy; teacher không ghi tài khoản, Hiệu trưởng ghi được (2026-10-23)', async () => {
  const structure = await repo.getStructure(vp);
  assert.ok(structure.campuses.some((row) => row.id === 'c1'));
  const principal = readDb().users.find((row) => row.role === 'PRINCIPAL');
  // Hiệu trưởng kích hoạt tài khoản phụ huynh toàn trường (user chốt 2026-10-23, thay quy định chỉ Phó hiệu trưởng).
  assert.ok((await addAndActivate(child.id, form(), principal)).newAccount);
  await assert.rejects(repo.listGuardians(child.id, { id: 'teacher', role: 'TEACHER' }), rejectStatus(403));
  const other = readDb().children.find((row) => row.campusId === 'c2');
  await assert.rejects(repo.listGuardians(other.id, vp), rejectStatus(403));
});
// User chốt 2026-10-28: tài khoản nhân sự tách riêng; email chỉ là liên hệ, tài khoản phụ huynh tìm theo SĐT.
test('SĐT/email nhân sự không chặn; email của tài khoản khác không ghép, tài khoản tìm theo SĐT', async () => {
  const staff = readDb().users.find((row) => row.role === 'TEACHER' && row.phone && row.email);
  assert.ok((await addAndActivate(child.id, form({ phone: staff.phone, email: staff.email }), vp)).newAccount);
  const [a, b] = readDb()
    .parentAccounts.filter((row) => row.email && row.idNumber && !(row.childIds || []).includes(child.id))
    .slice(0, 2);
  assert.ok(a && b);
  const linked = await addAndActivate(child.id, form({ phone: a.phone, idNumber: a.idNumber, email: b.email }), vp);
  assert.equal(linked.newAccount, false);
  const accountOf = (id) => readDb().parentAccounts.find((row) => row.id === id);
  assert.ok(accountOf(a.id).childIds.includes(child.id));
  assert.ok(!accountOf(b.id).childIds.includes(child.id));
});
test('thêm phụ huynh không email: hồ sơ, thông báo demo, khóa/gỡ liên kết đồng nhất', async () => {
  const added = await addAndActivate(child.id, form(), vp);
  assert.ok(added.newAccount);
  let db = readDb();
  let canonical = db.children.find((row) => row.id === child.id);
  assert.ok(canonical.guardians.some((row) => row.accountId === added.userId));
  assert.ok(healthNotificationRecipients(db, canonical).some((row) => row.recipientKey === `parent:${added.userId}`));
  await repo.updateParentStatus(added.userId, 'INACTIVE', vp);
  db = readDb(); canonical = db.children.find((row) => row.id === child.id);
  assert.equal(healthNotificationRecipients(db, canonical).some((row) => row.recipientKey === `parent:${added.userId}`), false);
  await repo.updateParentStatus(added.userId, 'ACTIVE', vp);
  await repo.removeGuardian(child.id, added.userId, vp);
  db = readDb(); canonical = db.children.find((row) => row.id === child.id);
  assert.ok(canonical.guardians.some((row) => row.accountId === added.userId && row.phone === '0987654321'));
  assert.equal((await repo.listGuardians(child.id, vp)).some((row) => row.userId === added.userId), false);
  assert.equal(healthNotificationRecipients(db, canonical).some((row) => row.recipientKey === `parent:${added.userId}`), false);
});
test('liên kết tài khoản đã có giữ ID/mật khẩu; không tạo trùng và giữ history/health/pickup', async () => {
  const added = await addAndActivate(child.id, form(), vp);
  const another = (await repo.searchChildren({ campusId: 'c1' }, vp)).items.find((row) => row.id !== child.id && row.canManage);
  const snapshot = structuredClone({ health: readDb().healthMeasurements, declarations: readDb().healthDeclarations, placements: readDb().childPlacements, pickups: readDb().pickups, users: readDb().users, classes: readDb().classes });
  const linked = await addAndActivate(another.id, form(), vp);
  assert.equal(linked.newAccount, false);
  assert.equal(linked.userId, added.userId);
  assert.equal(linked.smsStatus, null, 'tài khoản có sẵn giữ mật khẩu, không gửi SMS');
  assert.ok(!('temporaryPassword' in linked));
  // Không còn ai chờ kích hoạt ⇒ 409, không tạo tài khoản trùng.
  await assert.rejects(repo.activateGuardians(another.id, vp), rejectStatus(409));
  assert.deepEqual({ health: readDb().healthMeasurements, declarations: readDb().healthDeclarations, placements: readDb().childPlacements, pickups: readDb().pickups, users: readDb().users, classes: readDb().classes }, snapshot);
});
test('migration ID trùng idempotent, không khôi phục liên kết/mảng đã xóa', () => {
  const db = { parentAccounts: [{ id: 'same', phone: '0911111111', childIds: ['demo'] }, { id: 'same', phone: '0922222222', childIds: ['demo'] }], children: [{ id: 'demo', guardians: [{ accountId: 'same', phone: '0922222222' }] }] };
  migrateGuardianAccounts(db);
  assert.notEqual(db.parentAccounts[0].id, db.parentAccounts[1].id);
  assert.equal(db.children[0].guardians[0].accountId, db.parentAccounts[1].id);
  const before = structuredClone(db);
  migrateGuardianAccounts(db);
  assert.deepEqual(db, before);
  const empty = { parentAccounts: [], children: [] };
  migrateGuardianAccounts(empty);
  assert.deepEqual(empty.parentAccounts, []);
});
test('thông báo legacy giữ email key, không phát trùng và không nhận khi account khóa/gỡ', () => {
  const guardian = { fullName: 'Demo', phone: '0911111111', email: 'guardian@example.invalid', accountStatus: 'ACTIVE' };
  const canonical = { id: 'demo', guardians: [guardian, { ...guardian }] };
  const db = { parentAccounts: [{ id: 'p-demo', phone: guardian.phone, status: 'ACTIVE', childIds: ['demo'] }] };
  assert.deepEqual(healthNotificationRecipients(db, canonical).map((row) => row.recipientKey), [guardian.email]);
  db.parentAccounts[0].childIds = [];
  assert.equal(healthNotificationRecipients(db, canonical).length, 0);
});
