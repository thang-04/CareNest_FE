import { axiosClient } from '@/services/http/axiosClient';
import { buildRefs, planSteps, serverId, toUiEduConfig, toUiGoal, toYearPlanRequest } from './yearPlanMapper';

/*
 * Mục tiêu năm học (kế hoạch năm) và cấu hình: theo contract BE (`BE:docs/api/openapi.yaml`, /education-plans/...).
 * Tài liệu của lớp: /education-plans/class-docs (BE:EDU-12..18). AI vẫn là PROPOSED, BE chưa có.
 * Cùng tên hàm và tham số với mock repository.
 */
const GOALS = '/education-plans/goals';

// Dữ liệu tham chiếu (năm học, nhóm tuổi, lĩnh vực) để đổi id UI ↔ BE; nạp một lần mỗi phiên trang
let configCache = null;
const loadConfig = () => {
  configCache ||= axiosClient.get('/education-plans/config').catch((err) => {
    configCache = null;
    throw err;
  });
  return configCache;
};
// Trạng thái + quyền trên BE của từng kế hoạch, để biết lần lưu là sửa, gửi, ban hành hay trả lại
const known = new Map();

const remember = (detail, refs) => {
  const goal = toUiGoal(detail, refs);
  known.set(goal.id, { status: detail.status, permissions: detail.permissions, body: bodyKey(goal, refs) });
  return goal;
};
const bodyKey = (goal, refs) => JSON.stringify(toYearPlanRequest(goal, refs));
const fetchGoal = async (id, refs) => remember(await axiosClient.get(`${GOALS}/${id}`), refs);

const runSteps = async (goal, refs) => {
  let id = serverId(goal.id);
  let detail = null;
  const prev = id == null ? null : known.get(String(id));
  for (const step of planSteps(prev, goal, !prev || prev.body !== bodyKey(goal, refs))) {
    if (step.call === 'create') detail = await axiosClient.post(GOALS, toYearPlanRequest(goal, refs));
    else if (step.call === 'update') detail = await axiosClient.put(`${GOALS}/${id}`, toYearPlanRequest(goal, refs));
    else detail = await axiosClient.post(`${GOALS}/${id}/${step.call}`, { note: step.note });
    id = detail.id;
    remember(detail, refs);
  }
  return detail;
};

export const educationPlanApi = {
  getAll: async () => {
    const refs = buildRefs(await loadConfig());
    // Danh sách đã theo phạm vi người xem (BE); màn hình cần cả văn bản nên lấy chi tiết từng kế hoạch
    const page = await axiosClient.get(GOALS, { params: { page: 0, size: 200 } });
    const goals = await Promise.all(page.items.map((p) => fetchGoal(p.id, refs)));
    return { goals, themes: [], lessons: [] };
  },
  // Trả kế hoạch đã lưu (id do BE cấp) để trang lập kế hoạch dùng tiếp id thật
  saveGoal: async (item) => {
    const refs = buildRefs(await loadConfig());
    const detail = await runSteps(item, refs);
    return detail ? toUiGoal(detail, refs) : item;
  },
  // BE:EDU-10 — vào trang soạn lấy khóa "Đang sửa"; thoát trang nhả khóa (về Nháp / Bị trả lại)
  startEditingGoal: async (id) => {
    const refs = buildRefs(await loadConfig());
    return remember(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/start-editing`), refs);
  },
  // keepalive: request vẫn gửi đi khi đóng tab (axios dùng fetch adapter)
  finishEditingGoal: async (id, { keepalive = false } = {}) => {
    const refs = buildRefs(await loadConfig());
    const options = keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : undefined;
    return remember(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/finish-editing`, null, options), refs);
  },
  deleteGoal: async (id) => {
    await axiosClient.delete(`${GOALS}/${serverId(id) ?? id}`);
    known.delete(String(id));
  },
  saveTheme: (item) => axiosClient.put(`/education-plans/themes/${item.id}`, item),
  deleteTheme: (id) => axiosClient.delete(`/education-plans/themes/${id}`),
  saveLesson: (item) => axiosClient.put(`/education-plans/lessons/${item.id}`, item),
  deleteLesson: (id) => axiosClient.delete(`/education-plans/lessons/${id}`),
  // Tài liệu + lớp + giáo viên, tổ trưởng của năm học đang chọn ở header (BE lọc theo phạm vi người xem)
  getClassPlans: (schoolYearId) =>
    axiosClient.get('/education-plans/class-docs', { params: serverId(schoolYearId) == null ? {} : { schoolYearId: serverId(schoolYearId) } }),
  getEduConfig: async () => toUiEduConfig(await loadConfig()),
  // BE:EDU-11 — lưu xong thì dùng luôn bản BE trả về làm dữ liệu tham chiếu của phiên
  saveEduConfig: async (cfg) => {
    const saved = await axiosClient.put('/education-plans/config', {
      domainLabels: cfg.domainLabels || {},
      extraDomains: cfg.extraDomains || [],
      signers: cfg.signers,
      weekRows: cfg.weekRows,
    });
    configCache = Promise.resolve(saved);
    return toUiEduConfig(saved);
  },
  saveClassDoc: (kind, doc) => axiosClient.put(`/education-plans/class-docs/${kind}/${doc.id}`, doc),
  actOnClassDoc: (kind, id, body) => axiosClient.post(`/education-plans/class-docs/${kind}/${id}/actions`, body),
  suggestBranchNames: (input) => axiosClient.post('/education-plans/ai/branch-names', input),
  rewriteBranchName: (input) => axiosClient.post('/education-plans/ai/branch-names/rewrite', input),
  suggestLessonSteps: (input) => axiosClient.post('/education-plans/ai/lesson-steps', input),
};
