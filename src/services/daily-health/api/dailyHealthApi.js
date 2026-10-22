import { axiosClient } from '@/services/http/axiosClient';
import { dailyHealthSummary } from '@/mocks/dailyHealthSummary';
import { actionSummary } from '@/utils/dailyHealthValidation';

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
  // PENDING BE: tổng hợp sức khỏe trong ngày cho Ban giám hiệu; BE tự giới hạn điểm trường theo người gọi,
  // campusId / ageGroupId / classId chỉ là bộ lọc; trả kèm options (nhóm tuổi, lớp trong phạm vi); trẻ cần chú ý kèm photoUrl
  getDailyHealthOverview: ({ date, campusId, ageGroupId, classId }) =>
    axiosClient.get('/daily-health/overview', {
      params: { date, ...(campusId ? { campusId } : {}), ...(ageGroupId ? { ageGroupId } : {}), ...(classId ? { classId } : {}) },
    }),
  // PENDING BE: lịch sử ghi nhận trong ngày của một trẻ, chỉ xem
  getChildDailyHealthHistory: ({ childId, date }) => axiosClient.get(`/children/${childId}/daily-health`, { params: { date } }),
};

const toEntry = (entry) => ({
  ...entry,
  temperature: entry.temperature === null || entry.temperature === undefined ? null : Number(entry.temperature),
  earlyPickup: null,
  parentNotifications: [],
});

const toTemperature = (value) => {
  const raw = String(value ?? '')
    .trim()
    .replace(',', '.');
  return raw ? Number(raw) : null;
};

/**
 * Dev (VITE_SCHOOL_CONFIG_API): sức khỏe trong ngày nối BE thật qua beClient. BE chưa có thông báo phụ huynh
 * (notificationStatus luôn PENDING), liên hệ phụ huynh, giờ đón sớm từ màn Đón trẻ.
 */
export const createDailyHealthBeApi = (client) => ({
  getDailyHealth: async ({ classId, childId, date }) => {
    const day = await client.get(`/classes/${classId}/children/${childId}/daily-health`, { params: { date } });
    const entries = day.entries.map(toEntry);
    return { classId, childId, date, canRecord: day.canRecord, healthSummary: dailyHealthSummary(entries), contacts: [], entries };
  },
  addDailyHealth: async (payload) => {
    const noted = payload.observation === 'NOTED';
    const actions = noted ? payload.actions || [] : [];
    const entry = await client.post('/daily-health-entries', {
      requestId: payload.requestId,
      classId: payload.classId,
      childId: payload.childId,
      date: payload.date,
      temperature: toTemperature(payload.temperature),
      observation: payload.observation,
      symptoms: noted ? payload.symptoms || [] : [],
      note: (payload.note || '').trim(),
      actions,
      referral: actions.includes('REFERRAL') ? payload.referral : null,
    });
    return toEntry(entry);
  },
  // TODO(Cần): BE chưa có module thông báo phụ huynh; lần ghi nhận đã lưu, báo rõ là chưa gửi
  notifyDailyHealth: () => Promise.reject(Object.assign(new Error('Máy chủ chưa có chức năng gửi thông báo phụ huynh.'), { status: 501 })),
  getDailyHealthOverview: async ({ date, schoolYear, campusId, ageGroupId, classId }) => {
    const data = await client.get('/daily-health/overview', {
      params: {
        date,
        schoolYearId: schoolYear || undefined,
        campusId: campusId || undefined,
        ageGroupId: ageGroupId || undefined,
        classId: classId || undefined,
      },
    });
    return {
      ...data,
      attention: data.attention.map(({ latest, readings, ...child }) => {
        const list = readings.map(toEntry);
        return {
          ...child,
          childCode: '',
          photoUrl: null,
          temperature: toEntry(latest).temperature,
          observation: latest.observation,
          symptoms: latest.symptoms,
          note: latest.note,
          recordedByName: latest.recordedByName,
          recordedAt: latest.recordedAt,
          notificationStatus: latest.notificationStatus,
          notifiedAt: null,
          readingCount: list.length,
          temperatureTrail: list.map((item) => item.temperature),
          actionsText: actionSummary(list),
        };
      }),
    };
  },
  getChildDailyHealthHistory: async ({ childId, date }) => {
    const day = await client.get(`/children/${childId}/daily-health`, { params: { date } });
    return { ...day, childCode: '', contacts: [], entries: day.entries.map(toEntry) };
  },
});
