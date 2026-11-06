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
const { notificationMockRepository: notifications } = await import('@/mocks/notificationMockRepository');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { todayInput } = await import('@/utils/format');

/*
 * Cảnh báo sức khỏe ở Sổ sức khỏe, bỏ phiếu theo dõi (plan docs/plans/active/2026-11-04-health-warnings-book.md; HLT-16 bỏ, HLT-18,
 * HLT-19). Seed: c1 có đợt khám hc_c1_open đang diễn ra; c2 có kỳ cân đo hc_c2_next (Lớp Lá A đủ 6 trẻ, ch_033 gầy còm; Lớp Mầm 1 có
 * ch_026 béo phì, ch_029 nguy cơ thừa cân), đợt khám hc_c2_2610 đã đóng. Dữ liệu giả.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const AN = { id: 'u_an', role: 'TEACHER', campusId: 'c1' };
const MINH_ANH = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const ROUND = 'hc_c2_next';
const C1_OPEN = 'hc_c1_open';
const C2_OCT = 'hc_c2_2610';
const FOLLOW_UP_KEYS = ['followUpId', 'followUpEffect', 'parentContact'];
const BMI_RANK = { SEVERE_THINNESS: 0, OBESE: 0, THINNESS: 1, OVERWEIGHT: 1, OVERWEIGHT_RISK: 2 };

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const hasNone = (obj, keys) => keys.every((k) => !(k in obj));

/** Phiếu đủ ô bắt buộc từ bản điền sẵn; conclusion ghi đè phần kết luận. */
const examPayload = (view, conclusion, { companion = false } = {}) => {
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
  exam.conclusion = { ...buildEmptyExam().conclusion, doctorName: 'BS. Thử Nghiệm', ...conclusion };
  return {
    heightCm: 100,
    weightKg: 16,
    headCircumferenceCm: view.reference.headApplies ? 49 : null,
    exam,
    conclude: true,
    conclusionMode: view.conclusionMode,
  };
};

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-2 (HLT-19): Sổ sức khỏe trả latestExam, latestBmi; không còn dữ liệu phiếu theo dõi', async () => {
  const record = await children.getHealthRecord('ch_033', PRINCIPAL);
  assert.ok(hasNone(record, ['latestHealth', 'openFollowUp', 'externalResults']), 'bỏ trường của phiếu theo dõi');
  assert.equal('openFollowUpId' in record.child, false);
  assert.deepEqual(Object.keys(record.latestExam).sort(), [
    'campaignId',
    'campaignName',
    'conclusion',
    'conclusionCategory',
    'date',
    'followUpLevel',
    'measurementId',
  ]);
  assert.equal(record.latestExam.campaignId, C2_OCT);
  assert.equal(record.latestExam.followUpLevel, 'CLOSE_WATCH');
  assert.equal(record.latestExam.conclusionCategory, 'REFERRAL');
  assert.equal(record.latestExam.conclusion.specialty, 'Mắt');
  assert.deepEqual(Object.keys(record.latestBmi).sort(), [
    'ageMonths',
    'bmi',
    'bmiStatus',
    'bmiZScore',
    'campaignId',
    'campaignName',
    'date',
    'measurementId',
  ]);
  assert.equal(record.latestBmi.campaignId, ROUND);
  assert.equal(record.latestBmi.bmiStatus, 'THINNESS');
  assert.equal(Math.round(record.latestBmi.bmiZScore * 100) / 100, record.latestBmi.bmiZScore, 'z-score 2 chữ số');

  const exam = record.measurements.find((m) => m.source === 'EXAM');
  assert.deepEqual([exam.bmiStatus, exam.bmiZScore], [null, null], 'đợt khám theo kết luận bác sĩ, không xếp mức BMI');
  assert.equal(typeof exam.bmi, 'number', 'vẫn có số BMI');
  const round = record.measurements.find((m) => m.campaignId === ROUND);
  assert.equal(round.source, 'MEASUREMENT_ONLY');
  assert.equal(round.bmiStatus, 'THINNESS');
  assert.ok(record.measurements.every((m) => hasNone(m, [...FOLLOW_UP_KEYS, 'criteria', 'reference'])));
  assert.equal(readDb().healthFollowUps, undefined);
});

test('HLT-18: kết quả mẫu cũ có mức BMI, mức theo dõi không còn theo ngưỡng tạm; vòng đầu, vận động vẫn xem được', async () => {
  const record = await children.getHealthRecord('ch_014', PRINCIPAL);
  const legacy = record.measurements.filter((m) => m.source === 'LEGACY');
  assert.ok(legacy.length >= 2);
  assert.ok(legacy.every((m) => m.followUpLevel === 'UNAVAILABLE' && m.conclusionCategory === null));
  assert.ok(legacy.every((m) => m.bmiStatus && typeof m.bmiZScore === 'number' && m.grossMotor && m.fineMotor));
  assert.equal(legacy.find((m) => m.date === '2026-03-16').headCircumferenceStatus, 'LARGE', 'vòng đầu mẫu cũ vẫn hiện');
  // Trẻ chỉ có phiếu nháp trong đợt đang diễn ra: chưa có kết luận bác sĩ; BMI lấy từ kết quả mẫu cũ gần nhất (mock).
  assert.equal(record.latestExam, null);
  assert.equal(record.latestBmi.measurementId, legacy.sort((a, b) => b.date.localeCompare(a.date))[0].id);
});

test('AC-4 (HLT-19): kỳ cân đo có số trẻ theo mức BMI, bmiWarning theo lớp, trẻ cần chú ý xếp theo mức nặng rồi tên', async () => {
  const detail = await checks.getHealthCheck(ROUND, PRINCIPAL);
  const { bmi } = detail.campaign.progress;
  assert.deepEqual(Object.keys(bmi), ['severeThinness', 'thinness', 'overweightRisk', 'overweight', 'obese']);
  assert.deepEqual(Object.values(bmi), [0, 1, 1, 0, 1], 'gầy còm ch_033, nguy cơ thừa cân ch_029, béo phì ch_026');
  assert.ok(hasNone(detail.campaign, ['waitingFollowUpCount', 'overdueFollowUpCount']));
  assert.equal('byConclusion' in detail.campaign.progress, false);
  const byClass = Object.fromEntries(detail.classes.map((c) => [c.classId, c]));
  assert.equal(byClass.cls_c2_la.bmiWarning, 1);
  assert.equal(byClass.cls_c2_m1.bmiWarning, 2);
  assert.equal('bmi' in byClass.cls_c2_la, false, 'tiến độ theo lớp chỉ có số trẻ cảnh báo BMI');

  const list = detail.watchList;
  assert.deepEqual(
    list.map((r) => r.childId),
    ['ch_026', 'ch_033', 'ch_029'],
    'béo phì, rồi gầy còm, rồi nguy cơ thừa cân',
  );
  assert.ok(
    list.every((r) => r.bmiStatus && r.bmiStatus !== 'NORMAL' && typeof r.bmi === 'number' && hasNone(r, ['followUp', 'criteria'])),
  );
  for (let i = 1; i < list.length; i += 1) {
    const [a, b] = [list[i - 1], list[i]];
    const order = BMI_RANK[a.bmiStatus] - BMI_RANK[b.bmiStatus] || a.fullName.localeCompare(b.fullName, 'vi');
    assert.ok(order <= 0, `${a.fullName} trước ${b.fullName}`);
  }
  const roster = await checks.getHealthCheckClass(ROUND, 'cls_c2_la', PRINCIPAL);
  assert.ok(roster.children.every((r) => 'bmi' in r && 'bmiStatus' in r && !('followUp' in r)));
});

test('AC-4: đợt khám giữ trẻ cần theo dõi theo kết luận bác sĩ; số BMI luôn 0; đóng đợt không còn đếm phiếu theo dõi', async () => {
  const detail = await checks.getHealthCheck(C1_OPEN, PRINCIPAL);
  assert.deepEqual(Object.values(detail.campaign.progress.bmi), [0, 0, 0, 0, 0]);
  assert.ok(detail.classes.every((c) => c.bmiWarning === 0));
  const levels = detail.watchList.map((r) => r.followUpLevel);
  assert.ok(levels.length > 0 && levels.every((l) => l === 'WATCH' || l === 'CLOSE_WATCH'));
  assert.deepEqual(
    levels,
    [...levels].sort((a, b) => (a === b ? 0 : a === 'CLOSE_WATCH' ? -1 : 1)),
    'theo dõi sát trước',
  );
  assert.ok(detail.watchList.every((r) => r.bmiStatus === null && r.bmi === null));
  const list = await checks.listHealthChecks({}, PRINCIPAL);
  assert.ok(list.every((c) => hasNone(c, ['waitingFollowUpCount', 'overdueFollowUpCount']) && c.progress.bmi));
  const closed = await checks.closeHealthCheck(C1_OPEN, PRINCIPAL);
  assert.equal('waitingFollowUpCount' in closed, false);
});

test('AC-3 (HLT-16 bỏ): lưu số đo kỳ cân đo trả mức BMI; kết luận theo dõi sát không mở phiếu, không gửi thông báo phiếu theo dõi', async () => {
  const roster = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  const row = roster.children.find((r) => r.result === 'NOT_RECORDED');
  const saved = await children.saveMeasurement(
    row.childId,
    null,
    { campaignId: ROUND, heightCm: 98, weightKg: 22, note: '' },
    TUAN,
  );
  assert.equal(saved.source, 'MEASUREMENT_ONLY');
  assert.equal(saved.bmi, 22.9);
  assert.equal(saved.bmiStatus, 'OBESE');
  assert.ok(hasNone(saved, FOLLOW_UP_KEYS));
  const after = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  assert.deepEqual((({ bmi, bmiStatus }) => ({ bmi, bmiStatus }))(after.children.find((r) => r.childId === row.childId)), {
    bmi: 22.9,
    bmiStatus: 'OBESE',
  });

  const view = await exams.getHealthExam(C1_OPEN, 'ch_009', MINH_ANH);
  const res = await exams.saveHealthExam(
    C1_OPEN,
    'ch_009',
    examPayload(view, { normal: false, tbRisk: true, action: 'REFERRAL', specialty: 'Lao và bệnh phổi (giả)' }),
    MINH_ANH,
  );
  assert.equal(res.measurement.followUpLevel, 'CLOSE_WATCH');
  assert.ok(hasNone(res, ['openFollowUp', 'latestExternalResult']) && hasNone(res.measurement, FOLLOW_UP_KEYS));
  const db = readDb();
  assert.equal(db.healthFollowUps, undefined);
  assert.ok(!db.notifications.some((n) => n.type === 'HEALTH_FOLLOW_UP' || n.link?.startsWith('/children/health-follow-ups')));
  const record = await children.getHealthRecord('ch_009', PRINCIPAL);
  assert.equal(record.latestExam.measurementId, res.measurement.id);
  assert.equal(record.latestExam.conclusionCategory, 'TB_RISK');
});

test('AC-5: phiếu đã kết luận mẫu FOLLOW_UP giữ mẫu khi xem, sửa; phiếu mới, phiếu nháp dùng mẫu thường', async () => {
  const legacy = await exams.getHealthExam(C1_OPEN, 'ch_003', AN);
  assert.equal(legacy.conclusionMode, 'FOLLOW_UP');
  assert.equal(legacy.measurement.conclusionCategory, 'FOLLOWING_NEW', 'nhóm kết luận cũ vẫn đọc được');
  assert.equal(legacy.measurement.followUpLevel, 'CLOSE_WATCH');
  assert.ok(hasNone(legacy, ['openFollowUp', 'latestExternalResult']));
  await rejects(
    exams.saveHealthExam(C1_OPEN, 'ch_003', { ...examPayload(legacy, {}), conclusionMode: 'STANDARD', reason: 'Sửa (giả).' }, AN),
    409,
  );
  assert.equal((await exams.getHealthExam(C1_OPEN, 'ch_004', AN)).conclusionMode, 'STANDARD', 'phiếu nháp');
  assert.equal((await exams.getHealthExam(C1_OPEN, 'ch_007', MINH_ANH)).conclusionMode, 'STANDARD', 'phiếu mới');
});

// User bỏ câu "Vấn đề này" (mới hay đã biết) 2026-11-04, như BE: có vấn đề sức khỏe ⇒ Cần theo dõi; phiếu cũ đã trả lời giữ mức.
test('HLT-10: phiếu không hỏi vấn đề mới hay đã biết; có vấn đề là Cần theo dõi; phiếu cũ đã trả lời giữ mức khi xem', async () => {
  const ch007 = await exams.getHealthExam(C1_OPEN, 'ch_007', MINH_ANH);
  assert.equal('knownCondition' in ch007, false, 'API không còn knownCondition');
  // Trẻ có tiền sử bản thân đã khai (Hen phế quản) vẫn kết luận được mà không chọn mới hay đã biết; gửi kèm "KNOWN" cũng bị bỏ.
  const issue = {
    normal: false,
    healthIssue: true,
    issueText: 'Hen phế quản, ổn định (giả).',
    action: 'ADVICE',
    adviceText: 'Giữ ấm (giả).',
    issueKind: 'KNOWN',
  };
  const saved = await exams.saveHealthExam(C1_OPEN, 'ch_007', examPayload(ch007, issue), MINH_ANH);
  assert.equal(saved.measurement.followUpLevel, 'WATCH');
  assert.equal(saved.measurement.exam.conclusion.issueKind, '');
  // Dữ liệu seed cũ: lần khám đã trả lời "Vấn đề đã biết" vẫn ở mức ổn định.
  const record = await children.getHealthRecord('ch_023', PRINCIPAL);
  assert.equal(record.latestExam.followUpLevel, 'KNOWN_STABLE');
});

test('HLT-16 bỏ: cho trẻ nghỉ học không còn đóng phiếu theo dõi', async () => {
  const left = await children.withdrawChild('ch_006', { leftAt: todayInput(), reason: 'Chuyển nơi ở (giả).' }, PRINCIPAL);
  assert.equal('openFollowUpId' in left, false);
  const notice = readDb().notifications.find((n) => n.type === 'CHILD_WITHDRAWN' && n.link === '/children/ch_006');
  assert.ok(notice && !/phiếu theo dõi/i.test(notice.message));
});

test('DB demo cũ (seed v13): bỏ phiếu theo dõi và thông báo của nó; thêm số đo seed của kỳ cân đo khi kỳ còn nguyên', async () => {
  writeDb((d) => {
    d.healthSeedVersion = 13;
    d.healthFollowUps = [{ id: 'fu_old', childId: 'ch_001', measurementIds: [], history: [] }];
    d.healthMeasurements = d.healthMeasurements.filter((m) => m.campaignId !== ROUND);
    Object.assign(
      d.healthCheckCampaigns.find((c) => c.id === ROUND),
      { startDate: '2026-08-03', endDate: '2026-08-10' },
    );
    d.notifications = [
      ...(d.notifications || []),
      {
        id: 'n_fu_old',
        userId: 'u_hung',
        type: 'HEALTH_FOLLOW_UP',
        link: '/children/health-follow-ups/fu_old',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];
    d.mockSeedVersions = { ...(d.mockSeedVersions || {}), notifications: 1 };
  });
  const db = ensureChildRecordsSeeded();
  assert.equal(db.healthSeedVersion, 14);
  assert.equal(db.healthFollowUps, undefined);
  const round = db.healthCheckCampaigns.find((c) => c.id === ROUND);
  const results = db.healthMeasurements.filter((m) => m.campaignId === ROUND);
  assert.equal(results.length, 8, 'kỳ còn nguyên ⇒ thêm số đo seed');
  assert.ok(
    results.every((m) => m.date >= round.startDate && m.date <= round.endDate),
    'số đo nằm trong khoảng ngày mới của kỳ',
  );
  const mine = await notifications.list('u_hung');
  assert.ok(!mine.some((n) => n.type === 'HEALTH_FOLLOW_UP'));
  assert.equal(mine.find((n) => n.id === 'n_demo_3')?.type, 'CHILD_TB_CONTACT', 'thông báo demo cùng vị trí nhận nội dung mới');

  // Kỳ đã có người thao tác: không thêm số đo seed.
  writeDb((d) => {
    d.healthSeedVersion = 13;
    d.healthMeasurements = d.healthMeasurements.filter((m) => m.campaignId !== ROUND);
    d.healthCheckCampaigns.find((c) => c.id === ROUND).history.push({ at: new Date().toISOString(), userId: 'u_duc', action: 'UPDATED' });
  });
  assert.equal(ensureChildRecordsSeeded().healthMeasurements.filter((m) => m.campaignId === ROUND).length, 0);
});
