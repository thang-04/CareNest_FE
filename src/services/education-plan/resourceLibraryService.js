import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { resourceLibraryMockRepository as mock } from './mock/learningResourceMockRepository';
import { loadEduRefs } from './api/educationPlanApi';
import { serverId } from './api/yearPlanMapper';

// BE:EDU-82…88 (spec 900) — kho học liệu: phạm vi, nhãn, gợi ý, chia sẻ, duyệt lên kho trường
const BASE = '/education-plans/resources';
// UI dùng mã nhóm tuổi `ag-3`, BE dùng id số: đổi hai chiều ở tầng này
const toBe = async (code) => (code ? (await loadEduRefs()).ageGroupId(code) : null);
const toUi = async (item) => (item ? { ...item, ageGroupId: (await loadEduRefs()).ageGroupCode(item.ageGroupId) } : item);

export const resourceLibraryApi = {
  /** query: { view, q, kind, ageGroupId, themeId, themeName, goalIds, docKey, activityKey, page, size } */
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
  upload: async (_user, file, { title, ageGroupId } = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    const age = await toBe(ageGroupId);
    if (age) form.append('ageGroupId', String(age));
    return toUi(await axiosClient.post(BASE, form, { headers: { 'Idempotency-Key': crypto.randomUUID() }, timeout: 600000 }));
  },
  addLink: async (_user, body) => toUi(await axiosClient.post(`${BASE}/links`, { ...body, ageGroupId: await toBe(body.ageGroupId) })),
  update: async (_user, id, patch) =>
    toUi(await axiosClient.patch(`${BASE}/${id}`, { ...patch, ageGroupId: await toBe(patch.ageGroupId) })),
  share: async (_user, id, body) =>
    toUi(await axiosClient.post(`${BASE}/${id}/share`, { ...body, classroomId: serverId(body.classroomId) })),
  withdraw: async (_user, id) => toUi(await axiosClient.post(`${BASE}/${id}/withdraw`)),
  review: async (_user, id, body) => toUi(await axiosClient.post(`${BASE}/${id}/review`, body)),
  remove: (_user, id) => axiosClient.delete(`${BASE}/${id}`),
  usages: async (_user, id) =>
    (await axiosClient.get(`${BASE}/${id}/usages`)).map((u) => ({
      ...u,
      classroomId: u.classroomId == null ? null : String(u.classroomId),
    })),
  contentUrl: async (_user, id) => (await axiosClient.get(`${BASE}/${id}/url`)).url,
};
export const resourceLibraryService = USE_MOCK ? mock : resourceLibraryApi;
