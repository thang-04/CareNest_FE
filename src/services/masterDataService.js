import { SCHOOL_CONFIG_API } from '@/config/env';
import { ROLES } from '@/models/User';
import { sourceOf } from '@/services/demoSource';
import { beClient } from '@/services/http/beClient';
import { axiosClient } from '@/services/http/axiosClient';
import { masterDataMockRepository } from '@/mocks/masterDataMockRepository';

/** Master data shared by every module: campuses, locations, users. */
const api = {
  getCampuses: (schoolYearId) => axiosClient.get('/campuses', { params: { schoolYearId: schoolYearId || undefined } }),
  getLocations: (schoolYearId) => axiosClient.get('/locations', { params: { schoolYearId: schoolYearId || undefined } }),
  getUsers: () => axiosClient.get('/users'),
  // PENDING BE: quản lý phòng học (đề xuất 10/10/2026, ngoài SRS)
  getRooms: (filters) =>
    axiosClient.get('/locations', {
      params: {
        ...filters,
        withUsage: true,
      },
    }),
  saveRoom: (id, form, _user, schoolYearId) =>
    id
      ? axiosClient.put(`/locations/${id}`, form, { params: { schoolYearId } })
      : axiosClient.post('/locations', form, { params: { schoolYearId } }),
  setRoomStatus: (id, status, _user, schoolYearId) =>
    axiosClient.patch(
      `/locations/${id}/status`,
      {
        status,
      },
      { params: { schoolYearId } },
    ),
  // BE xóa mềm (status DELETED), giữ bản ghi cho lịch sử
  deleteRoom: (id, _user, schoolYearId) => axiosClient.delete(`/locations/${id}`, { params: { schoolYearId } }),
};
const repo = sourceOf('master-data', masterDataMockRepository, api);
// BE chưa có GET /users ⇒ danh bạ người dùng lấy dữ liệu demo
const usersRepo = sourceOf('master-data-users', masterDataMockRepository, api);

// Dev: màn Phòng ban gọi BE thật khi nối thử Cấu hình trường; danh mục chung khác vẫn theo repo trên
const roomsRepo = SCHOOL_CONFIG_API
  ? {
      getRooms: (filters) =>
        beClient.get('/locations', {
          params: filters,
        }),
      saveRoom: (id, form, _user, schoolYearId) =>
        id
          ? beClient.put(`/locations/${id}`, form, { params: { schoolYearId } })
          : beClient.post('/locations', form, { params: { schoolYearId } }),
      setRoomStatus: (id, status, _user, schoolYearId) =>
        beClient.patch(
          `/locations/${id}/status`,
          {
            status,
          },
          { params: { schoolYearId } },
        ),
      deleteRoom: (id, _user, schoolYearId) => beClient.delete(`/locations/${id}`, { params: { schoolYearId } }),
    }
  : repo;

// Dev nối thử: điểm trường, phòng lấy từ BE để màn Phòng ban/Cấu hình trường dùng đúng id BE (module mock khác sẽ thấy id mới)
// BE chỉ cho HT/PHT đọc điểm trường, phòng, phân công GV: vai trò khác dùng dữ liệu nền cũ, không gọi BE để khỏi 403
const readsOrgFromBe = (user) => !user || user.role === ROLES.PRINCIPAL || user.role === ROLES.VICE_PRINCIPAL;
const readsTeachersFromBe = (user) =>
  readsOrgFromBe(user) && (!Array.isArray(user?.bePermissions) || user.bePermissions.includes('STAFF_ASSIGNMENT_MANAGE'));
export const getCampuses = (user, schoolYearId) =>
  SCHOOL_CONFIG_API && readsOrgFromBe(user)
    ? beClient.get('/campuses', { params: { schoolYearId: schoolYearId || undefined } })
    : repo.getCampuses(schoolYearId);
export const getLocations = (user, schoolYearId) =>
  SCHOOL_CONFIG_API && readsOrgFromBe(user)
    ? beClient.get('/locations', { params: { schoolYearId: schoolYearId || undefined } })
    : repo.getLocations(schoolYearId);
// Năm để đọc danh sách GV: năm đang hoạt động, chưa có thì năm sắp tới (BE không nhận năm nào ⇒ 404 khi chưa kích hoạt)
const teacherListYear = (years) =>
  years.find((y) => y.status === 'ACTIVE') ||
  [...years].filter((y) => y.status === 'PLANNED').sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0] ||
  null;

// Dev nối thử: thêm giáo viên từ BE (id số) vào danh sách user mock để màn phân công/lớp hiện tên
export const getUsers = (user) =>
  SCHOOL_CONFIG_API && readsTeachersFromBe(user)
    ? Promise.all([
        usersRepo.getUsers(),
        // Không có năm mở (vd. mới kết thúc năm học) thì BE báo lỗi: vẫn dùng danh sách mock, không làm hỏng dữ liệu nền
        beClient
          .get('/school-years')
          .then((years) => {
            const year = teacherListYear(years || []);
            return year
              ? beClient.get('/teacher-assignments', {
                  params: {
                    schoolYearId: year.id,
                    campusId: 'all',
                  },
                })
              : {
                  teachers: [],
                };
          })
          .catch(() => ({
            teachers: [],
          })),
      ]).then(([users, { teachers }]) => [
        ...users,
        ...teachers.map((t) => ({
          ...t,
          role: 'TEACHER',
          status: 'ACTIVE',
        })),
      ])
    : usersRepo.getUsers();

/** Rooms (= locations) management, Principal only. */
export const getRooms = (filters, user) => roomsRepo.getRooms(filters, user);
export const saveRoom = (id, form, user, schoolYearId) => roomsRepo.saveRoom(id, form, user, schoolYearId);
export const setRoomStatus = (id, status, user, schoolYearId) => roomsRepo.setRoomStatus(id, status, user, schoolYearId);
export const deleteRoom = (id, user, schoolYearId) => roomsRepo.deleteRoom(id, user, schoolYearId);
