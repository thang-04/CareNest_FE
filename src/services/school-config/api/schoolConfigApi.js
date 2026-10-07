import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT, so `user` is ignored.
 */
export const schoolConfigApi = {
  getSchoolYears: () => axiosClient.get('/school-years'),
  getSchoolYearById: (id) => axiosClient.get(`/school-years/${id}`),
  saveSchoolYear: (id, form) => (id ? axiosClient.put(`/school-years/${id}`, form) : axiosClient.post('/school-years', form)),
  activateSchoolYear: (id) => axiosClient.post(`/school-years/${id}/activate`),
  closeSchoolYear: (id) => axiosClient.post(`/school-years/${id}/close`),
  deleteSchoolYear: (id) => axiosClient.delete(`/school-years/${id}`),

  getStructure: (filters) => axiosClient.get('/school-structure', { params: filters }),
  getAgeGroups: () => axiosClient.get('/age-groups'),
  saveAgeGroup: (id, form) => (id ? axiosClient.put(`/age-groups/${id}`, form) : axiosClient.post('/age-groups', form)),
  deleteAgeGroup: (id) => axiosClient.delete(`/age-groups/${id}`),
  saveClass: (id, form) => (id ? axiosClient.put(`/classes/${id}`, form) : axiosClient.post('/classes', form)),
  deleteClass: (id) => axiosClient.delete(`/classes/${id}`),

  getCutoffSetting: (schoolYear) => axiosClient.get(`/school-years/${schoolYear}/cutoff`),
  saveCutoffSetting: (schoolYear, form) => axiosClient.put(`/school-years/${schoolYear}/cutoff`, form),

  getCampuses: (schoolYear) => axiosClient.get('/campuses', { params: { schoolYear, withStats: true } }),
  getCampusDetail: (id, schoolYear) => axiosClient.get(`/campuses/${id}`, { params: { schoolYear } }),
  saveCampus: (id, form) => (id ? axiosClient.put(`/campuses/${id}`, form) : axiosClient.post('/campuses', form)),
  deleteCampus: (id) => axiosClient.delete(`/campuses/${id}`),

  getViceAssignments: (schoolYear) => axiosClient.get(`/school-years/${schoolYear}/vice-principal-assignments`),
  saveViceAssignment: (schoolYear, userId, form) =>
    axiosClient.put(`/school-years/${schoolYear}/vice-principal-assignments/${userId}`, form),

  getTeacherAssignments: (filters) => axiosClient.get('/teacher-assignments', { params: filters }),
  saveClassTeachers: (classId, form) => axiosClient.put(`/classes/${classId}/teachers`, form),
  saveTeamLeader: (payload) => axiosClient.put('/team-leader-assignments', payload),

  getRolePermissions: () => axiosClient.get('/role-permissions'),
  saveRolePermissions: (role, payload) => axiosClient.put(`/role-permissions/${role}`, payload),
};
