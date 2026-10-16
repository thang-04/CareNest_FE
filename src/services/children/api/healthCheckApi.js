import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract cho đợt khám sức khỏe (chưa thống nhất với CareNest_BE — plan
 * docs/plans/completed/2026-10-15-health-check-campaign-assessment.md). Cùng tên, cùng dạng với mock; BE đọc scope từ JWT.
 */
export const healthCheckApi = {
  listHealthChecks: (filters) => axiosClient.get('/health-checks', { params: filters }),
  getHealthCheck: (id) => axiosClient.get(`/health-checks/${id}`),
  getHealthCheckClass: (id, classId) => axiosClient.get(`/health-checks/${id}/classes/${classId}/children`),
  createHealthCheck: (payload) => axiosClient.post('/health-checks', payload),
  updateHealthCheck: (id, payload) => axiosClient.put(`/health-checks/${id}`, payload),
  cancelHealthCheck: (id) => axiosClient.post(`/health-checks/${id}/cancel`),
  closeHealthCheck: (id) => axiosClient.post(`/health-checks/${id}/close`),
  reopenHealthCheck: (id, body) => axiosClient.post(`/health-checks/${id}/reopen`, body),
  listHealthFollowUps: (filters) => axiosClient.get('/health-follow-ups', { params: filters }),
  getHealthFollowUp: (id) => axiosClient.get(`/health-follow-ups/${id}`),
  recordFollowUpContact: (id, body) => axiosClient.post(`/health-follow-ups/${id}/parent-contact`, body),
  recordFollowUpExternalResult: (id, body) => axiosClient.post(`/health-follow-ups/${id}/external-result`, body),
  closeFollowUp: (id, body) => axiosClient.post(`/health-follow-ups/${id}/close`, body),
};
