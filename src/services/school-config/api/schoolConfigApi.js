import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT, so `user` is ignored.
 */
export const schoolConfigApi = {
  getSchoolYears: () => axiosClient.get('/school-years'),
  getSchoolYearById: (id) => axiosClient.get(`/school-years/${id}`),
  saveSchoolYear: (id, form) => (id ? axiosClient.put(`/school-years/${id}`, form) : axiosClient.post('/school-years', form)),
  // PENDING BE: kích hoạt kiểm tra lại các bước bắt buộc, áp dụng bản xếp lớp; payload { confirmName }
  activateSchoolYear: (id, payload) => axiosClient.post(`/school-years/${id}/activate`, payload),
  // PENDING BE: các bước chuẩn bị năm học và điều kiện kích hoạt
  getYearReadiness: (id) => axiosClient.get(`/school-years/${id}/readiness`),
  // PENDING BE: xếp lớp năm học mới (lên lớp / ở lại / nghỉ / ra trường)
  getPlacements: (yearId) => axiosClient.get(`/school-years/${yearId}/placements`),
  savePlacements: (yearId, payload) => axiosClient.put(`/school-years/${yearId}/placements`, payload),
  // PENDING BE: phạm vi tùy chọn { campusId, ageGroupId } = chỉ xếp các lớp năm cũ đang lọc trên màn hình
  autoPlace: (yearId, _user, scope = {}) => axiosClient.post(`/school-years/${yearId}/placements/auto`, scope),
  closeSchoolYear: (id) => axiosClient.post(`/school-years/${id}/close`),
  deleteSchoolYear: (id) => axiosClient.delete(`/school-years/${id}`),

  getStructure: (filters) => axiosClient.get('/school-structure', { params: filters }),
  getAgeGroups: () => axiosClient.get('/age-groups'),
  // PENDING BE: nhóm tuổi gửi mealSessions (MORNING | LUNCH | AFTERNOON), mealsPerDay = số phần tử
  saveAgeGroup: (id, form) => (id ? axiosClient.put(`/age-groups/${id}`, form) : axiosClient.post('/age-groups', form)),
  deleteAgeGroup: (id) => axiosClient.delete(`/age-groups/${id}`),
  saveClass: (id, form) => (id ? axiosClient.put(`/classes/${id}`, form) : axiosClient.post('/classes', form)),
  deleteClass: (id) => axiosClient.delete(`/classes/${id}`),
  // PENDING BE: sao chép lớp từ năm học khác (chỉ tên, nhóm tuổi, điểm trường, phòng, sĩ số)
  copyClasses: (targetYearId, payload) => axiosClient.post(`/school-years/${targetYearId}/classes/copy`, payload),

  getCutoffSetting: (schoolYear) => axiosClient.get(`/school-years/${schoolYear}/cutoff`),
  saveCutoffSetting: (schoolYear, form) => axiosClient.put(`/school-years/${schoolYear}/cutoff`, form),

  getCampuses: (schoolYear) => axiosClient.get('/campuses', { params: { schoolYear, withStats: true } }),
  getCampusDetail: (id, schoolYear) => axiosClient.get(`/campuses/${id}`, { params: { schoolYear } }),
  saveCampus: (id, form) => (id ? axiosClient.put(`/campuses/${id}`, form) : axiosClient.post('/campuses', form)),
  deleteCampus: (id) => axiosClient.delete(`/campuses/${id}`),

  // PENDING BE: tài khoản nhân sự (đổi vai trò / điểm trường kết thúc phân công cũ ngay, giữ lịch sử)
  getStaffAccounts: () => axiosClient.get('/users', { params: { staff: true } }),
  getStaffImpact: (id, form) => axiosClient.get(`/users/${id}/role-change-impact`, { params: form }),
  saveStaffAccount: (id, form) => (id ? axiosClient.put(`/users/${id}`, form) : axiosClient.post('/users', form)),
  // PENDING BE: sửa thông tin hồ sơ nhân sự theo quyền PHT (không đổi vai trò / điểm trường / trạng thái)
  updateStaffProfile: (id, form) => axiosClient.patch(`/users/${id}/profile`, form),
  setStaffStatus: (id, status, reason) => axiosClient.patch(`/users/${id}/status`, { status, reason }),
  getViceAssignments: (schoolYear) => axiosClient.get(`/school-years/${schoolYear}/vice-principal-assignments`),
  saveViceAssignment: (schoolYear, userId, form) =>
    axiosClient.put(`/school-years/${schoolYear}/vice-principal-assignments/${userId}`, form),

  getTeacherAssignments: (filters) => axiosClient.get('/teacher-assignments', { params: filters }),
  saveClassTeachers: (classId, form) => axiosClient.put(`/classes/${classId}/teachers`, form),
  // PENDING BE: tổ trưởng 1 người / nhóm tuổi / năm học cho cả trường (không còn campusId trong payload)
  saveTeamLeader: (payload) => axiosClient.put('/team-leader-assignments', payload),
  getTeamLeaders: (filters) => axiosClient.get('/team-leader-assignments', { params: filters }),

  getRolePermissions: () => axiosClient.get('/role-permissions'),
  saveRolePermissions: (role, payload) => axiosClient.put(`/role-permissions/${role}`, payload),
};
