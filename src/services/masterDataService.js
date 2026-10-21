import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { masterDataMockRepository } from '@/mocks/masterDataMockRepository';

/** Master data shared by every module: campuses, locations, users, asset categories. */
const api = {
  getCampuses: () => axiosClient.get('/campuses'),
  getLocations: () => axiosClient.get('/locations'),
  getUsers: () => axiosClient.get('/users'),
  getAssetCategories: () => axiosClient.get('/asset-categories'),
  // PENDING BE: quản lý phòng học (đề xuất 10/10/2026, ngoài SRS)
  getRooms: (filters) => axiosClient.get('/locations', { params: { ...filters, withUsage: true } }),
  saveRoom: (id, form) => (id ? axiosClient.put(`/locations/${id}`, form) : axiosClient.post('/locations', form)),
  setRoomStatus: (id, status) => axiosClient.patch(`/locations/${id}/status`, { status }),
  // BE xóa mềm (status DELETED), giữ bản ghi cho lịch sử
  deleteRoom: (id) => axiosClient.delete(`/locations/${id}`),
};

const repo = USE_MOCK ? masterDataMockRepository : api;

export const getCampuses = () => repo.getCampuses();
export const getLocations = () => repo.getLocations();
export const getUsers = () => repo.getUsers();
export const getAssetCategories = () => repo.getAssetCategories();

/** Rooms (= locations) management, Principal only. */
export const getRooms = (filters, user) => repo.getRooms(filters, user);
export const saveRoom = (id, form, user) => repo.saveRoom(id, form, user);
export const setRoomStatus = (id, status, user) => repo.setRoomStatus(id, status, user);
export const deleteRoom = (id, user) => repo.deleteRoom(id, user);
