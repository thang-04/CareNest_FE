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

const editHeaders = (edit) => ({
  'X-Edit-Session': edit.sessionId,
  'X-Plan-Revision': String(edit.revision ?? 0),
  'X-Request-Id': edit.requestId || crypto.randomUUID(),
});

const runSteps = async (goal, refs, edit, forceSave = false) => {
  let id = serverId(goal.id);
  let detail = null;
  const prev = id == null ? null : known.get(String(id));
  for (const step of planSteps(prev, goal, forceSave || !prev || prev.body !== bodyKey(goal, refs))) {
    if (step.call === 'create') detail = await axiosClient.post(GOALS, toYearPlanRequest(goal, refs), { headers: editHeaders(edit) });
    else if (step.call === 'update')
      detail = await axiosClient.put(`${GOALS}/${id}`, toYearPlanRequest(goal, refs), { headers: editHeaders(edit) });
    else
      detail = await axiosClient.post(
        `${GOALS}/${id}/${step.call}`,
        { note: step.note },
        { headers: editHeaders({ ...edit, requestId: crypto.randomUUID() }) },
      );
    edit.revision = detail.revision;
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
  saveGoal: async (item, options = {}) => {
    const refs = buildRefs(await loadConfig());
    const explicit = options.edit;
    const edit = explicit
      ? { ...explicit }
      : { sessionId: crypto.randomUUID(), revision: item.revision ?? 0, requestId: crypto.randomUUID() };
    const id = serverId(item.id);
    let acquired = false;
    try {
      if (!explicit && id != null) {
        const current = await axiosClient.post(`${GOALS}/${id}/start-editing`, null, { headers: editHeaders(edit) });
        acquired = true;
        if ((item.revision ?? 0) !== (current.revision ?? 0)) {
          throw Object.assign(new Error('Kế hoạch đã thay đổi. Hãy tải lại và xem nội dung mới trước khi thao tác.'), { status: 409 });
        }
        remember(current, refs);
      }
      const detail = await runSteps(item, refs, edit, !!options.silent);
      return detail ? toUiGoal(detail, refs) : item;
    } finally {
      if (acquired) await axiosClient.post(`${GOALS}/${id}/finish-editing`, null, { headers: editHeaders(edit) }).catch(() => {});
    }
  },
  startEditingGoal: async (id, edit) => {
    const refs = buildRefs(await loadConfig());
    return remember(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/start-editing`, null, { headers: editHeaders(edit) }), refs);
  },
  heartbeatGoal: async (id, edit) => {
    const refs = buildRefs(await loadConfig());
    return toUiGoal(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/editing-heartbeat`, null, { headers: editHeaders(edit) }), refs);
  },
  finishEditingGoal: async (id, { keepalive = false, edit } = {}) => {
    const options = { headers: editHeaders(edit), ...(keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : {}) };
    return axiosClient.post(`${GOALS}/${serverId(id) ?? id}/finish-editing`, null, options);
  },
  deleteGoal: async (id, revision) => {
    const edit = { sessionId: crypto.randomUUID(), revision: revision ?? 0 };
    const current = await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/start-editing`, null, { headers: editHeaders(edit) });
    try {
      if (edit.revision !== current.revision)
        throw Object.assign(new Error('Kế hoạch đã thay đổi. Hãy xem lại trước khi xóa.'), { status: 409 });
      await axiosClient.delete(`${GOALS}/${serverId(id) ?? id}`, { headers: editHeaders(edit) });
      known.delete(String(id));
    } finally {
      await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/finish-editing`, null, { headers: editHeaders(edit) }).catch(() => {});
    }
  },
  saveTheme: (item) => axiosClient.put(`/education-plans/themes/${item.id}`, item),
  deleteTheme: (id) => axiosClient.delete(`/education-plans/themes/${id}`),
  saveLesson: (item) => axiosClient.put(`/education-plans/lessons/${item.id}`, item),
  deleteLesson: (id) => axiosClient.delete(`/education-plans/lessons/${id}`),
  // Tài liệu + lớp + giáo viên, tổ trưởng của năm học đang chọn ở header (BE lọc theo phạm vi người xem)
  // Header giữ id số (API) hoặc tên năm "2027-2028" (nối thử qua beClient) ⇒ đổi tên sang id theo cấu hình
  getClassPlans: async (schoolYearId) => {
    const id = serverId(schoolYearId) ?? (schoolYearId ? buildRefs(await loadConfig()).schoolYearId(String(schoolYearId)) : null);
    return axiosClient.get('/education-plans/class-docs', { params: id == null ? {} : { schoolYearId: id } });
  },
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
