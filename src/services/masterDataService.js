import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { masterDataMockRepository } from '@/mocks/masterDataMockRepository';

/** Master data shared by every module: campuses, locations, users, asset categories. */
const api = {
  getCampuses: () => axiosClient.get('/campuses'),
  getLocations: () => axiosClient.get('/locations'),
  getUsers: () => axiosClient.get('/users'),
  getAssetCategories: () => axiosClient.get('/asset-categories'),
};

const repo = USE_MOCK ? masterDataMockRepository : api;

export const getCampuses = () => repo.getCampuses();
export const getLocations = () => repo.getLocations();
export const getUsers = () => repo.getUsers();
export const getAssetCategories = () => repo.getAssetCategories();
