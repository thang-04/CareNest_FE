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

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { authMockRepository: auth, DEMO_PASSWORD } = await import('@/mocks/authMockRepository');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { validateChildProfile } = await import('@/utils/children/childrenValidation');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Tuần thai khi sinh bắt buộc mọi trẻ, khớp ô Sinh non (user chốt 2026-11-04; CHD-05; plan
 * docs/plans/active/2026-11-04-intake-weeks-round-dates.md). Câu lỗi như BE. Dữ liệu giả: CCCD bắt đầu 999.
 */
const BLANK = 'Nhập tuần thai khi sinh';
const PRETERM_TOO_LONG = 'Trẻ sinh non có tuần thai dưới 37';
const TERM_TOO_SHORT = 'Dưới 37 tuần là sinh non: chọn Sinh non là Có hoặc sửa tuần thai';
const RANGE = 'Nhập tuần thai từ 20 đến 42';

const loginAs = async (predicate) => (await auth.login({ email: readDb().users.find(predicate).email, password: DEMO_PASSWORD })).user; // carenest:allow-secret – mật khẩu demo của dữ liệu giả
const vpC1 = () => loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
const weeksError = (patch) => validateChildProfile(filledProfile(patch))['profile.gestationWeeks'];

const enrollment = (n, profile) => ({
  child: {
    ...emptyChildInfo(),
    fullName: `Trẻ Thử Tuần Thai ${n}`,
    dateOfBirth: '2023-05-05',
    gender: 'FEMALE',
    guardians: [{ fullName: `Phụ huynh tuần thai ${n}`, relation: 'Mẹ', phone: `0900 004 00${n}`, idNumber: `99990000400${n}`, email: '' }],
    profile,
  },
  classId: '',
  declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
});

const csvOf = (header, rows) =>
  [header.map((c) => c.label), ...rows.map((r) => header.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

const importRow = (n, patch = {}) => ({
  fullName: `Trẻ Nhập Tuần Thai ${n}`,
  dateOfBirth: `0${n}/06/2023`,
  gender: 'Nam',
  guardianName: `Phụ huynh nhập tuần thai ${n}`,
  relation: 'Bố',
  phone: `0900 005 00${n}`,
  guardianIdNumber: `99990000500${n}`,
  ...filledImportColumns(),
  ...patch,
});

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: tuần thai bắt buộc mọi trẻ, trong 20–42, khớp ô Sinh non; câu lỗi như BE', () => {
  assert.equal(weeksError({ gestationWeeks: '' }), BLANK, 'không sinh non cũng bắt buộc');
  assert.equal(weeksError({ premature: 'YES', gestationWeeks: null }), BLANK);
  assert.equal(weeksError({ gestationWeeks: '  ' }), BLANK);
  assert.equal(weeksError({ premature: 'YES', gestationWeeks: 37 }), PRETERM_TOO_LONG);
  assert.equal(weeksError({ premature: 'YES', gestationWeeks: '36' }), undefined);
  assert.equal(weeksError({ premature: 'NO', gestationWeeks: 36 }), TERM_TOO_SHORT);
  assert.equal(weeksError({ premature: 'NO', gestationWeeks: '37' }), undefined);
  assert.equal(weeksError({ gestationWeeks: 19 }), RANGE);
  assert.equal(weeksError({ gestationWeeks: 43 }), RANGE);
  assert.equal(weeksError({ gestationWeeks: 'ba mươi' }), RANGE);
  assert.equal(weeksError({ premature: 'YES', gestationWeeks: '36.5' }), 'Nhập số tuần nguyên, ví dụ 38');
  // Chưa chọn Sinh non: chỉ báo ô Sinh non, chưa kiểm khớp.
  const unanswered = validateChildProfile(filledProfile({ premature: '', gestationWeeks: 30 }));
  assert.equal(unanswered['profile.premature'], 'Chọn trẻ có sinh non hay không');
  assert.equal(unanswered['profile.gestationWeeks'], undefined);
});

test('AC-1: tiếp nhận, sửa hồ sơ trả 422 theo ô; lưu tuần thai cho trẻ không sinh non', async () => {
  const vp = await vpC1();
  const reject = async (promise, message) => {
    const err = await promise.catch((e) => e);
    assert.equal(err.status, 422);
    assert.equal(err.details['profile.gestationWeeks'], message);
  };
  await reject(children.enrollChild(enrollment(1, filledProfile({ gestationWeeks: '' })), vp), BLANK);
  await reject(children.enrollChild(enrollment(1, filledProfile({ premature: 'YES', gestationWeeks: 38 })), vp), PRETERM_TOO_LONG);
  await reject(children.enrollChild(enrollment(1, filledProfile({ gestationWeeks: 34 })), vp), TERM_TOO_SHORT);

  const saved = await children.enrollChild(enrollment(1, filledProfile({ gestationWeeks: '39' })), vp);
  const child = readDb().children.find((c) => c.id === saved.id);
  assert.equal(child.profile.premature, 'NO');
  assert.equal(child.profile.gestationWeeks, 39, 'tuần thai lưu cả khi không sinh non');
  assert.equal((await children.getChildDetail(saved.id, vp)).child.profile.gestationWeeks, 39);

  const form = (profile) => ({
    fullName: child.fullName,
    dateOfBirth: child.dateOfBirth,
    gender: child.gender,
    guardians: child.guardians,
    profile: { ...child.profile, ...profile },
  });
  await reject(children.updateChild(child.id, { child: form({ gestationWeeks: '' }), reason: 'Thử xóa tuần thai' }, vp), BLANK);
  await reject(children.updateChild(child.id, { child: form({ premature: 'YES' }), reason: 'Thử đổi sinh non' }, vp), PRETERM_TOO_LONG);
  await children.updateChild(child.id, { child: form({ premature: 'YES', gestationWeeks: 35 }), reason: 'Phụ huynh báo lại' }, vp);
  assert.deepEqual(
    (({ premature, gestationWeeks }) => ({ premature, gestationWeeks }))(readDb().children.find((c) => c.id === child.id).profile),
    { premature: 'YES', gestationWeeks: 35 },
  );
});

test('AC-1: nhập Excel bắt cột tuần thai; dòng trống hoặc không khớp Sinh non báo lỗi đúng dòng', async () => {
  const noColumn = readEnrollmentCsv(
    csvOf(
      IMPORT_COLUMNS.filter((c) => c.key !== 'gestationWeeks'),
      [importRow(1)],
    ),
  );
  assert.ok(noColumn.missingColumns.includes('Tuần thai khi sinh (20–42)'));
  // File theo mẫu cũ (nhãn "bắt buộc khi sinh non") vẫn khớp cột.
  const oldHeader = IMPORT_COLUMNS.map((c) =>
    c.key === 'gestationWeeks' ? { ...c, label: 'Tuần thai khi sinh (bắt buộc khi sinh non)' } : c,
  );
  const old = readEnrollmentCsv(csvOf(oldHeader, [importRow(1)]));
  assert.deepEqual(old.missingColumns, []);
  assert.equal(old.rows[0].payload.child.profile.gestationWeeks, '39');

  const vp = await vpC1();
  const csv = csvOf(IMPORT_COLUMNS, [
    importRow(1),
    importRow(2, { gestationWeeks: '' }),
    importRow(3, { premature: 'Có', gestationWeeks: '38' }),
    importRow(4, { premature: 'Có', gestationWeeks: '34' }),
  ]);
  const { rows } = await children.previewImport({ name: 'tuan-thai.csv', text: async () => csv }, vp);
  assert.deepEqual(rows[0].errors, []);
  assert.ok(rows[1].errors.includes(BLANK));
  assert.ok(rows[2].errors.includes(PRETERM_TOO_LONG));
  assert.deepEqual(rows[3].errors, []);
});

test('AC-2: dữ liệu demo — mọi trẻ có tuần thai khớp Sinh non; DB cũ điền tuần thai trống một lần, ô đã có giữ nguyên', () => {
  const allValid = (db) => db.children.every((c) => !validateChildProfile(c.profile)['profile.gestationWeeks']);
  assert.ok(allValid(readDb()));
  writeDb((d) => {
    d.children.find((c) => c.id === 'ch_002').profile.gestationWeeks = null;
    d.children.find((c) => c.id === 'ch_016').profile.gestationWeeks = '';
    d.children.find((c) => c.id === 'ch_003').profile.gestationWeeks = 40;
    d.profileFillVersion = 1;
  });
  ensureChildRecordsSeeded();
  const db = readDb();
  const weeksOf = (id) => db.children.find((c) => c.id === id).profile.gestationWeeks;
  assert.equal(weeksOf('ch_002'), 39);
  assert.equal(weeksOf('ch_016'), 35, 'trẻ sinh non điền 35');
  assert.equal(weeksOf('ch_003'), 40, 'ô đã có giữ nguyên');
  assert.ok(allValid(db));
});
