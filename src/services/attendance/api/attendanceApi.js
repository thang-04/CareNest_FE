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
  // PENDING BE: không có classId = tổng hợp nhiều lớp trong phạm vi người gọi (campusId tùy chọn, BE tự giới hạn phạm vi)
  getAttendanceSummary: ({ classId, campusId, from, to }) =>
    classId
      ? axiosClient.get(`/classes/${classId}/attendance/summary`, { params: { from, to } })
      : axiosClient.get('/attendance/summary', { params: { from, to, ...(campusId ? { campusId } : {}) } }),
  getMealCounts: ({ date }) => axiosClient.get('/meal-counts', { params: { date } }),
  confirmMealCount: (id) => axiosClient.post(`/meal-counts/${id}/confirm`),
  // PENDING BE: sửa số suất / ngày của một lớp (kèm lý do), áp cho mọi bữa trong ngày
  adjustMealDay: (body) => axiosClient.post('/meal-counts/adjustments', body),
  getMealHandovers: ({ date }) => axiosClient.get('/meal-handovers', { params: { date } }),
  confirmHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/confirm`, body),
  reportHandoverShortage: (id, body) => axiosClient.post(`/meal-handovers/${id}/shortage`, body),
  supplementHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/supplement`, body),
};
