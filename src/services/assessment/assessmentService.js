import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { getClasses } from '@/services/schoolService';
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

export const getChildDevelopment = (childId, params, user) => repo.getChildDevelopment(childId, params, user);

export const getEvaluations = (kind, filters, user) => repo.listEvaluations(kind, filters, user);
export const getEvaluation = (kind, id, user) => repo.getEvaluation(kind, id, user);
export const saveEvaluationDraft = (kind, id, content, user) => repo.saveEvaluationDraft(kind, id, content, user);
export const confirmEvaluation = (kind, id, content, user) => repo.confirmEvaluation(kind, id, content, user);
export const regenerateEvaluationDraft = (kind, id, user) => repo.regenerateEvaluationDraft(kind, id, user);

export const getTicketBoard = (params, user) => repo.getTicketBoard(params, user);
export const getTicketSummary = (params, user) => repo.getTicketSummary(params, user);
export const getTicketOverview = (params, user) => repo.getTicketOverview(params, user);
// Tổng quan đánh giá các lớp cho PHT / Hiệu trưởng
export const getClassAssessmentOverview = (params, user) => (be || repo).getClassAssessmentOverview(params, user);
export const getClassAssessmentDetail = (params, user) => (be || repo).getClassAssessmentDetail(params, user);
export const issueTickets = (body, user) => repo.issueTickets(body, user);

export const getRewardProposals = (filters, user) => repo.listRewardProposals(filters, user);
export const getRewardProposal = (id, user) => repo.getRewardProposal(id, user);
export const getRewardCandidates = (schoolYear, user) => repo.getRewardCandidates(schoolYear, user);
export const saveRewardProposal = (id, payload, options, user) => repo.saveRewardProposal(id, payload, options, user);
export const deleteRewardProposal = (id, user) => repo.deleteRewardProposal(id, user);
export const reviewRewardProposal = (id, body, user) => repo.reviewRewardProposal(id, body, user);
export const decideRewardProposal = (id, body, user) => repo.decideRewardProposal(id, body, user);
