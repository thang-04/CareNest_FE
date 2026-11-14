import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { getAgeGroups, getCampusList, getChildren, getClasses } from '@/services/schoolService';
import { isClassTeacher, isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentMockRepository as mock } from '@/services/assessment/mock/assessmentMockRepository';
import { createAssessmentBeApi } from '@/services/assessment/api/assessmentApi';

/** Facade used by hooks / pages: nối BE (SCHOOL_CONFIG_API) thì mọi màn đánh giá trẻ gọi BE thật, không thì mock. */
// Build nối BE mà chưa bật SCHOOL_CONFIG_API: báo lỗi rõ thay vì lặng lẽ trả dữ liệu mẫu
const notConnected = new Proxy(
  {},
  { get: () => () => Promise.reject(Object.assign(new Error('Đánh giá trẻ cần đăng nhập hệ thống CareNest.'), { status: 501 })) },
);
const repo = USE_MOCK ? mock : notConnected;
const be = SCHOOL_CONFIG_API ? createAssessmentBeApi(beClient) : null;

export const getAssessmentCriteria = () => repo.getCriteria();

/** Lớp cho đánh giá hằng ngày / mở lại ngày: BE kèm cờ teaches, canUnlock; mock: lớp năm đang hoạt động. */
export const getDailyAssessmentClasses = (schoolYear, user) =>
  be ? be.getDailyAssessmentClasses(schoolYear) : getClasses({ activeYear: true }, user);
// Phiếu đánh giá ngày dùng chung 2 view (Hoạt động chung, Kiến thức kỹ năng); lưu riêng từng view
export const getDailyAssessment = (params, user) => (be || repo).getDailyAssessment(params, user);
export const saveDailyGeneral = (body, user) => (be || repo).saveDailyGeneral(body, user);
export const saveDailySkills = (body, user) => (be || repo).saveDailySkills(body, user);
export const getAssessmentDayUnlocks = (filters, user) => (be || repo).listAssessmentDayUnlocks(filters, user);
export const unlockAssessmentDay = (body, user) => (be || repo).unlockAssessmentDay(body, user);
export const revokeAssessmentDayUnlock = (id, user) => (be || repo).revokeAssessmentDayUnlock(id, user);

export const getChildDevelopment = (childId, params, user) => (be || repo).getChildDevelopment(childId, params, user);
/** Trẻ cho Hồ sơ / Tiến độ phát triển: BE trả trẻ trong phạm vi; mock lọc trẻ đang học theo lớp của người dùng. */
export const getDevelopmentChildren = async (params, user) => {
  if (be) return be.getDevelopmentChildren(params);
  const [classes, children, campuses, ageGroups] = await Promise.all([
    getClasses({ activeYear: true }, user),
    getChildren({ status: 'ACTIVE' }, user),
    getCampusList(params?.schoolYear, user).catch(() => []),
    getAgeGroups().catch(() => []),
  ]);
  const mine = new Map(classes.filter((c) => isLeader(user) || isClassTeacher(c, user)).map((c) => [c.id, c]));
  return children
    .filter((ch) => mine.has(ch.classId))
    .map((ch) => {
      const cls = mine.get(ch.classId);
      const campus = campuses.find((x) => String(x.id) === String(cls.campusId));
      return {
        ...ch,
        className: cls.name,
        campusId: cls.campusId,
        campusName: campus?.name || '',
        ageGroupId: cls.ageGroupId,
        ageGroupName: ageGroups.find((g) => String(g.id) === String(cls.ageGroupId))?.name || '',
      };
    });
};

export const getEvaluations = (kind, filters, user) => (be ? be.getEvaluations(kind, filters) : repo.listEvaluations(kind, filters, user));
export const getEvaluation = (kind, id, user) => (be || repo).getEvaluation(kind, id, user);
export const saveEvaluationDraft = (kind, id, content, user) => (be || repo).saveEvaluationDraft(kind, id, content, user);
export const confirmEvaluation = (kind, id, content, user) => (be || repo).confirmEvaluation(kind, id, content, user);
export const regenerateEvaluationDraft = (kind, id, user) => (be || repo).regenerateEvaluationDraft(kind, id, user);
export const markProgramCompletion = (id, completed, user) => (be || repo).markProgramCompletion(id, completed, user);
export const getYearEndSheet = (id, user) => (be || repo).getYearEndSheet(id, user);
export const saveYearEndSheet = (id, body, user) => (be || repo).saveYearEndSheet(id, body, user);
export const getProgramCompletion = (params, user) => (be || repo).getProgramCompletion(params, user);

export const getTicketBoard = (params, user) => (be || repo).getTicketBoard(params, user);
export const getTicketSummary = (params, user) => (be || repo).getTicketSummary(params, user);
export const getTicketOverview = (params, user) => (be || repo).getTicketOverview(params, user);
// Tổng quan đánh giá các lớp cho PHT / Hiệu trưởng
export const getClassAssessmentOverview = (params, user) => (be || repo).getClassAssessmentOverview(params, user);
export const getQualityReport = (params, user) => (be || repo).getQualityReport(params, user);
/** Nhận xét chung cả lớp theo tháng: { status, draft, content, canEdit, … }. */
export const getClassMonthlyComment = (params, user) => (be || repo).getClassMonthlyComment(params, user);
export const saveClassMonthlyComment = (body, user) => (be || repo).saveClassMonthlyComment(body, user);
export const confirmClassMonthlyComment = (body, user) => (be || repo).confirmClassMonthlyComment(body, user);
// Nhận xét tuần theo trẻ (OBS-29): GV viết, gửi phụ huynh
export const getWeeklyComments = (params, user) => (be || repo).getWeeklyComments(params, user);
export const writeWeeklyCommentDrafts = (body, user) => (be || repo).writeWeeklyCommentDrafts(body, user);
export const saveWeeklyComment = (body, user) => (be || repo).saveWeeklyComment(body, user);
export const sendWeeklyComments = (body, user) => (be || repo).sendWeeklyComments(body, user);
export const unlockWeeklyComments = (body, user) => (be || repo).unlockWeeklyComments(body, user);
export const revokeWeeklyCommentUnlock = (id, user) => (be || repo).revokeWeeklyCommentUnlock(id, user);
export const getWeeklyCommentOverview = (params, user) => (be || repo).getWeeklyCommentOverview(params, user);
export const getWeeklyCommentUnlocks = (filters, user) => (be || repo).listWeeklyCommentUnlocks(filters, user);
// Đánh giá cuối chủ đề / học kỳ / cuối năm: kỳ của lớp, mở lại lớp – kỳ, lớp quá hạn (BE OBS-30)
export const getEvaluationPeriods = (params, user) => (be || repo).getEvaluationPeriods(params, user);
export const unlockEvaluation = (body, user) => (be || repo).unlockEvaluation(body, user);
export const getEvaluationUnlocks = (filters, user) => (be || repo).listEvaluationUnlocks(filters, user);
export const revokeEvaluationUnlock = (id, user) => (be || repo).revokeEvaluationUnlock(id, user);
export const getOverdueClasses = (params, user) => (be || repo).getOverdueClasses(params, user);
/** Xếp loại nhóm lớp theo kỳ: { rows: [{ classId, levels, note, canEdit, … }], campuses }. */
export const getClassRatings = (params, user) => (be || repo).getClassRatings(params, user);
/** Đánh giá cuối chủ đề (lớp mẫu giáo): danh sách chủ đề, bảng trẻ × MT, lưu ô sửa tay / ghi chú, xác nhận. */
export const getThemeClasses = (params, user) => (be || repo).getThemeClasses(params, user);
export const getThemeList = (params, user) => (be || repo).getThemeList(params, user);
export const getThemeEvaluation = (params, user) => (be || repo).getThemeEvaluation(params, user);
export const saveThemeEvaluation = (body, user) => (be || repo).saveThemeEvaluation(body, user);
export const confirmThemeEvaluation = (body, user) => (be || repo).confirmThemeEvaluation(body, user);
export const saveClassRatings = (body, user) => (be || repo).saveClassRatings(body, user);
export const getClassAssessmentDetail = (params, user) => (be || repo).getClassAssessmentDetail(params, user);
export const issueTickets = (body, user) => (be || repo).issueTickets(body, user);

export const getRewardLists = (params, user) => (be || repo).getRewardLists(params, user);
export const getRewardList = (classId, user) => (be || repo).getRewardList(classId, user);
export const saveRewardList = (classId, items, options, user) => (be || repo).saveRewardList(classId, items, options, user);
export const reviewRewardList = (id, body, user) => (be || repo).reviewRewardList(id, body, user);
export const decideRewardList = (id, body, user) => (be || repo).decideRewardList(id, body, user);

// Bảng học kỳ mới cần nguồn BE, không trộn dữ liệu mock cũ của nhận xét định kỳ.
const semesterBackend = () => be || notConnected;
export const getSemesterAssessment = (params) => semesterBackend().getSemesterAssessment(params);
export const saveSemesterAssessment = (body) => semesterBackend().saveSemesterAssessment(body);
export const confirmSemesterAssessment = (body) => semesterBackend().confirmSemesterAssessment(body);
