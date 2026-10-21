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
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import(
  '@/services/children/mock/childrenMockRepository'
);
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const { todayInput } = await import('@/utils/format');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-21-health-follow-up-close-outcome.md (dữ liệu giả của seed).
 * c1: đợt hc_c1_open đang diễn ra. c2: hủy đợt sắp diễn ra rồi tạo đợt mới hôm nay như kịch bản thử tay.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const teacher = (id, campusId) => ({ id, role: 'TEACHER', campusId });
const MINH_ANH = teacher('u_minhanh', 'c1');
const HOA = teacher('u_hoa', 'c1');
const TUAN = teacher('u_tuan', 'c2');
const NGOC = teacher('u_ngoc', 'c2');
const C1_OPEN = 'hc_c1_open';

const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.prototype.hasOwnProperty.call(err.details || {}, key)));

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const followUpOf = (childId) => readDb().healthFollowUps.find((f) => f.childId === childId && !f.closedAt);
const notificationsOf = (followUpId) => (readDb().notifications || []).filter((n) => n.link === `/children/health-follow-ups/${followUpId}`);
const latestHealthOf = async (childId, user) => (await children.listChildren({}, user)).find((c) => c.id === childId)?.latestHealth;

/** Phiếu đủ ô bắt buộc từ bản điền sẵn; conclusion ghi đè phần kết luận. */
const filledPayload = (view, conclusion, { companion = true, reason } = {}) => {
  const exam = structuredClone(view.draft ? view.draft.exam : view.measurement.exam);
  exam.admin.premature ||= 'NO';
  exam.admin.hasCompanion = companion ? 'YES' : 'NO';
  exam.admin.companion = companion
    ? { guardianIndex: null, fullName: 'Người đi cùng (giả)', relation: 'Mẹ', phone: '', idNumber: '' }
    : { guardianIndex: null, fullName: '', relation: '', phone: '', idNumber: '' };
  exam.history = { self: 'NO', selfText: '', family: 'NO', familyText: '', tbContact: 'NO' };
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
    date: view.measurement?.date || view.draft.date,
    heightCm: 100,
    weightKg: 16,
    headCircumferenceCm: view.reference.headApplies ? 49 : null,
    exam,
    conclude: true,
    conclusionMode: view.conclusionMode,
    ...(reason ? { reason } : {}),
  };
};

const conclude = async (campaignId, childId, user, conclusion, opts) => {
  const view = await exams.getHealthExam(campaignId, childId, user);
  return exams.saveHealthExam(campaignId, childId, filledPayload(view, conclusion, opts), user);
};

let c2Campaign = null;
const openC2Campaign = async () => {
  if (c2Campaign) return c2Campaign;
  await checks.cancelHealthCheck('hc_c2_next', PRINCIPAL);
  const today = todayInput();
  c2Campaign = await checks.createHealthCheck(
    { name: 'Khám thử luồng phiếu theo dõi', campusId: 'c2', startDate: today, endDate: addDays(today, 3), examiner: 'Trạm Y tế (giả)' },
    PRINCIPAL,
  );
  return c2Campaign;
};

test('seed v9: phiếu khám mẫu FOLLOW_UP và phiếu đóng có kết quả', async () => {
  ensureChildRecordsSeeded();
  const db = readDb();
  assert.equal(db.healthSeedVersion, 9);
  // ch_019: "Chưa ghi nhận thêm bất thường" ⇒ phiếu giữ trạng thái có kết quả chuyên khoa, không mở vòng.
  const f019 = followUpOf('ch_019');
  const added = f019.history.find((e) => e.action === 'MEASUREMENT_ADDED');
  assert.equal(added.newFinding, false);
  assert.equal(f019.status, 'EXTERNAL_RESULT_RECORDED');
  // ch_003: "Có thêm bất thường mới", không có người đi cùng ⇒ vòng mới chờ trao đổi.
  assert.equal(followUpOf('ch_003').status, 'WAITING_PARENT_CONTACT');
  const f031 = db.healthFollowUps.find((f) => f.childId === 'ch_031');
  assert.equal(f031.closeOutcome, 'KNOWN_CONDITION');
  const h031 = await latestHealthOf('ch_031', PRINCIPAL);
  assert.equal(h031.followUpLevel, 'KNOWN_STABLE');
  assert.equal(h031.knownCondition, 'Bàn chân bẹt – mang giày chỉnh hình');
  const h023 = await latestHealthOf('ch_023', PRINCIPAL);
  assert.equal(h023.followUpLevel, 'KNOWN_STABLE');
  assert.equal(h023.source, 'EXAM');
  // Trẻ còn phiếu mở ⇒ "Cần theo dõi sát" dù lần khám gần nhất là "Chưa ghi nhận thêm bất thường".
  const h019 = await latestHealthOf('ch_019', PRINCIPAL);
  assert.equal(h019.followUpLevel, 'CLOSE_WATCH');
  assert.equal(h019.source, 'FOLLOW_UP_OPEN');
});

test('AC-1, AC-2: trẻ có phiếu mở dùng mẫu FOLLOW_UP; kiểm nhập theo mẫu; mẫu khác BE ⇒ 409', async () => {
  const view = await exams.getHealthExam(C1_OPEN, 'ch_011', MINH_ANH);
  assert.equal(view.conclusionMode, 'FOLLOW_UP');
  assert.equal(view.openFollowUp.id, followUpOf('ch_011').id);
  assert.ok(view.openFollowUp.openedOn);
  const noFinding = filledPayload(view, {});
  await rejects(exams.saveHealthExam(C1_OPEN, 'ch_011', noFinding, MINH_ANH), 422, 'exam.conclusion.followUpFinding');
  const advice = filledPayload(view, { followUpFinding: 'ADVICE' });
  await rejects(exams.saveHealthExam(C1_OPEN, 'ch_011', advice, MINH_ANH), 422, 'exam.conclusion.adviceText');
  await rejects(exams.saveHealthExam(C1_OPEN, 'ch_011', advice, MINH_ANH), 422, 'exam.conclusion.issueText');
  const newFinding = filledPayload(view, { followUpFinding: 'NEW_FINDING' });
  await rejects(exams.saveHealthExam(C1_OPEN, 'ch_011', newFinding, MINH_ANH), 422, 'exam.conclusion.issueText');
  const stale = { ...filledPayload(view, { followUpFinding: 'NO_NEW_FINDING' }), conclusionMode: 'STANDARD' };
  await rejects(exams.saveHealthExam(C1_OPEN, 'ch_011', stale, MINH_ANH), 409);
  // Trẻ không có phiếu mở: mẫu thường.
  const standard = await exams.getHealthExam(C1_OPEN, 'ch_020', HOA);
  assert.equal(standard.conclusionMode, 'STANDARD');
  assert.equal(standard.openFollowUp, null);
});

test('AC-3, AC-6, AC-11: "Chưa ghi nhận thêm" giữ phiếu; sửa sang "Có thêm bất thường mới" tính lại vòng', async () => {
  const before = followUpOf('ch_011');
  const notified = notificationsOf(before.id).length;
  const saved = await conclude(C1_OPEN, 'ch_011', MINH_ANH, { followUpFinding: 'NO_NEW_FINDING' });
  assert.equal(saved.measurement.publishBlockedReason, null);
  assert.equal(saved.measurement.followUpLevel, 'CLOSE_WATCH');
  assert.equal(saved.measurement.conclusionCategory, 'FOLLOWING_NO_NEW');
  let f = followUpOf('ch_011');
  assert.ok(f, 'phiếu vẫn mở');
  assert.equal(f.status, before.status);
  const event = f.history.find((e) => e.action === 'MEASUREMENT_ADDED' && e.measurementId === saved.measurement.id);
  assert.equal(event.newFinding, false);
  assert.ok(!f.history.some((e) => e.atExam && e.measurementId === saved.measurement.id), 'không ghi trao đổi tại buổi khám');
  assert.equal(notificationsOf(f.id).length, notified, 'không có thông báo mới');
  const health = await latestHealthOf('ch_011', MINH_ANH);
  assert.equal(health.followUpLevel, 'CLOSE_WATCH');
  // Sửa lựa chọn: vòng gộp (phiếu chưa trao đổi), ghi trao đổi tại buổi khám vì có người đi cùng.
  await conclude(C1_OPEN, 'ch_011', MINH_ANH, { followUpFinding: 'NEW_FINDING', issueText: 'Có thêm dấu hiệu mới (giả).' }, { reason: 'Sửa theo bác sĩ.' });
  f = followUpOf('ch_011');
  assert.equal(f.history.find((e) => e.measurementId === saved.measurement.id && e.action === 'MEASUREMENT_ADDED').newFinding, true);
  assert.ok(f.history.some((e) => e.atExam && e.measurementId === saved.measurement.id));
  assert.equal(f.status, 'PARENT_CONTACTED');
  await conclude(C1_OPEN, 'ch_011', MINH_ANH, { followUpFinding: 'NO_NEW_FINDING' }, { reason: 'Sửa lại theo bác sĩ.' });
  f = followUpOf('ch_011');
  assert.ok(f && !f.closedAt, 'sửa không đóng phiếu');
  assert.ok(f.history.some((e) => e.atExam && e.measurementId === saved.measurement.id), 'trao đổi đã ghi giữ nguyên');
  const { campaign, watchList } = await checks.getHealthCheck(C1_OPEN, PRINCIPAL);
  assert.ok(campaign.progress.byConclusion.FOLLOWING_NO_NEW >= 1);
  assert.ok(watchList.some((r) => r.childId === 'ch_011'), 'trẻ còn phiếu mở ở tab Trẻ cần theo dõi');
});

test('AC-4: "Có thêm bất thường mới" khi phiếu đã trao đổi ⇒ vòng mới, hạn 7 ngày, chặn công bố, thông báo', async () => {
  const campaign = await openC2Campaign();
  const f = followUpOf('ch_027');
  assert.equal(f.status, 'PARENT_CONTACTED');
  const draft = await exams.getHealthExam(campaign.id, 'ch_027', TUAN);
  await exams.saveHealthExam(campaign.id, 'ch_027', { ...filledPayload(draft, {}), conclude: false }, TUAN);
  assert.equal(followUpOf('ch_027').history.length, f.history.length, 'phiếu nháp không đổi phiếu theo dõi');
  const saved = await conclude(
    campaign.id,
    'ch_027',
    TUAN,
    { followUpFinding: 'NEW_FINDING', issueText: 'Vòng đầu nhỏ (giả).', specialty: 'Nhi khoa' },
    { companion: false },
  );
  const after = followUpOf('ch_027');
  assert.equal(after.id, f.id, 'không mở phiếu thứ hai');
  assert.equal(after.status, 'WAITING_PARENT_CONTACT');
  assert.equal(saved.measurement.publishBlockedReason, 'FOLLOW_UP_CONTACT_REQUIRED');
  assert.equal(saved.measurement.conclusionCategory, 'FOLLOWING_NEW');
  const titles = notificationsOf(f.id).map((n) => n.title);
  assert.ok(titles.includes('Trẻ có thêm bất thường mới'));
  const view = await checks.getHealthFollowUp(f.id, TUAN);
  assert.equal(view.currentRound.dueOn, addDays(todayInput(), 7));
});

test('AC-4: tích nguy cơ lao ở mẫu FOLLOW_UP xử lý như bất thường mới, có thông báo lao', async () => {
  const campaign = await openC2Campaign();
  const f = followUpOf('ch_033');
  assert.equal(f.status, 'WAITING_PARENT_CONTACT');
  const saved = await conclude(campaign.id, 'ch_033', NGOC, { followUpFinding: 'NO_NEW_FINDING', tbRisk: true });
  assert.equal(saved.measurement.conclusionCategory, 'TB_RISK');
  const after = followUpOf('ch_033');
  assert.equal(after.status, 'PARENT_CONTACTED', 'có người đi cùng ⇒ trao đổi tại buổi khám');
  assert.ok(notificationsOf(f.id).some((n) => n.title === 'Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)'));
});

test('AC-13: mẫu thường, có vấn đề không chuyển khám ⇒ hỏi mới hay đã biết', async () => {
  const campaign = await openC2Campaign();
  const view = await exams.getHealthExam(campaign.id, 'ch_028', TUAN);
  assert.equal(view.conclusionMode, 'STANDARD');
  const issue = { healthIssue: true, issueText: 'Cận thị – đeo kính (giả).', action: 'NONE' };
  await rejects(exams.saveHealthExam(campaign.id, 'ch_028', filledPayload(view, issue), TUAN), 422, 'exam.conclusion.issueKind');
  const saved = await exams.saveHealthExam(campaign.id, 'ch_028', filledPayload(view, { ...issue, issueKind: 'KNOWN' }), TUAN);
  assert.equal(saved.measurement.followUpLevel, 'KNOWN_STABLE');
  assert.equal(followUpOf('ch_028'), undefined, 'không mở phiếu');
  const health = await latestHealthOf('ch_028', TUAN);
  assert.equal(health.followUpLevel, 'KNOWN_STABLE');
  assert.equal(health.knownCondition, 'Cận thị – đeo kính (giả).');
  const detail = await checks.getHealthCheck(campaign.id, PRINCIPAL);
  assert.ok(!detail.watchList.some((r) => r.childId === 'ch_028'), 'vấn đề đã biết không vào tab Trẻ cần theo dõi');
  assert.equal(detail.campaign.progress.byConclusion.ISSUE >= 1, true, 'vẫn đếm là có vấn đề sức khỏe');
  // Chuyển khám: không hỏi câu này, mở phiếu như hiện nay.
  const referral = await conclude(campaign.id, 'ch_029', TUAN, {
    healthIssue: true,
    issueText: 'Chảy nước mũi kéo dài (giả).',
    action: 'REFERRAL',
    specialty: 'Tai mũi họng',
  });
  assert.equal(referral.measurement.followUpLevel, 'CLOSE_WATCH');
  assert.ok(followUpOf('ch_029'));
});

test('AC-8, AC-10: đóng phiếu bắt buộc kết quả; điều kiện theo phiếu; mức hiện tại theo kết quả', async () => {
  const f = followUpOf('ch_027');
  await rejects(checks.closeFollowUp(f.id, { reason: 'Xong việc.' }, TUAN), 422, 'outcome');
  await rejects(checks.closeFollowUp(f.id, { outcome: 'KNOWN_CONDITION', conditionText: 'X', reason: 'Xong.' }, TUAN), 422, 'outcome');
  await rejects(checks.closeFollowUp(f.id, { outcome: 'DOCTOR_NORMAL', reason: 'Xong.' }, PRINCIPAL), 403);
  const view = await checks.getHealthFollowUp(f.id, TUAN);
  assert.deepEqual(view.closeOutcomeOptions, ['DOCTOR_NORMAL', 'NO_SPECIALIST_RESULT']);
  const closed = await checks.closeFollowUp(f.id, { outcome: 'DOCTOR_NORMAL', reason: 'Bác sĩ trường kết luận vấn đề cũ đã hết.' }, TUAN);
  assert.equal(closed.closeOutcome, 'DOCTOR_NORMAL');
  const health = await latestHealthOf('ch_027', TUAN);
  assert.equal(health.followUpLevel, 'NONE');
  assert.equal(health.source, 'FOLLOW_UP_CLOSED');
  // Phiếu không có kết quả chuyên khoa: giữ mức lần khám, kèm ngày đóng.
  const f033 = followUpOf('ch_033');
  await checks.closeFollowUp(f033.id, { outcome: 'NO_SPECIALIST_RESULT', reason: 'Phụ huynh chưa đưa trẻ đi khám.' }, NGOC);
  const h033 = await latestHealthOf('ch_033', NGOC);
  assert.equal(h033.followUpLevel, 'CLOSE_WATCH');
  assert.equal(h033.closedWithoutResultOn, todayInput());
});

test('AC-9: đóng với "chuyên khoa xác định có vấn đề" ghi tiền sử bản thân, không thông báo', async () => {
  const campaign = await openC2Campaign();
  // ch_025 có phiếu Tai mũi họng đang mở (đã có kết quả chuyên khoa); khám đợt mới chọn "Tư vấn".
  const exam = await conclude(campaign.id, 'ch_025', TUAN, {
    followUpFinding: 'ADVICE',
    issueText: 'Răng có mảng bám (giả).',
    adviceText: 'Đánh răng 2 lần mỗi ngày.',
  });
  assert.equal(exam.measurement.conclusionCategory, 'ISSUE');
  const f = followUpOf('ch_025');
  assert.equal(f.status, 'EXTERNAL_RESULT_RECORDED', '"Tư vấn" không đổi phiếu');
  await rejects(checks.closeFollowUp(f.id, { outcome: 'KNOWN_CONDITION', reason: 'Xong.' }, TUAN), 422, 'conditionText');
  const notified = notificationsOf(f.id).length;
  const condition = 'Nghe kém tai phải – theo dõi tại nhà';
  await checks.closeFollowUp(f.id, { outcome: 'KNOWN_CONDITION', conditionText: condition, reason: 'Đã khám chuyên khoa.' }, TUAN);
  const decl = readDb().healthDeclarations.find((x) => x.childId === 'ch_025');
  assert.equal(decl.medicalHistory.self.state, 'REPORTED');
  assert.ok(decl.medicalHistory.self.text.includes(condition));
  assert.equal(decl.history.at(-1).action, 'UPDATED_FROM_FOLLOW_UP');
  assert.equal(notificationsOf(f.id).length, notified);
  const health = await latestHealthOf('ch_025', TUAN);
  assert.equal(health.followUpLevel, 'KNOWN_STABLE');
  assert.equal(health.knownCondition, condition);
  // Đóng lần nữa với cùng tên vấn đề (phiếu khác của trẻ) không lặp tên trong tiền sử.
  const again = readDb().healthDeclarations.find((x) => x.childId === 'ch_025').medicalHistory.self.text;
  assert.equal(again.split(condition).length - 1, 1);
});

test('AC-5: cân đo ngoài đợt không đổi phiếu theo dõi đang mở', async () => {
  const f = followUpOf('ch_019');
  await children.saveMeasurement('ch_019', null, { date: todayInput(), heightCm: 112, weightKg: 19, note: 'Cân đo tại lớp (giả).' }, HOA);
  const after = followUpOf('ch_019');
  assert.equal(after.history.length, f.history.length);
  assert.equal(after.status, f.status);
});

test('AC-12: DB cũ chưa có cờ newFinding được gắn khi nâng cấp', async () => {
  writeDb((d) => {
    d.healthSeedVersion = 8;
    const f = d.healthFollowUps.find((x) => x.childId === 'ch_019' && !x.closedAt);
    const e = f.history.find((x) => x.action === 'MEASUREMENT_ADDED');
    delete e.newFinding;
    f.history.push({ at: new Date().toISOString(), userId: null, action: 'OVERDUE_REMINDED', roundAt: f.openedAt, dueOn: '2026-09-22' });
  });
  ensureChildRecordsSeeded();
  const f = followUpOf('ch_019');
  assert.equal(f.history.find((x) => x.action === 'MEASUREMENT_ADDED').newFinding, false);
  assert.equal(readDb().healthSeedVersion, 9);
});
