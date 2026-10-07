import { ROLES } from '@/models/User';
import { formatDate } from '@/utils/format';
import { getUsers } from '@/services/masterDataService';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { getIssues, getRequests, getProposals } from '@/services/facility/facilityService';
import { getRewardProposals } from '@/services/assessment/assessmentService';
import { getInspections } from '@/services/inventory-inspection/inspectionService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getStockIssue } from '@/services/kitchen/kitchenService';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { REQUEST_STATUS, PROPOSAL_STATUS, ISSUE_STATUS, ISSUE_TYPE_LABELS } from '@/models/facility/facilityConstants';
import { REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';
import { ROUND_STATUS_LABELS, SHEET_STATUS_LABELS } from '@/models/inventory-inspection/inspectionConstants';
import { MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import {
  MEAL_SESSION_LABELS,
  ISSUE_STATUS as STOCK_ISSUE_STATUS,
  ISSUE_STATUS_LABELS as STOCK_LABELS,
} from '@/models/kitchen/kitchenConstants';
import { canDecideIssue, canReviewRequest, canPrincipalDecideRequest, canDecideProposal } from '@/utils/facility/facilityPermissions';
import { canReviewRewardProposal, canDecideRewardProposal } from '@/utils/assessment/assessmentPermissions';
import { canReviewSheet, canApproveRound } from '@/utils/inventory-inspection/inspectionPermissions';
import { canConfirmMealCount } from '@/utils/attendance/attendancePermissions';
import { canApproveStockIssue } from '@/utils/kitchen/kitchenPermissions';
import { APPROVAL_TYPE, APPROVAL_TYPES_BY_ROLE } from '@/models/dashboard/dashboardConstants';
import { canViewPendingApprovals } from '@/utils/dashboard/dashboardPermissions';
import { sortKey } from '@/utils/dashboard/dashboardFormat';

/*
 * Pending Approval Requests (#126, UC 3.4) aggregated on the client from the facades of the owning
 * modules; every decision still happens on that module's own page. Each source keeps the module's
 * own permission check (canDecide…/canReview…), so a row appears only when the user can really decide.
 * PROPOSED backend: GET /approvals/pending → PendingApprovalGroup[] (one call instead of many).
 */

const LESSON_TYPE = { week: 'Kế hoạch tuần', day: 'Kế hoạch ngày' };
const STATUS_EDU = { PENDING_TL: 'Chờ tổ trưởng duyệt', PENDING_VP: 'Chờ Phó HT duyệt' };

const lastAt = (history = []) => history[history.length - 1]?.at || null;

const lessonPeriod = (l) => (l.type === 'day' ? `ngày ${formatDate(l.date)}` : `${formatDate(l.weekStart)} – ${formatDate(l.weekEnd)}`);

/** Each source: (user, ctx) → Promise<PendingApprovalItem[]>. ctx = { users, schoolYear, date } */
const SOURCES = {
  [APPROVAL_TYPE.LESSON_REVIEW]: async (user) => {
    const { lessons } = await getEducationPlans();
    return lessons
      .filter((l) => l.status === EDU_STATUS.PENDING_TL && l.ageGroupId === user.ageGroupId)
      .map((l) => ({
        id: l.id,
        code: l.code,
        title: `${LESSON_TYPE[l.type] || 'Giáo án'} ${lessonPeriod(l)}`.trim(),
        by: l.createdBy,
        at: lastAt(l.history),
        campusId: null,
        statusLabel: STATUS_EDU.PENDING_TL,
        to: `/education/reviews/${l.id}`,
      }));
  },

  [APPROVAL_TYPE.THEME_PLAN]: async () => {
    const { themes } = await getEducationPlans();
    return themes
      .filter((t) => t.status === EDU_STATUS.PENDING_VP)
      .map((t) => ({
        id: t.id,
        code: t.code,
        title: `Kế hoạch chủ đề: ${t.name}`,
        by: t.createdBy,
        at: lastAt(t.history),
        campusId: null,
        statusLabel: STATUS_EDU.PENDING_VP,
        to: `/education/approvals/chu-de/${t.id}`,
      }));
  },

  [APPROVAL_TYPE.LESSON_PLAN]: async () => {
    const { lessons } = await getEducationPlans();
    return lessons
      .filter((l) => l.status === EDU_STATUS.PENDING_VP)
      .map((l) => ({
        id: l.id,
        code: l.code,
        title: `${LESSON_TYPE[l.type] || 'Giáo án'} ${lessonPeriod(l)}`.trim(),
        by: l.createdBy,
        at: lastAt(l.history),
        campusId: null,
        statusLabel: STATUS_EDU.PENDING_VP,
        to: `/education/approvals/giao-an/${l.id}`,
      }));
  },

  [APPROVAL_TYPE.REWARD_REVIEW]: async (user, { users, schoolYear }) =>
    (await getRewardProposals({ schoolYear }, user)).filter((p) => canReviewRewardProposal(p, user)).map((p) => rewardRow(p, users)),

  [APPROVAL_TYPE.REWARD_DECISION]: async (user, { users, schoolYear }) =>
    (await getRewardProposals({ schoolYear }, user)).filter((p) => canDecideRewardProposal(p, user)).map((p) => rewardRow(p, users)),

  [APPROVAL_TYPE.FACILITY_ISSUE]: async (user, { users }) =>
    (await getIssues({ status: ISSUE_STATUS.SUBMITTED }, user))
      .filter((i) => canDecideIssue(i, user))
      .map((i) => ({
        id: i.id,
        code: i.code,
        title: `${ISSUE_TYPE_LABELS[i.type] || 'Sự cố'}: ${i.assetName}`,
        by: users[i.reporterId] || '—',
        at: i.createdAt,
        campusId: i.campusId,
        statusLabel: 'Chờ PHT duyệt',
        to: `/facility/issues/${i.id}`,
      })),

  [APPROVAL_TYPE.FACILITY_REQUEST]: async (user, { users }) => {
    const principal = user.role === ROLES.PRINCIPAL;
    const status = principal ? REQUEST_STATUS.PENDING_PRINCIPAL : REQUEST_STATUS.SUBMITTED;
    const can = principal ? canPrincipalDecideRequest : canReviewRequest;
    return (await getRequests({ status }, user))
      .filter((r) => can(r, user))
      .map((r) => ({
        id: r.id,
        code: r.code,
        title: `Bổ sung ${r.quantity} ${r.unit} ${r.itemName}`,
        by: users[r.requesterId] || '—',
        at: principal ? r.forwardedAt || r.createdAt : r.createdAt,
        campusId: r.campusId,
        statusLabel: principal ? 'Chờ Hiệu trưởng duyệt' : 'Chờ PHT duyệt',
        to: `/facility/requests/${r.id}`,
      }));
  },

  [APPROVAL_TYPE.FACILITY_PROPOSAL]: async (user, { users }) =>
    (await getProposals({ status: PROPOSAL_STATUS.SUBMITTED }, user))
      .filter((p) => canDecideProposal(p, user))
      .map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        by: users[p.createdBy] || '—',
        at: p.submittedAt || p.createdAt,
        campusId: p.campusId,
        statusLabel: 'Chờ Hiệu trưởng phê duyệt',
        to: `/facility/proposals/${p.id}`,
      })),

  [APPROVAL_TYPE.INSPECTION]: async (user, { users }) => {
    const rounds = await getInspections({}, user);
    const rows = [];
    rounds.forEach((r) => {
      if (canApproveRound(r, user)) {
        rows.push({
          id: r.id,
          code: r.code,
          title: `Phê duyệt kết quả đợt: ${r.name}`,
          by: users[r.createdBy] || '—',
          at: r.updatedAt,
          campusId: null,
          statusLabel: ROUND_STATUS_LABELS.PENDING_APPROVAL,
          to: `/facility/inspections/${r.id}`,
        });
      }
      (r.sheets || [])
        .filter((s) => canReviewSheet(r, s, user))
        .forEach((s) =>
          rows.push({
            id: `${r.id}:${s.id}`,
            code: s.code,
            title: `Duyệt phiếu kiểm kê – ${r.name}`,
            by: users[s.inspectorUserId] || '—',
            at: s.submittedAt,
            campusId: null,
            statusLabel: SHEET_STATUS_LABELS.SUBMITTED,
            to: `/facility/inspections/${r.id}/sheets/${s.id}`,
          }),
        );
    });
    return rows;
  },

  [APPROVAL_TYPE.MEAL_COUNT]: async (user, { date }) => {
    const { counts } = await getMealCounts({ date }, user);
    return counts
      .filter((c) => c.id && canConfirmMealCount(c, user))
      .map((c) => ({
        id: c.id,
        code: `${MEAL_SESSION_LABELS[c.session] || c.session} ${formatDate(c.date)}`,
        title: `${c.totals.normal + c.totals.substitute} suất (${c.totals.substitute} suất thay thế)`,
        by: 'Hệ thống chốt theo giờ điểm danh',
        at: c.aggregatedAt || c.date,
        campusId: c.campusId,
        statusLabel: MEAL_COUNT_STATUS_LABELS.PENDING_CONFIRMATION,
        to: `/attendance/meal-count?date=${c.date}`,
      }));
  },

  [APPROVAL_TYPE.STOCK_ISSUE]: async (user, { date }) => {
    const view = await getStockIssue({ campusId: user.campusId, date }, user);
    const issue = view?.issue;
    if (view?.state !== STOCK_ISSUE_STATUS.PENDING_APPROVAL || !issue || !canApproveStockIssue(issue, user)) return [];
    return [
      {
        id: issue.code,
        code: issue.code,
        title: `Xuất ${issue.items.length} loại thực phẩm cho bếp`,
        by: 'Lập từ sĩ số suất ăn đã xác nhận',
        at: date,
        campusId: issue.campusId,
        statusLabel: STOCK_LABELS.PENDING_APPROVAL,
        to: '/kitchen/stock-issues',
      },
    ];
  },
};

function rewardRow(p, users) {
  return {
    id: p.id,
    code: p.code,
    title: `${p.rewardTitle} – ${p.childName} (${p.className})`,
    by: users[p.createdBy] || '—',
    at: p.submittedAt || p.createdAt,
    campusId: p.campusId,
    statusLabel: REWARD_STATUS_LABELS[p.status],
    to: `/assessment/rewards/${p.id}`,
  };
}

/**
 * Everything waiting for the signed-in user's decision, grouped by type (#126).
 * Sources run in parallel; a failing source returns { error } for its group only.
 * @returns {Promise<import('@/models/dashboard/dashboardConstants').PendingApprovalGroup[]>}
 */
export async function getPendingApprovals(user, { schoolYear, date }) {
  if (!canViewPendingApprovals(user)) return [];
  const types = APPROVAL_TYPES_BY_ROLE[user.role] || [];
  // Names only decorate the rows: the list still works when the user directory is unavailable.
  const users = await getUsers()
    .then((list) => Object.fromEntries(list.map((u) => [u.id, u.fullName])))
    .catch(() => ({}));
  const ctx = { users, schoolYear, date };
  const results = await Promise.allSettled(types.map((type) => SOURCES[type](user, ctx)));
  return types.map((type, i) => {
    const r = results[i];
    const items =
      r.status === 'fulfilled'
        ? r.value.map((it) => ({ ...it, type, key: `${type}:${it.id}` })).sort((a, b) => sortKey(a.at).localeCompare(sortKey(b.at)))
        : [];
    return { type, items, error: r.status === 'rejected' ? r.reason : null };
  });
}
