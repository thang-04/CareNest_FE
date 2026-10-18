import { axiosClient } from '@/services/http/axiosClient';

/** Tài khoản phụ huynh — contract: BE:docs/contracts/AUTH_CONTRACT.md mục "Tài khoản phụ huynh gắn trẻ". */
export const guardianApi = {
  searchChildren: ({ campusId, classroomId, q, page = 0, size = 20 } = {}) =>
    axiosClient.get('/children', {
      params: { campusId: campusId || undefined, classroomId: classroomId || undefined, q: q || undefined, page, size },
    }),
  listGuardians: (childId) => axiosClient.get(`/children/${encodeURIComponent(childId)}/guardians`),
  addGuardian: (childId, { phone, fullName, relationship }) =>
    axiosClient.post(`/children/${encodeURIComponent(childId)}/guardians`, { phone, fullName: fullName.trim(), relationship }),
  removeGuardian: (childId, userId) =>
    axiosClient.delete(`/children/${encodeURIComponent(childId)}/guardians/${encodeURIComponent(userId)}`),
  updateParentStatus: (userId, status) => axiosClient.patch(`/parent-accounts/${encodeURIComponent(userId)}/status`, { status }),
  resetParentPassword: (userId) => axiosClient.post(`/parent-accounts/${encodeURIComponent(userId)}/temporary-password`),
};
