import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED Spring Boot contract for the facility module (same names and shapes as the mock repository).
 * The backend takes the current user from the token; the `user` argument is ignored here.
 */
export const facilityApi = {
  listAssets: (filters) => axiosClient.get('/facility/assets', { params: filters }),
  getScopeLocations: () => axiosClient.get('/facility/assets/locations'),
  checkOpenIssue: (assetId, type) => axiosClient.get('/facility/issues/open', { params: { assetId, type } }),
  listIssues: (filters) => axiosClient.get('/facility/issues', { params: filters }),
  getIssue: (id) => axiosClient.get(`/facility/issues/${id}`),
  createIssue: (payload) => axiosClient.post('/facility/issues', payload),
  approveIssue: (id, body) => axiosClient.post(`/facility/issues/${id}/approve`, body),
  rejectIssue: (id, reason) => axiosClient.post(`/facility/issues/${id}/reject`, { reason }),
  listRequests: (filters) => axiosClient.get('/facility/requests', { params: filters }),
  getRequest: (id) => axiosClient.get(`/facility/requests/${id}`),
  createRequest: (payload) => axiosClient.post('/facility/requests', payload),
  approveRequest: (id, note) => axiosClient.post(`/facility/requests/${id}/approve`, { note }),
  rejectRequest: (id, reason) => axiosClient.post(`/facility/requests/${id}/reject`, { reason }),
  forwardRequest: (id, note) => axiosClient.post(`/facility/requests/${id}/forward`, { note }),
  listMyReports: () => axiosClient.get('/facility/my-reports'),
  listProposals: (filters) => axiosClient.get('/facility/proposals', { params: filters }),
  getProposal: (id) => axiosClient.get(`/facility/proposals/${id}`),
  getProposalSources: (_user, proposalId) => axiosClient.get('/facility/proposals/sources', { params: { proposalId } }),
  saveProposalDraft: (id, payload) =>
    id ? axiosClient.put(`/facility/proposals/${id}`, payload) : axiosClient.post('/facility/proposals', payload),
  submitProposal: (id, payload) =>
    id ? axiosClient.post(`/facility/proposals/${id}/submit`, payload) : axiosClient.post('/facility/proposals/submit', payload),
  cancelProposal: (id, reason) => axiosClient.post(`/facility/proposals/${id}/cancel`, { reason }),
  approveProposal: (id, note) => axiosClient.post(`/facility/proposals/${id}/approve`, { note }),
  rejectProposal: (id, reason) => axiosClient.post(`/facility/proposals/${id}/reject`, { reason }),
};
