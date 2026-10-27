import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT.
 */
export const attendanceApi = {
  getDayInfo: (date) => axiosClient.get('/attendance/day-info', { params: { date } }),
  getClassAttendance: (classId, date) => axiosClient.get(`/classes/${classId}/attendance`, { params: { date } }),
  saveClassAttendance: ({ classId, date, entries }) => axiosClient.put(`/classes/${classId}/attendance`, { date, entries }),
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

/** BE trả thông tin ngày trong `day`, trẻ chỉ có id/họ tên/ngày sinh: đổi về dạng mock để màn hình dùng chung. */
const toSheet = (data) => {
  const children = data.children.map(({ child, record }) => ({
    child: { ...child, code: '', gender: null, allergies: [], photoUrl: null },
    record,
    leaveRequest: null,
    healthSummary: null,
  }));
  const status = (row) => row.record?.status;
  return {
    ...data.day,
    classId: data.classId,
    className: data.className,
    campusId: data.campusId,
    mealSessions: data.mealSessions,
    canRecord: data.canRecord,
    mealCountStatus: null,
    children,
    receptionStats: {
      total: children.length,
      present: children.filter((row) => status(row) === 'PRESENT').length,
      absent: children.filter((row) => row.record && status(row) !== 'PRESENT').length,
      missing: children.filter((row) => !row.record).length,
      noted: 0,
    },
  };
};

const withSubstitute = (summary, scope) => ({ scope, ...summary, days: summary.days.map((d) => ({ ...d, substitute: 0 })) });

/**
 * Dev (VITE_SCHOOL_CONFIG_API): điểm danh (đợt 1) và sổ báo ăn (đợt 2) nối BE thật qua beClient (id số <-> chuỗi,
 * lỗi đã dịch). Bàn giao bữa chưa có BE.
 */
export const createAttendanceBeApi = (client) => ({
  getAttendanceClasses: (schoolYear) => client.get('/attendance/classes', { params: { schoolYearId: schoolYear || undefined } }),
  getDayInfo: (date, classId) => client.get('/attendance/day-info', { params: { date, classId: classId || undefined } }),
  listAttendanceDayUnlocks: () => client.get('/attendance/day-unlocks'),
  unlockAttendanceDay: (body) => client.post('/attendance/day-unlocks', body),
  revokeAttendanceDayUnlock: (id) => client.post(`/attendance/day-unlocks/${id}/revoke`),
  getClassAttendance: async (classId, date) => toSheet(await client.get(`/classes/${classId}/attendance`, { params: { date } })),
  saveClassAttendance: ({ classId, date, entries }) =>
    client.put(`/classes/${classId}/attendance`, {
      date,
      entries: entries.map(({ childId, status, meals }) => ({ childId, status, meals })),
    }),
  getAttendanceSummary: async ({ classId, campusId, schoolYear, from, to }) =>
    classId
      ? withSubstitute(await client.get(`/classes/${classId}/attendance/summary`, { params: { from, to } }), 'CLASS')
      : withSubstitute(
          await client.get('/attendance/summary', {
            params: { from, to, campusId: campusId || undefined, schoolYearId: schoolYear || undefined },
          }),
          'MULTI',
        ),
  getMealCounts: ({ date, schoolYear }) => client.get('/meal-counts', { params: { date, schoolYearId: schoolYear || undefined } }),
  confirmMealCount: (id) => client.post(`/meal-counts/${id}/confirm`),
  adjustMealDay: ({ campusId, date, session, classId, normal, substitute, note }) =>
    client.post('/meal-counts/adjustments', { campusId, date, session: session || null, classId, normal, substitute, note }),
});
