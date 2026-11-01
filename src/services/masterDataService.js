import { SCHOOL_CONFIG_API } from '@/config/env';
import { sourceOf } from '@/services/demoSource';
import { beClient } from '@/services/http/beClient';
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

const repo = sourceOf('master-data', masterDataMockRepository, api);
// BE chưa có GET /users, /asset-categories ⇒ danh bạ người dùng, danh mục tài sản lấy dữ liệu demo
const usersRepo = sourceOf('master-data-users', masterDataMockRepository, api);
const assetRepo = sourceOf('facility', masterDataMockRepository, api);

// Dev: màn Phòng ban gọi BE thật khi nối thử Cấu hình trường; danh mục chung khác vẫn theo repo trên
const roomsRepo = SCHOOL_CONFIG_API
  ? {
      getRooms: (filters) => beClient.get('/locations', { params: filters }),
      saveRoom: (id, form) => (id ? beClient.put(`/locations/${id}`, form) : beClient.post('/locations', form)),
      setRoomStatus: (id, status) => beClient.patch(`/locations/${id}/status`, { status }),
      deleteRoom: (id) => beClient.delete(`/locations/${id}`),
    }
  : repo;

// Dev nối thử: điểm trường, phòng lấy từ BE để màn Phòng ban/Cấu hình trường dùng đúng id BE (module mock khác sẽ thấy id mới)
export const getCampuses = () => (SCHOOL_CONFIG_API ? beClient.get('/campuses') : repo.getCampuses());
export const getLocations = () => (SCHOOL_CONFIG_API ? beClient.get('/locations') : repo.getLocations());
// Dev nối thử: thêm giáo viên từ BE (id số) vào danh sách user mock để màn phân công/lớp hiện tên
export const getUsers = () =>
  SCHOOL_CONFIG_API
    ? Promise.all([
        usersRepo.getUsers(),
        // Không có năm đang hoạt động (vd. vừa kết thúc năm học) thì BE trả 404: vẫn dùng danh sách mock, không làm hỏng dữ liệu nền
        beClient.get('/teacher-assignments', { params: { campusId: 'all' } }).catch(() => ({ teachers: [] })),
      ]).then(([users, { teachers }]) => [...users, ...teachers.map((t) => ({ ...t, role: 'TEACHER', status: 'ACTIVE' }))])
    : usersRepo.getUsers();
export const getAssetCategories = () => assetRepo.getAssetCategories();

/** Rooms (= locations) management, Principal only. */
export const getRooms = (filters, user) => roomsRepo.getRooms(filters, user);
export const saveRoom = (id, form, user) => roomsRepo.saveRoom(id, form, user);
export const setRoomStatus = (id, status, user) => roomsRepo.setRoomStatus(id, status, user);
export const deleteRoom = (id, user) => roomsRepo.deleteRoom(id, user);
