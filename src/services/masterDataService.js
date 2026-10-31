import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { ROLES } from '@/models/User';
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

const repo = USE_MOCK ? masterDataMockRepository : api;

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
// BE chỉ cho HT/PHT đọc điểm trường, phòng, phân công GV: vai trò khác dùng dữ liệu nền cũ, không gọi BE để khỏi 403
const readsOrgFromBe = (user) => !user || user.role === ROLES.PRINCIPAL || user.role === ROLES.VICE_PRINCIPAL;
const readsTeachersFromBe = (user) =>
  readsOrgFromBe(user) && (!Array.isArray(user?.bePermissions) || user.bePermissions.includes('STAFF_ASSIGNMENT_MANAGE'));

export const getCampuses = (user) => (SCHOOL_CONFIG_API && readsOrgFromBe(user) ? beClient.get('/campuses') : repo.getCampuses());
export const getLocations = (user) => (SCHOOL_CONFIG_API && readsOrgFromBe(user) ? beClient.get('/locations') : repo.getLocations());
// Năm để đọc danh sách GV: năm đang hoạt động, chưa có thì năm sắp tới (BE không nhận năm nào ⇒ 404 khi chưa kích hoạt)
const teacherListYear = (years) =>
  years.find((y) => y.status === 'ACTIVE') ||
  [...years].filter((y) => y.status === 'PLANNED').sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0] ||
  null;

// Dev nối thử: thêm giáo viên từ BE (id số) vào danh sách user mock để màn phân công/lớp hiện tên
export const getUsers = (user) =>
  SCHOOL_CONFIG_API && readsTeachersFromBe(user)
    ? Promise.all([
        repo.getUsers(),
        // Không có năm mở (vd. mới kết thúc năm học) thì BE báo lỗi: vẫn dùng danh sách mock, không làm hỏng dữ liệu nền
        beClient
          .get('/school-years')
          .then((years) => {
            const year = teacherListYear(years || []);
            return year ? beClient.get('/teacher-assignments', { params: { schoolYearId: year.id, campusId: 'all' } }) : { teachers: [] };
          })
          .catch(() => ({ teachers: [] })),
      ]).then(([users, { teachers }]) => [...users, ...teachers.map((t) => ({ ...t, role: 'TEACHER', status: 'ACTIVE' }))])
    : repo.getUsers();
export const getAssetCategories = () => repo.getAssetCategories();

/** Rooms (= locations) management, Principal only. */
export const getRooms = (filters, user) => roomsRepo.getRooms(filters, user);
export const saveRoom = (id, form, user) => roomsRepo.saveRoom(id, form, user);
export const setRoomStatus = (id, status, user) => roomsRepo.setRoomStatus(id, status, user);
export const deleteRoom = (id, user) => roomsRepo.deleteRoom(id, user);
