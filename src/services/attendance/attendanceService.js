import { USE_MOCK } from '@/config/env';
import { attendanceMockRepository } from '@/services/attendance/mock/attendanceMockRepository';
import { attendanceApi } from '@/services/attendance/api/attendanceApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
const repo = USE_MOCK ? attendanceMockRepository : attendanceApi;

export const getDayInfo = (date) => repo.getDayInfo(date);
export const getClassAttendance = (classId, date, user) => repo.getClassAttendance(classId, date, user);
export const saveClassAttendance = (payload, user) => repo.saveClassAttendance(payload, user);
export const correctMealAfterLock = (payload, user) => repo.correctMealAfterLock(payload, user);
export const getAttendanceSummary = (query, user) => repo.getAttendanceSummary(query, user);
export const getMealCounts = (query, user) => repo.getMealCounts(query, user);
/** Chốt suất cả ngày của một cơ sở (mọi bữa một lần). */
export const confirmMealCountDay = (payload, user) => repo.confirmMealCountDay(payload, user);
