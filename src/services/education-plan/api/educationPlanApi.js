import { axiosClient } from '@/services/http/axiosClient';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { buildRefs, planSteps, serverId, toUiEduConfig, toUiGoal, toYearPlanRequest } from './yearPlanMapper';

/*
 * Mục tiêu năm học (kế hoạch năm) và cấu hình: theo contract BE (`BE:docs/api/openapi.yaml`, /education-plans/...).
 * Tài liệu của lớp: /education-plans/class-docs (BE:EDU-12..18). AI vẫn là PROPOSED, BE chưa có.
 * Cùng tên hàm và tham số với mock repository.
 */
const GOALS = '/education-plans/goals';

const sourceError = (status, message) => Object.assign(new Error(message), { status });
// BE:EDU-06 — Tổ trưởng chọn được nhóm tuổi khác; BE chỉ trả bản đã ban hành của nhóm đó
const sourceGroup = (actor, requested) => {
  if (actor?.role === ROLES.VICE_PRINCIPAL) return requested;
  if (actor?.role === ROLES.TEAM_LEADER && actor.ageGroupId) return requested;
  throw sourceError(403, 'Bạn không có quyền lấy mục tiêu từ kế hoạch này.');
};
const sourceSummary = (item, refs) => ({
  id: String(item.id),
  code: item.code,
  title: item.title,
  schoolYear: item.schoolYearName?.replace('-', ' – '),
  ageGroupId: refs.ageGroupCode(item.ageGroupId),
  status: item.status,
  revision: item.revision ?? 0,
  goalCount: item.goalCount ?? 0,
});

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

// Danh mục Chương trình GDMN của Bộ (BE:EDU-28); nhóm tuổi UI dạng mã "ag-3"
const curriculumOf = async (path, ageGroupCode, options = {}) => {
  const ageGroupId = buildRefs(await loadConfig()).ageGroupId(ageGroupCode);
  if (ageGroupId == null) throw sourceError(400, 'Nhóm tuổi đã chọn không hợp lệ.');
  return axiosClient.get(`/education-plans/curriculum/${path}`, { params: { ageGroupId }, signal: options.signal });
};

export const educationPlanApi = {
  previewBranchFile: (file, { classId, yearPlanId }) => {
    const cls = serverId(classId);
    const plan = serverId(yearPlanId);
    if (cls == null || plan == null) throw sourceError(400, 'Lớp hoặc kế hoạch năm không hợp lệ.');
    const data = new FormData();
    data.append('file', file);
    data.append('classId', String(cls));
    data.append('yearPlanId', String(plan));
    return axiosClient.post('/education-plans/class-docs/branch/file-preview', data, {
      headers: { 'Content-Type': undefined },
      timeout: 60000,
    });
  },
  // BE:EDU-46 — BE đọc file bảng mục tiêu (Word/Excel/CSV) thành bản xem trước, không lưu
  previewGoalFile: (file) => {
    const data = new FormData();
    data.append('file', file);
    return axiosClient.post(`${GOALS}/file-preview`, data, { headers: { 'Content-Type': undefined }, timeout: 60000 });
  },
  getCurriculumSources: (options = {}) => axiosClient.get('/education-plans/curriculum/sources', { signal: options.signal }),
  getCurriculumGoals: (ageGroupCode, options) => curriculumOf('goals', ageGroupCode, options),
  getCurriculumContents: (ageGroupCode, options) => curriculumOf('contents', ageGroupCode, options),
  listGoalSources: async ({ schoolYear, ageGroupId, excludeId } = {}, actor, options = {}) => {
    const group = sourceGroup(actor, ageGroupId);
    const refs = buildRefs(await loadConfig());
    const params = {};
    if (schoolYear) {
      params.schoolYearId = refs.schoolYearId(schoolYear);
      if (params.schoolYearId == null) throw sourceError(400, 'Năm học đã chọn không hợp lệ.');
    }
    if (group) {
      params.ageGroupId = refs.ageGroupId(group);
      if (params.ageGroupId == null) throw sourceError(400, 'Nhóm tuổi đã chọn không hợp lệ.');
    }
    const sources = new Map();
    let page = 0;
    let totalPages;
    do {
      const result = await axiosClient.get(GOALS, { params: { ...params, page, size: 200 }, signal: options.signal });
      for (const item of result.items) {
        const summary = sourceSummary(item, refs);
        if (summary.id !== String(excludeId) && !sources.has(summary.id)) sources.set(summary.id, summary);
      }
      totalPages = result.totalPages;
      page++;
    } while (page < totalPages);
    return [...sources.values()];
  },
  getGoalSource: async (id, actor, options = {}) => {
    sourceGroup(actor);
    const refs = buildRefs(await loadConfig());
    const goal = toUiGoal(await axiosClient.get(`${GOALS}/${id}`, { signal: options.signal }), refs);
    // BE:EDU-06/24 — giới hạn UX của import; quyền đọc thực tế vẫn do BE kiểm qua token.
    if (actor.role === ROLES.TEAM_LEADER && goal.ageGroupId !== actor.ageGroupId && goal.status !== EDU_STATUS.APPROVED)
      throw sourceError(403, 'Nhóm tuổi khác chỉ lấy được từ kế hoạch đã ban hành.');
    return {
      ...goal,
      goalCount: goal.domains.reduce((count, domain) => count + domain.rows.filter((row) => row.kind === 'goal').length, 0),
    };
  },
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
  // BE:EDU-25 — phiên bản n+1 chép từ bản ban hành mới nhất; người tạo giữ phiên sửa của bản mới
  createGoalVersion: async (id, edit) => {
    const refs = buildRefs(await loadConfig());
    return remember(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/versions`, null, { headers: editHeaders(edit) }), refs);
  },
  getGoalChanges: (id, fromId) =>
    axiosClient.get(`${GOALS}/${serverId(id) ?? id}/changes`, { params: fromId ? { fromPlanId: serverId(fromId) ?? fromId } : {} }),
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
  // BE:EDU-27 — ô "Kế hoạch điều chỉnh và bổ sung", ghi được cả khi đã duyệt
  saveClassDocAdjustments: (id, adjustments) => axiosClient.put(`/education-plans/class-docs/week/${id}/adjustments`, { adjustments }),
  actOnClassDoc: (kind, id, body) => axiosClient.post(`/education-plans/class-docs/${kind}/${id}/actions`, body),
  suggestBranchNames: (input) => axiosClient.post('/education-plans/ai/branch-names', input),
  rewriteBranchName: (input) => axiosClient.post('/education-plans/ai/branch-names/rewrite', input),
  suggestLessonSteps: (input) => axiosClient.post('/education-plans/ai/lesson-steps', input),
};
