import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { validateMeasurement } = await import('@/utils/children/childrenValidation');
const { validateHealthExam } = await import('@/utils/children/healthExamValidation');
const { todayInput } = await import('@/utils/format');

/*
 * Kỳ cân đo bỏ vòng đầu; ngày đo, ngày khám do BE ghi, không sửa (user chốt 2026-11-04; HLT-01, HLT-08; plan
 * docs/plans/active/2026-11-04-intake-weeks-round-dates.md). Seed: c2 có kỳ cân đo hc_c2_next (Lớp Mầm 1 của thầy Tuấn có số đo
 * seed của ch_026, ch_029); c1 có đợt khám hc_c1_open (phiếu seed ngày hôm qua; Lớp Chồi 1 chưa khám). Dữ liệu giả.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const ROUND = 'hc_c2_next';
const C1_OPEN = 'hc_c1_open';
const OLD_DATE = '2020-01-01';

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const teacherOf = (childId) => {
  const db = readDb();
  const child = db.children.find((c) => c.id === childId);
  const cls = db.classes.find((c) => c.id === child.classId);
  return { id: cls.teacherIds[0], role: 'TEACHER', campusId: child.campusId };
};
const stored = (id) => readDb().healthMeasurements.find((m) => m.id === id);

/** Phiếu đủ ô bắt buộc từ bản điền sẵn, cố gửi kèm ngày cũ (BE bỏ qua). */
const examPayload = (view, { conclude = true, reason } = {}) => {
  const exam = structuredClone(view.draft ? view.draft.exam : view.measurement.exam);
  exam.admin.hasCompanion = 'NO';
  exam.admin.companion = { ...buildEmptyExam().admin.companion };
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
    date: OLD_DATE,
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

test('AC-3 (HLT-01): số đo mới ngày = hôm nay, không lưu vòng đầu dù client gửi ngày, vòng đầu', async () => {
  const roster = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  const row = roster.children.find((r) => r.result === 'NOT_RECORDED');
  const saved = await children.saveMeasurement(
    row.childId,
    null,
    { campaignId: ROUND, date: OLD_DATE, heightCm: 99, weightKg: 15.5, headCircumferenceCm: 49, note: '' },
    TUAN,
  );
  assert.equal(saved.date, todayInput());
  assert.equal(saved.headCircumferenceCm, null);
  assert.equal(stored(saved.id).headCircumferenceCm, null);
  assert.equal(saved.campaignId, ROUND);
});

// Kỳ cân đo tự đóng sau ngày kết thúc (HLT-17, 2026-11-04): không còn kỳ mở sau ngày kết thúc để ghi ngày kết thúc thay hôm nay.
test('AC-3 (HLT-01, HLT-17): ngày kết thúc của kỳ vẫn nhập, ngày đo = hôm nay; kỳ qua ngày kết thúc tự đóng, không nhập được', async () => {
  const setEnd = (endDate) =>
    writeDb((d) => {
      Object.assign(
        d.healthCheckCampaigns.find((c) => c.id === ROUND),
        { startDate: addDays(todayInput(), -20), endDate },
      );
    });
  setEnd(todayInput());
  const roster = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  const [first, second] = roster.children.filter((r) => r.result === 'NOT_RECORDED');
  const saved = await children.saveMeasurement(first.childId, null, { campaignId: ROUND, heightCm: 99, weightKg: 15.5, note: '' }, TUAN);
  assert.equal(saved.date, todayInput());

  setEnd(addDays(todayInput(), -1));
  await rejects(children.saveMeasurement(second.childId, null, { campaignId: ROUND, heightCm: 99, weightKg: 15.5, note: '' }, TUAN), 409);
  assert.equal((await checks.getHealthCheck(ROUND, PRINCIPAL)).campaign.status, 'CLOSED');
});

test('AC-3 (HLT-13): sửa số đo giữ ngày đo và vòng đầu cũ; lịch sử chỉ ghi ô đã sửa', async () => {
  const seeded = readDb().healthMeasurements.find((m) => m.childId === 'ch_026' && m.campaignId === ROUND);
  // Số đo cũ của kỳ có vòng đầu (dữ liệu trước 2026-11-04).
  writeDb((d) => {
    d.healthMeasurements.find((m) => m.id === seeded.id).headCircumferenceCm = 48.5;
  });
  assert.notEqual(seeded.date, todayInput(), 'số đo seed của kỳ ghi ngày hôm qua');
  const edited = await children.saveMeasurement(
    'ch_026',
    seeded.id,
    {
      date: todayInput(),
      heightCm: seeded.heightCm + 0.5,
      weightKg: seeded.weightKg,
      headCircumferenceCm: 50,
      note: seeded.note,
      reason: 'Đo lại chiều cao (giả).',
    },
    TUAN,
  );
  assert.equal(edited.date, seeded.date);
  assert.equal(edited.headCircumferenceCm, 48.5);
  assert.deepEqual(
    edited.edits.at(-1).changes.map((c) => c.field),
    ['heightCm'],
  );
});

test('AC-3: hôm nay trẻ đã có kết quả đo khác ⇒ 409, không còn lỗi ngày ngoài kỳ', async () => {
  const roster = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  const row = roster.children.find((r) => r.result === 'NOT_RECORDED');
  writeDb((d) => {
    d.healthMeasurements.push({
      id: 'hm_today_test',
      childId: row.childId,
      campaignId: null,
      date: todayInput(),
      heightCm: 99,
      weightKg: 15,
      headCircumferenceCm: null,
      grossMotor: null,
      fineMotor: null,
      note: '',
      exam: null,
      examStatus: null,
      published: true,
      edits: [],
    });
  });
  const err = await children
    .saveMeasurement(row.childId, null, { campaignId: ROUND, heightCm: 99, weightKg: 15.5, note: '' }, TUAN)
    .catch((e) => e);
  assert.equal(err.status, 409);
  assert.equal(err.details, undefined, 'không gắn lỗi vào ô ngày');
});

test('AC-5: Sổ sức khỏe không còn headCircumferenceUntil; kiểm nhập số đo không còn ngày, vòng đầu', async () => {
  const record = await children.getHealthRecord('ch_026', PRINCIPAL);
  assert.equal('rules' in record, false);
  assert.equal('headCircumferenceUntil' in record, false);
  assert.deepEqual(validateMeasurement({ date: 'sai', heightCm: 100, weightKg: 15, headCircumferenceCm: 999 }), {});
  assert.deepEqual(Object.keys(validateMeasurement({ heightCm: '', weightKg: 99, reason: '' }, { requireReason: true })).sort(), [
    'heightCm',
    'reason',
    'weightKg',
  ]);
});

test('AC-4 (HLT-08): phiếu mới ngày = hôm nay trong khoảng của đợt; client gửi ngày thì bỏ qua', async () => {
  const teacher = teacherOf('ch_007');
  const view = await exams.getHealthExam(C1_OPEN, 'ch_007', teacher);
  assert.equal(view.measurement, null, 'Lớp Chồi 1 chưa khám');
  assert.equal(view.draft.date, todayInput(), 'ngày BE sẽ ghi, để hiện');
  const draft = await exams.saveHealthExam(C1_OPEN, 'ch_007', examPayload(view, { conclude: false }), teacher);
  assert.equal(draft.measurement.date, todayInput());
  const concluded = await exams.saveHealthExam(C1_OPEN, 'ch_007', examPayload(draft), teacher);
  assert.equal(concluded.measurement.date, todayInput());
  assert.equal(concluded.measurement.examStatus, 'CONCLUDED');
});

test('AC-4 (HLT-08): phiếu nháp và phiếu đã kết luận giữ ngày khám cũ khi lưu lại', async () => {
  const seedDate = readDb().healthMeasurements.find((m) => m.id === 'hm_ch_004_open').date;
  assert.notEqual(seedDate, todayInput());
  const teacher = teacherOf('ch_004');
  const draftView = await exams.getHealthExam(C1_OPEN, 'ch_004', teacher);
  assert.equal(draftView.measurement.examStatus, 'DRAFT');
  const savedDraft = await exams.saveHealthExam(C1_OPEN, 'ch_004', examPayload(draftView, { conclude: false }), teacher);
  assert.equal(savedDraft.measurement.date, seedDate);

  const concludedView = await exams.getHealthExam(C1_OPEN, 'ch_001', teacherOf('ch_001'));
  assert.equal(concludedView.measurement.examStatus, 'CONCLUDED');
  const before = concludedView.measurement.date;
  const resaved = await exams.saveHealthExam(
    C1_OPEN,
    'ch_001',
    { ...examPayload(concludedView, { reason: 'Sửa cân nặng (giả).' }), weightKg: 16.4 },
    teacherOf('ch_001'),
  );
  assert.equal(resaved.measurement.date, before);
  assert.ok(!resaved.measurement.edits.at(-1).changes.some((c) => c.field === 'date'), 'lịch sử sửa không có đổi ngày');
});

test('AC-4: phiếu của đợt chưa bắt đầu hiện ngày bắt đầu (hôm nay kẹp vào khoảng của đợt), chưa lưu được', async () => {
  await checks.closeHealthCheck(ROUND, PRINCIPAL);
  const startDate = addDays(todayInput(), 3);
  const campaign = await checks.createHealthCheck(
    { name: 'Khám thử ngày khám (giả)', campusId: 'c2', startDate, endDate: addDays(startDate, 2), examiner: 'Trạm Y tế (giả)' },
    PRINCIPAL,
  );
  const view = await exams.getHealthExam(campaign.id, 'ch_026', TUAN);
  assert.equal(view.draft.date, startDate);
  await rejects(exams.saveHealthExam(campaign.id, 'ch_026', examPayload(view, { conclude: false }), TUAN), 409);
});

test('AC-4: kiểm nhập phiếu không còn ô ngày; ngày tiếp xúc lao không sau ngày khám BE ghi', () => {
  const exam = buildEmptyExam();
  exam.history = { ...exam.history, tbContact: 'YES', tbContactDate: '2026-10-05' };
  const errors = validateHealthExam({ exam }, { dateOfBirth: '2023-01-01', examDate: '2026-10-01' });
  assert.equal(errors.date, undefined);
  assert.equal(errors['exam.history.tbContactDate'], 'Ngày tiếp xúc không được sau ngày khám 01/10/2026');
  const sameDay = validateHealthExam({ exam }, { dateOfBirth: '2023-01-01', examDate: '2026-10-05' });
  assert.equal(sameDay['exam.history.tbContactDate'], undefined);
});
