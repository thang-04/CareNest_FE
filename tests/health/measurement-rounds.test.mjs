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
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { canManageHealthCheck } = await import('@/utils/children/childrenPermissions');
const { todayInput } = await import('@/utils/format');
const { buildSeedSchoolConfig } = await import('@/mocks/schoolConfigSeed');

/*
 * Kỳ cân đo do HT/PHT mở, đợt khám 1 lần/năm (plan docs/plans/completed/2026-10-31-health-measurement-rounds.md).
 * Seed: c1 có đợt khám hc_c1_open đang diễn ra; c2 có kỳ cân đo hc_c2_next đang diễn ra. Dữ liệu giả.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const LAN = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const DUC = { id: 'u_duc', role: 'VICE_PRINCIPAL', campusId: 'c2' };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const C1_OPEN = 'hc_c1_open';
const C2_ROUND = 'hc_c2_next';

const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.prototype.hasOwnProperty.call(err.details || {}, key)));

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

/** Hủy mọi kỳ/đợt chưa đóng của điểm trường để tạo mới (dữ liệu test). */
const freeCampus = (campusId) =>
  writeDb((d) => {
    d.healthCheckCampaigns
      .filter((c) => c.campusId === campusId && !c.closedAt && !c.cancelledAt)
      .forEach((c) => (c.cancelledAt = new Date().toISOString()));
  });

/** Thêm kỳ/đợt đã đóng thẳng vào DB. */
const insertRound = (fields) =>
  writeDb((d) => {
    d.healthCheckCampaigns.push({
      name: 'Kỳ thử (giả)',
      examiner: '',
      note: '',
      createdBy: PRINCIPAL.id,
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      closedBy: PRINCIPAL.id,
      cancelledAt: null,
      absentChildIds: [],
      history: [],
      ...fields,
    });
  });

const roundPayload = (campusId, kind, startDate = todayInput()) => ({
  kind,
  name: kind === 'MEASUREMENT' ? 'Cân đo thử (giả)' : 'Khám thử (giả)',
  campusId,
  startDate,
  endDate: addDays(startDate, 3),
  examiner: 'Trạm Y tế (giả)',
});

const tuanChild = () => {
  const db = readDb();
  const cls = db.classes.find((c) => c.campusId === 'c2' && (c.teacherIds || []).includes(TUAN.id));
  return db.children.find((ch) => ch.classId === cls.id && ch.status === 'ACTIVE');
};

test('Seed: kỳ cân đo đang diễn ra ở c2; đợt cũ là đợt khám', () => {
  const db = readDb();
  const round = db.healthCheckCampaigns.find((c) => c.id === C2_ROUND);
  assert.equal(round.kind, 'MEASUREMENT');
  assert.ok(round.startDate <= todayInput() && todayInput() <= round.endDate, 'kỳ đang diễn ra');
  assert.ok(
    db.healthCheckCampaigns.filter((c) => c.id !== C2_ROUND).every((c) => c.kind === 'EXAM'),
    'mọi đợt khác là đợt khám',
  );
});

test('AC-1: quyền quản lý theo điểm trường', async () => {
  assert.equal(canManageHealthCheck(LAN, 'c1'), true);
  assert.equal(canManageHealthCheck(LAN, 'c2'), false);
  assert.equal(canManageHealthCheck(LAN), true, 'không nêu điểm trường: PHT có điểm trường để quản lý');
  assert.equal(canManageHealthCheck(PRINCIPAL, 'c2'), true);
  assert.equal(canManageHealthCheck(TUAN), false);

  freeCampus('c1');
  const created = await checks.createHealthCheck(roundPayload('c1', 'MEASUREMENT'), LAN);
  assert.equal(created.kind, 'MEASUREMENT');
  await rejects(checks.createHealthCheck(roundPayload('c2', 'EXAM'), LAN), 422, 'campusId');
  await rejects(checks.createHealthCheck(roundPayload('c1', 'EXAM'), TUAN), 403);

  freeCampus('c2');
  const byPrincipal = await checks.createHealthCheck(roundPayload('c2', 'EXAM'), PRINCIPAL);
  assert.equal(byPrincipal.kind, 'EXAM');
  // PHT đóng, mở lại kỳ của điểm trường mình; không đụng được điểm trường khác.
  await checks.closeHealthCheck(created.id, LAN);
  await checks.reopenHealthCheck(created.id, { reason: 'Nhập bù (giả).' }, LAN);
  await rejects(checks.closeHealthCheck(byPrincipal.id, LAN), 404);
});

test('AC-2: kỳ cân đo không có đơn vị khám; lọc theo loại', async () => {
  freeCampus('c1');
  const created = await checks.createHealthCheck(roundPayload('c1', 'MEASUREMENT'), PRINCIPAL);
  assert.equal(created.examiner, '');
  const updated = await checks.updateHealthCheck(created.id, { ...roundPayload('c1', 'EXAM'), name: 'Đổi tên (giả)' }, PRINCIPAL);
  assert.equal(updated.kind, 'MEASUREMENT', 'không đổi loại sau khi tạo');
  const rounds = await checks.listHealthChecks({ kind: 'MEASUREMENT' }, PRINCIPAL);
  assert.ok(rounds.length >= 2);
  assert.ok(rounds.every((c) => c.kind === 'MEASUREMENT'));
  await rejects(checks.createHealthCheck({ ...roundPayload('c2', 'EXAM'), kind: 'OTHER' }, PRINCIPAL), 422, 'kind');
});

test('AC-3: cảnh báo khi ngày bắt đầu cách kỳ/đợt khác dưới 2 tháng 15 ngày', async () => {
  insertRound({ id: 'r_far', kind: 'MEASUREMENT', campusId: 'c1', startDate: '2030-09-01', endDate: '2030-09-05' });
  insertRound({
    id: 'r_cancelled',
    kind: 'MEASUREMENT',
    campusId: 'c1',
    startDate: '2030-12-20',
    endDate: '2030-12-22',
    closedAt: null,
    cancelledAt: new Date().toISOString(),
  });
  const warn = (startDate, excludeId) =>
    checks.scheduleWarnings({ campusId: 'c1', kind: 'MEASUREMENT', startDate, excludeId }, LAN).then((r) => r.warnings);

  const after = await warn('2030-11-15');
  assert.deepEqual(
    after.map((w) => [w.code, w.campaignId]),
    [['TOO_CLOSE', 'r_far']],
  );
  assert.equal(after[0].kind, 'MEASUREMENT');
  assert.equal(after[0].startDate, '2030-09-01');
  assert.deepEqual(await warn('2030-11-16'), [], 'đúng bằng ngưỡng thì không cảnh báo; kỳ đã hủy không tính');
  assert.deepEqual(
    (await warn('2030-06-18')).map((w) => w.campaignId),
    ['r_far'],
    'kỳ ở sau cũng tính',
  );
  assert.deepEqual(await warn('2030-06-17'), []);
  assert.deepEqual(await warn('2030-09-10', 'r_far'), [], 'sửa kỳ thì bỏ qua chính nó');
  await rejects(checks.scheduleWarnings({ campusId: 'c2', kind: 'MEASUREMENT', startDate: '2030-09-10' }, LAN), 403);
});

test('AC-4: đợt khám thứ hai trong năm học có cảnh báo, vẫn tạo được', async () => {
  const year = (readDb().schoolYears || buildSeedSchoolConfig().schoolYears).find((y) => y.status === 'ACTIVE');
  const first = addDays(year.startDate, 10);
  insertRound({ id: 'r_exam', kind: 'EXAM', campusId: 'c2', startDate: first, endDate: addDays(first, 2) });
  insertRound({
    id: 'r_exam_cancelled',
    kind: 'EXAM',
    campusId: 'c2',
    startDate: addDays(first, 20),
    endDate: addDays(first, 22),
    closedAt: null,
    cancelledAt: new Date().toISOString(),
  });
  const later = addDays(year.startDate, 200);
  const exam = await checks.scheduleWarnings({ campusId: 'c2', kind: 'EXAM', startDate: later }, PRINCIPAL);
  const inYear = exam.warnings.filter((w) => w.code === 'EXAM_IN_SCHOOL_YEAR').map((w) => w.campaignId);
  assert.ok(inYear.includes('r_exam'));
  assert.ok(!inYear.includes('r_exam_cancelled'));
  const round = await checks.scheduleWarnings({ campusId: 'c2', kind: 'MEASUREMENT', startDate: later }, PRINCIPAL);
  assert.equal(round.warnings.filter((w) => w.code === 'EXAM_IN_SCHOOL_YEAR').length, 0, 'chỉ đợt khám mới có cảnh báo này');

  freeCampus('c2');
  const created = await checks.createHealthCheck(roundPayload('c2', 'EXAM'), PRINCIPAL);
  assert.equal(created.kind, 'EXAM', 'cảnh báo không chặn tạo');
});

test('AC-5: mỗi điểm trường một kỳ/đợt chưa đóng, tính chung hai loại', async () => {
  await rejects(checks.createHealthCheck(roundPayload('c1', 'MEASUREMENT'), LAN), 422, 'campusId');
  await rejects(checks.createHealthCheck(roundPayload('c2', 'EXAM'), DUC), 422, 'campusId');
});

test('AC-6: giáo viên nhập số đo trong kỳ; đóng kỳ thì trẻ chưa cân là vắng', async () => {
  const child = tuanChild();
  const round = readDb().healthCheckCampaigns.find((c) => c.id === C2_ROUND);
  const before = await checks.getHealthCheckClass(C2_ROUND, child.classId, TUAN);
  assert.equal(before.canRecord, true);
  assert.ok(before.children.every((r) => r.result === 'NOT_RECORDED'));

  const payload = { campaignId: C2_ROUND, date: todayInput(), heightCm: 105, weightKg: 17.5, note: '' };
  await rejects(children.saveMeasurement(child.id, null, { ...payload, date: addDays(round.startDate, -1) }, TUAN), 422, 'date');
  const saved = await children.saveMeasurement(child.id, null, payload, TUAN);
  assert.equal(saved.campaignId, C2_ROUND);
  assert.equal(saved.campaignKind, 'MEASUREMENT', 'Sổ sức khỏe không mở phiếu khám cho số đo của kỳ');
  assert.equal(saved.source, 'MEASUREMENT_ONLY');
  assert.equal(saved.published, true);
  await rejects(
    children.saveMeasurement(child.id, null, { ...payload, date: round.startDate }, TUAN),
    422,
    'campaignId',
  );

  const after = await checks.getHealthCheckClass(C2_ROUND, child.classId, TUAN);
  const row = after.children.find((r) => r.childId === child.id);
  assert.equal(row.result, 'RECORDED');
  assert.deepEqual([row.heightCm, row.weightKg], [105, 17.5], 'danh sách lớp của kỳ hiện số đo');
  assert.equal(after.campaign.kind, 'MEASUREMENT');

  await checks.closeHealthCheck(C2_ROUND, DUC);
  const closed = await checks.getHealthCheckClass(C2_ROUND, child.classId, TUAN);
  assert.equal(closed.canRecord, false);
  assert.ok(closed.children.filter((r) => r.childId !== child.id).every((r) => r.result === 'ABSENT'));
  await rejects(
    children.saveMeasurement(child.id, saved.id, { ...payload, heightCm: 106, reason: 'Đo lại (giả).' }, TUAN),
    409,
  );
});

test('AC-7: không nhập lẻ ngoài kỳ; kết quả cũ ngoài đợt vẫn sửa được', async () => {
  const child = tuanChild();
  const base = { date: todayInput(), heightCm: 105, weightKg: 17.5, note: '' };
  await rejects(children.saveMeasurement(child.id, null, base, TUAN), 422, 'campaignId');
  await rejects(children.saveMeasurement(child.id, null, { ...base, campaignId: C1_OPEN }, TUAN), 422, 'campaignId');

  const record = await children.getHealthRecord(child.id, TUAN);
  assert.equal(record.openCampaign.id, C2_ROUND);
  assert.equal(record.openCampaign.kind, 'MEASUREMENT');

  const old = readDb().healthMeasurements.find((m) => !m.campaignId && !m.exam && m.childId === child.id);
  if (old) {
    const edited = await children.saveMeasurement(
      child.id,
      old.id,
      { date: old.date, heightCm: old.heightCm, weightKg: old.weightKg + 0.1, note: old.note || '', reason: 'Sửa số (giả).' },
      TUAN,
    );
    assert.equal(edited.campaignId, null);
  }
});

test('AC-8: lần đo của kỳ cân đo không là lần khám trước', async () => {
  const CHILD = 'ch_008';
  const db = readDb();
  const open = db.healthCheckCampaigns.find((c) => c.id === C1_OPEN);
  const child = db.children.find((c) => c.id === CHILD);
  const exam = db.healthMeasurements
    .filter((m) => m.childId === CHILD && m.campaignId && m.date < open.startDate && m.examStatus !== 'DRAFT')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const roundDate = addDays(open.startDate, -1);
  assert.ok(exam.date < roundDate);
  insertRound({ id: 'r_c1_round', kind: 'MEASUREMENT', campusId: 'c1', startDate: roundDate, endDate: roundDate });
  writeDb((d) => {
    d.healthMeasurements.push({
      id: 'hm_round_test',
      childId: CHILD,
      campaignId: 'r_c1_round',
      date: roundDate,
      heightCm: 100,
      weightKg: 16,
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
  const cls = db.classes.find((c) => c.id === child.classId);
  const teacher = { id: cls.teacherIds[0], role: 'TEACHER', campusId: 'c1' };
  const roster = await checks.getHealthCheckClass(C1_OPEN, cls.id, teacher);
  assert.equal(roster.children.find((r) => r.childId === CHILD).previous.date, exam.date);
});

test('AC-9: đợt cũ không có kind hiện là đợt khám', async () => {
  writeDb((d) => {
    delete d.healthCheckCampaigns.find((c) => c.id === C1_OPEN).kind;
  });
  const { campaign } = await checks.getHealthCheck(C1_OPEN, PRINCIPAL);
  assert.equal(campaign.kind, 'EXAM');
  const list = await checks.listHealthChecks({ kind: 'EXAM' }, PRINCIPAL);
  assert.ok(list.some((c) => c.id === C1_OPEN));
});
