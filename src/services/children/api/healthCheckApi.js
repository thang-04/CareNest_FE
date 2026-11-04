import { axiosClient } from '@/services/http/axiosClient';

/**
 * Contract đợt khám sức khỏe, kỳ cân đo, phiếu khám Phụ lục II (BE sở hữu: `BE:docs/modules/health.md`; mock cùng tên, cùng dạng).
 * BE đọc scope từ JWT. Plan gốc: docs/plans/completed/2026-10-15-health-check-campaign-assessment.md,
 * docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md, docs/plans/completed/2026-10-31-health-measurement-rounds.md.
 * - Phiếu khám: 1 phiếu/trẻ/đợt; PUT lưu nháp (conclude=false) hoặc lưu kết luận (conclude=true; sửa phiếu đã kết luận cần reason).
 *   Request không có date (2026-11-04): BE ghi ngày khám — phiếu đã có giữ ngày, phiếu mới = hôm nay kẹp vào [startDate, endDate];
 *   GET trả draft.date (ngày sẽ ghi) để hiện. Trùng ngày đo khác ⇒ 422 date.
 *   BE điền exam.admin (trừ người đi cùng) từ hồ sơ trẻ; client gửi hasCompanion + companion.guardianIndex (sai ⇒ 422
 *   exam.admin.companion). Lưu kết luận ⇒ BE cập nhật declaration.medicalHistory, công bố ngay; nháp không công bố.
 *   exam.conclusion.parentOpinion (≤500) bắt buộc khi có người đi cùng và kết luận mức Cần theo dõi sát (422).
 * - GET exam trả conclusionMode: STANDARD, trừ phiếu đã kết luận theo mẫu FOLLOW_UP trước 2026-11-04 (giữ mẫu khi xem/sửa;
 *   exam.conclusion.followUpFinding NO_NEW_FINDING | ADVICE | NEW_FINDING); PUT gửi lại conclusionMode (khác ⇒ 409). Không còn
 *   knownCondition và câu issueKind (bỏ 2026-11-04; phiếu cũ đã trả lời giữ issueKind khi sửa). previous: lần khám trong đợt gần
 *   nhất trước ngày khám (không tính phiếu nháp, số đo của kỳ cân đo).
 * - Cảnh báo (2026-11-04, plan docs/plans/active/2026-11-04-health-warnings-book.md; HLT-16 bỏ, HLT-18, HLT-19): không còn phiếu
 *   theo dõi, không còn /health-follow-ups. progress (danh sách, chi tiết) có watch, closeWatch theo kết luận bác sĩ và
 *   bmi { severeThinness, thinness, overweightRisk, overweight, obese } (số trẻ theo mức BMI của kỳ cân đo; đợt khám luôn 0).
 *   Chi tiết: classes[].bmiWarning; watchList = trẻ cần chú ý (đợt khám: WATCH/CLOSE_WATCH, theo dõi sát trước; kỳ cân đo: bmiStatus
 *   khác NORMAL, gầy còm nặng/béo phì trước, rồi gầy còm/thừa cân, rồi nguy cơ thừa cân; cùng mức theo tên). Dòng trẻ có bmi,
 *   bmiStatus (chỉ kỳ cân đo).
 * - Năm học (user chốt 2026-10-28, Y-4): GET /health-checks nhận schoolYear; đợt thuộc năm học của ngày bắt đầu.
 * - Kỳ cân đo (user chốt 2026-10-31): kind EXAM | MEASUREMENT (đợt cũ không có ⇒ EXAM); POST nhận kind, PUT không đổi kind. Mỗi điểm
 *   trường 1 đợt/kỳ chưa đóng. GET schedule-warnings { campusId, kind, startDate, excludeId? } trả { warnings: [{ code: TOO_CLOSE |
 *   EXAM_IN_SCHOOL_YEAR, campaignId, name, kind, startDate }] }, không chặn lưu. Danh sách lớp của kỳ: result NOT_RECORDED | RECORDED |
 *   ABSENT.
 */
export const healthCheckApi = {
  listHealthChecks: (filters) => axiosClient.get('/health-checks', { params: filters }),
  scheduleWarnings: (params) => axiosClient.get('/health-checks/schedule-warnings', { params }),
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
};
