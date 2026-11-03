import { ROLES } from '@/models/User';
import { formatDate } from '@/utils/format';
import { getUsers } from '@/services/masterDataService';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { getRewardLists } from '@/services/assessment/assessmentService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';
import { MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import { canConfirmMealCount } from '@/utils/attendance/attendancePermissions';
import { APPROVAL_TYPE, APPROVAL_TYPES_BY_ROLE } from '@/models/dashboard/dashboardConstants';
import { canViewPendingApprovals } from '@/utils/dashboard/dashboardPermissions';
import { sortKey } from '@/utils/dashboard/dashboardFormat';

/*
 * Pending Approval Requests (#126, UC 3.4) aggregated on the client from the facades of the owning
 * modules; every decision still happens on that module's own page. Each source keeps the module's
 * own permission check (canDecide…/canReview…), so a row appears only when the user can really decide.
 * PROPOSED backend: GET /approvals/pending → PendingApprovalGroup[] (one call instead of many).
 */

const LESSON_TYPE = {
  week: 'Kế hoạch tuần',
  day: 'Kế hoạch ngày',
};
const STATUS_EDU = {
  PENDING_TL: 'Chờ tổ trưởng duyệt',
  PENDING_VP: 'Chờ Phó HT duyệt',
};
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
        to: '/education/plan-reviews',
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
        to: '/education/plan-reviews',
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
        to: '/education/plan-reviews',
      }));
  },
  // Danh sách khen thưởng của lớp: PHT xem xét bản chờ PHT; HT phê duyệt bản chờ HT (BE cho HT xử lý cả bản chờ PHT)
  [APPROVAL_TYPE.REWARD_REVIEW]: async (user, { schoolYear }) =>
    user?.role === ROLES.VICE_PRINCIPAL
      ? (await getRewardLists({ schoolYear }, user)).filter((r) => r.status === 'PENDING_VP').map(rewardRow)
      : [],
  [APPROVAL_TYPE.REWARD_DECISION]: async (user, { schoolYear }) =>
    user?.role === ROLES.PRINCIPAL
      ? (await getRewardLists({ schoolYear }, user)).filter((r) => r.status === 'PENDING_PRINCIPAL').map(rewardRow)
      : [],
  [APPROVAL_TYPE.MEAL_COUNT]: async (user, { date }) => {
    const { counts } = await getMealCounts(
      {
        date,
      },
      user,
    );
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
};
function rewardRow(r) {
  return {
    id: r.listId,
    code: r.className,
    title: `Danh sách khen thưởng lớp ${r.className} (${r.awarded ?? 0}/${r.children} trẻ)`,
    by: '—',
    at: r.submittedAt,
    campusId: r.campusId,
    statusLabel: REWARD_STATUS_LABELS[r.status],
    to: `/assessment/rewards/${r.classId}`,
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
  const ctx = {
    users,
    schoolYear,
    date,
  };
  const results = await Promise.allSettled(types.map((type) => SOURCES[type](user, ctx)));
  return types.map((type, i) => {
    const r = results[i];
    const items =
      r.status === 'fulfilled'
        ? r.value
            .map((it) => ({
              ...it,
              type,
              key: `${type}:${it.id}`,
            }))
            .sort((a, b) => sortKey(a.at).localeCompare(sortKey(b.at)))
        : [];
    return {
      type,
      items,
      error: r.status === 'rejected' ? r.reason : null,
    };
  });
}
