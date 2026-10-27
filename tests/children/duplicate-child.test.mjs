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
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { todayInput } = await import('@/utils/format');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Trùng hồ sơ trẻ (user chốt 2026-10-23): cùng họ tên, ngày sinh và CCCD của ít nhất một phụ huynh; khác phụ huynh thì tiếp nhận
 * bình thường. Trẻ đã nghỉ học trùng ⇒ gợi ý mở lại hồ sơ cũ (về Chờ xếp lớp). Dữ liệu giả (CCCD bắt đầu bằng 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const DOB = '2023-05-17';
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));

const guardian = (n, patch = {}) => ({
  fullName: `Phụ huynh thử ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 5${String(n).padStart(2, '0')}`,
  idNumber: `9999000005${String(n).padStart(2, '0')}`,
  email: '',
  ...patch,
});
const payload = (fullName, guardians) => ({
  child: { ...emptyChildInfo(), fullName, dateOfBirth: DOB, gender: 'FEMALE', guardians, profile: filledProfile() },
  classId: '',
  declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
});
const check = (fullName, guardians) =>
  children.checkDuplicate({ fullName, dateOfBirth: DOB, guardianIdNumbers: guardians.map((g) => g.idNumber) }, VP);

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('cùng họ tên, ngày sinh nhưng khác phụ huynh ⇒ hai trẻ khác nhau, tiếp nhận được', async () => {
  await children.enrollChild(payload('Nguyễn Minh Anh', [guardian(1)]), VP);
  assert.equal(await check('Nguyễn Minh Anh', [guardian(2)]), null);
  const second = await children.enrollChild(payload('Nguyễn Minh Anh', [guardian(2)]), VP);
  assert.equal(second.fullName, 'Nguyễn Minh Anh');
});

test('cùng họ tên, ngày sinh và CCCD một phụ huynh ⇒ trùng hồ sơ: báo hồ sơ đã có, lưu bị 409', async () => {
  const first = await children.enrollChild(payload('Nguyễn Minh Anh', [guardian(1)]), VP);
  const dup = await check('  nguyễn  minh anh ', [guardian(3), guardian(1)]);
  assert.equal(dup.kind, 'ACTIVE');
  assert.equal(dup.id, first.id);
  await rejects(children.enrollChild(payload('Nguyễn Minh Anh', [guardian(1)]), VP), 409);
});

test('trẻ sinh đôi tên chỉ khác dấu (Minh Anh / Minh Ánh), cùng phụ huynh ⇒ không trùng', async () => {
  await children.enrollChild(payload('Nguyễn Minh Anh', [guardian(1)]), VP);
  assert.equal(await check('Nguyễn Minh Ánh', [guardian(1)]), null);
  await children.enrollChild(payload('Nguyễn Minh Ánh', [guardian(1)]), VP);
});

test('trẻ đã nghỉ học trùng ⇒ gợi ý mở lại hồ sơ cũ; mở lại về Chờ xếp lớp, giữ mã; vẫn được tạo hồ sơ mới', async () => {
  const old = await children.enrollChild(payload('Trần Bảo Ngọc', [guardian(4)]), VP);
  await children.withdrawChild(old.id, { leftAt: todayInput(), reason: 'Chuyển nơi ở (giả)' }, VP);
  const dup = await check('Trần Bảo Ngọc', [guardian(4)]);
  assert.equal(dup.kind, 'LEFT');
  assert.equal(dup.id, old.id);
  assert.equal(dup.canReadmit, true);
  await rejects(children.readmitChild(old.id, { reason: ' ' }, VP), 422, 'reason');
  await assert.rejects(children.readmitChild(old.id, { reason: 'Quay lại học (giả)' }, TEACHER), (err) => err.status === 403);
  const back = await children.readmitChild(old.id, { reason: 'Gia đình chuyển về lại (giả)' }, VP);
  assert.equal(back.status, 'PENDING_PLACEMENT');
  assert.equal(back.code, old.code);
  assert.equal(back.classId, null);
  await assert.rejects(children.readmitChild(old.id, { reason: 'Lần hai (giả)' }, VP), (err) => err.status === 409);
  // Hồ sơ đã mở lại là trẻ đang chờ xếp lớp ⇒ giờ là trùng thật.
  assert.equal((await check('Trần Bảo Ngọc', [guardian(4)])).kind, 'ACTIVE');
});

test('trẻ đã nghỉ học: không mở lại mà tạo hồ sơ mới vẫn được (không 409)', async () => {
  const old = await children.enrollChild(payload('Lê Gia Huy', [guardian(5)]), VP);
  await children.withdrawChild(old.id, { leftAt: todayInput(), reason: 'Nghỉ (giả)' }, VP);
  const fresh = await children.enrollChild(payload('Lê Gia Huy', [guardian(5)]), VP);
  assert.notEqual(fresh.id, old.id);
});

test('sửa hồ sơ thành trùng trẻ khác (họ tên, ngày sinh, phụ huynh) ⇒ 409; khác phụ huynh thì lưu được', async () => {
  const a = await children.enrollChild(payload('Phạm Thu Hà', [guardian(6)]), VP);
  const b = await children.enrollChild(payload('Phạm Thu Hằng', [guardian(7)]), VP);
  const form = (guardians) => ({ ...payload('Phạm Thu Hà', guardians).child, gender: b.gender });
  await rejects(children.updateChild(b.id, { child: form([guardian(7), guardian(6)]), reason: 'Thử (giả)' }, VP), 409);
  const ok = await children.updateChild(b.id, { child: form([guardian(7)]), reason: 'Sửa tên (giả)' }, VP);
  assert.equal(ok.fullName, 'Phạm Thu Hà');
  assert.notEqual(ok.id, a.id);
});

const csvOf = (rows) =>
  [IMPORT_COLUMNS.map((c) => c.label), ...rows.map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
const row = (fullName, g) => ({
  fullName,
  dateOfBirth: '17/05/2023',
  gender: 'Nữ',
  guardianName: g.fullName,
  relation: 'Mẹ',
  phone: g.phone,
  guardianIdNumber: g.idNumber,
  ...filledImportColumns(),
});

test('nhập Excel: trùng hồ sơ đang học ⇒ dòng lỗi; khác phụ huynh ⇒ hợp lệ; trẻ đã nghỉ học ⇒ ghi chú gợi ý mở lại', async () => {
  await children.enrollChild(payload('Đỗ An Khang', [guardian(8)]), VP);
  const left = await children.enrollChild(payload('Vũ Hải Đăng', [guardian(9)]), VP);
  await children.withdrawChild(left.id, { leftAt: todayInput(), reason: 'Nghỉ (giả)' }, VP);
  const text = csvOf([row('Đỗ An Khang', guardian(8)), row('Đỗ An Khang', guardian(10)), row('Vũ Hải Đăng', guardian(9))]);
  const { rows } = await children.previewImport({ name: 'tiep-nhan.csv', text: async () => text }, VP);
  assert.ok(rows[0].errors.some((e) => e.startsWith('Trẻ đã có hồ sơ trong hệ thống')));
  assert.deepEqual(rows[1].errors, []);
  assert.deepEqual(rows[2].errors, []);
  assert.ok(rows[2].notes.some((n) => n.includes(left.code)));
});
