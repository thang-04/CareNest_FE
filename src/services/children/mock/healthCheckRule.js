import { schoolYearIdOfDate } from '@/mocks/schoolYearScope';
import { CHILD_STATUS } from '@/models/School';
import { CAMPAIGN_KIND, CAMPAIGN_STATUS, SCHEDULE_MIN_GAP, SCHEDULE_WARNING } from '@/models/children/healthCheckConstants';
import { todayInput } from '@/utils/format';

/*
 * Backend giả: trạng thái đợt khám (user chốt 2026-10-15, PROPOSED — BE sở hữu rule thật).
 * Nhập/sửa kết quả chỉ khi đợt đang diễn ra; đợt đã đóng khóa kết quả tới khi Hiệu trưởng mở lại.
 */
export const campaignStatusOf = (c, today = todayInput()) => {
  if (c.cancelledAt) return CAMPAIGN_STATUS.CANCELLED;
  if (c.closedAt) return CAMPAIGN_STATUS.CLOSED;
  return today < c.startDate ? CAMPAIGN_STATUS.UPCOMING : CAMPAIGN_STATUS.IN_PROGRESS;
};

export const isOpenForEntry = (c) => !!c && campaignStatusOf(c) === CAMPAIGN_STATUS.IN_PROGRESS;

/** Đợt chưa đóng (sắp diễn ra hoặc đang diễn ra) của điểm trường: tối đa 1, tính chung đợt khám và kỳ cân đo (M3). */
export const unclosedCampaignOf = (db, campusId, excludeId) =>
  (db.healthCheckCampaigns || []).find((c) => c.campusId === campusId && c.id !== excludeId && !c.closedAt && !c.cancelledAt) || null;

/** Đợt lưu trước khi có kỳ cân đo không có kind: là đợt khám. */
export const campaignKindOf = (c) => c?.kind || CAMPAIGN_KIND.EXAM;
export const isExamCampaign = (c) => campaignKindOf(c) === CAMPAIGN_KIND.EXAM;

// BE:docs/modules/health.md — tự đóng đợt khám quá hạn, kể cả đợt đã mở lại để nhập bù.
export const expiredExamCampaignsOf = (db, today = todayInput()) =>
  (db.healthCheckCampaigns || []).filter(
    (campaign) => isExamCampaign(campaign) && !campaign.closedAt && !campaign.cancelledAt && campaign.endDate < today,
  );

// Đóng tay và tự đóng cùng chốt trẻ chưa có kết quả; phiếu nháp giữ nguyên.
export const closeCampaign = (db, campaign, userId, at = new Date().toISOString()) => {
  const classIds = new Set(db.classes.filter((cls) => cls.campusId === campaign.campusId).map((cls) => cls.id));
  const recorded = new Set(db.healthMeasurements.filter((m) => m.campaignId === campaign.id).map((m) => m.childId));
  campaign.absentChildIds = db.children
    .filter((child) => classIds.has(child.classId) && child.status === CHILD_STATUS.ACTIVE && !recorded.has(child.id))
    .map((child) => child.id);
  campaign.closedAt = at;
  campaign.closedBy = userId;
  campaign.history = [...(campaign.history || []), { at, userId, action: 'CLOSED' }];
};

const addMonths = (date, n) => {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
};

/** Ngày bắt đầu sớm nhất không còn "sát" ngày date: date + 2 tháng + 15 ngày (user chốt 2026-10-31). */
const gapEndOf = (date) => addDays(addMonths(date, SCHEDULE_MIN_GAP.months), SCHEDULE_MIN_GAP.days);

/**
 * Cảnh báo khi tạo/sửa kỳ hoặc đợt (user chốt 2026-10-31; M1, M2): kỳ/đợt khác cùng điểm trường, chưa hủy, có ngày bắt đầu
 * cách dưới 2 tháng 15 ngày (cả trước lẫn sau); đợt khám thêm cảnh báo năm học đã có đợt khám. Không chặn lưu.
 */
export const scheduleWarningsOf = (db, { campusId, kind, startDate, excludeId }) => {
  const others = (db.healthCheckCampaigns || []).filter((c) => c.campusId === campusId && c.id !== excludeId && !c.cancelledAt);
  const brief = (code, c) => ({ code, campaignId: c.id, name: c.name, kind: campaignKindOf(c), startDate: c.startDate });
  const tooClose = others
    .filter((c) => c.startDate < gapEndOf(startDate) && startDate < gapEndOf(c.startDate))
    .map((c) => brief(SCHEDULE_WARNING.TOO_CLOSE, c));
  const yearId = kind === CAMPAIGN_KIND.EXAM ? schoolYearIdOfDate(db, startDate) : null;
  const examInYear = yearId
    ? others
        .filter((c) => isExamCampaign(c) && schoolYearIdOfDate(db, c.startDate) === yearId)
        .map((c) => brief(SCHEDULE_WARNING.EXAM_IN_SCHOOL_YEAR, c))
    : [];
  return [...tooClose, ...examInYear].sort((a, b) => a.startDate.localeCompare(b.startDate));
};

export const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
