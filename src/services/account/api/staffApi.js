import { axiosClient } from '@/services/http/axiosClient';

/** Nhân sự — contract: BE:docs/contracts/AUTH_CONTRACT.md (cấp/khóa tài khoản, danh sách, phân công, campus/lớp). */
export const staffApi = {
  searchAccounts: ({ role, status, campusId, q, staffOnly = false, page = 0, size = 20 } = {}) =>
    axiosClient.get('/accounts', {
      params: {
        role: role || undefined,
        status: status || undefined,
        campusId: campusId || undefined,
        q: q || undefined,
        staffOnly: staffOnly || undefined,
        page,
        size,
      },
    }),
  getRoster: (campusId) => axiosClient.get('/staff-assignments/roster', { params: { campusId } }),
  getAccount: (userId) => axiosClient.get(`/accounts/${encodeURIComponent(userId)}`),
  createAccount: (form) => {
    const assignment =
      form.campusId || form.classroomId
        ? { campusId: form.campusId || null, classroomId: form.classroomId || null, validFrom: form.validFrom || null }
        : null;
    return axiosClient.post('/accounts', {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      email: form.email?.trim() || null,
      role: form.role,
      temporaryPassword: form.temporaryPassword || null, // carenest:allow-secret
      assignment,
    });
  },
  updateAccountStatus: (userId, status) => axiosClient.patch(`/accounts/${encodeURIComponent(userId)}/status`, { status }),
  resetTemporaryPassword: (userId, temporaryPassword) =>
    axiosClient.post(`/accounts/${encodeURIComponent(userId)}/temporary-password`, { temporaryPassword }),
  assignStaff: (payload) => axiosClient.post('/staff-assignments', payload),
  endAssignment: (assignmentId, validTo) => axiosClient.patch(`/staff-assignments/${encodeURIComponent(assignmentId)}/end`, { validTo }),
  getCampuses: () => axiosClient.get('/campuses'),
  getClassrooms: (campusId) => axiosClient.get('/classrooms', { params: { campusId } }),
};
