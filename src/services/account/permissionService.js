import { USE_MOCK } from '@/config/env';
import { permissionMockRepository as mock } from './mock/permissionMockRepository';

const call = (method, ...args) =>
  USE_MOCK
    ? mock[method](...args)
    : Promise.reject({ status: 501, message: 'Màn phân quyền này chỉ là demo; cần thống nhất contract BE.' });

export const getPermissionCatalog = (user) => call('getPermissionCatalog', user);
export const getPermissionStaff = (user) => call('getPermissionStaff', user);
export const getRolePermissions = (user) => call('getRolePermissions', user);
export const updateRolePermissions = (role, payload, user) => call('updateRolePermissions', role, payload, user);
export const getPermissionOverrides = (id, user) => call('getPermissionOverrides', id, user);
export const getAccountsWithOverrides = (user) => call('getAccountsWithOverrides', user);
export const updatePermissionOverrides = (id, payload, user) => call('updatePermissionOverrides', id, payload, user);
export const getPermissionChangeLogs = (filters, user) => call('getPermissionChangeLogs', filters, user);
