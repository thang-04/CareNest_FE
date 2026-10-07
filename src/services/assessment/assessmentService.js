import { USE_MOCK } from '@/config/env';
import { assessmentMockRepository as mock } from '@/services/assessment/mock/assessmentMockRepository';
import { assessmentApi as api } from '@/services/assessment/api/assessmentApi';

/** Facade used by hooks / pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getAssessmentCriteria = () => repo.getCriteria();

export const getDailySheet = (params, user) => repo.getDailySheet(params, user);
export const saveDailyAssessments = (body, user) => repo.saveDailyAssessments(body, user);

export const getChildDevelopment = (childId, params, user) => repo.getChildDevelopment(childId, params, user);

export const getEvaluations = (kind, filters, user) => repo.listEvaluations(kind, filters, user);
export const getEvaluation = (kind, id, user) => repo.getEvaluation(kind, id, user);
export const saveEvaluationDraft = (kind, id, content, user) => repo.saveEvaluationDraft(kind, id, content, user);
export const confirmEvaluation = (kind, id, content, user) => repo.confirmEvaluation(kind, id, content, user);
export const regenerateEvaluationDraft = (kind, id, user) => repo.regenerateEvaluationDraft(kind, id, user);

export const getTicketBoard = (params, user) => repo.getTicketBoard(params, user);
export const issueTickets = (body, user) => repo.issueTickets(body, user);

export const getRewardProposals = (filters, user) => repo.listRewardProposals(filters, user);
export const getRewardProposal = (id, user) => repo.getRewardProposal(id, user);
export const getRewardCandidates = (schoolYear, user) => repo.getRewardCandidates(schoolYear, user);
export const saveRewardProposal = (id, payload, options, user) => repo.saveRewardProposal(id, payload, options, user);
export const deleteRewardProposal = (id, user) => repo.deleteRewardProposal(id, user);
export const reviewRewardProposal = (id, body, user) => repo.reviewRewardProposal(id, body, user);
export const decideRewardProposal = (id, body, user) => repo.decideRewardProposal(id, body, user);
