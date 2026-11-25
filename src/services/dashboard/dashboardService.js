import { ROLES } from '@/models/User';
import { formatDate } from '@/utils/format';
import { getUsers } from '@/services/masterDataService';
import { getAllClassDocSummaries, getClassDocContext, getReviewQueue } from '@/services/education-plan/educationPlanService';
import { planRoute } from '@/models/education-plan/planLevel.mjs';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { getClassAssessmentOverview, getRewardLists } from '@/services/assessment/assessmentService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getPublishedMenu } from '@/services/kitchen/kitchenService';
import { OVERVIEW_PERIOD, REWARD_STATUS_LABELS } from '@/models/assessment/assessmentConstants';
import { MEAL_COUNT_STATUS, MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import { MEAL_SESSION_LABELS, MENU_TYPE } from '@/models/kitchen/kitchenConstants';
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

/** Each source: (user, ctx) → Promise<PendingApprovalItem[]>. ctx = { users, schoolYear, date } */
const SOURCES = {
  // Kế hoạch năm/tổ: BE trả đúng bản chờ người gọi duyệt (EDU-05, EDU-54); không lọc năm để thấy mọi bản đang chờ
  [APPROVAL_TYPE.YEAR_PLAN]: async (user) =>
    (await getReviewQueue(user)).map((g) => ({
      id: g.id,
      code: g.code,
      title: g.title,
      by: g.sentBy?.name || submitEntryOf(g)?.by || '—',
      at: g.sentAt ?? g.sentBy?.at ?? null,
      campusId: null,
      statusLabel: 'Chờ duyệt',
      to: `${planRoute(g)}/${g.id}`,
    })),
  // Hồ sơ lớp chờ đúng lượt người xem (EDU-05, EDU-18): BE lọc theo chuỗi duyệt và phạm vi, FE chỉ hiển thị
  [APPROVAL_TYPE.LESSON_REVIEW]: (user, { schoolYear }) => classDocRows(user, schoolYear, ['semester', 'dossier']),
  [APPROVAL_TYPE.THEME_PLAN]: (user, { schoolYear }) => classDocRows(user, schoolYear, ['semester']),
  [APPROVAL_TYPE.LESSON_PLAN]: (user, { schoolYear }) => classDocRows(user, schoolYear, ['dossier']),
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
async function classDocRows(user, schoolYear, kinds) {
  const [docs, context] = await Promise.all([
    getAllClassDocSummaries(schoolYear, user, kinds, { review: true, myTurn: true }),
    getClassDocContext(schoolYear, user),
  ]);
  const className = (id) => (context.classes || []).find((c) => String(c.id) === String(id))?.name || '';
  return docs.map((d) => {
    const sent = [...(d.history || [])].reverse().find((h) => !h.tone);
    return {
      id: d.id,
      code: className(d.classId),
      title:
        d.kind === 'semester'
          ? `Học kỳ ${d.semesterNo}: kế hoạch chủ đề · ${(d.themeIds || []).length} chủ đề`
          : `Chủ đề ${d.themeNo || ''}: ${d.themeName || '—'} · kế hoạch giáo dục ngày`,
      by: sent?.by || '—',
      at: sent?.at || null,
      campusId: null,
      statusLabel: 'Chờ duyệt',
      to: '/education/plan-reviews',
    };
  });
}

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
  const users = await getUsers(user)
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

/**
 * Bữa trưa hôm nay của trang chủ: tổng suất (thường + thay thế) theo sổ báo ăn, số điểm trường đã xác nhận, thực đơn đã công bố.
 * counts = getMealCounts().counts, menu = getPublishedMenu({ view: 'day' }); null = nguồn đó không tải được.
 */
export function buildLunch({ counts, menu, campusId = '', campusName = (id) => id }) {
  const lunches = counts ? counts.filter((c) => c.session === 'LUNCH' && (!campusId || c.campusId === campusId)) : null;
  const session = menu ? (menu[0]?.sessions || []).find((s) => s.session === 'LUNCH' && s.menus.length) : null;
  const normal = (session?.menus || []).filter((m) => m.type !== MENU_TYPE.ALLERGY);
  const confirmed = (c) => c.status === MEAL_COUNT_STATUS.CONFIRMED;
  return {
    meals: lunches ? lunches.reduce((n, c) => n + c.totals.normal + c.totals.substitute, 0) : null,
    campuses: lunches ? lunches.length : null,
    confirmed: lunches ? lunches.filter(confirmed).length : null,
    pendingCampuses: lunches ? lunches.filter((c) => !confirmed(c)).map((c) => campusName(c.campusId)) : [],
    reconfirm: !!lunches?.some((c) => c.needsReconfirmation),
    menuLoaded: !!menu,
    published: !!session,
    dishes: [...new Set(normal.flatMap((m) => m.dishes.map((d) => d.name)))],
    allergyMenus: (session?.menus.length || 0) - normal.length,
  };
}

/** Sổ báo ăn + thực đơn đã công bố hôm nay; nguồn lỗi hoặc 403 theo vai trò trả null. */
// withCounts=false: trang chủ theo lớp chỉ hiện món; sổ báo ăn toàn trường chỉ HT/PHT/bếp đọc được (403 với GV)
export async function getLunchSources(user, { date, withCounts = true }) {
  const [counts, menu] = await Promise.all([
    withCounts
      ? getMealCounts({ date }, user)
          .then((r) => r?.counts || [])
          .catch(() => null)
      : null,
    getPublishedMenu({ date, view: 'day' }, user).catch(() => null),
  ]);
  return { counts, menu };
}

/** Nguồn phụ của "Tiến độ trong ngày": mỗi nguồn lỗi (hoặc 403 với vai trò) trả null, không làm hỏng cả khối. */
export async function getDayProgressSources(user, { date, schoolYear, campusId }) {
  const [lunch, assessment] = await Promise.all([
    getLunchSources(user, { date }),
    getClassAssessmentOverview({ period: OVERVIEW_PERIOD.DAY, date, schoolYear, campusId: campusId || undefined }, user).catch(() => null),
  ]);
  return { ...lunch, assessment };
}
