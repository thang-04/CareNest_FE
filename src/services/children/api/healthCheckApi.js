import { SCHOOL_NAME } from '@/config/app';
import { axiosClient } from '@/services/http/axiosClient';
import { stringifyIds } from '@/services/http/idStrings';
import { toBeSchoolYear } from '@/services/http/schoolYearIds';

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
 * - Tổng hợp cân đo mẫu 5.1 (2026-11-04, docs/plans/active/2026-11-04-health-growth-report.md): GET /health-checks/growth-report
 *   { month: 'yyyy-MM', campusId? } — HT mọi điểm trường (campusId không có ⇒ 404), PHT điểm trường được giao (khác ⇒ 403), vai
 *   trò khác 403, month thiếu/sai dạng ⇒ 400. Mọi lớp của điểm trường có dòng khi tháng có đợt/kỳ (lớp không có trẻ ⇒ số 0). Trả
 *   { month, campuses: [{ campusId, campusName, campaigns, classes: [{ classId, className, ageGroupName, level, counts }], preschool,
 *   nursery, total }], preschool, nursery, total }; counts = { enrolled, measured, weightNormal, underweight, heightNormal, stunted,
 *   bmiNormal, wasted, overweight, obese, unclassified }.
 * - Kỳ cân đo (user chốt 2026-10-31): kind EXAM | MEASUREMENT (đợt cũ không có ⇒ EXAM); POST nhận kind, PUT không đổi kind. Mỗi điểm
 *   trường 1 đợt/kỳ chưa đóng. GET schedule-warnings { campusId, kind, startDate, excludeId? } trả { warnings: [{ code: TOO_CLOSE |
 *   EXAM_IN_SCHOOL_YEAR, campaignId, name, kind, startDate }] }, không chặn lưu. Danh sách lớp của kỳ: result NOT_RECORDED | RECORDED |
 *   ABSENT.
 */
// BE trả id số; màn và mock dùng id chuỗi (plan 2026-11-11-children-module-be-wiring)
const read = (promise) => promise.then(stringifyIds);
// Số nháp của phiếu khám: BE null, form dùng ô trống như mock
const blankIfNull = (value) => (value == null ? '' : value);

export const healthCheckApi = {
  // Header năm học dùng tên "2026-2027" khi nối BE ⇒ đổi sang id BE
  listHealthChecks: async (filters = {}) =>
    read(axiosClient.get('/health-checks', { params: { ...filters, schoolYear: await toBeSchoolYear(filters.schoolYear) } })),
  getGrowthReport: (params) => read(axiosClient.get('/health-checks/growth-report', { params })),
  scheduleWarnings: (params) => read(axiosClient.get('/health-checks/schedule-warnings', { params })),
  getHealthCheck: (id) => read(axiosClient.get(`/health-checks/${id}`)),
  getHealthCheckClass: (id, classId) => read(axiosClient.get(`/health-checks/${id}/classes/${classId}/children`)),
  createHealthCheck: (payload) => read(axiosClient.post('/health-checks', payload)),
  updateHealthCheck: (id, payload) => read(axiosClient.put(`/health-checks/${id}`, payload)),
  cancelHealthCheck: (id) => read(axiosClient.post(`/health-checks/${id}/cancel`)),
  closeHealthCheck: (id) => read(axiosClient.post(`/health-checks/${id}/close`)),
  reopenHealthCheck: (id, body) => read(axiosClient.post(`/health-checks/${id}/reopen`, body)),
  // BE không trả tên trường của trẻ (mock có child.schoolName): lấy tên trường của ứng dụng
  getHealthExam: (campaignId, childId) =>
    read(axiosClient.get(`/health-checks/${campaignId}/children/${childId}/exam`)).then((view) => ({
      ...view,
      child: view.child && { ...view.child, schoolName: view.child.schoolName || SCHOOL_NAME },
      draft: view.draft && {
        ...view.draft,
        heightCm: blankIfNull(view.draft.heightCm),
        weightKg: blankIfNull(view.draft.weightKg),
        headCircumferenceCm: blankIfNull(view.draft.headCircumferenceCm),
      },
    })),
  saveHealthExam: (campaignId, childId, payload) => read(axiosClient.put(`/health-checks/${campaignId}/children/${childId}/exam`, payload)),
  previewHealthExamReview: (campaignId, childId, payload) =>
    read(axiosClient.post(`/health-checks/${campaignId}/children/${childId}/exam/review-preview`, payload)),
};
