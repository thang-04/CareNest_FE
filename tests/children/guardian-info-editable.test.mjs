import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { readDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Thông tin phụ huynh sửa được ở hồ sơ trẻ, tài khoản đổi theo; đổi SĐT ⇒ tên đăng nhập đổi sang số mới, mật khẩu tạm mới gửi SMS
 * tới số mới (user chốt 2026-10-28; plan docs/plans/active/2026-10-28-guardian-info-editable.md). Dữ liệu giả (CCCD bắt đầu 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const digits = (v) => String(v).replace(/\s/g, '');
const snapshot = (id) => structuredClone(readDb().parentAccounts.find((a) => a.id === id));
const accountByUsername = (phone) => readDb().parentAccounts.find((a) => a.username === digits(phone));

const guardian = (n, patch = {}) => ({
  fullName: `Phụ huynh sửa ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 6${String(n).padStart(2, '0')}`,
  idNumber: `9999000006${String(n).padStart(2, '0')}`,
  email: '',
  ...patch,
});
let seq = 0;
const enroll = (list) => {
  seq += 1;
  return children.enrollChild(
    {
      child: {
        ...emptyChildInfo(),
        fullName: `Trẻ sửa phụ huynh ${seq}`,
        dateOfBirth: '2023-01-15',
        gender: 'FEMALE',
        guardians: list,
        profile: filledProfile(),
      },
      classId: '',
      declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
    },
    VP,
  );
};
const formOf = (saved, guardians) => ({
  fullName: saved.fullName,
  dateOfBirth: saved.dateOfBirth,
  gender: saved.gender,
  guardians:
    guardians ?? saved.guardians.map(({ fullName, relation, phone, idNumber, email }) => ({ fullName, relation, phone, idNumber, email })),
  profile: saved.profile,
});
const update = (saved, guardians) =>
  children.updateChild(saved.id, { child: formOf(saved, guardians), reason: 'Phụ huynh đổi thông tin (giả)' }, VP);
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: Sửa hồ sơ đổi SĐT ⇒ tên đăng nhập sang số mới, mật khẩu mới gửi SMS số mới; hồ sơ anh/chị đổi theo', async () => {
  const first = await enroll([guardian(1)]);
  const sibling = await enroll([guardian(1)]);
  const account = accountByUsername(guardian(1).phone);
  const before = snapshot(account.id);
  const [g] = formOf(first).guardians;
  const result = await update(first, [{ ...g, phone: '0900 000 650' }]);
  assert.deepEqual(
    result.accountChanges.map((c) => [c.phoneChanged, c.smsStatus]),
    [[true, 'SENT']],
  );
  const after = snapshot(account.id);
  assert.equal(after.username, '0900000650');
  assert.equal(after.phone, '0900000650');
  assert.equal(after.mustChangePassword, true);
  assert.equal(after.sms.length, before.sms.length + 1);
  const other = readDb().children.find((c) => c.id === sibling.id);
  assert.equal(digits(other.guardians[0].phone), '0900000650');
  assert.equal(other.guardians[0].accountStatus, 'ACTIVE');
});

test('AC-2: đổi họ tên, email, CCCD ⇒ tài khoản và hồ sơ anh/chị đổi theo, không cấp mật khẩu mới', async () => {
  const first = await enroll([guardian(2)]);
  const sibling = await enroll([guardian(2)]);
  const account = accountByUsername(guardian(2).phone);
  const before = snapshot(account.id);
  const [g] = formOf(first).guardians;
  const result = await update(first, [{ ...g, fullName: 'Tên mới (giả)', email: 'moi@example.invalid', idNumber: '999900000652' }]);
  assert.deepEqual(
    result.accountChanges.map((c) => c.phoneChanged),
    [false],
  );
  const after = snapshot(account.id);
  assert.deepEqual(
    [after.fullName, after.email, after.idNumber, after.username],
    ['Tên mới (giả)', 'moi@example.invalid', '999900000652', before.username],
  );
  assert.equal(after.sms.length, before.sms.length);
  const copy = readDb().children.find((c) => c.id === sibling.id).guardians[0];
  assert.deepEqual([copy.fullName, copy.idNumber], ['Tên mới (giả)', '999900000652']);
});

test('AC-3: tiếp nhận với CCCD của tài khoản có sẵn và SĐT khác ⇒ liên kết, đổi tên đăng nhập, gửi mật khẩu mới', async () => {
  await enroll([guardian(3)]);
  const account = accountByUsername(guardian(3).phone);
  const saved = await enroll([guardian(3, { phone: '0900 000 653' })]);
  assert.deepEqual(
    [saved.guardianAccounts[0].result, saved.guardianAccounts[0].phoneChanged, saved.guardianAccounts[0].smsStatus],
    ['LINKED', true, 'SENT'],
  );
  const after = snapshot(account.id);
  assert.equal(after.username, '0900000653');
  assert.ok(after.childIds.includes(saved.id));
});

test('AC-4: số mới đã thuộc phụ huynh khác ⇒ 409 dưới ô SĐT, không đổi gì', async () => {
  const first = await enroll([guardian(4)]);
  await enroll([guardian(5)]);
  const account = accountByUsername(guardian(4).phone);
  const before = snapshot(account.id);
  const [g] = formOf(first).guardians;
  await rejects(update(first, [{ ...g, phone: guardian(5).phone }]), 409, 'guardians.0.phone');
  assert.deepEqual(snapshot(account.id), before);
});

test('AC-5: đổi cùng lúc CCCD và SĐT của phụ huynh đã có tài khoản ⇒ 422 dưới ô CCCD', async () => {
  const first = await enroll([guardian(6)]);
  const [g] = formOf(first).guardians;
  await rejects(update(first, [{ ...g, phone: '0900 000 656', idNumber: '999900000656' }]), 422, 'guardians.0.idNumber');
});

test('AC-6: nhập Excel dòng có CCCD của tài khoản ⇒ dùng thông tin tài khoản, không sửa tài khoản từ file', async () => {
  await enroll([guardian(7)]);
  const account = accountByUsername(guardian(7).phone);
  const before = snapshot(account.id);
  const row = {
    fullName: 'Trẻ nhập file (giả)',
    dateOfBirth: '01/02/2023',
    gender: 'Nữ',
    guardianName: 'Tên khác trong file',
    relation: 'Mẹ',
    phone: guardian(7).phone,
    guardianIdNumber: guardian(7).idNumber,
    ...filledImportColumns(),
  };
  const csv = [IMPORT_COLUMNS.map((c) => c.label), IMPORT_COLUMNS.map((c) => row[c.key] ?? '')]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const { rows } = await children.previewImport({ name: 'tiep-nhan.csv', text: async () => csv }, VP);
  assert.equal(rows[0].payload.child.guardians[0].fullName, before.fullName);
  await children.importChildren([rows[0].payload], VP);
  assert.equal(snapshot(account.id).fullName, before.fullName);
});
