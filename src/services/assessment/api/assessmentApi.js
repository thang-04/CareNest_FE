import { isLeader } from '@/utils/assessment/assessmentPermissions';
// API đánh giá trẻ của BE (client = beClient: bóc envelope, đổi id/năm học giữa dạng BE và UI)

// Tên ngắn của điểm trường dùng trong bảng, bộ lọc (Tên ngắn ở Cấu hình điểm trường), thiếu thì tên đầy đủ
const campusLabel = (campuses, id) => {
  const c = campuses.find((x) => String(x.id) === String(id));
  return c?.shortName || c?.name;
};
// Ô lọc điểm trường hiện đủ tên (Cần chốt 10/11/2026)
const campusFull = (campuses, id) => campuses.find((x) => String(x.id) === String(id))?.name;

const GOAL_LISTS = ['goalsMet', 'goalsNotMet'];
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
  // Thiếu danh mục (giáo viên, tổ trưởng) thì để tên trống, không hiện mã số thay tên
  campuses: (overview.campuses || []).map((c) => ({
    ...c,
    name: campusLabel(campuses, c.id) || c.name || null,
    fullName: campusFull(campuses, c.id),
  })),
  ageGroups: (overview.ageGroups || []).map((g) => ({ ...g, name: nameOf(ageGroups, g) })),
  // Đủ danh mục điểm trường cho ô lọc của Hiệu trưởng (kể cả điểm trường chưa có lớp)
  allCampuses: campuses.map((c) => ({ id: c.id, name: c.shortName || c.name, fullName: c.name })),
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
    client.put(
      `/classes/${classId}/daily-assessment/skills`,
      {
        date,
        entries: entries.map((e) => ({
          childId: e.childId,
          comment: e.comment ?? null,
          activities: (e.activities || []).map((a) => goalIdsToBe({ key: a.key, participation: blank(a.participation), ...pickGoals(a) })),
        })),
      },
      // '' = xóa nhận xét (BE: null mới là giữ nguyên), không để tầng chung đổi thành null
      { preserveEmptyStrings: ['comment'] },
    ),
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
  getClassAssessmentOverview: async ({ period, date, schoolYear, campusId, ageGroupId, classId } = {}, user) => {
    const [overview, campuses, ageGroups] = await Promise.all([
      client.get('/assessment/overview', {
        params: {
          period,
          date: date || undefined,
          schoolYearId: schoolYear || undefined,
          campusId: campusId || undefined,
          ageGroupId: ageGroupId || undefined,
          classId: classId || undefined,
        },
      }),
      // Tổ trưởng không đọc được danh mục điểm trường (màn không lọc điểm trường cho tổ trưởng)
      isLeader(user) ? client.get('/campuses').catch(() => []) : [],
      client.get('/age-groups').catch(() => []),
    ]);
    return withNames(overview, campuses, ageGroups);
  },
  getClassAssessmentDetail: ({ classId, period, date }) =>
    client.get(`/assessment/overview/classes/${classId}`, { params: { period, date: date || undefined } }),
  getQualityReport: async ({ schoolYear, month, campusId } = {}, user) => {
    const report = await client.get('/assessment/quality-report', {
      params: { schoolYearId: schoolYear || undefined, month: month || undefined, campusId: campusId || undefined },
    });
    // GV, tổ trưởng không đọc được danh mục điểm trường (màn không hiện cột điểm trường); BGH lọc thì vẫn cần đủ danh sách
    const campuses =
      isLeader(user) && (campusId || (report.campusIds || []).length > 1) ? await client.get('/campuses').catch(() => []) : [];
    return {
      ...report,
      campuses: (report.campusIds || []).map((id) => ({ id, name: campusLabel(campuses, id) || id, fullName: campusFull(campuses, id) })),
      allCampuses: campuses.map((c) => ({ id: c.id, name: c.shortName || c.name, fullName: c.name })),
    };
  },
  // Xếp loại nhóm lớp: ghép tên ngắn điểm trường cho cột / bộ lọc
  getClassRatings: async ({ schoolYear, period, campusId } = {}, user) => {
    const result = await client.get('/assessment/class-ratings', {
      params: { period, schoolYearId: schoolYear || undefined, campusId: campusId || undefined },
    });
    // GV (1 điểm trường) không có quyền đọc danh mục điểm trường: chỉ tra tên khi có nhiều điểm trường
    const campuses = isLeader(user) && (result.campusIds || []).length > 1 ? await client.get('/campuses').catch(() => []) : [];
    return {
      ...result,
      campuses: (result.campusIds || []).map((id) => ({ id, name: campusLabel(campuses, id) || id, fullName: campusFull(campuses, id) })),
    };
  },
  saveClassRatings: ({ period, items }) => client.put('/assessment/class-ratings', { period, items }),
  // Đánh giá cuối chủ đề lớp mẫu giáo (BE OBS-27): chủ đề của kế hoạch năm học đã duyệt, bảng trẻ × MT
  getThemeClasses: ({ schoolYear } = {}) =>
    client.get('/assessment/theme-evaluations/classes', { params: { schoolYearId: schoolYear || undefined } }),
  getThemeList: ({ classId }) => client.get('/assessment/theme-evaluations/themes', { params: { classId } }),
  getThemeEvaluation: ({ classId, themeId }) => client.get('/assessment/theme-evaluations', { params: { classId, themeId } }),
  saveThemeEvaluation: (body) => client.put('/assessment/theme-evaluations', body),
  confirmThemeEvaluation: (body) => client.post('/assessment/theme-evaluations/confirm', body),
  // Nhận xét chung cả lớp theo tháng (BE OBS-26); month = ngày 1 của tháng
  getClassMonthlyComment: ({ classId, month }) => client.get('/assessment/class-monthly-comments', { params: { classId, month } }),
  saveClassMonthlyComment: ({ classId, month, content }) => client.put('/assessment/class-monthly-comments', { classId, month, content }),
  confirmClassMonthlyComment: ({ classId, month, content }) =>
    client.post('/assessment/class-monthly-comments/confirm', { classId, month, content }),
  // Nhận xét tuần theo trẻ (BE OBS-29): weekStart = thứ Hai; childId trống = cả lớp
  getWeeklyComments: ({ classId, weekStart }) =>
    client.get('/assessment/weekly-comments', { params: { classId, weekStart: weekStart || undefined } }),
  writeWeeklyCommentDrafts: ({ classId, weekStart, childId, overwrite = false, ai = false }) =>
    client.post('/assessment/weekly-comments/drafts', { classId, weekStart, childId: childId || null, overwrite, ai }),
  saveWeeklyComment: ({ classId, weekStart, childId, content }) =>
    client.put('/assessment/weekly-comments', { classId, weekStart, childId, content }),
  sendWeeklyComments: ({ classId, weekStart, childId, content }) =>
    client.post('/assessment/weekly-comments/send', { classId, weekStart, childId: childId || null, content: content ?? null }),
  // Đánh giá tháng / cuối năm: BE tạo bản nháp khi tháng kết thúc (cuối năm: khi học kỳ II kết thúc)
  getEvaluations: (kind, { schoolYear, classId } = {}) =>
    client.get('/assessment/evaluations', {
      params: {
        periodType: { 'year-end': 'YEAR', semester: 'SEMESTER' }[kind] || 'MONTH',
        schoolYearId: schoolYear || undefined,
        classId: classId || undefined,
      },
    }),
  getEvaluation: (kind, id) => client.get(`/assessment/evaluations/${id}`),
  saveEvaluationDraft: (kind, id, content) => client.put(`/assessment/evaluations/${id}/content`, { content }),
  confirmEvaluation: (kind, id, content) => client.post(`/assessment/evaluations/${id}/confirm`, { content }),
  regenerateEvaluationDraft: (kind, id) => client.post(`/assessment/evaluations/${id}/redraft`),
  markProgramCompletion: (id, completed) => client.put(`/assessment/evaluations/${id}/program-completion`, { completed }),
  // Phiếu đánh giá sự phát triển cuối năm (BE OBS-28)
  getSemesterAssessment: (params) => client.get('/assessment/semester-evaluations', { params }),
  saveSemesterAssessment: (body) => client.put('/assessment/semester-evaluations', body),
  confirmSemesterAssessment: (body) => client.post('/assessment/semester-evaluations/confirm', body),
  getYearEndSheet: (id) => client.get(`/assessment/evaluations/${id}/year-sheet`),
  saveYearEndSheet: (id, body) => client.put(`/assessment/evaluations/${id}/year-sheet`, body),
  // Hồ sơ / tiến độ phát triển: trẻ trong phạm vi của năm học, số liệu của trẻ theo khoảng ngày
  // Ghép điểm trường (tên đủ) và nhóm tuổi của lớp cho ô lọc; thiếu danh mục thì để trống, không chặn danh sách
  getDevelopmentChildren: async ({ schoolYear, classId } = {}) => {
    const [rows, classes, campuses, ageGroups] = await Promise.all([
      client.get('/assessment/children', { params: { schoolYearId: schoolYear || undefined, classId: classId || undefined } }),
      client.get('/assessment/theme-evaluations/classes', { params: { schoolYearId: schoolYear || undefined } }).catch(() => []),
      client.get('/campuses').catch(() => []),
      client.get('/age-groups').catch(() => []),
    ]);
    const classOf = new Map(classes.map((c) => [String(c.classId), c]));
    return rows.map((r) => {
      const ageGroupId = classOf.get(String(r.classId))?.ageGroupId ?? null;
      return {
        ...r,
        campusName: campusFull(campuses, r.campusId) || '',
        ageGroupId,
        ageGroupName: ageGroups.find((g) => String(g.id) === String(ageGroupId))?.name || '',
      };
    });
  },
  getChildDevelopment: (childId, { start, end }) => client.get(`/assessment/children/${childId}/development`, { params: { start, end } }),
  // Trẻ lớp 5–6 tuổi hoàn thành chương trình (sổ chỉ đạo chuyên môn mục 8): ghép tên điểm trường
  getProgramCompletion: async ({ schoolYear, campusId } = {}) => {
    const [report, campuses] = await Promise.all([
      client.get('/assessment/program-completion', {
        params: { schoolYearId: schoolYear || undefined, campusId: campusId || undefined },
      }),
      client.get('/campuses').catch(() => []),
    ]);
    return {
      ...report,
      campuses: (report.campusIds || []).map((id) => ({ id, name: campusLabel(campuses, id) || id, fullName: campusFull(campuses, id) })),
    };
  },
  // Đề xuất khen thưởng theo danh sách lớp: ghép tên điểm trường cho HT lọc
  getRewardLists: async ({ schoolYear } = {}) => {
    const rows = await client.get('/assessment/reward-lists', { params: { schoolYearId: schoolYear || undefined } });
    const campuses = new Set(rows.map((r) => r.campusId)).size > 1 ? await client.get('/campuses').catch(() => []) : [];
    return rows.map((r) => ({ ...r, campusName: campusLabel(campuses, r.campusId) || '' }));
  },
  getRewardList: (classId) => client.get(`/assessment/reward-lists/classes/${classId}`),
  saveRewardList: (classId, items, { submit = false } = {}) =>
    client.put(`/assessment/reward-lists/classes/${classId}`, { items }, { params: { submit } }),
  reviewRewardList: (id, body) => client.post(`/assessment/reward-lists/${id}/review`, body),
  decideRewardList: (id, body) => client.post(`/assessment/reward-lists/${id}/decision`, body),
  // Phiếu bé ngoan: BE tính điều kiện từ điểm danh và Cờ của đánh giá ngày
  getTicketBoard: ({ classId, type, periodStart }) =>
    client.get('/assessment/behaviour-tickets/board', { params: { classId, type, periodStart: periodStart || undefined } }),
  issueTickets: ({ classId, type, periodStart, childIds }) =>
    client.post('/assessment/behaviour-tickets', { classId, type, periodStart, childIds }),
  getTicketSummary: ({ classId, month }) =>
    client.get('/assessment/behaviour-tickets/summary', { params: { classId, month: month || undefined } }),
  getTicketOverview: async ({ schoolYear, month, campusId } = {}) => {
    const [overview, campuses] = await Promise.all([
      client.get('/assessment/behaviour-tickets/overview', {
        params: { schoolYearId: schoolYear || undefined, month: month || undefined, campusId: campusId || undefined },
      }),
      client.get('/campuses').catch(() => []),
    ]);
    return {
      ...overview,
      // Không đọc được danh mục điểm trường (giáo viên): tên trống để màn ẩn cột, không hiện mã số
      campuses: (overview.campusIds || []).map((id) => ({
        id,
        name: campusLabel(campuses, id) || null,
        fullName: campusFull(campuses, id),
      })),
    };
  },
});
