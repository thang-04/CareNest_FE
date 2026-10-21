import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the user comes from the JWT, so `user` is ignored.
 */
export const dailyHealthApi = {
  // PENDING BE: ghi nhận sức khỏe trong ngày do giáo viên lớp nhập ở màn Điểm danh
  getDailyHealth: ({ classId, childId, date }) =>
    axiosClient.get(`/classes/${classId}/children/${childId}/daily-health`, { params: { date } }),
  // PENDING BE: payload thêm actions[] (MONITOR | MEDICAL_ROOM | PARENT_INFORMED | EARLY_PICKUP | REFERRAL),
  // referral { place, time, escort }. EARLY_PICKUP chỉ đánh dấu "chờ đón sớm"; giờ, người đón lấy từ bản ghi trả trẻ ở Đón trẻ
  addDailyHealth: (payload) => axiosClient.post('/daily-health-entries', payload),
  notifyDailyHealth: (entryId) => axiosClient.post(`/daily-health-entries/${entryId}/parent-notifications`),

  // PENDING BE: mỗi lần ghi nhận nên trả kèm mức thân nhiệt (level: LOW/NORMAL/WATCH/HIGH/VERY_HIGH, ngưỡng ở utils/attendance/temperatureLevels.js)
  // PENDING BE: tổng hợp sức khỏe đầu ngày cho Ban giám hiệu; BE tự giới hạn điểm trường theo người gọi,
  // campusId / ageGroupId / classId chỉ là bộ lọc; trả kèm options (nhóm tuổi, lớp trong phạm vi); trẻ cần chú ý kèm photoUrl
  getDailyHealthOverview: ({ date, campusId, ageGroupId, classId }) =>
    axiosClient.get('/daily-health/overview', {
      params: { date, ...(campusId ? { campusId } : {}), ...(ageGroupId ? { ageGroupId } : {}), ...(classId ? { classId } : {}) },
    }),
  // PENDING BE: lịch sử ghi nhận trong ngày của một trẻ, chỉ xem
  getChildDailyHealthHistory: ({ childId, date }) => axiosClient.get(`/children/${childId}/daily-health`, { params: { date } }),
};
