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
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');
const { todayInput } = await import('@/utils/format');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-21-tb-contact-date.md (dữ liệu giả của seed).
 * Ngày tiếp xúc gần nhất với người bệnh lao: bắt buộc khi "Có"; đổi ngày đã có ⇒ báo Hiệu trưởng + Phó hiệu trưởng điểm trường.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const loginAs = async (predicate) => (await auth.login({ email: readDb().users.find(predicate).email, password: DEMO_PASSWORD })).user; // carenest:allow-secret – mật khẩu demo của dữ liệu giả
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const vpIdOf = (campusId) => readDb().users.find((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === campusId).id;
const noticesOf = (type, childId) =>
  (readDb().notifications || []).filter((n) => n.type === type && n.link === `/children/${childId}/health-declaration`);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const withTb = (decl, contactDate, state = 'REPORTED') => ({
  ...structuredClone(decl),
  medicalHistory: { ...structuredClone(decl.medicalHistory || emptyDeclaration().medicalHistory), tbContact: { state, contactDate } },
});

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-7: dữ liệu demo — mọi khai báo và phiếu khám "Có tiếp xúc" đều có ngày; DB cũ được bổ sung một lần', () => {
  const db = readDb();
  const reported = db.healthDeclarations.filter((x) => x.medicalHistory?.tbContact?.state === 'REPORTED');
  assert.ok(reported.length > 0 && reported.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.medicalHistory.tbContact.contactDate)));
  const examYes = db.healthMeasurements.filter((m) => m.exam?.history?.tbContact === 'YES');
  assert.ok(examYes.length > 0 && examYes.every((m) => m.exam.history.tbContactDate && m.exam.history.tbContactDate <= m.date));
  const [decl] = reported;
  const [exam] = examYes;
  writeDb((d) => {
    d.healthDeclarations.find((x) => x.childId === decl.childId).medicalHistory.tbContact.contactDate = '';
    d.healthMeasurements.find((m) => m.id === exam.id).exam.history.tbContactDate = '';
    delete d.tbContactDateVersion;
  });
  ensureChildRecordsSeeded();
  const after = readDb();
  const declared = after.healthDeclarations.find((x) => x.childId === decl.childId).medicalHistory.tbContact.contactDate;
  assert.match(declared, /^\d{4}-\d{2}-\d{2}$/);
  const filled = after.healthMeasurements.find((m) => m.id === exam.id).exam.history.tbContactDate;
  assert.ok(filled && filled <= exam.date);
});

test('AC-1, AC-4, AC-6: sửa khai báo — bắt ngày; lần đầu "Có" báo kèm ngày; đổi ngày ⇒ báo BGH, không báo giáo viên', async () => {
  const db = readDb();
  const child = db.children.find(
    (c) =>
      c.status === 'ACTIVE' &&
      c.classId &&
      db.classes.find((k) => k.id === c.classId)?.teacherIds?.length &&
      db.healthDeclarations.find((x) => x.childId === c.id && x.medicalHistory?.tbContact?.state !== 'REPORTED'),
  );
  const vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === child.campusId);
  const decl = db.healthDeclarations.find((x) => x.childId === child.id);
  const save = (d, reason = 'Phụ huynh báo lại') => children.saveDeclaration(child.id, { declaration: d, reason }, vp);
  await rejects(save(withTb(decl, '')), 422, 'medicalHistory.tbContactDate');
  await rejects(save(withTb(decl, addDays(todayInput(), 1))), 422, 'medicalHistory.tbContactDate');
  await rejects(save(withTb(decl, addDays(child.dateOfBirth, -1))), 422, 'medicalHistory.tbContactDate');

  await save(withTb(decl, '2026-09-01'));
  const first = noticesOf('CHILD_TB_CONTACT', child.id);
  const teachers = db.classes.find((k) => k.id === child.classId).teacherIds;
  assert.ok(first.some((n) => n.userId === PRINCIPAL.id && n.message.includes('01/09/2026')));
  assert.ok(
    teachers.every((t) => first.some((n) => n.userId === t)),
    'lần đầu khai "Có" vẫn báo giáo viên lớp',
  );
  assert.equal(noticesOf('CHILD_TB_CONTACT_DATE_CHANGED', child.id).length, 0);

  const saved = readDb().healthDeclarations.find((x) => x.childId === child.id);
  await save(withTb(saved, '2026-09-08'));
  const changed = noticesOf('CHILD_TB_CONTACT_DATE_CHANGED', child.id);
  assert.deepEqual(changed.map((n) => n.userId).sort(), [PRINCIPAL.id].sort(), 'chỉ Hiệu trưởng (người lưu là Phó hiệu trưởng)');
  assert.ok(changed[0].message.includes('01/09/2026') && changed[0].message.includes('08/09/2026'));
  assert.ok(changed[0].message.includes('sửa khai báo sức khỏe'));
  await save(
    withTb(
      readDb().healthDeclarations.find((x) => x.childId === child.id),
      '2026-09-08',
    ),
  );
  assert.equal(noticesOf('CHILD_TB_CONTACT_DATE_CHANGED', child.id).length, 1, 'lưu lại cùng ngày không báo');
});

test('AC-1: tiếp nhận — khai "Có tiếp xúc" mà thiếu ngày ⇒ 422', async () => {
  const vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
  const declaration = { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() };
  declaration.medicalHistory.tbContact = { state: 'REPORTED', contactDate: '' };
  const guardian = { fullName: 'Phụ huynh thử', relation: 'Mẹ', phone: '0900 000 011', idNumber: '999900000011', email: '' };
  const payload = {
    child: {
      ...emptyChildInfo(),
      fullName: 'Trẻ Thử Lao',
      dateOfBirth: '2023-02-02',
      gender: 'FEMALE',
      guardians: [guardian],
      profile: filledProfile(),
    },
    classId: '',
    declaration,
  };
  await rejects(children.enrollChild(payload, vp), 422, 'declaration.medicalHistory.tbContactDate');
  declaration.medicalHistory.tbContact.contactDate = '2026-09-15';
  const saved = await children.enrollChild(payload, vp);
  assert.equal(readDb().healthDeclarations.find((x) => x.childId === saved.id).medicalHistory.tbContact.contactDate, '2026-09-15');
});

test('AC-2: nhập Excel — "Có" mà thiếu ngày ⇒ dòng lỗi; có ngày dd/mm/yyyy ⇒ lưu đúng ngày', async () => {
  const vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
  const row = (n, patch) => ({
    fullName: `Trẻ Nhập Lao ${n}`,
    dateOfBirth: `0${n}/03/2023`,
    gender: 'Nam',
    guardianName: `Phụ huynh nhập lao ${n}`,
    relation: 'Bố',
    phone: `0900 002 00${n}`,
    guardianIdNumber: `99990000200${n}`,
    ...filledImportColumns(),
    tbContact: 'Có',
    ...patch,
  });
  const csv = [
    IMPORT_COLUMNS.map((c) => c.label),
    ...[row(1, {}), row(2, { tbContactDate: '05/08/2026' })].map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? '')),
  ]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const { rows } = await children.previewImport({ name: 'lao.csv', text: async () => csv }, vp);
  assert.ok(rows[0].errors.includes('Chọn ngày tiếp xúc gần nhất'));
  assert.deepEqual(rows[1].errors, []);
  assert.equal(rows[1].payload.declaration.medicalHistory.tbContact.contactDate, '2026-08-05');
});

/** Phiếu đủ ô bắt buộc từ bản điền sẵn; history ghi đè phần tiền sử. */
const filledPayload = (view, history) => {
  const exam = structuredClone(view.draft ? view.draft.exam : view.measurement.exam);
  // Người đi cùng là phụ huynh đầu tiên của hồ sơ; hành chính BE lấy từ hồ sơ.
  exam.admin.hasCompanion = 'YES';
  exam.admin.companion = { ...exam.admin.companion, guardianIndex: 0 };
  exam.history = { ...exam.history, self: 'NO', selfText: '', family: 'NO', familyText: '', ...history };
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
    conclude: true,
    conclusionMode: view.conclusionMode,
  };
};

test('AC-3, AC-5: phiếu khám điền sẵn ngày; "Có" bắt ngày, không sau ngày khám; đổi ngày khi lưu kết luận ⇒ báo BGH', async () => {
  await checks.cancelHealthCheck('hc_c2_next', PRINCIPAL);
  const today = todayInput();
  const campaign = await checks.createHealthCheck(
    { name: 'Khám thử ngày tiếp xúc lao', campusId: 'c2', startDate: today, endDate: addDays(today, 3), examiner: 'Trạm Y tế (giả)' },
    PRINCIPAL,
  );
  writeDb((d) => {
    const decl = d.healthDeclarations.find((x) => x.childId === 'ch_028');
    decl.medicalHistory = {
      ...(decl.medicalHistory || emptyDeclaration().medicalHistory),
      tbContact: { state: 'REPORTED', contactDate: '2026-09-01' },
    };
  });
  const view = await exams.getHealthExam(campaign.id, 'ch_028', TUAN);
  assert.equal(view.conclusionMode, 'STANDARD');
  assert.equal(view.draft.exam.history.tbContact, 'YES');
  assert.equal(view.draft.exam.history.tbContactDate, '2026-09-01');
  const save = (history) => exams.saveHealthExam(campaign.id, 'ch_028', filledPayload(view, history), TUAN);
  await rejects(save({ tbContact: 'YES', tbContactDate: '' }), 422, 'exam.history.tbContactDate');
  await rejects(save({ tbContact: 'YES', tbContactDate: addDays(view.draft.date, 1) }), 422, 'exam.history.tbContactDate');

  await save({ tbContact: 'YES', tbContactDate: '2026-09-10' });
  const decl = readDb().healthDeclarations.find((x) => x.childId === 'ch_028');
  assert.deepEqual(decl.medicalHistory.tbContact, { state: 'REPORTED', contactDate: '2026-09-10' }, 'cập nhật ngược vào khai báo');
  const changed = noticesOf('CHILD_TB_CONTACT_DATE_CHANGED', 'ch_028');
  assert.deepEqual(changed.map((n) => n.userId).sort(), [PRINCIPAL.id, vpIdOf('c2')].sort(), 'Hiệu trưởng + Phó hiệu trưởng điểm trường');
  assert.ok(changed[0].message.includes('01/09/2026') && changed[0].message.includes('10/09/2026'));
  assert.ok(changed[0].message.includes('phiếu khám ngày'));
  assert.equal(noticesOf('CHILD_TB_CONTACT', 'ch_028').length, 0, 'phiếu khám không báo khai lần đầu (3b)');
});
