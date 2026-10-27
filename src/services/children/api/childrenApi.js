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
 * Khai tiếp xúc người bệnh lao ⇒ BE gửi thông báo CHILD_TB_CONTACT (cả người lưu, 2026-10-27). Từ 2026-10-22: bắt buộc trừ idNumber, bloodType (422 theo ô
 * profile.x, medicalHistory.x khác NOT_PROVIDED); phiếu khám không sửa hành chính, tiền sử sửa ở phiếu thì lưu kết luận BE cập nhật
 * vào khai báo; PUT health-declaration thêm Hiệu trưởng.
 * CCCD phụ huynh (2026-10-21): guardians[].idNumber (12 chữ số, bắt buộc) trong POST enrollments, PUT /children/{id}, file nhập
 * (cột "Số CCCD phụ huynh") và mọi response có guardians; parent-account-options trả idNumber; trùng phụ huynh khác ⇒ 409 + details.
 * Ngày tiếp xúc người bệnh lao (2026-10-21): medicalHistory.tbContact.contactDate bắt buộc khi REPORTED (PUT health-declaration,
 * POST enrollments, file nhập); đổi ngày đã có ⇒ BE gửi CHILD_TB_CONTACT_DATE_CHANGED cho Hiệu trưởng, Phó hiệu trưởng điểm trường và người lưu (2026-10-27).
 * Phụ huynh theo CCCD (2026-10-23, docs/plans/completed/2026-10-23-guardian-identity-by-citizen-id.md): GET by-citizen-id trả tài khoản
 * { id, fullName, phone, idNumber, email, status, children[], otherChildrenCount, relation } | null; POST enrollments, PUT /children/{id}, import:
 * idNumber trùng tài khoản ⇒ BE dùng họ tên/SĐT/email của tài khoản và liên kết trẻ (bỏ accountId, parent-account-options); SĐT trùng
 * phụ huynh có CCCD khác ⇒ 409 guardians.i.phone.
 * Công bố (2026-10-23, docs/plans/completed/2026-10-23-auto-publish-health-results.md): lưu/sửa cân đo ⇒ BE công bố ngay
 * (published, publishedAt), sửa thì gửi phụ huynh thông báo cập nhật; bỏ POST .../measurements/{id}/publish và publishBlockedReason.
 * Phiếu khám mức Cần theo dõi sát trả parentContact { contacted, atExam, on, opinion } | null.
 * Trùng hồ sơ (2026-10-23): cùng họ tên (giữ dấu), ngày sinh và CCCD của ít nhất một phụ huynh; duplicate-check nhận thêm
 * guardianIdNumbers, trả { kind: ACTIVE | LEFT, sameCampus, id?, code?, fullName?, leftAt?, canReadmit? } | null; LEFT ⇒ gợi ý
 * POST /children/{id}/readmit { reason } (về PENDING_PLACEMENT, giữ hồ sơ cũ). Enrollment/PUT/import 409 theo quy tắc mới.
 */
export const childrenApi = {
  listChildren: (filters) => axiosClient.get('/children', { params: filters }),
  getChildDetail: (id) => axiosClient.get(`/children/${id}/profile`),
  checkDuplicate: (data, _user, excludeId) =>
    axiosClient.get('/children/duplicate-check', {
      params: {
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        guardianIdNumbers: (data.guardianIdNumbers || []).join(','),
        excludeId,
      },
    }),
  readmitChild: (childId, body) => axiosClient.post(`/children/${childId}/readmit`, body),
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
  findParentAccountByCitizenId: (idNumber) => axiosClient.get('/children/parent-accounts/by-citizen-id', { params: { idNumber } }),
  activateParentAccount: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/activate`),
  resendParentSms: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/resend-sms`),
  getHealthRecord: (childId) => axiosClient.get(`/children/${childId}/health`),
  saveMeasurement: (childId, measurementId, payload) =>
    measurementId
      ? axiosClient.put(`/children/${childId}/health/measurements/${measurementId}`, payload)
      : axiosClient.post(`/children/${childId}/health/measurements`, payload),
  analyzeHealthTrend: (childId) => axiosClient.post(`/children/${childId}/health/trend-analysis`),
};
