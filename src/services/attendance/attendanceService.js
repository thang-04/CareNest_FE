import { USE_MOCK } from '@/config/env';
import { attendanceMockRepository } from '@/services/attendance/mock/attendanceMockRepository';
import { attendanceApi } from '@/services/attendance/api/attendanceApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
const repo = USE_MOCK ? attendanceMockRepository : attendanceApi;

export const getDayInfo = (date, classId, user) => repo.getDayInfo(date, classId, user);
const unlockUnavailable = () =>
  Promise.reject(Object.assign(new Error('Mở lại điểm danh hiện chỉ có trong demo; cần thống nhất API với backend.'), { status: 501 }));
export const getAttendanceDayUnlocks = (user) => (USE_MOCK ? attendanceMockRepository.listAttendanceDayUnlocks(user) : unlockUnavailable());
export const unlockAttendanceDay = (body, user) =>
  USE_MOCK ? attendanceMockRepository.unlockAttendanceDay(body, user) : unlockUnavailable();
export const getClassAttendance = (classId, date, user) => repo.getClassAttendance(classId, date, user);
export const saveClassAttendance = (payload, user) => repo.saveClassAttendance(payload, user);
export const correctMealAfterLock = (payload, user) => repo.correctMealAfterLock(payload, user);
export const getAttendanceSummary = (query, user) => repo.getAttendanceSummary(query, user);
export const getMealCounts = (query, user) => repo.getMealCounts(query, user);
export const confirmMealCount = (id, user) => repo.confirmMealCount(id, user);
export const adjustMealDay = (payload, user) => repo.adjustMealDay(payload, user);
export const getMealHandovers = (query, user) => repo.getMealHandovers(query, user);
export const confirmHandover = (id, body, user) => repo.confirmHandover(id, body, user);
export const reportHandoverShortage = (id, body, user) => repo.reportHandoverShortage(id, body, user);
export const supplementHandover = (id, body, user) => repo.supplementHandover(id, body, user);
