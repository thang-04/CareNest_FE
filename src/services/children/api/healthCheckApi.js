import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract cho đợt khám sức khỏe và phiếu theo dõi (chưa thống nhất với CareNest_BE — plan
 * docs/plans/completed/2026-10-15-health-check-campaign-assessment.md, phiếu dài hạn ở
 * docs/plans/completed/2026-10-16-health-follow-up-long-lived.md). Cùng tên, cùng dạng với mock; BE đọc scope từ JWT.
 * Phiếu ghi được nhiều lần trao đổi và nhiều kết quả khám bên ngoài nên dùng tài nguyên số nhiều.
 * Phiếu khám Phụ lục II (docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md): 1 phiếu/trẻ/đợt, PUT lưu nháp
 * (conclude=false) hoặc lưu kết luận (conclude=true, sửa phiếu đã kết luận cần reason). Kết quả khám bên ngoài thêm facility, images[].
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
  getHealthExam: (campaignId, childId) => axiosClient.get(`/health-checks/${campaignId}/children/${childId}/exam`),
  saveHealthExam: (campaignId, childId, payload) => axiosClient.put(`/health-checks/${campaignId}/children/${childId}/exam`, payload),
  listHealthFollowUps: (filters) => axiosClient.get('/health-follow-ups', { params: filters }),
  getHealthFollowUp: (id) => axiosClient.get(`/health-follow-ups/${id}`),
  recordFollowUpContact: (id, body) => axiosClient.post(`/health-follow-ups/${id}/parent-contacts`, body),
  recordFollowUpExternalResult: (id, body) => axiosClient.post(`/health-follow-ups/${id}/external-results`, body),
  closeFollowUp: (id, body) => axiosClient.post(`/health-follow-ups/${id}/close`, body),
};
