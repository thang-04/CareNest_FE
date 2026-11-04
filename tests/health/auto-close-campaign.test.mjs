import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

process.env.TZ = 'Asia/Ho_Chi_Minh';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');

/*
 * HLT-17: đợt khám và kỳ cân đo (kỳ cân đo từ 2026-11-04, user quyết định) tự đóng khi qua ngày kết thúc theo giờ Việt Nam; ngày
 * kết thúc vẫn nhập được; mở lại đợt/kỳ đã hết hạn phải có ngày kết thúc mới từ hôm nay. Dữ liệu giả của seed.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const EXAM = 'hc_c1_open';
const ROUND = 'hc_c2_next';
const campaign = () => readDb().healthCheckCampaigns.find((item) => item.id === EXAM);
const round = () => readDb().healthCheckCampaigns.find((item) => item.id === ROUND);
const nextDay = (context) => context.mock.timers.setTime(new Date('2026-11-02T00:01:00+07:00').getTime());

beforeEach((context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T23:59:00+07:00').getTime() });
  resetDb();
  ensureChildRecordsSeeded();
  writeDb((db) => {
    for (const id of [EXAM, ROUND]) {
      Object.assign(
        db.healthCheckCampaigns.find((item) => item.id === id),
        { startDate: '2026-10-25', endDate: '2026-11-01' },
      );
    }
  });
});

test('đợt khám vẫn mở hết ngày kết thúc, qua nửa đêm Việt Nam tự đóng', async (context) => {
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'IN_PROGRESS');
  assert.equal(campaign().closedAt, null);

  nextDay(context);
  assert.equal(new Date().toISOString().slice(0, 10), '2026-11-01', 'UTC vẫn là ngày trước');
  const view = await checks.getHealthCheck(EXAM, PRINCIPAL);
  assert.equal(view.campaign.status, 'CLOSED');
  assert.ok(campaign().closedAt);
  assert.equal(campaign().closedBy, null);
  assert.equal(view.campaign.closedByName, 'Hệ thống');
  assert.equal(view.campaign.history.at(-1).action, 'CLOSED');
  assert.equal(view.campaign.history.at(-1).userName, 'Hệ thống');
  assert.equal(view.campaign.history.at(-1).reason, 'Hệ thống tự đóng khi qua ngày kết thúc khám', 'lý do như BE');
  assert.equal(
    view.classes.every((cls) => !cls.canRecord),
    true,
  );
});

test('tự đóng chốt vắng khám, giữ nháp chưa kết luận, khóa ghi phiếu', async (context) => {
  let draftId;
  let childId;
  let teacher;
  let absentIds;
  writeDb((db) => {
    const draft = db.healthMeasurements.find((measurement) => measurement.campaignId === EXAM && measurement.examStatus === 'CONCLUDED');
    assert.ok(draft, 'có phiếu mẫu để chuyển thành nháp');
    Object.assign(draft, { examStatus: 'DRAFT', published: false });
    draftId = draft.id;
    childId = draft.childId;
    const child = db.children.find((item) => item.id === childId);
    const cls = db.classes.find((item) => item.id === child.classId);
    teacher = { id: cls.teacherIds[0], role: 'TEACHER', campusId: 'c1' };
    const classIds = new Set(db.classes.filter((item) => item.campusId === 'c1').map((item) => item.id));
    const measuredIds = new Set(db.healthMeasurements.filter((item) => item.campaignId === EXAM).map((item) => item.childId));
    absentIds = db.children
      .filter((item) => classIds.has(item.classId) && item.status === 'ACTIVE' && !measuredIds.has(item.id))
      .map((item) => item.id);
  });
  nextDay(context);
  const view = await checks.getHealthCheck(EXAM, PRINCIPAL);
  assert.deepEqual(campaign().absentChildIds, absentIds);
  assert.ok(absentIds.length > 0);
  assert.equal(view.campaign.progress.absent, absentIds.length);
  assert.ok(view.campaign.progress.notConcluded > 0);
  assert.equal(view.campaign.progress.inProgress, 0);
  assert.equal(view.campaign.progress.notRecorded, 0);
  const savedDraft = readDb().healthMeasurements.find((item) => item.id === draftId);
  assert.equal(savedDraft.examStatus, 'DRAFT');
  assert.equal(savedDraft.published, false);
  assert.equal(readDb().healthFollowUps, undefined, 'không còn phiếu theo dõi (HLT-16 bỏ)');
  await assert.rejects(exams.saveHealthExam(EXAM, childId, {}, teacher), (error) => error.status === 409);
});

test('đọc lại không lặp lịch sử đóng, đợt hết hạn không cản tạo đợt mới', async (context) => {
  nextDay(context);
  await checks.getHealthCheck(EXAM, PRINCIPAL);
  const closedAt = campaign().closedAt;
  const snapshot = [...campaign().absentChildIds];
  await checks.listHealthChecks({}, PRINCIPAL);
  await checks.getHealthCheck(EXAM, PRINCIPAL);
  assert.equal(campaign().history.filter((event) => event.action === 'CLOSED').length, 1);
  assert.equal(campaign().closedAt, closedAt);
  assert.deepEqual(campaign().absentChildIds, snapshot);
  const created = await checks.createHealthCheck(
    { kind: 'EXAM', name: 'Đợt sau (giả)', campusId: 'c1', startDate: '2026-11-02', endDate: '2026-11-03' },
    PRINCIPAL,
  );
  assert.equal(created.status, 'IN_PROGRESS');
});

test('không tự đóng đợt đã hủy hoặc đã đóng; kỳ cân đo hết hạn cũng tự đóng', async (context) => {
  writeDb((db) => {
    db.healthCheckCampaigns.find((item) => item.id === EXAM).cancelledAt = new Date().toISOString();
  });
  const closed = readDb().healthCheckCampaigns.find((item) => item.closedAt);
  const previousHistory = structuredClone(closed.history);
  nextDay(context);
  const views = await checks.listHealthChecks({}, PRINCIPAL);
  assert.equal(views.find((item) => item.id === EXAM).status, 'CANCELLED');
  assert.equal(views.find((item) => item.id === ROUND).status, 'CLOSED');
  assert.equal(campaign().closedAt, null);
  assert.deepEqual(readDb().healthCheckCampaigns.find((item) => item.id === closed.id).history, previousHistory);
});

test('kỳ cân đo: ngày kết thúc vẫn nhập số đo; qua nửa đêm tự đóng, trẻ chưa cân đo thành vắng, khóa nhập', async (context) => {
  const before = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  const [first, second] = before.children.filter((r) => r.result === 'NOT_RECORDED');
  assert.ok(first && second, 'lớp Mầm 1 còn trẻ chưa cân đo');
  const saved = await children.saveMeasurement(first.childId, null, { campaignId: ROUND, heightCm: 99, weightKg: 15.5, note: '' }, TUAN);
  assert.equal(saved.date, '2026-11-01', 'ngày kết thúc vẫn nhập được, ngày đo = hôm nay');

  nextDay(context);
  const view = await checks.getHealthCheck(ROUND, PRINCIPAL);
  assert.equal(view.campaign.status, 'CLOSED');
  assert.equal(round().closedBy, null);
  assert.equal(view.campaign.closedByName, 'Hệ thống');
  const closing = view.campaign.history.at(-1);
  assert.deepEqual(
    [closing.action, closing.userName, closing.reason],
    ['CLOSED', 'Hệ thống', 'Hệ thống tự đóng khi qua ngày kết thúc cân đo'],
  );
  assert.ok(view.classes.every((cls) => !cls.canRecord));

  // Như đóng tay: trẻ đang học của điểm trường chưa có số đo thành vắng; trẻ vừa cân đo giữ kết quả.
  const db = readDb();
  const classIds = new Set(db.classes.filter((cls) => cls.campusId === 'c2').map((cls) => cls.id));
  const measured = new Set(db.healthMeasurements.filter((m) => m.campaignId === ROUND).map((m) => m.childId));
  const expectedAbsent = db.children
    .filter((ch) => classIds.has(ch.classId) && ch.status === 'ACTIVE' && !measured.has(ch.id))
    .map((ch) => ch.id);
  assert.deepEqual(round().absentChildIds, expectedAbsent);
  assert.equal(view.campaign.progress.absent, expectedAbsent.length);
  assert.equal(view.campaign.progress.notRecorded, 0);
  const after = await checks.getHealthCheckClass(ROUND, 'cls_c2_m1', TUAN);
  assert.equal(after.canRecord, false);
  assert.equal(after.children.find((r) => r.childId === first.childId).result, 'RECORDED');
  assert.equal(after.children.find((r) => r.childId === second.childId).result, 'ABSENT');
  await assert.rejects(
    children.saveMeasurement(second.childId, null, { campaignId: ROUND, heightCm: 99, weightKg: 15.5, note: '' }, TUAN),
    (error) => error.status === 409,
  );
  await assert.rejects(
    children.saveMeasurement(first.childId, saved.id, { heightCm: 99.5, weightKg: 15.5, note: '', reason: 'Đo lại (giả)' }, TUAN),
    (error) => error.status === 409,
  );
});

test('kỳ cân đo hết hạn mở lại phải có ngày kết thúc mới từ hôm nay, rồi lại tự đóng khi qua hạn mới', async (context) => {
  nextDay(context);
  await checks.getHealthCheck(ROUND, PRINCIPAL);
  assert.ok(round().closedAt);
  for (const endDate of [undefined, '2026-11-01', '2026-11-31']) {
    await assert.rejects(
      checks.reopenHealthCheck(ROUND, { reason: 'Cân đo bù (giả)', endDate }, PRINCIPAL),
      (error) => error.status === 422 && !!error.details?.endDate,
    );
    assert.ok(round().closedAt, 'chưa mở lại');
  }
  const reopened = await checks.reopenHealthCheck(ROUND, { reason: 'Cân đo bù (giả)', endDate: '2026-11-02' }, PRINCIPAL);
  assert.deepEqual([reopened.status, reopened.endDate], ['IN_PROGRESS', '2026-11-02']);
  assert.deepEqual(round().absentChildIds, [], 'trẻ vắng trở lại chưa cân đo');
  context.mock.timers.setTime(new Date('2026-11-02T23:59:00+07:00').getTime());
  assert.equal((await checks.getHealthCheck(ROUND, PRINCIPAL)).campaign.status, 'IN_PROGRESS');
  context.mock.timers.setTime(new Date('2026-11-03T00:01:00+07:00').getTime());
  assert.equal((await checks.getHealthCheck(ROUND, PRINCIPAL)).campaign.status, 'CLOSED');
  assert.equal(round().history.filter((event) => event.action === 'CLOSED').length, 2);
});

test('kỳ cân đo vẫn đóng sớm được; mở lại trước khi hết hạn không cần ngày kết thúc mới', async (context) => {
  const closed = await checks.closeHealthCheck(ROUND, PRINCIPAL);
  assert.equal(closed.campaign.status, 'CLOSED');
  assert.equal(round().closedBy, PRINCIPAL.id);
  assert.equal(round().history.at(-1).reason, undefined, 'đóng tay không có lý do của hệ thống');
  const reopened = await checks.reopenHealthCheck(ROUND, { reason: 'Còn trẻ chưa cân (giả)' }, PRINCIPAL);
  assert.deepEqual([reopened.status, reopened.endDate], ['IN_PROGRESS', '2026-11-01']);
  nextDay(context);
  assert.equal((await checks.getHealthCheck(ROUND, PRINCIPAL)).campaign.status, 'CLOSED');
  assert.equal(round().closedBy, null);
});

test('đợt tự đóng mở lại với hạn mới để nhập bù rồi tự đóng lại khi qua hạn mới', async (context) => {
  nextDay(context);
  await checks.getHealthCheck(EXAM, PRINCIPAL);
  const reopened = await checks.reopenHealthCheck(EXAM, { reason: 'Nhập bù kết quả (giả)', endDate: '2026-11-02' }, PRINCIPAL);
  assert.equal(reopened.status, 'IN_PROGRESS');
  assert.equal(reopened.endDate, '2026-11-02');
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'IN_PROGRESS');
  assert.equal(campaign().closedAt, null);
  context.mock.timers.setTime(new Date('2026-11-03T00:01:00+07:00').getTime());
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'CLOSED');
  assert.equal(campaign().closedBy, null);
  assert.equal(campaign().history.filter((event) => event.action === 'CLOSED').length, 2);
});

test('mở lại đợt hết hạn bắt ngày kết thúc mới hợp lệ từ hôm nay', async (context) => {
  nextDay(context);
  await checks.getHealthCheck(EXAM, PRINCIPAL);
  for (const endDate of [undefined, '2026-11-01', '2026-11-31', '03/11/202']) {
    await assert.rejects(
      checks.reopenHealthCheck(EXAM, { reason: 'Nhập bù (giả)', endDate }, PRINCIPAL),
      (error) => error.status === 422 && !!error.details?.endDate,
    );
    assert.ok(campaign().closedAt);
  }
  const reopened = await checks.reopenHealthCheck(EXAM, { reason: 'Nhập bù (giả)', endDate: '2026-11-04' }, PRINCIPAL);
  assert.equal(reopened.endDate, '2026-11-04');
  assert.equal(reopened.status, 'IN_PROGRESS');
  context.mock.timers.setTime(new Date('2026-11-04T23:59:00+07:00').getTime());
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'IN_PROGRESS');
  context.mock.timers.setTime(new Date('2026-11-05T00:01:00+07:00').getTime());
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'CLOSED');
});

test('đóng sớm rồi mở lại trong ngày kết thúc vẫn tự đóng khi qua hạn', async (context) => {
  await checks.closeHealthCheck(EXAM, PRINCIPAL);
  await checks.reopenHealthCheck(EXAM, { reason: 'Tiếp tục khám (giả)' }, PRINCIPAL);
  nextDay(context);
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'CLOSED');
  assert.equal(campaign().closedBy, null);
});

test('đợt cũ chưa có kind vẫn tự đóng khi hết hạn', async (context) => {
  writeDb((db) => {
    delete db.healthCheckCampaigns.find((item) => item.id === EXAM).kind;
  });
  nextDay(context);
  assert.equal((await checks.getHealthCheck(EXAM, PRINCIPAL)).campaign.status, 'CLOSED');
});
