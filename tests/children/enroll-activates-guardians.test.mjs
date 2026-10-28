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
const { guardianMockRepository: guardians } = await import('@/services/account/mock/guardianMockRepository');
const { emptyChildInfo, emptyDeclaration, withGuardianAccounts } = await import('@/utils/children/childrenHelpers');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Tiếp nhận bằng form kích hoạt tài khoản phụ huynh ngay; nhập Excel kích hoạt sau (user chốt 2026-10-28, L-14;
 * plan docs/plans/active/2026-10-28-enroll-activates-guardians.md). Dữ liệu giả (CCCD bắt đầu bằng 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
// PHT chỉ được Thêm hồ sơ trẻ, không được Sửa ⇒ không kích hoạt phụ huynh.
const VP_CREATE_ONLY = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1', areas: { children: 'VC@c1' } };
const digits = (v) => String(v).replace(/\s/g, '');

const guardian = (n, patch = {}) => ({
  fullName: `Phụ huynh kích hoạt ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 8${String(n).padStart(2, '0')}`,
  idNumber: `9999000008${String(n).padStart(2, '0')}`,
  email: '',
  ...patch,
});
let seq = 0;
const row = (list) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ thử kích hoạt ${seq}`,
      dateOfBirth: '2023-03-09',
      gender: 'MALE',
      guardians: list,
      profile: filledProfile(),
    },
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  };
};
const accountOfPhone = (phone) => readDb().parentAccounts.find((a) => a.username === digits(phone));

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: lưu form tiếp nhận ⇒ tạo tài khoản cho mọi phụ huynh chưa có, gửi SMS, phụ huynh đang hoạt động', async () => {
  const saved = await children.enrollChild(
    { ...row([guardian(1), guardian(2, { fullName: 'Bố kích hoạt', relation: 'Bố' })]), classId: '' },
    VP,
  );
  assert.deepEqual(
    saved.guardianAccounts.map((a) => [a.result, a.smsStatus]),
    [
      ['CREATED', 'SENT'],
      ['CREATED', 'SENT'],
    ],
  );
  assert.deepEqual(
    saved.guardians.map((g) => g.accountStatus),
    ['ACTIVE', 'ACTIVE'],
  );
  [guardian(1), guardian(2)].forEach((g) => assert.ok(accountOfPhone(g.phone).childIds.includes(saved.id)));
});

test('AC-2: phụ huynh có CCCD khớp tài khoản có sẵn ⇒ chỉ liên kết, không tạo tài khoản, không gửi SMS', async () => {
  const existing = readDb().parentAccounts.find((a) => a.idNumber && a.status === 'ACTIVE');
  const before = readDb().parentAccounts.length;
  const sent = existing.sms?.length || 0;
  const saved = await children.enrollChild(
    { ...row([guardian(3, { idNumber: existing.idNumber, phone: existing.phone, fullName: existing.fullName })]), classId: '' },
    VP,
  );
  assert.deepEqual(saved.guardianAccounts[0].result, 'LINKED');
  assert.equal(saved.guardianAccounts[0].smsStatus, null);
  assert.equal(readDb().parentAccounts.length, before);
  const after = readDb().parentAccounts.find((a) => a.id === existing.id);
  assert.ok(after.childIds.includes(saved.id));
  assert.equal(after.sms?.length || 0, sent);
});

test('AC-3: SMS lỗi ⇒ hồ sơ và tài khoản vẫn lưu, báo SMS lỗi', async () => {
  const saved = await children.enrollChild({ ...row([guardian(99)]), classId: '' }, VP);
  assert.deepEqual([saved.guardianAccounts[0].result, saved.guardianAccounts[0].smsStatus], ['CREATED', 'FAILED']);
  assert.ok(readDb().children.some((c) => c.id === saved.id));
  assert.ok(accountOfPhone(guardian(99).phone));
});

test('AC-4: nhập Excel ⇒ phụ huynh chưa kích hoạt, không tạo tài khoản; kích hoạt sau ở màn Tài khoản phụ huynh', async () => {
  const before = readDb().parentAccounts.length;
  const done = await children.importChildren([row([guardian(4)])], VP);
  const child = readDb().children.find((c) => c.id === done.ids[0]);
  assert.equal(child.guardians[0].accountStatus, 'NOT_ACTIVATED');
  assert.equal(readDb().parentAccounts.length, before);
  const [result] = await guardians.activateGuardians(child.id, VP);
  assert.equal(result.newAccount, true);
});

test('AC-5: người lưu không có quyền Sửa hồ sơ trẻ ⇒ lưu được, phụ huynh chờ kích hoạt', async () => {
  const before = readDb().parentAccounts.length;
  const saved = await children.enrollChild({ ...row([guardian(5)]), classId: '' }, VP_CREATE_ONLY);
  assert.equal(saved.guardianAccounts[0].result, 'NOT_ACTIVATED');
  assert.equal(readDb().parentAccounts.length, before);
});

// P-18 A (user chốt 2026-10-28); không có quyền thì giữ thông tin tài khoản (user đồng ý 2026-10-28).
test('P-18 A: không có quyền kích hoạt ⇒ phụ huynh trùng CCCD chỉ liên kết, giữ thông tin tài khoản; phụ huynh mới chờ kích hoạt', async () => {
  const existing = readDb().parentAccounts.find((a) => a.idNumber && a.status === 'ACTIVE');
  const sent = existing.sms?.length || 0;
  const saved = await children.enrollChild(
    {
      ...row([
        guardian(6, { idNumber: existing.idNumber, phone: '0900 000 896', fullName: 'Tên gõ khác tài khoản', email: 'khac@example.test' }),
        guardian(7, { relation: 'Bố' }),
      ]),
      classId: '',
    },
    VP_CREATE_ONLY,
  );
  const after = readDb().parentAccounts.find((a) => a.id === existing.id);
  assert.deepEqual(
    [after.username, after.phone, after.fullName, after.email || ''],
    [existing.username, existing.phone, existing.fullName, existing.email || ''],
  );
  assert.equal(after.sms?.length || 0, sent);
  assert.ok(after.childIds.includes(saved.id));
  assert.deepEqual([saved.guardians[0].fullName, digits(saved.guardians[0].phone)], [existing.fullName, digits(existing.phone)]);
  assert.deepEqual(
    saved.guardianAccounts.map((a) => [a.result, a.phoneChanged]),
    [
      ['LINKED', false],
      ['NOT_ACTIVATED', false],
    ],
  );
  assert.equal(accountOfPhone(guardian(7).phone), undefined);
});

test('P-18 A: form tiếp nhận hiện thông tin tài khoản khi không có quyền kích hoạt', () => {
  const account = { fullName: 'Tên theo tài khoản', phone: '0900000811', email: 'tk@example.test' };
  const typed = [{ ...guardian(12), fullName: 'Tên đã gõ', email: '' }];
  const fields = ([g]) => [g.fullName, digits(g.phone), g.email];
  assert.deepEqual(fields(withGuardianAccounts(typed, () => account)), ['Tên đã gõ', digits(guardian(12).phone), 'tk@example.test']);
  assert.deepEqual(fields(withGuardianAccounts(typed, () => account, { accountOnly: true })), [
    'Tên theo tài khoản',
    '0900000811',
    'tk@example.test',
  ]);
});
