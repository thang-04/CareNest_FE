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
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { validateChildInfo } = await import('@/utils/children/childrenValidation');
const { validateGuardian } = await import('@/utils/account/guardianValidation');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Tiếp nhận xong thì kích hoạt được (plan docs/plans/completed/2026-10-27-guardian-activation-ready-at-enrollment.md, user chốt
 * 2026-10-28): không kiểm trùng nhân sự, email chỉ là liên hệ, định dạng phụ huynh ở tiếp nhận chặt bằng kích hoạt.
 * Mọi CCCD, SĐT, email là dữ liệu giả (CCCD bắt đầu bằng 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const digits = (v) => String(v).replace(/\s/g, '');

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

let seq = 0;
const payload = (list) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ Kích Hoạt ${seq}`,
      dateOfBirth: `2023-04-${String(seq).padStart(2, '0')}`,
      gender: 'MALE',
      guardians: list,
      profile: filledProfile(),
    },
    classId: '',
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  };
};
const guardian = (patch = {}) => ({
  fullName: 'Phụ huynh thử',
  relation: 'Mẹ',
  phone: '0900 000 401',
  idNumber: '999900000401',
  email: '',
  ...patch,
});
const csvOf = (rows) =>
  [IMPORT_COLUMNS.map((c) => c.label), ...rows.map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
const importRow = (patch = {}) => ({
  fullName: 'Trẻ Nhập Kích Hoạt',
  dateOfBirth: '06/04/2023',
  gender: 'Nam',
  guardianName: 'Phụ huynh trong file',
  relation: 'Mẹ',
  phone: '0900 000 406',
  guardianIdNumber: '999900000406',
  ...filledImportColumns(),
  ...patch,
});
const preview = (rows) => children.previewImport({ name: 'tiep-nhan.csv', text: async () => csvOf(rows) }, VP);
const accountOfPhone = (phone) => readDb().parentAccounts.find((a) => a.username === digits(phone));

// Form tiếp nhận tự kích hoạt khi lưu (user chốt 2026-10-28, L-14) ⇒ kết quả kích hoạt nằm ở guardianAccounts của kết quả lưu.
test('AC-1: SĐT, email phụ huynh trùng nhân sự ⇒ tiếp nhận lưu được, kích hoạt tạo tài khoản phụ huynh; tài khoản nhân sự giữ nguyên', async () => {
  const staff = readDb().users.find((u) => u.role === 'TEACHER' && u.phone && u.email);
  const saved = await children.enrollChild(payload([guardian({ phone: staff.phone, email: staff.email })]), VP);
  assert.equal(saved.guardianAccounts[0].result, 'CREATED');
  assert.ok(accountOfPhone(staff.phone).childIds.includes(saved.id));
  const after = readDb().users.find((u) => u.id === staff.id);
  assert.deepEqual([after.role, after.phone, after.email], [staff.role, staff.phone, staff.email]);
});

test('AC-2: email trùng tài khoản phụ huynh khác ⇒ không chặn; kích hoạt tạo tài khoản theo SĐT, không ghép theo email', async () => {
  const other = readDb().parentAccounts.find((a) => a.email && a.idNumber);
  const saved = await children.enrollChild(
    payload([guardian({ phone: '0900 000 402', idNumber: '999900000402', email: other.email })]),
    VP,
  );
  assert.equal(saved.guardianAccounts[0].result, 'CREATED');
  assert.ok(accountOfPhone('0900 000 402').childIds.includes(saved.id));
  assert.ok(
    !readDb()
      .parentAccounts.find((a) => a.id === other.id)
      .childIds.includes(saved.id),
  );
});

test('AC-3: giá trị kích hoạt từ chối vì định dạng thì tiếp nhận cũng từ chối; Excel họ tên phụ huynh quá 150 ký tự ⇒ dòng lỗi', async () => {
  const rejected = [
    { fullName: '' },
    { fullName: 'A'.repeat(151) },
    { phone: '0912' },
    { phone: '1912345678' },
    { email: 'lien-he@khong-dung' },
    { idNumber: '' },
    { idNumber: '12345' },
  ];
  rejected.forEach((patch) => {
    const g = guardian(patch);
    assert.ok(Object.keys(validateGuardian({ ...g, relationship: 'MOTHER' })).length, `kích hoạt từ chối ${JSON.stringify(patch)}`);
    const errors = validateChildInfo(payload([g]).child);
    assert.ok(
      Object.keys(errors).some((k) => k.startsWith('guardians.0.')),
      `tiếp nhận cũng từ chối ${JSON.stringify(patch)}`,
    );
  });
  assert.deepEqual(validateChildInfo(payload([guardian({ fullName: 'A'.repeat(150) })]).child)['guardians.0.fullName'], undefined);
  const { rows } = await preview([importRow({ guardianName: 'A'.repeat(151) })]);
  assert.ok(rows[0].errors.includes('Họ tên tối đa 150 ký tự'));
});

test('AC-4: tiếp nhận ở form kích hoạt ngay khi lưu; nhập Excel xong thì kích hoạt ngay được', async () => {
  const saved = await children.enrollChild(
    payload([
      guardian({ phone: '0900 000 404', idNumber: '999900000404', email: 'me.thu@example.invalid' }),
      guardian({ fullName: 'Bố thử', relation: 'Bố', phone: '0900 000 405', idNumber: '999900000405' }),
    ]),
    VP,
  );
  assert.deepEqual(
    saved.guardianAccounts.map((a) => a.result),
    ['CREATED', 'CREATED'],
  );
  const { rows } = await preview([importRow({ email: 'nhap.thu@example.invalid' })]);
  assert.deepEqual(rows[0].errors, []);
  const done = await children.importChildren([rows[0].payload], VP);
  const [imported] = await guardians.activateGuardians(done.ids[0], VP);
  assert.equal(imported.newAccount, true);
});

test('AC-5: bước 1 tiếp nhận: CCCD/SĐT lệch phụ huynh đã có ⇒ 409 theo ô; hợp lệ ⇒ không lỗi; giáo viên 403', async () => {
  const db = readDb();
  const taken = (a, g) => a.idNumber === g.idNumber || digits(a.phone) === digits(g.phone);
  const other = db.children
    .flatMap((c) => c.guardians || [])
    .find((g) => g.accountStatus === 'NOT_ACTIVATED' && g.idNumber && !db.parentAccounts.some((a) => taken(a, g)));
  const conflictAt = (key) => (err) => err.status === 409 && Object.hasOwn(err.details || {}, key);
  await assert.rejects(children.checkGuardianConflicts([guardian({ idNumber: other.idNumber })], VP), conflictAt('guardians.0.idNumber'));
  await assert.rejects(children.checkGuardianConflicts([guardian({ phone: other.phone })], VP), conflictAt('guardians.0.phone'));
  assert.equal(await children.checkGuardianConflicts([guardian()], VP), null);
  await assert.rejects(children.checkGuardianConflicts([guardian()], TEACHER), (err) => err.status === 403);
});
