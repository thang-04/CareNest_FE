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

const { resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { guardianMockRepository: guardians } = await import('@/services/account/mock/guardianMockRepository');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { validateChildInfo } = await import('@/utils/children/childrenValidation');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Quan hệ phụ huynh 6 loại cho cả hồ sơ lẫn tài khoản (D-5a B), tối đa 3 phụ huynh mỗi trẻ (D-5b A) — user chốt 2026-10-28.
 * Dữ liệu giả: CCCD bắt đầu bằng 999, SĐT 0900 000 5xx.
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const guardian = (n, patch = {}) => ({
  fullName: `Phụ huynh quan hệ ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 5${String(n).padStart(2, '0')}`,
  idNumber: `9999000005${String(n).padStart(2, '0')}`,
  email: '',
  ...patch,
});
let seq = 0;
const payload = (list) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ thử quan hệ ${seq}`,
      dateOfBirth: '2022-08-19',
      gender: 'FEMALE',
      guardians: list,
      profile: filledProfile(),
    },
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
    classId: '',
  };
};
const csvOf = (rows) =>
  [IMPORT_COLUMNS.map((c) => c.label), ...rows.map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
const csvRow = (n, patch = {}) => ({
  fullName: `Trẻ nhập quan hệ ${n}`,
  dateOfBirth: `0${n}/03/2023`,
  gender: 'Nữ',
  guardianName: `Phụ huynh nhập quan hệ ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 52${n}`,
  guardianIdNumber: `99990000052${n}`,
  ...filledImportColumns(),
  ...patch,
});

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('D-5b: mỗi trẻ tối đa 3 phụ huynh (form và BE giả)', async () => {
  const four = [guardian(1), guardian(2, { relation: 'Bố' }), guardian(3, { relation: 'Ông' }), guardian(4, { relation: 'Bà' })];
  assert.equal(validateChildInfo(payload(four).child).guardians, 'Mỗi trẻ tối đa 3 phụ huynh');
  await rejects(children.enrollChild(payload(four), VP), 422, 'guardians');
});

test('D-5a: quan hệ chỉ 6 loại; tài khoản dùng đúng loại của hồ sơ', async () => {
  await rejects(children.enrollChild(payload([guardian(5, { relation: 'Dì' })]), VP), 422, 'guardians.0.relation');
  const saved = await children.enrollChild(payload([guardian(6, { relation: 'Ông' }), guardian(7, { relation: 'Anh/chị' })]), VP);
  const linked = await guardians.listGuardians(saved.id, VP);
  assert.deepEqual(linked.map((g) => g.relationship).sort(), ['GRANDFATHER', 'SIBLING']);
});

test('D-5a: file Excel nhận quan hệ không dấu, không phân biệt hoa thường; giá trị khác báo lỗi ở dòng đó', () => {
  const { rows } = readEnrollmentCsv(
    csvOf([csvRow(1, { relation: 'anh chị' }), csvRow(2, { relation: 'MẸ' }), csvRow(3, { relation: 'Cô' })]),
  );
  assert.deepEqual(
    rows.map((r) => r.payload.child.guardians[0].relation),
    ['Anh/chị', 'Mẹ', 'Cô'],
  );
  assert.ok(validateChildInfo(rows[2].payload.child)['guardians.0.relation']);
  assert.equal(validateChildInfo(rows[0].payload.child)['guardians.0.relation'], undefined);
});
