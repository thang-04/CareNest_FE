import { axiosClient } from '@/services/http/axiosClient';

/** Phân quyền — contract: BE:docs/contracts/AUTH_CONTRACT.md mục "Phân quyền cấu hình được". */
export const permissionApi = {
  getPermissionCatalog: () => axiosClient.get('/permissions'),
  getRolePermissions: () => axiosClient.get('/role-permissions'),
  updateRolePermissions: (role, { permissions, reason }) =>
    axiosClient.put(`/role-permissions/${encodeURIComponent(role)}`, { permissions, reason }),
  getPermissionOverrides: (userId) => axiosClient.get(`/accounts/${encodeURIComponent(userId)}/permission-overrides`),
  updatePermissionOverrides: (userId, { overrides, reason }) =>
    axiosClient.put(`/accounts/${encodeURIComponent(userId)}/permission-overrides`, { overrides, reason }),
  getAccountsWithOverrides: () => axiosClient.get('/permission-overrides').catch(() => []),
  getPermissionChangeLogs: ({ targetRole, targetUserId, page = 0, size = 20 } = {}) =>
    axiosClient.get('/permission-change-logs', {
      params: { targetRole: targetRole || undefined, targetUserId: targetUserId || undefined, page, size },
    }),
};
