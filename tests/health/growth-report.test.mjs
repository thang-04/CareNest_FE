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
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { growthReportMockRepository: repo, GROWTH_COUNT_KEYS } = await import('@/services/children/mock/growthReportMockRepository');
const { heightLmsOf, weightLmsOf } = await import('@/services/children/mock/growthForAgeRule');
const { bmiForZScore, bmiLmsOf } = await import('@/services/children/mock/bmiForAgeRule');
const { ageMonthsOn } = await import('@/services/children/mock/healthScreeningRule');
const { openCampaignDates } = await import('@/mocks/healthCheckSeed');

/*
 * Báo cáo tổng hợp cân đo mẫu 5.1 (BE giả của GET /health-checks/growth-report; plan
 * docs/plans/active/2026-11-04-health-growth-report.md). Tháng 7/2026 không có đợt seed: test tự dựng một kỳ cân đo và một đợt
 * khám đã đóng ở c1 để đếm đúng từng ô. Dữ liệu giả.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const LAN = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const TUAN = { id: 'u_tuan', role: 'TEACHER', campusId: 'c2' };
const JULY = '2026-07';
const ROUND_DATE = '2026-07-08';
const EXAM_DATE = '2026-07-21';
const MIXED_CLASS = 'cls_t_mixed';

const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.prototype.hasOwnProperty.call(err.details || {}, key)));

const counts = (fields = {}) => ({ ...Object.fromEntries(GROWTH_COUNT_KEYS.map((k) => [k, 0])), ...fields });

// Số đo đúng z chiều cao zh và z cân nặng zw (hoặc z BMI bmiZ) theo chuẩn WHO tại ngày đo.
const atZ = (z, [l, m, s]) => m * (1 + l * s * z) ** (1 / l);
const numbersOf = (child, date, { zw = 0, zh = 0, bmiZ = null }) => {
  const age = ageMonthsOn(child.dateOfBirth, date);
  const heightCm = atZ(zh, heightLmsOf(child.gender, age));
  const weightLms = weightLmsOf(child.gender, age);
  const weightKg =
    bmiZ != null
      ? bmiForZScore(bmiZ, bmiLmsOf(child.gender, age)) * (heightCm / 100) ** 2
      : zw < -3
        ? atZ(-3, weightLms) + (zw + 3) * (atZ(-2, weightLms) - atZ(-3, weightLms))
        : atZ(zw, weightLms);
  return { heightCm: Math.round(heightCm * 100) / 100, weightKg: Math.round(weightKg * 100) / 100 };
};

const campaign = (fields) => ({
  kind: 'MEASUREMENT',
  name: 'Kỳ thử (giả)',
  campusId: 'c1',
  examiner: '',
  note: '',
  createdBy: PRINCIPAL.id,
  createdAt: '2026-07-01T02:00:00.000Z',
  closedAt: '2026-07-25T09:00:00.000Z',
  closedBy: PRINCIPAL.id,
  cancelledAt: null,
  absentChildIds: [],
  history: [],
  ...fields,
});

const record = (d, childId, campaignId, date, spec, extra = {}) => {
  const child = d.children.find((c) => c.id === childId);
  d.healthMeasurements.push({
    id: `hm_t_${campaignId}_${childId}`,
    childId,
    date,
    ...numbersOf(child, date, spec),
    headCircumferenceCm: null,
    grossMotor: null,
    fineMotor: null,
    exam: null,
    examStatus: null,
    note: '',
    campaignId,
    measuredBy: 'u_an',
    published: true,
    publishedAt: `${date}T09:00:00.000Z`,
    createdAt: `${date}T08:30:00.000Z`,
    edits: [],
    ...extra,
  });
};

/*
 * Tháng 7/2026 ở c1:
 * - Kỳ cân đo hc_t_round (06–10/7, đã đóng), Lớp Chồi 1: ch_007 bình thường; ch_008 nhẹ cân (W/A −3SD); ch_009 thấp còi, BMI
 *   +2,5SD (thừa cân); ch_010 bình thường; ch_012 vắng. Lớp Nhà trẻ 1: ch_056 bình thường; ch_058 chưa có giới tính (chưa xếp
 *   được); ch_059 thiếu cân nặng. Lớp ghép chưa có nhóm tuổi: ch_057.
 * - Đợt khám hc_t_exam (20–24/7, đã đóng): ch_010 kết luận, BMI +3,5SD (béo phì, lần đo gần nhất); ch_007 phiếu nháp nhẹ cân,
 *   thấp còi (không tính); ch_011 vắng.
 * - Không tính: kỳ đã hủy hc_t_cancel (ch_020), kỳ bắt đầu tháng 6 hc_t_june (ch_019, đo 01/7).
 */
const seedJuly = () =>
  writeDb((d) => {
    d.classes.push({ ...d.classes.find((c) => c.id === 'cls_c1_x01'), id: MIXED_CLASS, name: 'Lớp ghép (giả)', ageGroupId: null });
    d.children.find((c) => c.id === 'ch_057').classId = MIXED_CLASS;
    d.healthCheckCampaigns.push(
      campaign({ id: 'hc_t_round', startDate: '2026-07-06', endDate: '2026-07-10', absentChildIds: ['ch_012'] }),
      campaign({
        id: 'hc_t_exam',
        kind: 'EXAM',
        name: 'Khám thử (giả)',
        startDate: '2026-07-20',
        endDate: '2026-07-24',
        absentChildIds: ['ch_011'],
      }),
      campaign({
        id: 'hc_t_cancel',
        startDate: '2026-07-13',
        endDate: '2026-07-15',
        closedAt: null,
        cancelledAt: '2026-07-12T02:00:00.000Z',
      }),
      campaign({ id: 'hc_t_june', startDate: '2026-06-29', endDate: '2026-07-03', closedAt: '2026-07-04T09:00:00.000Z' }),
    );
    record(d, 'ch_007', 'hc_t_round', ROUND_DATE, {});
    record(d, 'ch_008', 'hc_t_round', ROUND_DATE, { zw: -3 });
    record(d, 'ch_009', 'hc_t_round', ROUND_DATE, { zh: -3, bmiZ: 2.5 });
    record(d, 'ch_010', 'hc_t_round', ROUND_DATE, {});
    record(d, 'ch_056', 'hc_t_round', ROUND_DATE, {});
    record(d, 'ch_058', 'hc_t_round', ROUND_DATE, {});
    record(d, 'ch_059', 'hc_t_round', ROUND_DATE, {}, { weightKg: '' });
    record(d, 'ch_057', 'hc_t_round', ROUND_DATE, {});
    record(d, 'ch_010', 'hc_t_exam', EXAM_DATE, { bmiZ: 3.5 }, { examStatus: 'CONCLUDED', concludedAt: `${EXAM_DATE}T09:30:00.000Z` });
    record(d, 'ch_007', 'hc_t_exam', EXAM_DATE, { zw: -3, zh: -3 }, { examStatus: 'DRAFT', published: false });
    record(d, 'ch_020', 'hc_t_cancel', '2026-07-14', {});
    record(d, 'ch_019', 'hc_t_june', '2026-07-01', {});
    // Số đo dựng bằng giới tính thật; sau đó bỏ giới tính để thành "chưa xếp được".
    d.children.find((c) => c.id === 'ch_058').gender = null;
  });

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('Phạm vi: HT mọi điểm trường; PHT điểm trường của mình; vai trò khác 403; tháng thiếu/sai dạng 400', async () => {
  const all = await repo.getGrowthReport({ month: JULY }, PRINCIPAL);
  assert.deepEqual(
    all.campuses.map((c) => c.campusId),
    ['c1', 'c2'],
  );
  const onlyC2 = await repo.getGrowthReport({ month: JULY, campusId: 'c2' }, PRINCIPAL);
  assert.deepEqual(
    onlyC2.campuses.map((c) => c.campusId),
    ['c2'],
  );
  const lan = await repo.getGrowthReport({ month: JULY }, LAN);
  assert.deepEqual(
    lan.campuses.map((c) => c.campusId),
    ['c1'],
  );
  await rejects(repo.getGrowthReport({ month: JULY, campusId: 'c2' }, LAN), 403);
  await rejects(repo.getGrowthReport({ month: JULY }, TUAN), 403);
  await rejects(repo.getGrowthReport({ month: JULY, campusId: 'c9' }, PRINCIPAL), 404);
  await rejects(repo.getGrowthReport({ month: '2026-7' }, PRINCIPAL), 400, 'month');
  await rejects(repo.getGrowthReport({ month: '2026-13' }, PRINCIPAL), 400, 'month');
  await rejects(repo.getGrowthReport({}, PRINCIPAL), 400, 'month');
});

test('Điểm trường không có kỳ/đợt trong tháng vẫn trả về, mảng rỗng, số 0', async () => {
  const report = await repo.getGrowthReport({ month: '2026-08' }, PRINCIPAL);
  assert.equal(report.month, '2026-08');
  for (const campus of report.campuses) {
    assert.deepEqual([campus.campaigns, campus.classes], [[], []]);
    assert.deepEqual([campus.preschool, campus.nursery, campus.total], [counts(), counts(), counts()]);
  }
  assert.deepEqual([report.preschool, report.nursery, report.total], [counts(), counts(), counts()]);
  assert.equal(report.campuses[0].campusName, readDb().campuses.find((c) => c.id === 'c1').name);
});

test('Đếm từng lớp: gộp theo trẻ, lần đo gần nhất; nháp, vắng, thiếu số đo không tính được cân đo; chưa xếp được', async () => {
  seedJuly();
  const report = await repo.getGrowthReport({ month: JULY }, PRINCIPAL);
  const c1 = report.campuses.find((c) => c.campusId === 'c1');
  assert.deepEqual(
    c1.campaigns.map((c) => [c.id, c.kind, c.status, c.startDate, c.endDate]),
    [
      ['hc_t_round', 'MEASUREMENT', 'CLOSED', '2026-07-06', '2026-07-10'],
      ['hc_t_exam', 'EXAM', 'CLOSED', '2026-07-20', '2026-07-24'],
    ],
    'kỳ đã hủy và kỳ bắt đầu tháng 6 không tính',
  );
  // Như BE: mọi lớp của điểm trường có dòng (lớp không có trẻ trong danh sách ⇒ số 0); lớp chưa có nhóm tuổi xếp cuối.
  const db = readDb();
  assert.equal(c1.classes.length, db.classes.filter((c) => c.campusId === 'c1').length);
  const rowOf = (classId) => c1.classes.find((r) => r.classId === classId);
  assert.deepEqual(
    [rowOf('cls_c1_c1'), rowOf('cls_c1_x01'), c1.classes.at(-1)].map((r) => [r.classId, r.className, r.level, r.ageGroupName]),
    [
      ['cls_c1_c1', 'Lớp Chồi 1', 'PRESCHOOL', 'Mẫu giáo nhỡ (4–5 tuổi)'],
      ['cls_c1_x01', 'Lớp Nhà trẻ 1', 'NURSERY', 'Nhà trẻ (24–36 tháng)'],
      [MIXED_CLASS, 'Lớp ghép (giả)', null, null],
    ],
  );
  assert.deepEqual(rowOf('cls_c1_l1').counts, counts(), 'Lớp Lá 1: kỳ đã hủy, kỳ bắt đầu tháng 6 không tính');
  const [choi, nhaTre, mixed] = ['cls_c1_c1', 'cls_c1_x01', MIXED_CLASS].map((id) => rowOf(id).counts);
  // ch_010: kỳ cân đo bình thường, đợt khám sau béo phì ⇒ tính 1 lần theo đợt khám. ch_007: phiếu nháp không thay số đo của kỳ.
  assert.deepEqual(
    choi,
    counts({
      enrolled: 6,
      measured: 4,
      weightNormal: 3,
      underweight: 1,
      heightNormal: 3,
      stunted: 1,
      bmiNormal: 1,
      wasted: 1,
      overweight: 1,
      obese: 1,
    }),
  );
  assert.deepEqual(
    nhaTre,
    counts({ enrolled: 3, measured: 2, weightNormal: 1, heightNormal: 1, bmiNormal: 1, unclassified: 1 }),
    'ch_059 thiếu cân nặng: chưa được cân đo; ch_058 chưa có giới tính: chưa xếp được, không vào nhóm nào',
  );
  assert.deepEqual(mixed, counts({ enrolled: 1, measured: 1, weightNormal: 1, heightNormal: 1, bmiNormal: 1 }));
});

test('Cộng dồn: Tổng MG, Tổng NT, tổng điểm trường (gồm lớp chưa có nhóm tuổi), toàn trường', async () => {
  seedJuly();
  const report = await repo.getGrowthReport({ month: JULY }, PRINCIPAL);
  const c1 = report.campuses.find((c) => c.campusId === 'c1');
  const c2 = report.campuses.find((c) => c.campusId === 'c2');
  // Lớp khác của c1 đều 0 nên Tổng MG = Lớp Chồi 1, Tổng NT = Lớp Nhà trẻ 1.
  const countsOf = (classId) => c1.classes.find((r) => r.classId === classId).counts;
  assert.deepEqual(c1.preschool, countsOf('cls_c1_c1'));
  assert.deepEqual(c1.nursery, countsOf('cls_c1_x01'));
  assert.deepEqual(
    c1.total,
    counts({
      enrolled: 10,
      measured: 7,
      weightNormal: 5,
      underweight: 1,
      heightNormal: 5,
      stunted: 1,
      bmiNormal: 3,
      wasted: 1,
      overweight: 1,
      obese: 1,
      unclassified: 1,
    }),
  );
  assert.deepEqual([c2.campaigns, c2.classes, c2.total], [[], [], counts()]);
  assert.deepEqual([report.preschool, report.nursery, report.total], [c1.preschool, c1.nursery, c1.total]);
  // Mỗi trẻ được cân đo vào đúng 1 nhóm của mỗi chỉ số, hoặc chưa xếp được.
  const t = report.total;
  assert.equal(t.weightNormal + t.underweight + t.unclassified, t.measured);
  assert.equal(t.heightNormal + t.stunted + t.unclassified, t.measured);
  assert.equal(t.bmiNormal + t.wasted + t.overweight + t.obese + t.unclassified, t.measured);
});

test('Lọc theo tháng bắt đầu: kỳ bắt đầu tháng 6 thuộc báo cáo tháng 6', async () => {
  seedJuly();
  const june = await repo.getGrowthReport({ month: '2026-06', campusId: 'c1' }, PRINCIPAL);
  assert.deepEqual(
    june.campuses[0].campaigns.map((c) => c.id),
    ['hc_c1_2606', 'hc_t_june'],
  );
  const la1 = june.campuses[0].classes.find((r) => r.classId === 'cls_c1_l1');
  assert.ok(la1.counts.enrolled >= 1 && la1.counts.measured >= 1);
});

test('Thứ tự dòng: mẫu giáo nhóm tuổi lớn trước rồi tên lớp; rồi nhà trẻ', async () => {
  const report = await repo.getGrowthReport({ month: '2026-09', campusId: 'c1' }, PRINCIPAL);
  assert.deepEqual(
    report.campuses[0].classes.map((r) => r.className),
    [
      'Lớp Lá 1',
      'Lớp Lá 2',
      'Lớp Lá 3',
      'Lớp Chồi 1',
      'Lớp Chồi 2',
      'Lớp Chồi 3',
      'Lớp Mầm 1',
      'Lớp Mầm 2',
      'Lớp Mầm 3',
      'Lớp Nhà trẻ 1',
      'Lớp Nhà trẻ 2',
      'Lớp Nhà trẻ 3',
    ],
  );
  const campus = report.campuses[0];
  const sum = (level) => campus.classes.filter((r) => r.level === level).reduce((acc, r) => acc + r.counts.enrolled, 0);
  assert.equal(campus.preschool.enrolled, sum('PRESCHOOL'));
  assert.equal(campus.nursery.enrolled, sum('NURSERY'));
  assert.equal(campus.total.enrolled, campus.preschool.enrolled + campus.nursery.enrolled);
});

test('Đợt đang diễn ra (seed tháng này): trẻ đang học đều trong danh sách; chỉ phiếu đã kết luận/số đo được tính', async () => {
  const month = openCampaignDates().startDate.slice(0, 7);
  const report = await repo.getGrowthReport({ month, campusId: 'c1' }, PRINCIPAL);
  const campus = report.campuses[0];
  const open = campus.campaigns.find((c) => c.id === 'hc_c1_open');
  assert.equal(open.status, 'IN_PROGRESS');
  const db = readDb();
  const activeIds = new Set(db.children.filter((c) => c.campusId === 'c1' && c.status === 'ACTIVE').map((c) => c.id));
  assert.equal(campus.total.enrolled, activeIds.size);
  const counted = db.healthMeasurements.filter(
    (m) => m.campaignId === 'hc_c1_open' && m.examStatus !== 'DRAFT' && Number(m.heightCm) > 0 && Number(m.weightKg) > 0,
  );
  assert.ok(
    db.healthMeasurements.some((m) => m.campaignId === 'hc_c1_open' && m.examStatus === 'DRAFT'),
    'seed có phiếu nháp',
  );
  assert.equal(campus.total.measured, counted.length);
});
