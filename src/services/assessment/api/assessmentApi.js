import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for the assessment module (same names / shapes as the mock).
 * Not agreed with CareNest_BE yet. The user is read from the JWT, so `user` arguments are ignored here.
 */
export const assessmentApi = {
  getCriteria: () => axiosClient.get('/assessment/criteria'),

  getDailySheet: (params) => axiosClient.get('/assessment/daily-sheet', { params }),
  saveDailyAssessments: (body) => axiosClient.put('/assessment/daily-assessments', body),

  getChildDevelopment: (childId, params) => axiosClient.get(`/assessment/children/${childId}/development`, { params }),

  listEvaluations: (kind, params) => axiosClient.get(`/assessment/evaluations/${kind}`, { params }),
  getEvaluation: (kind, id) => axiosClient.get(`/assessment/evaluations/${kind}/${id}`),
  saveEvaluationDraft: (kind, id, content) => axiosClient.put(`/assessment/evaluations/${kind}/${id}/content`, { content }),
  confirmEvaluation: (kind, id, content) => axiosClient.post(`/assessment/evaluations/${kind}/${id}/confirm`, { content }),
  regenerateEvaluationDraft: (kind, id) => axiosClient.post(`/assessment/evaluations/${kind}/${id}/ai-draft`),

  getTicketBoard: (params) => axiosClient.get('/assessment/behaviour-tickets/board', { params }),
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
