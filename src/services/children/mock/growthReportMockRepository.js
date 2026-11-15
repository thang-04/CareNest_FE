import { delay, ApiError } from '@/mocks/mockDatabase';
import { AGE_GROUPS } from '@/models/School';
import { CHILD_RESULT_STATUS } from '@/models/children/healthCheckConstants';
import { isPrincipal, isVicePrincipal } from '@/utils/children/childrenPermissions';
import { ensureChildRecordsSeeded } from './childrenMockRepository';
import { rosterOf } from './healthCheckMockRepository';
import { campaignKindOf, campaignStatusOf } from './healthCheckRule';
import { ageMonthsOn } from './healthScreeningRule';
import { classifyGrowth } from './growthForAgeRule';

/*
 * Backend giả của GET /health-checks/growth-report?month=yyyy-MM[&campusId=] — tổng hợp cân đo theo mẫu 5.1 của trường (contract
 * coordinator 2026-11-04; W/A, H/A, BMI chuẩn WHO: growthForAgeRule). BE sở hữu rule thật; lệch thì BE thắng.
 * Phạm vi: Hiệu trưởng mọi điểm trường; Phó hiệu trưởng điểm trường của mình; vai trò khác 403.
 * Khác BE (chỉ ở demo): danh sách trẻ theo lớp hiện tại của trẻ (mock không lưu lớp lúc đo) nên không lọc lớp theo năm học; kết quả
 * mẫu cũ (BE không có) có chiều cao, cân nặng tính là được cân đo.
 */

export const GROWTH_COUNT_KEYS = [
  'enrolled',
  'measured',
  'weightNormal',
  'underweight',
  'heightNormal',
  'stunted',
  'bmiNormal',
  'wasted',
  'overweight',
  'obese',
  'unclassified',
];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const BMI_KEY = { NORMAL: 'bmiNormal', WASTED: 'wasted', OVERWEIGHT: 'overweight', OBESE: 'obese' };
// Cấp lớp theo nhóm tuổi: nhà trẻ ⇒ NURSERY, mẫu giáo ⇒ PRESCHOOL, không có nhóm tuổi ⇒ null (chỉ vào tổng điểm trường, toàn trường).
const LEVEL_OF = { NURSERY: 'NURSERY', KINDERGARTEN: 'PRESCHOOL' };

const emptyCounts = () => Object.fromEntries(GROWTH_COUNT_KEYS.map((k) => [k, 0]));
const sumCounts = (list) =>
  list.reduce((acc, c) => {
    GROWTH_COUNT_KEYS.forEach((k) => (acc[k] += c[k]));
    return acc;
  }, emptyCounts());

const forbid = () => {
  throw new ApiError(403, 'Bạn không có quyền xem báo cáo tổng hợp cân đo.');
};

const positive = (v) => v !== '' && v != null && Number(v) > 0;
const isLater = (a, b) => a.date > b.date || (a.date === b.date && (a.createdAt || '') > (b.createdAt || ''));

/** Lần đo được tính "được cân đo": số đo của kỳ cân đo, phiếu khám đã kết luận (cả kết quả mẫu cũ ở demo) có chiều cao, cân nặng. */
const countedRecordOf = (db, row) => {
  if (row.result !== CHILD_RESULT_STATUS.RECORDED || !row.measurementId) return null;
  const m = db.healthMeasurements.find((x) => x.id === row.measurementId);
  return m && positive(m.heightCm) && positive(m.weightKg) ? m : null;
};

const ageGroupsOf = (db) => (db.ageGroups?.length ? db.ageGroups : AGE_GROUPS);

/** Thứ tự dòng: mẫu giáo theo nhóm tuổi lớn trước rồi tên lớp; rồi nhà trẻ; rồi lớp chưa có nhóm tuổi. */
const LEVEL_RANK = { PRESCHOOL: 0, NURSERY: 1 };
const byReportOrder = (a, b) =>
  (LEVEL_RANK[a.level] ?? 2) - (LEVEL_RANK[b.level] ?? 2) || b.sortOrder - a.sortOrder || a.className.localeCompare(b.className, 'vi');

/** Một điểm trường của tháng: đợt/kỳ chưa hủy bắt đầu trong tháng; trẻ gộp theo trẻ, lấy lần đo được tính gần nhất. */
const campusReportOf = (db, campus, month) => {
  const campaigns = (db.healthCheckCampaigns || [])
    .filter((c) => c.campusId === campus.id && !c.cancelledAt && String(c.startDate).slice(0, 7) === month)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  const classes = db.classes.filter((cls) => cls.campusId === campus.id);
  const byChild = new Map();
  campaigns.forEach((campaign) =>
    classes.forEach((cls) =>
      rosterOf(db, campaign, cls).forEach((row) => {
        const entry = byChild.get(row.childId) || { classId: cls.id, record: null };
        const record = countedRecordOf(db, row);
        if (record && (!entry.record || isLater(record, entry.record))) Object.assign(entry, { record, classId: cls.id });
        else if (!entry.record) entry.classId = cls.id;
        byChild.set(row.childId, entry);
      }),
    ),
  );

  // Như BE (HealthCheckRules.classesOf): mọi lớp của điểm trường có dòng khi tháng có đợt/kỳ, kể cả lớp không có trẻ (số 0).
  const countsByClass = new Map(campaigns.length ? classes.map((cls) => [cls.id, emptyCounts()]) : []);
  byChild.forEach((entry, childId) => {
    const counts = countsByClass.get(entry.classId) || emptyCounts();
    counts.enrolled += 1;
    if (entry.record) {
      counts.measured += 1;
      const child = db.children.find((c) => c.id === childId);
      const ageMonths = child?.dateOfBirth ? ageMonthsOn(child.dateOfBirth, entry.record.date) : null;
      const growth = classifyGrowth({
        gender: child?.gender,
        ageMonths,
        heightCm: entry.record.heightCm,
        weightKg: entry.record.weightKg,
      });
      if (!growth) counts.unclassified += 1;
      else {
        counts[growth.weight === 'UNDERWEIGHT' ? 'underweight' : 'weightNormal'] += 1;
        counts[growth.height === 'STUNTED' ? 'stunted' : 'heightNormal'] += 1;
        counts[BMI_KEY[growth.bmi]] += 1;
      }
    }
    countsByClass.set(entry.classId, counts);
  });

  const groups = ageGroupsOf(db);
  const rows = [...countsByClass.entries()]
    .map(([classId, counts]) => {
      const cls = db.classes.find((c) => c.id === classId);
      const index = groups.findIndex((g) => g.id === cls?.ageGroupId);
      const group = index >= 0 ? groups[index] : null;
      return {
        classId,
        className: cls?.name || '',
        ageGroupName: group?.name || null,
        level: LEVEL_OF[group?.level] || null,
        sortOrder: index,
        counts,
      };
    })
    .sort(byReportOrder)
    .map(({ sortOrder: _sortOrder, ...row }) => row);

  return {
    campusId: campus.id,
    campusName: campus.name,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      kind: campaignKindOf(c),
      status: campaignStatusOf(c),
      startDate: c.startDate,
      endDate: c.endDate,
    })),
    classes: rows,
    preschool: sumCounts(rows.filter((r) => r.level === 'PRESCHOOL').map((r) => r.counts)),
    nursery: sumCounts(rows.filter((r) => r.level === 'NURSERY').map((r) => r.counts)),
    total: sumCounts(rows.map((r) => r.counts)),
  };
};

export const growthReportMockRepository = {
  /** params: { month: 'yyyy-MM', campusId? }. */
  async getGrowthReport({ month, campusId } = {}, user) {
    await delay(200);
    const db = ensureChildRecordsSeeded();
    if (!isPrincipal(user) && !isVicePrincipal(user)) forbid();
    // BE: tham số month kiểu YearMonth bắt buộc; thiếu hoặc sai dạng ⇒ 400 (REQUIRED_FIELD_MISSING / sai kiểu tham số)
    if (!MONTH_RE.test(month || '')) throw new ApiError(400, 'Thiếu thông tin bắt buộc: tháng', { month: 'Chọn tháng theo dạng yyyy-MM' });
    const active = (db.campuses || []).filter((c) => c.status !== 'INACTIVE');
    const inScope = isPrincipal(user) ? active : active.filter((c) => c.id === user.campusId);
    let campuses = inScope;
    if (campusId) {
      if (!inScope.some((c) => c.id === campusId)) {
        if (isVicePrincipal(user)) forbid();
        throw new ApiError(404, 'Không tìm thấy điểm trường.');
      }
      campuses = inScope.filter((c) => c.id === campusId);
    }
    const reports = campuses.map((campus) => campusReportOf(db, campus, month));
    return {
      month,
      campuses: reports,
      preschool: sumCounts(reports.map((r) => r.preschool)),
      nursery: sumCounts(reports.map((r) => r.nursery)),
      total: sumCounts(reports.map((r) => r.total)),
    };
  },
};
