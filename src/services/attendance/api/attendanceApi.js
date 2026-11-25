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
    axiosClient.put(`/classes/${classId}/attendance`, {
      date,
      entries: entries.map(({ childId, status, meals, presentPart }) => ({ childId, status, meals, presentPart })),
    }),
  markArrived: ({ classId, childId, date }) =>
    axiosClient.post(`/classes/${classId}/attendance/children/${childId}/arrived`, undefined, { params: { date } }),
  correctMealParticipation: ({ classId, childId, date, participates }) =>
    axiosClient.post(`/classes/${classId}/attendance/children/${childId}/meal-participation`, { date, participates }),
  // PENDING BE: không có classId = tổng hợp nhiều lớp trong phạm vi người gọi (campusId tùy chọn, BE tự giới hạn phạm vi)
  getAttendanceSummary: ({ classId, campusId, from, to }) =>
    classId
      ? axiosClient.get(`/classes/${classId}/attendance/summary`, { params: { from, to } })
      : axiosClient.get('/attendance/summary', { params: { from, to, ...(campusId ? { campusId } : {}) } }),
  getMealCounts: ({ date }) => axiosClient.get('/meal-counts', { params: { date } }),
  getClassMealCount: ({ classId, date }) => axiosClient.get('/meal-counts/class', { params: { classId, date } }),
  confirmMealCount: (id, seen) =>
    axiosClient.post(`/meal-counts/${id}/confirm`, undefined, { params: { seenServings: seen?.servings ?? undefined } }),
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
    // ATT-12: part = cả ngày / buổi sáng / buổi chiều; eats = bé ăn bữa của buổi còn học (null = không áp dụng);
    // eatsMeals = các bữa của buổi còn học theo nhóm tuổi
    leaveRequest: leave
      ? {
          id: leave.requestId,
          fromDate: leave.fromDate,
          toDate: leave.toDate,
          reason: leave.reason,
          part: leave.part || 'FULL_DAY',
          eats: leave.eats ?? null,
          eatsMeals: leave.eatsMeals || [],
          noticeOnly: !!leave.noticeOnly,
        }
      : null,
    healthSummary: dailyHealthSummaryFromBe(health),
  }));
  const status = (row) => row.record?.status;
  return {
    ...data.day,
    classId: data.classId,
    className: data.className,
    campusId: data.campusId,
    mealSessions: data.mealSessions,
    afternoonStart: data.afternoonStart,
    latestAfternoonArrival: data.latestAfternoonArrival,
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
  // Có mặt mặc định ăn đủ bữa; giáo viên có thể tắt báo ăn nên phải gửi cả meals.
  saveClassAttendance: ({ classId, date, entries }) =>
    client.put(`/classes/${classId}/attendance`, {
      date,
      entries: entries.map(({ childId, status, meals, presentPart }) => ({ childId, status, meals, presentPart })),
    }),
  // ATT-13: trẻ nghỉ buổi sáng đã đến lớp buổi chiều (không đổi sổ báo ăn)
  markArrived: ({ classId, childId, date }) =>
    client.post(`/classes/${classId}/attendance/children/${childId}/arrived`, undefined, { params: { date } }),
  // ATT-02a: after the cut-off, only today's accidental meal-participation toggle may be corrected.
  // The server rejects it once a relevant meal count is confirmed or the kitchen record is signed.
  correctMealParticipation: ({ classId, childId, date, participates }) =>
    client.post(`/classes/${classId}/attendance/children/${childId}/meal-participation`, { date, participates }),
  getAttendanceSummary: async ({ classId, campusId, ageGroupId, schoolYear, from, to }) =>
    classId
      ? withSubstitute(await client.get(`/classes/${classId}/attendance/summary`, { params: { from, to } }), 'CLASS')
      : withSubstitute(
          await client.get('/attendance/summary', {
            params: {
              from,
              to,
              campusId: campusId || undefined,
              ageGroupId: ageGroupId || undefined,
              schoolYearId: schoolYear || undefined,
            },
          }),
          'MULTI',
        ),
  getMealCounts: ({ date, schoolYear }) => client.get('/meal-counts', { params: { date, schoolYearId: schoolYear || undefined } }),
  // NUT-02, ATT-02: suất ăn từng bữa của một lớp cho giáo viên (BE kiểm phân công lớp, không tên trẻ)
  getClassMealCount: ({ classId, date }) => client.get('/meal-counts/class', { params: { classId, date } }),
  // seen: { servings } cơ sở–ngày đang hiện; BE từ chối (409) nếu số đã đổi so với lúc xem (NUT-03)
  confirmMealCount: (id, seen) =>
    client.post(`/meal-counts/${id}/confirm`, undefined, { params: { seenServings: seen?.servings ?? undefined } }),
});
