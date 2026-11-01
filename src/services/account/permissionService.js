import { sourceOf } from '@/services/demoSource';
import { permissionMockRepository as mock } from './mock/permissionMockRepository';
import { permissionApi as api } from './api/permissionApi';

/** Facade màn phân quyền; nguồn theo INTEGRATION_MODULES (api = BE PermissionController). */
const repo = sourceOf('permission', mock, api);
const call = (method, ...args) => repo[method](...args);

export const getPermissionCatalog = (user) => call('getPermissionCatalog', user);
export const getPermissionStaff = (user) => call('getPermissionStaff', user);
export const getRolePermissions = (user) => call('getRolePermissions', user);
export const updateRolePermissions = (role, payload, user) => call('updateRolePermissions', role, payload, user);
export const getPermissionOverrides = (id, user) => call('getPermissionOverrides', id, user);
export const getAccountsWithOverrides = (user) => call('getAccountsWithOverrides', user);
export const updatePermissionOverrides = (id, payload, user) => call('updatePermissionOverrides', id, payload, user);
export const getPermissionChangeLogs = (filters, user) => call('getPermissionChangeLogs', filters, user);
