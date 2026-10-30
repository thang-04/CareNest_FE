import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { getChildren, getClasses } from '@/services/schoolService';
import { isClassTeacher, isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentMockRepository as mock } from '@/services/assessment/mock/assessmentMockRepository';
import { assessmentApi as api, createAssessmentBeApi } from '@/services/assessment/api/assessmentApi';

/** Facade used by hooks / pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;
// Dev: đánh giá hằng ngày (2 view), mở lại ngày đánh giá, tổng quan đánh giá lớp dùng BE thật; phần còn lại vẫn mock
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
  const [classes, children] = await Promise.all([getClasses({ activeYear: true }, user), getChildren({ status: 'ACTIVE' }, user)]);
  const mine = new Map(classes.filter((c) => isLeader(user) || isClassTeacher(c, user)).map((c) => [c.id, c]));
  return children
    .filter((ch) => mine.has(ch.classId))
    .map((ch) => ({ ...ch, className: mine.get(ch.classId).name, campusId: mine.get(ch.classId).campusId }));
};

export const getEvaluations = (kind, filters, user) => (be ? be.getEvaluations(kind, filters) : repo.listEvaluations(kind, filters, user));
export const getEvaluation = (kind, id, user) => (be || repo).getEvaluation(kind, id, user);
export const saveEvaluationDraft = (kind, id, content, user) => (be || repo).saveEvaluationDraft(kind, id, content, user);
export const confirmEvaluation = (kind, id, content, user) => (be || repo).confirmEvaluation(kind, id, content, user);
export const regenerateEvaluationDraft = (kind, id, user) => (be || repo).regenerateEvaluationDraft(kind, id, user);
// Chỉ có ở BE (không có mock): trẻ lớp 5–6 tuổi hoàn thành chương trình
export const markProgramCompletion = (id, completed) => (be || api).markProgramCompletion(id, completed);
export const getProgramCompletion = (params, user) => (be || api).getProgramCompletion(params, user);

export const getTicketBoard = (params, user) => (be || repo).getTicketBoard(params, user);
export const getTicketSummary = (params, user) => (be || repo).getTicketSummary(params, user);
export const getTicketOverview = (params, user) => (be || repo).getTicketOverview(params, user);
// Tổng quan đánh giá các lớp cho PHT / Hiệu trưởng
export const getClassAssessmentOverview = (params, user) => (be || repo).getClassAssessmentOverview(params, user);
// Chỉ có ở BE (không có mock): số liệu thật từ điểm danh, suất ăn, cờ đánh giá ngày
export const getQualityReport = (params, user) => (be || api).getQualityReport(params, user);
export const getClassAssessmentDetail = (params, user) => (be || repo).getClassAssessmentDetail(params, user);
export const issueTickets = (body, user) => (be || repo).issueTickets(body, user);

// Chỉ có ở BE (không có mock): đề xuất khen thưởng cuối năm theo danh sách lớp
export const getRewardLists = (params) => (be || api).getRewardLists(params);
export const getRewardList = (classId) => (be || api).getRewardList(classId);
export const saveRewardList = (classId, items, options) => (be || api).saveRewardList(classId, items, options);
export const reviewRewardList = (id, body) => (be || api).reviewRewardList(id, body);
export const decideRewardList = (id, body) => (be || api).decideRewardList(id, body);
