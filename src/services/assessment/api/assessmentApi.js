import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for the assessment module (same names / shapes as the mock).
 * Not agreed with CareNest_BE yet. The user is read from the JWT, so `user` arguments are ignored here.
 */
export const assessmentApi = {
  getCriteria: () => axiosClient.get('/assessment/criteria'),

  getDailyAssessment: ({ classId, date }) => axiosClient.get(`/classes/${classId}/daily-assessment`, { params: { date } }),
  saveDailyGeneral: ({ classId, date, entries, classComment }) =>
    axiosClient.put(`/classes/${classId}/daily-assessment/general`, {
      date,
      entries,
      ...(classComment != null ? { classComment } : {}),
    }),
  saveDailySkills: ({ classId, date, entries }) => axiosClient.put(`/classes/${classId}/daily-assessment/skills`, { date, entries }),
  listAssessmentDayUnlocks: (filters) => axiosClient.get('/assessment/day-unlocks', { params: filters }),
  unlockAssessmentDay: (body) => axiosClient.post('/assessment/day-unlocks', body),
  revokeAssessmentDayUnlock: (id) => axiosClient.post(`/assessment/day-unlocks/${id}/revoke`),

  getChildDevelopment: (childId, params) => axiosClient.get(`/assessment/children/${childId}/development`, { params }),

  listEvaluations: (kind, params) => axiosClient.get(`/assessment/evaluations/${kind}`, { params }),
  getEvaluation: (kind, id) => axiosClient.get(`/assessment/evaluations/${kind}/${id}`),
  saveEvaluationDraft: (kind, id, content) => axiosClient.put(`/assessment/evaluations/${kind}/${id}/content`, { content }),
  confirmEvaluation: (kind, id, content) => axiosClient.post(`/assessment/evaluations/${kind}/${id}/confirm`, { content }),
  regenerateEvaluationDraft: (kind, id) => axiosClient.post(`/assessment/evaluations/${kind}/${id}/ai-draft`),

  getTicketBoard: (params) => axiosClient.get('/assessment/behaviour-tickets/board', { params }),
  // PENDING BE: tổng hợp phiếu bé ngoan theo trẻ
  getTicketSummary: (params) => axiosClient.get('/assessment/behaviour-tickets/summary', { params }),
  getTicketOverview: (params) => axiosClient.get('/assessment/behaviour-tickets/overview', { params }),
  getClassAssessmentOverview: ({ schoolYear, ...params }) =>
    axiosClient.get('/assessment/overview', { params: { ...params, schoolYearId: schoolYear } }),
  getClassAssessmentDetail: ({ classId, period }) => axiosClient.get(`/assessment/overview/classes/${classId}`, { params: { period } }),
  issueTickets: (body) => axiosClient.post('/assessment/behaviour-tickets', body),

  listRewardProposals: (params) => axiosClient.get('/assessment/reward-proposals', { params }),
  getRewardProposal: (id) => axiosClient.get(`/assessment/reward-proposals/${id}`),
  getRewardCandidates: (schoolYear) => axiosClient.get('/assessment/reward-proposals/candidates', { params: { schoolYear } }),
  saveRewardProposal: (id, payload, { submit = false } = {}) =>
    id
      ? axiosClient.put(`/assessment/reward-proposals/${id}`, payload, { params: { submit } })
      : axiosClient.post('/assessment/reward-proposals', payload, { params: { submit } }),
  deleteRewardProposal: (id) => axiosClient.delete(`/assessment/reward-proposals/${id}`),
  reviewRewardProposal: (id, body) => axiosClient.post(`/assessment/reward-proposals/${id}/review`, body),
  decideRewardProposal: (id, body) => axiosClient.post(`/assessment/reward-proposals/${id}/decision`, body),
};

/* ---------------- Dev (VITE_SCHOOL_CONFIG_API): đánh giá hằng ngày, mở lại ngày, tổng quan nối BE thật ---------------- */

const GOAL_LISTS = ['goalsMet', 'goalsEffort', 'goalsNotMet'];
// beClient đổi `id` số thành chuỗi nhưng không đổi phần tử của goalsMet/…: đưa về chuỗi để so với goals[].id
const goalIdsToUi = (a) => ({ ...a, ...Object.fromEntries(GOAL_LISTS.map((k) => [k, (a[k] || []).map(String)])) });
const goalIdsToBe = (a) => ({ ...a, ...Object.fromEntries(GOAL_LISTS.map((k) => [k, (a[k] || []).map(Number)])) });

/** DailySheetResponse của BE, chỉ chuẩn hóa id mục tiêu và danh sách rỗng. */
export const toDailySheet = (data) => ({
  ...data,
  mealSessions: data.mealSessions || [],
  lesson: data.lesson ? { ...data.lesson, activities: data.lesson.activities || [] } : null,
  rows: (data.rows || []).map((r) => ({
    ...r,
    behaviors: r.behaviors || [],
    meals: r.meals || {},
    health: { signs: [], prefillSigns: [], note: '', overridden: false, ...r.health },
    activities: (r.activities || []).map(goalIdsToUi),
  })),
});

const nameOf = (list, item) => item.name || list.find((x) => x.id === item.id)?.name || item.id;
/** Tổng quan đánh giá: điền tên điểm trường / nhóm tuổi từ danh mục (BE trả name null). */
export const withNames = (overview, campuses = [], ageGroups = []) => ({
  ...overview,
  campuses: (overview.campuses || []).map((c) => ({ ...c, name: nameOf(campuses, c) })),
  ageGroups: (overview.ageGroups || []).map((g) => ({ ...g, name: nameOf(ageGroups, g) })),
});

const pickGoals = (a) => Object.fromEntries(GOAL_LISTS.map((k) => [k, a[k] || []]));
const blank = (v) => (v === '' || v === undefined ? null : v);

export const createAssessmentBeApi = (client) => ({
  // Lớp trong phạm vi người dùng (BE kèm teaches / canRecord / canUnlock); dùng chung danh sách lớp của điểm danh
  getDailyAssessmentClasses: (schoolYear) => client.get('/attendance/classes', { params: { schoolYearId: schoolYear || undefined } }),
  getDailyAssessment: async ({ classId, date }) =>
    toDailySheet(await client.get(`/classes/${classId}/daily-assessment`, { params: { date: date || undefined } })),
  saveDailyGeneral: ({ classId, date, entries, classComment }) =>
    client.put(
      `/classes/${classId}/daily-assessment/general`,
      {
        date,
        ...(classComment != null ? { classComment } : {}),
        entries: entries.map((e) => ({
          childId: e.childId,
          healthOverridden: !!e.healthOverridden,
          healthSigns: e.healthSigns || [],
          healthNote: e.healthNote || '',
          meals: e.meals || {},
          nap: blank(e.nap),
          emotion: blank(e.emotion),
          participation: blank(e.participation),
          behaviors: e.behaviors || [],
          behaviorNote: e.behaviorNote || '',
          flag: e.flag ?? null,
          comment: e.comment ?? '',
        })),
      },
      { preserveEmptyStrings: ['classComment'] },
    ),
  saveDailySkills: ({ classId, date, entries }) =>
    client.put(`/classes/${classId}/daily-assessment/skills`, {
      date,
      entries: entries.map((e) => ({
        childId: e.childId,
        comment: e.comment ?? null,
        activities: (e.activities || []).map((a) => goalIdsToBe({ key: a.key, participation: blank(a.participation), ...pickGoals(a) })),
      })),
    }),
  listAssessmentDayUnlocks: ({ campusId, classId, active, from, to } = {}) =>
    client.get('/assessment/day-unlocks', {
      params: {
        campusId: campusId || undefined,
        classId: classId || undefined,
        active: active === '' || active == null ? undefined : active,
        from: from || undefined,
        to: to || undefined,
      },
    }),
  unlockAssessmentDay: ({ classId, date, validUntil, reason }) =>
    client.post('/assessment/day-unlocks', { classId, date, validUntil, reason }),
  revokeAssessmentDayUnlock: (id) => client.post(`/assessment/day-unlocks/${id}/revoke`),
  // BE không trả tên điểm trường / nhóm tuổi (name null): ghép tên từ danh mục của BE
  getClassAssessmentOverview: async ({ period, schoolYear, campusId, ageGroupId, classId } = {}) => {
    const [overview, campuses, ageGroups] = await Promise.all([
      client.get('/assessment/overview', {
        params: {
          period,
          schoolYearId: schoolYear || undefined,
          campusId: campusId || undefined,
          ageGroupId: ageGroupId || undefined,
          classId: classId || undefined,
        },
      }),
      client.get('/campuses').catch(() => []),
      client.get('/age-groups').catch(() => []),
    ]);
    return withNames(overview, campuses, ageGroups);
  },
  getClassAssessmentDetail: ({ classId, period }) => client.get(`/assessment/overview/classes/${classId}`, { params: { period } }),
});
