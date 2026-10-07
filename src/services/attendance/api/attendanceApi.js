import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT.
 */
export const attendanceApi = {
  getDayInfo: (date) => axiosClient.get('/attendance/day-info', { params: { date } }),
  getClassAttendance: (classId, date) => axiosClient.get(`/classes/${classId}/attendance`, { params: { date } }),
  saveClassAttendance: ({ classId, date, entries }) => axiosClient.put(`/classes/${classId}/attendance`, { date, entries }),
  correctMealAfterLock: ({ childId, date, session, note }) =>
    axiosClient.post(`/attendance/meal-corrections`, { childId, date, session, note }),
  getAttendanceSummary: ({ classId, from, to }) => axiosClient.get(`/classes/${classId}/attendance/summary`, { params: { from, to } }),
  getMealCounts: ({ date }) => axiosClient.get('/meal-counts', { params: { date } }),
  confirmMealCount: (id) => axiosClient.post(`/meal-counts/${id}/confirm`),
  getMealHandovers: ({ date }) => axiosClient.get('/meal-handovers', { params: { date } }),
  confirmHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/confirm`, body),
  reportHandoverShortage: (id, body) => axiosClient.post(`/meal-handovers/${id}/shortage`, body),
  supplementHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/supplement`, body),
};
