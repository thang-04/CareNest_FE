import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for child records & child health (not agreed with CareNest_BE yet).
 * Same names and shapes as the mock repository; the backend reads the user's scope from the JWT.
 * Mỗi trẻ trả thêm latestHealth { date, followUpLevel, campaignName, source, knownCondition, resultOn, followUpId,
 * closedWithoutResultOn } để danh sách lọc trẻ theo mức qua mọi đợt (2026-10-17): còn phiếu theo dõi mở ⇒ CLOSE_WATCH
 * (source FOLLOW_UP_OPEN); không thì mục mới hơn giữa lần khám có xếp mức (EXAM; bỏ phiếu nháp, cân đo ngoài đợt) và phiếu
 * đóng có kết quả theo lời bác sĩ (FOLLOW_UP_CLOSED). Mức KNOWN_STABLE "Vấn đề đã biết, ổn định" (2026-10-21).
 * Hành chính, tiền sử (2026-10-17, `models/children/childProfile.js`): child.profile trong GET profile, POST enrollments,
 * PUT /children/{id} (danh sách không trả); declaration.medicalHistory trong PUT health-declaration; file nhập thêm cột.
 * Khai tiếp xúc người bệnh lao ⇒ BE gửi thông báo CHILD_TB_CONTACT. Lưu kết luận phiếu khám ⇒ BE cập nhật ngược 2 phần này.
 */
export const childrenApi = {
  listChildren: (filters) => axiosClient.get('/children', { params: filters }),
  getChildDetail: (id) => axiosClient.get(`/children/${id}/profile`),
  checkDuplicate: (data, _user, excludeId) =>
    axiosClient.get('/children/duplicate-check', { params: { fullName: data.fullName, dateOfBirth: data.dateOfBirth, excludeId } }),
  getPlacementClasses: (filters) => axiosClient.get('/children/placement-classes', { params: filters }),
  enrollChild: (payload) => axiosClient.post('/children/enrollments', payload),
  updateChild: (id, body) => axiosClient.put(`/children/${id}`, body),
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient.post('/children/enrollments/import/preview', form);
  },
  importChildren: (rows) => axiosClient.post('/children/enrollments/import', { rows }),
  placeChild: (childId, body) => axiosClient.post(`/children/${childId}/placement`, body),
  withdrawChild: (childId, body) => axiosClient.post(`/children/${childId}/withdraw`, body),
  saveDeclaration: (childId, body) => axiosClient.put(`/children/${childId}/health-declaration`, body),
  listParentAccounts: (filters) => axiosClient.get('/children/parent-accounts', { params: filters }),
  listParentAccountOptions: (filters) => axiosClient.get('/children/parent-account-options', { params: filters }),
  activateParentAccount: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/activate`),
  resendParentSms: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/resend-sms`),
  getHealthRecord: (childId) => axiosClient.get(`/children/${childId}/health`),
  saveMeasurement: (childId, measurementId, payload) =>
    measurementId
      ? axiosClient.put(`/children/${childId}/health/measurements/${measurementId}`, payload)
      : axiosClient.post(`/children/${childId}/health/measurements`, payload),
  publishMeasurement: (childId, measurementId) => axiosClient.post(`/children/${childId}/health/measurements/${measurementId}/publish`),
  analyzeHealthTrend: (childId) => axiosClient.post(`/children/${childId}/health/trend-analysis`),
};
