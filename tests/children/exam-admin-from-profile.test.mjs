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
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { validateChildProfile } = await import('@/utils/children/childrenValidation');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-22-exam-admin-from-profile.md (dữ liệu giả của seed).
 * Phiếu khám chỉ xem hành chính của hồ sơ, tiền sử sửa được và lưu kết luận cập nhật vào khai báo; người đi cùng chọn trong
 * phụ huynh; hồ sơ bắt buộc đủ khi tiếp nhận.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const C1_OPEN = 'hc_c1_open';
const CHILD = 'ch_007';
const loginAs = async (predicate) => (await auth.login({ email: readDb().users.find(predicate).email, password: DEMO_PASSWORD })).user; // carenest:allow-secret – mật khẩu demo của dữ liệu giả
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const childOf = (id) => readDb().children.find((c) => c.id === id);
const teacherOf = (id) => {
  const child = childOf(id);
  const cls = readDb().classes.find((c) => c.id === child.classId);
  return { id: cls.teacherIds[0], role: 'TEACHER', campusId: child.campusId };
};
const setProfile = (id, patch) =>
  writeDb((d) => {
    const child = d.children.find((c) => c.id === id);
    child.profile = { ...child.profile, ...patch };
  });

/** Phiếu đủ ô bắt buộc; admin/history là giá trị client cố gửi khác hồ sơ. */
const filledPayload = (view, { admin = {}, history = {}, companion = { guardianIndex: 0 }, conclude = true, reason } = {}) => {
  const exam = structuredClone(view.draft ? view.draft.exam : view.measurement.exam);
  exam.admin = { ...exam.admin, ...admin, hasCompanion: companion ? 'YES' : 'NO', companion: { ...exam.admin.companion, ...companion } };
  exam.history = { ...exam.history, ...history };
  exam.vitals = {
    temperatureC: 36.8,
    temperatureStatus: 'NORMAL',
    pulse: 100,
    pulseStatus: 'NORMAL',
    respiratoryRate: 24,
    respiratoryStatus: 'NORMAL',
  };
  exam.nutrition = { ...exam.nutrition, headStatus: view.reference.headApplies ? 'NORMAL' : '', statuses: ['NORMAL'] };
  exam.development = { mental: 'YES', motor: 'YES', autismRisk: view.reference.autismQuestion ? 'NO' : '' };
  exam.immunization = { bcg: 'YES', hepB1: 'YES', fullSchedule: 'YES' };
  exam.conclusion = { ...buildEmptyExam().conclusion, normal: true, action: 'NONE', doctorName: 'BS. Thử Nghiệm' };
  return {
    date: view.measurement?.date || view.draft.date,
    heightCm: 100,
    weightKg: 16,
    headCircumferenceCm: view.reference.headApplies ? 49 : null,
    exam,
    conclude,
    conclusionMode: view.conclusionMode,
    ...(reason ? { reason } : {}),
  };
};

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: hành chính lấy từ hồ sơ hiện tại, bỏ giá trị client gửi; tiền sử điền sẵn từ khai báo, giáo viên sửa được', async () => {
  const teacher = teacherOf(CHILD);
  const view = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  assert.equal(view.draft.exam.admin.premature, 'YES');
  assert.equal(view.draft.exam.admin.gestationWeeks, 35);
  assert.equal(view.draft.exam.history.self, 'YES');
  assert.equal(view.draft.exam.history.selfText, 'Hen phế quản');

  const draft = filledPayload(view, { admin: { ethnicity: 'Khác' }, history: { self: 'NO', selfText: '' }, conclude: false });
  const saved = await exams.saveHealthExam(C1_OPEN, CHILD, draft, teacher);
  assert.equal(saved.measurement.exam.admin.ethnicity, 'Kinh');
  assert.equal(saved.measurement.exam.history.self, 'NO', 'tiền sử giữ theo giáo viên nhập');
  assert.equal(readDb().healthDeclarations.find((x) => x.childId === CHILD).medicalHistory.self.state, 'REPORTED', 'nháp không cập nhật');

  setProfile(CHILD, { ethnicity: 'Tày' });
  const again = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  assert.equal(again.measurement.exam.admin.ethnicity, 'Tày', 'phiếu nháp hiện hồ sơ vừa sửa');
  assert.equal(again.measurement.exam.history.self, 'NO');
});

test('AC-2, AC-3: lưu kết luận cập nhật tiền sử vào khai báo, không đổi hồ sơ; phiếu đã kết luận giữ bản chụp hành chính', async () => {
  const teacher = teacherOf(CHILD);
  const before = structuredClone(childOf(CHILD));
  const view = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  await exams.saveHealthExam(
    C1_OPEN,
    CHILD,
    filledPayload(view, { admin: { bloodType: 'AB' }, history: { family: 'YES', familyText: 'Tăng huyết áp (giả)' } }),
    teacher,
  );
  const after = childOf(CHILD);
  assert.deepEqual(after.profile, before.profile);
  assert.ok(!(after.history || []).some((h) => h.action === 'UPDATED_FROM_EXAM'));
  const decl = readDb().healthDeclarations.find((x) => x.childId === CHILD);
  assert.deepEqual(decl.medicalHistory.family, { state: 'REPORTED', text: 'Tăng huyết áp (giả)' });
  const entry = decl.history.at(-1);
  assert.equal(entry.action, 'UPDATED_FROM_EXAM');
  assert.equal(entry.historyChange.from.family.state, 'NONE_REPORTED');

  setProfile(CHILD, { ethnicity: 'Tày' });
  const concluded = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  assert.equal(concluded.measurement.exam.admin.ethnicity, 'Kinh', 'bản chụp lúc lưu');
  const resaved = await exams.saveHealthExam(C1_OPEN, CHILD, filledPayload(concluded, { reason: 'Sửa cân nặng' }), teacher);
  assert.equal(resaved.measurement.exam.admin.ethnicity, 'Kinh');
});

test('AC-2: lưu lại phiếu đã kết luận mà không sửa tiền sử thì không ghi đè khai báo sửa sau đó', async () => {
  const teacher = teacherOf(CHILD);
  const view = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  await exams.saveHealthExam(C1_OPEN, CHILD, filledPayload(view, { history: { family: 'YES', familyText: 'Hen (giả)' } }), teacher);
  writeDb((d) => {
    d.healthDeclarations.find((x) => x.childId === CHILD).medicalHistory.family = { state: 'NONE_REPORTED', text: '' };
  });
  const concluded = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  await exams.saveHealthExam(C1_OPEN, CHILD, filledPayload(concluded, { reason: 'Sửa cân nặng' }), teacher);
  assert.equal(readDb().healthDeclarations.find((x) => x.childId === CHILD).medicalHistory.family.state, 'NONE_REPORTED');
});

test('AC-4: người đi cùng phải là phụ huynh trong hồ sơ; chi tiết chép từ hồ sơ', async () => {
  const teacher = teacherOf(CHILD);
  const view = await exams.getHealthExam(C1_OPEN, CHILD, teacher);
  const save = (companion) => exams.saveHealthExam(C1_OPEN, CHILD, filledPayload(view, { companion }), teacher);
  await rejects(save({ guardianIndex: null, fullName: 'Người ngoài (giả)', relation: 'Ông/bà' }), 422, 'exam.admin.companion');
  await rejects(save({ guardianIndex: 9 }), 422, 'exam.admin.companion');
  const saved = await save({ guardianIndex: 0, fullName: 'Tên gõ tay (giả)', phone: '0900 999 999' });
  const g = childOf(CHILD).guardians[0];
  const c = saved.measurement.exam.admin.companion;
  assert.equal(c.fullName, g.fullName);
  assert.equal(c.phone, g.phone);
  assert.equal(c.idNumber, g.idNumber);
});

test('AC-5: tiếp nhận, sửa hồ sơ, khai báo bắt buộc hành chính và tiền sử (trừ CCCD trẻ, nhóm máu)', async () => {
  const vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
  const guardian = { fullName: 'Phụ huynh thử', relation: 'Mẹ', phone: '0900 000 031', idNumber: '999900000031', email: '' };
  const payload = (profile, medicalHistory) => ({
    child: { ...emptyChildInfo(), fullName: 'Trẻ Thử Hồ Sơ', dateOfBirth: '2023-03-03', gender: 'MALE', guardians: [guardian], profile },
    classId: '',
    declaration: { ...emptyDeclaration(), medicalHistory },
  });
  const err = await children.enrollChild(payload(emptyChildInfo().profile, emptyDeclaration().medicalHistory), vp).catch((e) => e);
  assert.equal(err.status, 422);
  [
    'profile.premature',
    'profile.ethnicity',
    'profile.beneficiary',
    'profile.paymentSource',
    'profile.address.province',
    'profile.address.ward',
    'profile.address.street',
    'declaration.medicalHistory.self',
    'declaration.medicalHistory.family',
    'declaration.medicalHistory.tbContact',
  ].forEach((k) => assert.ok(Object.hasOwn(err.details, k), k));
  assert.ok(!Object.hasOwn(err.details, 'profile.idNumber') && !Object.hasOwn(err.details, 'profile.bloodType'));
  await rejects(
    children.enrollChild(payload(filledProfile({ premature: 'YES' }), filledMedicalHistory()), vp),
    422,
    'profile.gestationWeeks',
  );
  const saved = await children.enrollChild(payload(filledProfile(), filledMedicalHistory()), vp);

  const c = childOf(saved.id);
  const form = {
    fullName: c.fullName,
    dateOfBirth: c.dateOfBirth,
    gender: c.gender,
    guardians: c.guardians,
    profile: { ...c.profile, ethnicity: '' },
  };
  await rejects(children.updateChild(c.id, { child: form, reason: 'Thử xóa' }, vp), 422, 'profile.ethnicity');
});

test('AC-6: nhập Excel bắt cột và ô hành chính, tiền sử', async () => {
  const vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
  const csvOf = (rows, columns = IMPORT_COLUMNS) =>
    [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))]
      .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  const row = (n, patch = {}) => ({
    fullName: `Trẻ Nhập Hồ Sơ ${n}`,
    dateOfBirth: `0${n}/04/2023`,
    gender: 'Nữ',
    guardianName: `Phụ huynh nhập hồ sơ ${n}`,
    relation: 'Mẹ',
    phone: `0900 003 00${n}`,
    guardianIdNumber: `99990000300${n}`,
    ...filledImportColumns(),
    ...patch,
  });
  const noColumn = readEnrollmentCsv(
    csvOf(
      [row(1)],
      IMPORT_COLUMNS.filter((c) => c.key !== 'ethnicity'),
    ),
  );
  assert.ok(noColumn.missingColumns.includes('Dân tộc'));
  const { rows } = await children.previewImport(
    { name: 'ho-so.csv', text: async () => csvOf([row(1), row(2, { ethnicity: '', selfHistory: '' })]) },
    vp,
  );
  assert.deepEqual(rows[0].errors, []);
  assert.ok(rows[1].errors.includes('Nhập dân tộc'));
  assert.ok(rows[1].errors.includes('Chọn Có hoặc Không cho tiền sử bản thân'));
});

test('AC-7: Hiệu trưởng sửa được khai báo sức khỏe; giáo viên không', async () => {
  const decl = structuredClone(readDb().healthDeclarations.find((x) => x.childId === CHILD));
  const declaration = { allergies: decl.allergies, diet: decl.diet, otherNotes: decl.otherNotes, medicalHistory: decl.medicalHistory };
  declaration.medicalHistory.family = { state: 'REPORTED', text: 'Tăng huyết áp (giả)' };
  await rejects(children.saveDeclaration(CHILD, { declaration, reason: 'Thử' }, teacherOf(CHILD)), 403);
  await children.saveDeclaration(CHILD, { declaration, reason: 'Phụ huynh bổ sung' }, PRINCIPAL);
  assert.equal(readDb().healthDeclarations.find((x) => x.childId === CHILD).medicalHistory.family.state, 'REPORTED');
});

test('AC-8: dữ liệu demo đủ hồ sơ; DB cũ được điền đầy một lần, ô đã có giữ nguyên', () => {
  const answered = ['REPORTED', 'NONE_REPORTED'];
  const complete = (db) =>
    db.children.every((c) => {
      const mh = db.healthDeclarations.find((x) => x.childId === c.id)?.medicalHistory;
      return (
        Object.keys(validateChildProfile(c.profile)).length === 0 &&
        ['self', 'family', 'tbContact'].every((k) => answered.includes(mh?.[k]?.state))
      );
    });
  assert.ok(complete(readDb()));

  writeDb((d) => {
    const child = d.children.find((c) => c.id === 'ch_002');
    child.profile = { ...child.profile, ethnicity: '', premature: '', bloodType: 'AB' };
    d.healthDeclarations.find((x) => x.childId === 'ch_002').medicalHistory.family = { state: 'NOT_PROVIDED', text: '' };
    delete d.profileFillVersion;
  });
  ensureChildRecordsSeeded();
  const db = readDb();
  assert.ok(complete(db));
  assert.equal(db.children.find((c) => c.id === 'ch_002').profile.bloodType, 'AB');
});
