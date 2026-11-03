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
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');

/*
 * "Lần khám trước" chỉ lấy lần khám trong đợt (có bác sĩ), bỏ cân đo ngoài đợt của giáo viên (user chốt 2026-10-22).
 * Dữ liệu giả của seed: ch_008 có lần cân đo tại lớp ngày 10/10/2026, ngoài đợt.
 */
const C1_OPEN = 'hc_c1_open';
const CHILD = 'ch_008';

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

const teacherOf = (childId) => {
  const child = readDb().children.find((c) => c.id === childId);
  const cls = readDb().classes.find((c) => c.id === child.classId);
  return { user: { id: cls.teacherIds[0], role: 'TEACHER', campusId: child.campusId }, classId: cls.id };
};

/** Lần khám trong đợt gần nhất trước ngày (không nháp), tính thẳng từ DB để so. */
const latestCampaignExam = (childId, before) =>
  readDb()
    .healthMeasurements.filter((m) => m.childId === childId && m.campaignId && m.date < before && m.examStatus !== 'DRAFT')
    .sort((a, b) => b.date.localeCompare(a.date))[0];

test('Danh sách lớp và phiếu khám: lần khám trước bỏ cân đo ngoài đợt', async () => {
  const outside = readDb().healthMeasurements.find((m) => m.childId === CHILD && !m.campaignId && m.date === '2026-10-10');
  assert.ok(outside, 'seed có cân đo ngoài đợt');
  const { user, classId } = teacherOf(CHILD);
  const campaign = readDb().healthCheckCampaigns.find((c) => c.id === C1_OPEN);
  const expected = latestCampaignExam(CHILD, campaign.startDate);
  assert.ok(expected && expected.date < outside.date, 'lần khám trong đợt cũ hơn lần cân đo ngoài đợt');

  const roster = await checks.getHealthCheckClass(C1_OPEN, classId, user);
  const row = roster.children.find((r) => r.childId === CHILD);
  assert.equal(row.previous.date, expected.date);
  assert.ok(row.previous.campaignName, 'lần khám trước thuộc một đợt');

  const view = await exams.getHealthExam(C1_OPEN, CHILD, user);
  assert.equal(view.previous.date, expected.date);
});

test('Chỉ có cân đo ngoài đợt thì không có lần khám trước', async () => {
  const { user, classId } = teacherOf(CHILD);
  writeDb((d) => {
    d.healthMeasurements = d.healthMeasurements.filter((m) => m.childId !== CHILD || !m.campaignId);
  });
  const roster = await checks.getHealthCheckClass(C1_OPEN, classId, user);
  assert.equal(roster.children.find((r) => r.childId === CHILD).previous, null);
});
