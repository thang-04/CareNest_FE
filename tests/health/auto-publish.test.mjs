import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb } = await import('@/mocks/mockDatabase');
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { todayInput } = await import('@/utils/format');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-23-auto-publish-health-results.md (dữ liệu giả của seed).
 * Lớp Chồi 1 (cô Minh Anh) chưa có phiếu trong đợt hc_c1_open đang diễn ra.
 */
const MINH_ANH = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const C1_OPEN = 'hc_c1_open';
const REFERRAL = { normal: false, healthIssue: true, issueText: 'Lác mắt (giả).', action: 'REFERRAL', specialty: 'Mắt' };

const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.prototype.hasOwnProperty.call(err.details || {}, key)));

const payloadOf = (view, conclusion, { companion = true, conclude = true, reason } = {}) => {
  const exam = structuredClone(view.draft ? view.draft.exam : view.measurement.exam);
  exam.admin.hasCompanion = companion ? 'YES' : 'NO';
  exam.admin.companion = { ...buildEmptyExam().admin.companion, guardianIndex: companion ? 0 : null };
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
  exam.conclusion = { ...buildEmptyExam().conclusion, normal: true, action: 'NONE', doctorName: 'BS. Thử Nghiệm', ...conclusion };
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

const save = async (childId, conclusion, opts) => {
  const view = await exams.getHealthExam(C1_OPEN, childId, MINH_ANH);
  return exams.saveHealthExam(C1_OPEN, childId, payloadOf(view, conclusion, opts), MINH_ANH);
};

const followUpOf = (childId) => readDb().healthFollowUps.find((f) => f.childId === childId && !f.closedAt);

test('AC-6: DB demo — mọi kết quả đã kết luận/cân đo đã công bố, phiếu nháp chưa; DB cũ công bố bù một lần', () => {
  const db = ensureChildRecordsSeeded();
  const unpublished = db.healthMeasurements.filter((m) => !m.published);
  assert.ok(unpublished.length > 0, 'seed có phiếu nháp');
  assert.ok(
    unpublished.every((m) => m.examStatus === 'DRAFT'),
    'chỉ phiếu nháp chưa công bố',
  );
  // DB lưu trước quy định mới: có kết quả chưa công bố.
  const legacyId = db.healthMeasurements.find((m) => m.id === 'hm_ch_008_class').id;
  writeDb((d) => {
    const m = d.healthMeasurements.find((x) => x.id === legacyId);
    Object.assign(m, { published: false, publishedAt: null });
    delete d.autoPublishVersion;
  });
  const after = ensureChildRecordsSeeded();
  const m = after.healthMeasurements.find((x) => x.id === legacyId);
  assert.equal(m.published, true);
  assert.ok(m.publishedAt);
  assert.ok(after.healthMeasurements.filter((x) => !x.published).every((x) => x.examStatus === 'DRAFT'));
});

test('AC-1: phiếu nháp chưa công bố; lưu kết luận không có người đi cùng thì công bố ngay', async () => {
  const draft = await save('ch_009', {}, { companion: false, conclude: false });
  assert.equal(draft.measurement.published, false);
  const saved = await save('ch_009', {}, { companion: false });
  assert.equal(saved.measurement.published, true);
  assert.ok(saved.measurement.publishedAt);
  assert.equal(saved.measurement.parentContact, null, 'không Cần theo dõi sát thì không có trạng thái trao đổi');
});

test('AC-4: có người đi cùng + Cần theo dõi sát ⇒ bắt buộc ý kiến phụ huynh, ghi vào lần trao đổi tại buổi khám', async () => {
  await rejects(save('ch_010', REFERRAL), 422, 'exam.conclusion.parentOpinion');
  const saved = await save('ch_010', { ...REFERRAL, parentOpinion: 'Mẹ đồng ý đưa trẻ khám mắt (giả).' });
  const m = saved.measurement;
  assert.equal(m.published, true);
  assert.equal(m.exam.conclusion.parentOpinion, 'Mẹ đồng ý đưa trẻ khám mắt (giả).');
  assert.deepEqual(m.parentContact, { contacted: true, atExam: true, on: m.date, opinion: 'Mẹ đồng ý đưa trẻ khám mắt (giả).' });
  const contact = followUpOf('ch_010').history.find((e) => e.action === 'PARENT_CONTACTED' && e.atExam);
  assert.match(contact.note, /Ý kiến phụ huynh: Mẹ đồng ý đưa trẻ khám mắt \(giả\)\./);
  // Sửa ý kiến: ghi chú lần trao đổi tại buổi khám theo bản mới.
  await save('ch_010', { ...REFERRAL, parentOpinion: 'Bố sẽ đưa trẻ đi khám (giả).' }, { reason: 'Ghi lại ý kiến (giả).' });
  assert.match(followUpOf('ch_010').history.find((e) => e.atExam).note, /Bố sẽ đưa trẻ đi khám/);
});

test('AC-4: ý kiến phụ huynh bị bỏ khi không cần (kết luận bình thường)', async () => {
  const saved = await save('ch_012', { parentOpinion: 'Không cần (giả).' });
  assert.equal(saved.measurement.exam.conclusion.parentOpinion, '');
  assert.equal(saved.measurement.parentContact, null);
});

test('AC-5: không có người đi cùng ⇒ "Chưa trao đổi" tới khi giáo viên ghi trao đổi trong phiếu theo dõi', async () => {
  const saved = await save('ch_007', REFERRAL, { companion: false });
  assert.equal(saved.measurement.published, true, 'vẫn tự công bố');
  assert.deepEqual(saved.measurement.parentContact, { contacted: false, atExam: false, on: null, opinion: '' });
  const f = followUpOf('ch_007');
  await checks.recordFollowUpContact(f.id, { contactedOn: todayInput(), note: 'Đã gọi mẹ (giả).' }, MINH_ANH);
  const view = await exams.getHealthExam(C1_OPEN, 'ch_007', MINH_ANH);
  assert.equal(view.measurement.parentContact.contacted, true);
  assert.equal(view.measurement.parentContact.on, todayInput());
});

test('AC-2, AC-3: cân đo ngoài đợt công bố khi lưu; sửa thì công bố lại, có lịch sử; không còn API công bố riêng', async () => {
  assert.equal(children.publishMeasurement, undefined);
  const db = readDb();
  const used = new Set(db.healthMeasurements.filter((m) => m.childId === 'ch_008').map((m) => m.date));
  const date = ['2026-10-01', '2026-10-02', '2026-10-03'].find((d) => !used.has(d));
  const created = await children.saveMeasurement('ch_008', null, { date, heightCm: 101, weightKg: 16.2, note: '' }, MINH_ANH);
  assert.equal(created.published, true);
  const first = created.publishedAt;
  await new Promise((r) => setTimeout(r, 5));
  await rejects(
    children.saveMeasurement('ch_008', created.id, { date, heightCm: 101.5, weightKg: 16.2, note: '' }, MINH_ANH),
    422,
    'reason',
  );
  const edited = await children.saveMeasurement(
    'ch_008',
    created.id,
    { date, heightCm: 101.5, weightKg: 16.2, note: '', reason: 'Đo lại (giả).' },
    MINH_ANH,
  );
  assert.equal(edited.published, true);
  assert.ok(edited.publishedAt > first, 'ngày công bố mới');
  assert.equal(edited.edits.length, 1);
});

test('AC-3: sửa phiếu khám đã kết luận vẫn công bố, ngày công bố mới', async () => {
  const before = (await exams.getHealthExam(C1_OPEN, 'ch_009', MINH_ANH)).measurement;
  await new Promise((r) => setTimeout(r, 5));
  const saved = await save(
    'ch_009',
    { action: 'ADVICE', adviceText: 'Uống đủ nước (giả).' },
    { companion: false, reason: 'Sửa lời dặn (giả).' },
  );
  assert.equal(saved.measurement.published, true);
  assert.ok(saved.measurement.publishedAt > before.publishedAt);
  assert.equal(saved.measurement.edits.length, 1);
});
