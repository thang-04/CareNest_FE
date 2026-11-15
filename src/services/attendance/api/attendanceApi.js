import { axiosClient } from '@/services/http/axiosClient';
import { dailyHealthSummaryFromBe } from '@/mocks/dailyHealthSummary';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT.
 */
export const attendanceApi = {
  getDayInfo: (date) => axiosClient.get('/attendance/day-info', { params: { date } }),
  getClassAttendance: (classId, date) => axiosClient.get(`/classes/${classId}/attendance`, { params: { date } }),
  saveClassAttendance: ({ classId, date, entries }) =>
    axiosClient.put(`/classes/${classId}/attendance`, { date, entries: entries.map(({ childId, status }) => ({ childId, status })) }),
  // PENDING BE: không có classId = tổng hợp nhiều lớp trong phạm vi người gọi (campusId tùy chọn, BE tự giới hạn phạm vi)
  getAttendanceSummary: ({ classId, campusId, from, to }) =>
    classId
      ? axiosClient.get(`/classes/${classId}/attendance/summary`, { params: { from, to } })
      : axiosClient.get('/attendance/summary', { params: { from, to, ...(campusId ? { campusId } : {}) } }),
  getMealCounts: ({ date }) => axiosClient.get('/meal-counts', { params: { date } }),
  getClassMealCount: ({ classId, date }) => axiosClient.get('/meal-counts/class', { params: { classId, date } }),
  confirmMealCount: (id, seen) =>
    axiosClient.post(`/meal-counts/${id}/confirm`, undefined, {
      params: { seenServings: seen?.servings ?? undefined, seenSubstitute: seen?.substitute ?? undefined },
    }),
  // NUT-02: chỉ suất thay thế (kèm lý do); suất thường chỉ đổi qua điểm danh
  adjustMealDay: ({ campusId, date, session, classId, substitute, note }) =>
    axiosClient.post('/meal-counts/adjustments', { campusId, date, session: session || null, classId, normal: null, substitute, note }),
  getMealHandovers: ({ date }) => axiosClient.get('/meal-handovers', { params: { date } }),
  confirmHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/confirm`, body),
  reportHandoverShortage: (id, body) => axiosClient.post(`/meal-handovers/${id}/shortage`, body),
  supplementHandover: (id, body) => axiosClient.post(`/meal-handovers/${id}/supplement`, body),
};

/** BE trả thông tin ngày trong `day`, trẻ chỉ có id/họ tên/ngày sinh: đổi về dạng mock để màn hình dùng chung. */
const toSheet = (data) => {
  const children = data.children.map(({ child, record, health, leave }) => ({
    child: { ...child, code: '', gender: null, allergies: [], photoUrl: null },
    record,
    // Đơn nghỉ phụ huynh còn hiệu lực ngày này (ATT-04): nhãn "Phụ huynh báo nghỉ" ở dòng trẻ
    leaveRequest: leave ? { id: leave.requestId, fromDate: leave.fromDate, toDate: leave.toDate, reason: leave.reason } : null,
    healthSummary: dailyHealthSummaryFromBe(health),
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
      noted: children.filter((row) => row.healthSummary.flagged).length,
    },
  };
};

// substitute: trẻ ăn suất thay thế (BE tính theo dị ứng trong hồ sơ); BE cũ chưa trả thì 0
const withSubstitute = (summary, scope) => ({
  scope,
  ...summary,
  days: summary.days.map((d) => ({ ...d, substitute: d.substitute ?? 0 })),
});

/**
 * Dev (VITE_SCHOOL_CONFIG_API): điểm danh (đợt 1) và sổ báo ăn (đợt 2) nối BE thật qua beClient (id số <-> chuỗi,
 * lỗi đã dịch). Bàn giao bữa chưa có BE.
 */
export const createAttendanceBeApi = (client) => ({
  getAttendanceClasses: (schoolYear) => client.get('/attendance/classes', { params: { schoolYearId: schoolYear || undefined } }),
  getDayInfo: (date, classId) => client.get('/attendance/day-info', { params: { date, classId: classId || undefined } }),
  listAttendanceDayUnlocks: () => client.get('/attendance/day-unlocks'),
  // Đơn nghỉ phụ huynh gửi từ App: GV/PHT/HT chỉ xem trong phạm vi (ATT-05)
  searchLeaveRequests: ({ from, to, campusId, classId, schoolYear } = {}) =>
    client.get('/leave-requests', { params: { from, to, campusId, classId, schoolYearId: schoolYear || undefined } }),
  unlockAttendanceDay: (body) => client.post('/attendance/day-unlocks', body),
  revokeAttendanceDayUnlock: (id) => client.post(`/attendance/day-unlocks/${id}/revoke`),
  getClassAttendance: async (classId, date) => toSheet(await client.get(`/classes/${classId}/attendance`, { params: { date } })),
  // ATT-02: BE tự tính suất từ status (bỏ qua meals) ⇒ chỉ gửi trẻ + trạng thái
  saveClassAttendance: ({ classId, date, entries }) =>
    client.put(`/classes/${classId}/attendance`, {
      date,
      entries: entries.map(({ childId, status }) => ({ childId, status })),
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
  // NUT-02, ATT-02: suất ăn từng bữa của một lớp cho giáo viên (BE kiểm phân công lớp, không tên trẻ)
  getClassMealCount: ({ classId, date }) => client.get('/meal-counts/class', { params: { classId, date } }),
  // seen: { servings, substitute } cơ sở–ngày đang hiện; BE từ chối (409) nếu số đã đổi so với lúc xem (NUT-03)
  confirmMealCount: (id, seen) =>
    client.post(`/meal-counts/${id}/confirm`, undefined, {
      params: { seenServings: seen?.servings ?? undefined, seenSubstitute: seen?.substitute ?? undefined },
    }),
  // NUT-02: chỉ điều chỉnh suất thay thế; suất thường chỉ đổi qua điểm danh ⇒ normal luôn null
  adjustMealDay: ({ campusId, date, session, classId, substitute, note }) =>
    client.post('/meal-counts/adjustments', { campusId, date, session: session || null, classId, normal: null, substitute, note }),
});
