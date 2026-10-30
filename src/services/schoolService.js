import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { schoolMockRepository } from '@/mocks/schoolMockRepository';
import { getAgeGroups as getConfiguredAgeGroups } from '@/services/school-config/schoolConfigService';
import { listAllChildren } from '@/services/children/api/childrenApi';

/**
 * Shared read access to the school structure (classes, children) for every module.
 * Visibility follows the signed-in user's role and assignment (the API reads it from the JWT).
 * PROPOSED endpoints – not agreed with CareNest_BE yet.
 */
const api = {
  getClasses: (filters) => axiosClient.get('/classes', { params: filters }),
  getClassById: (id) => axiosClient.get(`/classes/${id}`),
  getChildren: (filters) => listAllChildren(filters),
  getChildById: (id) => axiosClient.get(`/children/${id}`),
};

const repo = USE_MOCK ? schoolMockRepository : api;

export const getClasses = (filters, user) => repo.getClasses(filters, user);
export const getClassById = (id, user) => repo.getClassById(id, user);
export const getChildren = (filters, user) => repo.getChildren(filters, user);
export const getChildById = (id, user) => repo.getChildById(id, user);

/** Nhóm tuổi theo cấu hình trường (đọc chung cho mọi module, vd. chọn lớp theo nhóm tuổi). */
export const getAgeGroups = () => getConfiguredAgeGroups();
