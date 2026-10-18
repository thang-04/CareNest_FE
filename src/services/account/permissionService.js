import { USE_MOCK } from '@/config/env';
import { permissionMockRepository } from '@/services/account/mock/permissionMockRepository';
import { permissionApi } from '@/services/account/api/permissionApi';

/** Facade phân quyền: UI chỉ gọi các hàm này. */
const repo = USE_MOCK ? permissionMockRepository : permissionApi;

export const getPermissionCatalog = (user) => repo.getPermissionCatalog(user);
export const getRolePermissions = (user) => repo.getRolePermissions(user);
export const updateRolePermissions = (role, payload, user) => repo.updateRolePermissions(role, payload, user);
export const getPermissionOverrides = (userId, user) => repo.getPermissionOverrides(userId, user);
export const getAccountsWithOverrides = (user) => repo.getAccountsWithOverrides(user);
export const updatePermissionOverrides = (userId, payload, user) => repo.updatePermissionOverrides(userId, payload, user);
export const getPermissionChangeLogs = (filters, user) => repo.getPermissionChangeLogs(filters, user);
