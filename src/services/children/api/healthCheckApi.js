import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract cho đợt khám sức khỏe và phiếu theo dõi (chưa thống nhất với CareNest_BE — plan
 * docs/plans/completed/2026-10-15-health-check-campaign-assessment.md, phiếu dài hạn ở
 * docs/plans/completed/2026-10-16-health-follow-up-long-lived.md). Cùng tên, cùng dạng với mock; BE đọc scope từ JWT.
 * Phiếu ghi được nhiều lần trao đổi và nhiều kết quả khám bên ngoài nên dùng tài nguyên số nhiều.
 * Phiếu khám Phụ lục II (docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md): 1 phiếu/trẻ/đợt, PUT lưu nháp
 * (conclude=false) hoặc lưu kết luận (conclude=true, sửa phiếu đã kết luận cần reason). Kết quả khám bên ngoài thêm facility, images[].
 * Trẻ đang có phiếu theo dõi (docs/plans/completed/2026-10-21-health-follow-up-close-outcome.md): GET exam trả conclusionMode
 * (STANDARD | FOLLOW_UP) và openFollowUp; PUT exam gửi lại conclusionMode (khác ⇒ 409) và exam.conclusion.followUpFinding
 * (NO_NEW_FINDING | ADVICE | NEW_FINDING) hoặc issueKind (NEW | KNOWN). Lưu kết luận không đóng phiếu. Dòng thời gian có
 * MEASUREMENT_ADDED { newFinding }. POST close nhận { outcome (DOCTOR_NORMAL | KNOWN_CONDITION | NO_SPECIALIST_RESULT),
 * conditionText?, reason }; phiếu trả closeOutcome, closeConditionText, closeOutcomeOptions[]. KNOWN_CONDITION ⇒ BE ghi tiền sử bản thân.
 * Phần I (docs/plans/completed/2026-10-22-exam-admin-from-profile.md): BE điền exam.admin (trừ người đi cùng) từ hồ sơ trẻ,
 * bỏ qua giá trị client gửi; phiếu đã kết luận giữ bản chụp. Người đi cùng: client gửi hasCompanion + companion.guardianIndex,
 * BE chép chi tiết từ phụ huynh của hồ sơ; thiếu/sai ⇒ 422 exam.admin.companion. exam.history client gửi (điền sẵn từ khai báo);
 * lưu kết luận ⇒ BE cập nhật declaration.medicalHistory, có lịch sử; đổi ngày tiếp xúc lao ⇒ CHILD_TB_CONTACT_DATE_CHANGED.
 * previous (danh sách lớp, phiếu khám; 2026-10-22): lần khám trong đợt gần nhất trước ngày khám, không tính phiếu nháp và cân đo
 * ngoài đợt của giáo viên.
 * Công bố (2026-10-23, docs/plans/completed/2026-10-23-auto-publish-health-results.md): lưu kết luận (kể cả lưu lại sau sửa) ⇒ BE công bố
 * ngay; nháp không công bố. exam.conclusion.parentOpinion (≤500) bắt buộc khi có người đi cùng và kết luận mức Cần theo dõi sát
 * (422 exam.conclusion.parentOpinion), BE ghi vào lần trao đổi tại buổi khám; measurement trả parentContact.
 * Năm học (user chốt 2026-10-28, Y-4): GET /health-checks và /health-follow-ups nhận schoolYear (năm chọn ở header). Đợt khám thuộc
 * năm học của ngày bắt đầu (ngày thuộc năm gần nhất đã bắt đầu, hè tính vào năm vừa qua). Phiếu theo dõi đang mở luôn trả; phiếu đã
 * đóng trả khi khoảng mở–đóng giao năm đó; counts tính trên cùng phạm vi.
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
  previewHealthExamReview: (campaignId, childId, payload) =>
    axiosClient.post(`/health-checks/${campaignId}/children/${childId}/exam/review-preview`, payload),
  listHealthFollowUps: (filters) => axiosClient.get('/health-follow-ups', { params: filters }),
  getHealthFollowUp: (id) => axiosClient.get(`/health-follow-ups/${id}`),
  recordFollowUpContact: (id, body) => axiosClient.post(`/health-follow-ups/${id}/parent-contacts`, body),
  recordFollowUpExternalResult: (id, body) => axiosClient.post(`/health-follow-ups/${id}/external-results`, body),
  closeFollowUp: (id, body) => axiosClient.post(`/health-follow-ups/${id}/close`, body),
};
