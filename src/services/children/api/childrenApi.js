import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for child records & child health (not agreed with CareNest_BE yet).
 * Same names and shapes as the mock repository; the backend reads the user's scope from the JWT.
 * Mỗi trẻ trả thêm latestHealth { date, followUpLevel, campaignName } của lần khám gần nhất có xếp mức (bỏ phiếu nháp,
 * cân đo ngoài đợt) để danh sách lọc trẻ "Cần theo dõi" qua mọi đợt (2026-10-17).
 * Hành chính, tiền sử (2026-10-17, `models/children/childProfile.js`): child.profile trong GET profile, POST enrollments,
 * PUT /children/{id} (danh sách không trả); declaration.medicalHistory trong PUT health-declaration; file nhập thêm cột.
 * Khai tiếp xúc người bệnh lao ⇒ BE gửi thông báo CHILD_TB_CONTACT. Lưu kết luận phiếu khám ⇒ BE cập nhật ngược 2 phần này.
 */
const PAGE_SIZE = 100;

/**
 * BE:ChildController.searchChildren (G94-60) trả trang {items, totalPages}, tối đa 100 trẻ/trang, chỉ lọc campusId,
 * classroomId, q. Màn hình cần cả danh sách ⇒ đọc hết các trang, đổi classroomId → classId như mock.
 */
export async function listAllChildren(filters = {}) {
  const params = Object.fromEntries(
    Object.entries({ campusId: filters.campusId, classroomId: filters.classId, q: filters.keyword }).filter(([, v]) => v),
  );
  const items = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await axiosClient.get('/children', { params: { ...params, page, size: PAGE_SIZE } });
    // Bản cũ (mảng) vẫn đọc được
    if (Array.isArray(result)) return result;
    items.push(...(result?.items || []));
    totalPages = result?.totalPages || 0;
    page++;
  } while (page < totalPages);
  // DTO chỉ có guardianCount, chưa có mã, trạng thái, giới tính, tên lớp, sức khỏe: để trống, không đoán
  return items.map((child) => ({ ...child, classId: child.classId ?? child.classroomId, guardians: child.guardians || [] }));
}

export const childrenApi = {
  listChildren: (filters) => listAllChildren(filters),
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
