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
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-23-guardian-identity-by-citizen-id.md: CCCD là khóa nhận diện tài khoản
 * phụ huynh khi tiếp nhận, sửa hồ sơ, nhập Excel. Mọi CCCD, SĐT là số giả (CCCD bắt đầu bằng 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const digits = (v) => String(v).replace(/\s/g, '');

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

let seq = 0;
const payload = (guardians) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ Liên Kết ${seq}`,
      dateOfBirth: `2023-03-${String(seq).padStart(2, '0')}`,
      gender: 'FEMALE',
      guardians,
      profile: filledProfile(),
    },
    classId: '',
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  };
};
const guardian = (patch = {}) => ({
  fullName: 'Phụ huynh gõ tay',
  relation: 'Mẹ',
  phone: '0900 000 201',
  idNumber: '999900000201',
  email: '',
  ...patch,
});
const activeAccount = () => readDb().parentAccounts.find((a) => a.status === 'ACTIVE' && a.idNumber);

test('AC-1: tra CCCD ⇒ thông tin tài khoản; không trùng ⇒ null; Hiệu trưởng tra được; giáo viên 403', async () => {
  const acc = activeAccount();
  const found = await children.findParentAccountByCitizenId(acc.idNumber.replace(/(\d{4})/g, '$1 '), VP);
  assert.equal(found.id, acc.id);
  assert.equal(found.phone, acc.phone);
  assert.equal(found.children.length + found.otherChildrenCount > 0, true);
  assert.equal(await children.findParentAccountByCitizenId('999988887777', VP), null);
  assert.equal((await children.findParentAccountByCitizenId(acc.idNumber, PRINCIPAL)).id, acc.id);
  await assert.rejects(children.findParentAccountByCitizenId(acc.idNumber, TEACHER), (err) => err.status === 403);
});

// Form điền sẵn thông tin tài khoản khi CCCD trùng; sửa ở form thì tài khoản đổi theo (user chốt 2026-10-28) — test sửa ở guardian-info-editable.
const asAccount = (acc, patch = {}) =>
  guardian({ idNumber: acc.idNumber, fullName: acc.fullName, phone: acc.phone, email: acc.email || '', ...patch });

test('AC-2: tiếp nhận với CCCD trùng tài khoản, thông tin như tài khoản ⇒ liên kết trẻ, tài khoản giữ nguyên, không cần kích hoạt', async () => {
  const acc = structuredClone(activeAccount());
  const saved = await children.enrollChild(payload([asAccount(acc)]), VP);
  const g = saved.guardians[0];
  assert.equal(g.fullName, acc.fullName);
  assert.equal(digits(g.phone), acc.phone);
  assert.equal(g.accountStatus, 'ACTIVE');
  assert.equal(readDb().parentAccounts.find((a) => a.id === acc.id).username, acc.username);
  assert.ok(
    readDb()
      .parentAccounts.find((a) => a.id === acc.id)
      .childIds.includes(saved.id),
  );
});

test('AC-3: CCCD mới nhưng SĐT của phụ huynh có CCCD khác ⇒ 409 dưới ô SĐT', async () => {
  const acc = activeAccount();
  await assert.rejects(
    children.enrollChild(payload([guardian({ phone: acc.phone })]), VP),
    (err) => err.status === 409 && !!err.details?.['guardians.0.phone'],
  );
});

test('AC-4: sửa hồ sơ, thêm phụ huynh có CCCD trùng tài khoản ⇒ liên kết', async () => {
  const saved = await children.enrollChild(payload([guardian()]), VP);
  const acc = structuredClone(readDb().parentAccounts.find((a) => a.status === 'ACTIVE' && a.idNumber && !a.childIds.includes(saved.id)));
  const form = {
    fullName: saved.fullName,
    dateOfBirth: saved.dateOfBirth,
    gender: saved.gender,
    guardians: [...saved.guardians, asAccount(acc, { relation: 'Bố' })],
    profile: saved.profile,
  };
  const updated = await children.updateChild(saved.id, { child: form, reason: 'Thêm bố (giả)' }, VP);
  assert.equal(updated.guardians[1].fullName, acc.fullName);
  assert.equal(updated.guardians[1].accountStatus, 'ACTIVE');
  assert.ok(
    readDb()
      .parentAccounts.find((a) => a.id === acc.id)
      .childIds.includes(saved.id),
  );
});

const csvOf = (rows) =>
  [IMPORT_COLUMNS.map((c) => c.label), ...rows.map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

test('AC-5: Excel: dòng có CCCD trùng tài khoản không lỗi, có ghi chú; nhập thì liên kết tài khoản', async () => {
  const acc = activeAccount();
  const text = csvOf([
    {
      fullName: 'Trẻ Nhập Liên Kết',
      dateOfBirth: '05/04/2023',
      gender: 'Nữ',
      guardianName: 'Tên trong file',
      relation: 'Mẹ',
      phone: '0900 000 203',
      guardianIdNumber: acc.idNumber,
      ...filledImportColumns(),
    },
  ]);
  const { rows } = await children.previewImport({ name: 'tiep-nhan.csv', text: async () => text }, VP);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].notes.length, 1);
  assert.equal(rows[0].payload.child.guardians[0].fullName, acc.fullName);
  const done = await children.importChildren([rows[0].payload], VP);
  assert.ok(
    readDb()
      .parentAccounts.find((a) => a.id === acc.id)
      .childIds.includes(done.ids[0]),
  );
});
