import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { resourceLibraryMockRepository as mock } from './mock/learningResourceMockRepository';
import { loadEduRefs } from './api/educationPlanApi';

// BE:EDU-82…88 (spec 901) — kho học liệu cá nhân: nhãn chủ đề đã dạy/MT/nhóm tuổi, gợi ý, khóa xóa/đổi tên
const BASE = '/education-plans/resources';
// UI dùng mã nhóm tuổi `ag-3`, BE dùng id số: đổi hai chiều ở tầng này
const toBe = async (code) => (code ? (await loadEduRefs()).ageGroupId(code) : null);
const toUi = async (item) => (item ? { ...item, ageGroupId: (await loadEduRefs()).ageGroupCode(item.ageGroupId) } : item);

export const resourceLibraryApi = {
  /** Chỉ học liệu của người gọi. query: { q, kind, ageGroupId, teachThemeName, schoolYearId, themeId, themeName, goalIds, docKey, activityKey, page, size } */
  list: async (_user, query = {}) => {
    const params = Object.fromEntries(
      Object.entries({ ...query, ageGroupId: await toBe(query.ageGroupId) }).filter(
        ([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length),
      ),
    );
    if (params.goalIds) params.goalIds = params.goalIds.join(',');
    const page = await axiosClient.get(BASE, { params });
    return { ...page, items: await Promise.all(page.items.map(toUi)) };
  },
  /** patch: { title?, ageGroupId?, clearAgeGroup?, themes?, goals?, removeTagIds? }; đổi tên khi bị khóa ⇒ 7137. */
  update: async (_user, id, patch) =>
    toUi(await axiosClient.patch(`${BASE}/${id}`, { ...patch, ageGroupId: await toBe(patch.ageGroupId) })),
  /** Xóa vĩnh viễn kể cả còn dòng gắn; bị khóa ⇒ 7137. */
  remove: (_user, id) => axiosClient.delete(`${BASE}/${id}`),
  /** { rows: [{ attachmentId, docKey, classroomId, date, activityKey, activityLabel, status, locked }], locked, deletableFrom } */
  usages: async (_user, id) => {
    const res = await axiosClient.get(`${BASE}/${id}/usages`);
    return { ...res, rows: res.rows.map((u) => ({ ...u, classroomId: u.classroomId == null ? null : String(u.classroomId) })) };
  },
  contentUrl: async (_user, id) => (await axiosClient.get(`${BASE}/${id}/url`)).url,
};
export const resourceLibraryService = USE_MOCK ? mock : resourceLibraryApi;
