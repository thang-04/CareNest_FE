import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { getClasses } from '@/services/schoolService';
import { attendanceMockRepository } from '@/services/attendance/mock/attendanceMockRepository';
import { attendanceApi, createAttendanceBeApi } from '@/services/attendance/api/attendanceApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
const repo = USE_MOCK ? attendanceMockRepository : attendanceApi;
// Dev: điểm danh (xem/lưu, mở lại ngày, tổng hợp) và sổ báo ăn dùng BE thật; bàn giao bữa vẫn mock
const be = SCHOOL_CONFIG_API ? createAttendanceBeApi(beClient) : null;

/** Lớp của năm học chọn ở header trong phạm vi người dùng (BE kèm cờ canRecord / canUnlock); mock: năm đang hoạt động. */
export const getAttendanceClasses = (user, schoolYear) =>
  be ? be.getAttendanceClasses(schoolYear) : getClasses({ activeYear: true }, user);
export const getDayInfo = (date, classId, user) => (be || repo).getDayInfo(date, classId, user);
const unlockUnavailable = () =>
  Promise.reject(Object.assign(new Error('Mở lại điểm danh hiện chỉ có trong demo; cần thống nhất API với backend.'), { status: 501 }));
export const getAttendanceDayUnlocks = (user) =>
  be ? be.listAttendanceDayUnlocks() : USE_MOCK ? attendanceMockRepository.listAttendanceDayUnlocks(user) : unlockUnavailable();
export const unlockAttendanceDay = (body, user) =>
  be ? be.unlockAttendanceDay(body) : USE_MOCK ? attendanceMockRepository.unlockAttendanceDay(body, user) : unlockUnavailable();
export const revokeAttendanceDayUnlock = (id, user) =>
  be ? be.revokeAttendanceDayUnlock(id) : USE_MOCK ? attendanceMockRepository.revokeAttendanceDayUnlock(id, user) : unlockUnavailable();
export const getClassAttendance = (classId, date, user) => (be || repo).getClassAttendance(classId, date, user);
export const saveClassAttendance = (payload, user) => (be || repo).saveClassAttendance(payload, user);
export const getAttendanceSummary = (query, user) => (be || repo).getAttendanceSummary(query, user);
export const getMealCounts = (query, user) => (be || repo).getMealCounts(query, user);
export const confirmMealCount = (id, user) => (be || repo).confirmMealCount(id, user);
export const adjustMealDay = (payload, user) => (be || repo).adjustMealDay(payload, user);
export const getMealHandovers = (query, user) => repo.getMealHandovers(query, user);
export const confirmHandover = (id, body, user) => repo.confirmHandover(id, body, user);
export const reportHandoverShortage = (id, body, user) => repo.reportHandoverShortage(id, body, user);
export const supplementHandover = (id, body, user) => repo.supplementHandover(id, body, user);
