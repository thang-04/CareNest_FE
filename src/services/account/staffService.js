import { USE_MOCK } from '@/config/env';
import { staffMockRepository } from '@/services/account/mock/staffMockRepository';
import { staffApi } from '@/services/account/api/staffApi';

/** Facade quản lý nhân sự: UI chỉ gọi các hàm này. */
const repo = USE_MOCK ? staffMockRepository : staffApi;

export const searchAccounts = (filters, user) => repo.searchAccounts(filters, user);
export const getRoster = (campusId, user) => repo.getRoster(campusId, user);
export const getAccount = (userId, user) => repo.getAccount(userId, user);
export const createAccount = (form, user) => repo.createAccount(form, user);
export const updateAccountStatus = (userId, status, user) => repo.updateAccountStatus(userId, status, user);
export const resetTemporaryPassword = (userId, password, user) => repo.resetTemporaryPassword(userId, password, user);
export const assignStaff = (payload, user) => repo.assignStaff(payload, user);
export const endAssignment = (assignmentId, validTo, user) => repo.endAssignment(assignmentId, validTo, user);
export const getStaffCampuses = (user) => repo.getCampuses(user);
export const getStaffClassrooms = (campusId, user) => repo.getClassrooms(campusId, user);
