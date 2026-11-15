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
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { todayInput } = await import('@/utils/format');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-23-auto-publish-health-results.md (dữ liệu giả của seed).
 * Lớp Chồi 1 (cô Minh Anh) chưa có phiếu trong đợt hc_c1_open đang diễn ra. Từ 2026-11-04 không còn phiếu theo dõi (HLT-16 bỏ):
 * phiếu khám không còn trạng thái trao đổi phụ huynh; ý kiến phụ huynh tại buổi khám vẫn bắt buộc khi Cần theo dõi sát.
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
  assert.equal('parentContact' in saved.measurement, false, 'không còn trạng thái trao đổi phụ huynh');
});

test('AC-4: có người đi cùng + Cần theo dõi sát ⇒ bắt buộc ý kiến phụ huynh, lưu trên phiếu khám', async () => {
  await rejects(save('ch_010', REFERRAL), 422, 'exam.conclusion.parentOpinion');
  const saved = await save('ch_010', { ...REFERRAL, parentOpinion: 'Mẹ đồng ý đưa trẻ khám mắt (giả).' });
  const m = saved.measurement;
  assert.equal(m.published, true);
  assert.equal(m.followUpLevel, 'CLOSE_WATCH');
  assert.equal(m.exam.conclusion.parentOpinion, 'Mẹ đồng ý đưa trẻ khám mắt (giả).');
  assert.equal(readDb().healthFollowUps, undefined, 'không mở phiếu theo dõi');
  // Sửa ý kiến: phiếu lưu bản mới.
  const edited = await save('ch_010', { ...REFERRAL, parentOpinion: 'Bố sẽ đưa trẻ đi khám (giả).' }, { reason: 'Ghi lại ý kiến (giả).' });
  assert.equal(edited.measurement.exam.conclusion.parentOpinion, 'Bố sẽ đưa trẻ đi khám (giả).');
});

test('AC-4: ý kiến phụ huynh bị bỏ khi không cần (kết luận bình thường)', async () => {
  const saved = await save('ch_012', { parentOpinion: 'Không cần (giả).' });
  assert.equal(saved.measurement.exam.conclusion.parentOpinion, '');
});

test('AC-5: không có người đi cùng ⇒ chuyển khám vẫn công bố, không có ý kiến phụ huynh, không có việc trao đổi sau khám', async () => {
  const saved = await save('ch_007', { ...REFERRAL, parentOpinion: 'Không dùng (giả).' }, { companion: false });
  assert.equal(saved.measurement.published, true, 'vẫn tự công bố');
  assert.equal(saved.measurement.exam.conclusion.parentOpinion, '');
  assert.equal('parentContact' in saved.measurement, false);
  assert.equal(readDb().healthFollowUps, undefined);
});

test('AC-2, AC-3: số đo của kỳ cân đo công bố khi lưu; sửa thì công bố lại, có lịch sử; không còn API công bố riêng', async () => {
  assert.equal(children.publishMeasurement, undefined);
  // Từ 2026-10-31 chỉ nhập số đo trong kỳ cân đo: thêm thẳng một kỳ đang diễn ra ở c1 (dữ liệu giả).
  writeDb((d) => {
    d.healthCheckCampaigns.push({
      id: 'hc_c1_round_test',
      kind: 'MEASUREMENT',
      name: 'Cân đo thử (giả)',
      campusId: 'c1',
      startDate: '2026-10-01',
      endDate: todayInput(),
      examiner: '',
      note: '',
      closedAt: null,
      cancelledAt: null,
      absentChildIds: [],
      history: [],
    });
  });
  const created = await children.saveMeasurement(
    'ch_008',
    null,
    { campaignId: 'hc_c1_round_test', heightCm: 101, weightKg: 16.2, note: '' },
    MINH_ANH,
  );
  assert.equal(created.published, true);
  // Ngày đo do BE ghi (user chốt 2026-11-04): số đo mới = hôm nay, sửa giữ ngày.
  assert.equal(created.date, todayInput());
  const first = created.publishedAt;
  await new Promise((r) => setTimeout(r, 5));
  await rejects(
    children.saveMeasurement('ch_008', created.id, { heightCm: 101.5, weightKg: 16.2, note: '' }, MINH_ANH),
    422,
    'reason',
  );
  const edited = await children.saveMeasurement(
    'ch_008',
    created.id,
    { heightCm: 101.5, weightKg: 16.2, note: '', reason: 'Đo lại (giả).' },
    MINH_ANH,
  );
  assert.equal(edited.date, created.date);
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
