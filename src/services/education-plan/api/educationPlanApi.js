import { axiosClient } from '@/services/http/axiosClient';
import { ROLES } from '@/models/User';
import { EDU_STATUS, ageRangeKey } from '@/models/education-plan/educationPlanConstants';
import { sameSchoolYearId } from '@/models/education-plan/schoolYearScope.mjs';
import { buildRefs, planSteps, serverId, toUiEduConfig, toUiGoal, toYearPlanRequest } from './yearPlanMapper';

/*
 * Mục tiêu năm học (kế hoạch năm) và cấu hình: theo contract BE (`BE:docs/api/openapi.yaml`, /education-plans/...).
 * Tài liệu của lớp: /education-plans/class-docs (BE:EDU-12..18). AI hỗ trợ soạn/duyệt: /education-plans/ai (BE:EDU-95, 96, 103).
 * Cùng tên hàm và tham số với mock repository.
 */
const GOALS = '/education-plans/goals';

const sourceError = (status, message) => Object.assign(new Error(message), { status });
const yearParam = (value) => {
  const schoolYearId = serverId(value);
  if (schoolYearId == null) throw sourceError(400, 'Năm học không hợp lệ.');
  return { schoolYearId };
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
const loadConfig = (refresh = false) => {
  if (refresh) configCache = null;
  configCache ||= axiosClient.get('/education-plans/config').catch((err) => {
    configCache = null;
    throw err;
  });
  return configCache;
};
/** Bảng đổi id UI ↔ BE (nhóm tuổi `ag-3` ↔ id số) cho service khác của module, vd. kho học liệu. */
export const loadEduRefs = async () => buildRefs(await loadConfig());
// Trạng thái + quyền trên BE của từng kế hoạch, để biết lần lưu là sửa, gửi, ban hành hay trả lại
const known = new Map();

const remember = (detail, refs) => {
  const goal = toUiGoal(detail, refs);
  known.set(goal.id, { status: detail.status, permissions: detail.permissions, body: bodyKey(goal, refs) });
  return goal;
};
const bodyKey = (goal, refs) => JSON.stringify(toYearPlanRequest(goal, refs));
// Trang tải chi tiết từng kế hoạch cùng lúc; trình duyệt chỉ mở 6 kết nối nên yêu cầu xếp hàng có thể vượt 15 giây mặc định
// ponytail: nới thời gian chờ; về lâu dài cần API danh sách trả đủ nội dung hoặc tải chi tiết khi mở
const LIST_TIMEOUT = 60000;
const AI_MATCH_TIMEOUT = 70000;
const fetchGoal = async (id, refs) => remember(await axiosClient.get(`${GOALS}/${id}`, { timeout: LIST_TIMEOUT }), refs);

const editHeaders = (edit) => {
  const headers = {
    'X-Plan-Revision': String(edit?.revision ?? 0),
    'Idempotency-Key': edit?.requestId || crypto.randomUUID(),
  };
  if (edit?.sessionId) {
    headers['X-Edit-Session'] = edit.sessionId;
  }
  return headers;
};

const reviewHeaders = (edit) => ({
  'X-Plan-Revision': String(edit.revision ?? 0),
  'Idempotency-Key': edit.requestId || crypto.randomUUID(),
});

const runSteps = async (goal, refs, edit, forceSave = false, action) => {
  let id = serverId(goal.id);
  let detail = null;
  const prev = id == null ? null : known.get(String(id));
  // publish: HT soạn, chuỗi duyệt rỗng ⇒ ban hành thẳng (BE EDU-110 (8), (10))
  const actionCall = { submit: 'submit', approve: 'issue', reject: 'return', publish: 'principal-publish' }[action];
  const steps = actionCall
    ? [{ call: actionCall, note: goal.history?.at(-1)?.note || null }]
    : planSteps(prev, goal, forceSave || !prev || prev.body !== bodyKey(goal, refs));
  for (const step of steps) {
    if (step.call === 'create') detail = await axiosClient.post(GOALS, toYearPlanRequest(goal, refs), { headers: editHeaders(edit) });
    else if (step.call === 'update')
      detail = await axiosClient.put(`${GOALS}/${id}`, toYearPlanRequest(goal, refs), { headers: editHeaders(edit) });
    else
      detail = await axiosClient.post(
        `${GOALS}/${id}/${step.call}`,
        { note: step.note },
        {
          headers: (['submit', 'principal-publish'].includes(step.call) ? editHeaders : reviewHeaders)({
            ...edit,
            requestId: crypto.randomUUID(),
          }),
        },
      );
    edit.revision = detail.contentRevision ?? detail.revision;
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
  previewClassCalendar: (request) => axiosClient.post('/education-plans/class-docs/branch/calendar-preview', request),
  previewBranchFile: (file, { classId, yearPlanId, draftCalendar }) => {
    const cls = serverId(classId);
    const plan = serverId(yearPlanId);
    if (cls == null || plan == null) throw sourceError(400, 'Lớp hoặc kế hoạch năm không hợp lệ.');
    const data = new FormData();
    data.append('file', file);
    data.append('classId', String(cls));
    data.append('yearPlanId', String(plan));
    if (draftCalendar) data.append('draftCalendar', JSON.stringify(draftCalendar));
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
  listGoalSources: async ({ schoolYear, schoolYearId, ageGroupId, excludeId, planLevel } = {}, actor, options = {}) => {
    const group = ageGroupId;
    const refs = buildRefs(await loadConfig());
    const params = planLevel ? { planLevel } : {};
    if (schoolYearId != null || schoolYear) {
      params.schoolYearId = schoolYearId == null ? refs.schoolYearId(schoolYear) : serverId(schoolYearId);
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
    const refs = buildRefs(await loadConfig());
    const goal = toUiGoal(await axiosClient.get(`${GOALS}/${id}`, { signal: options.signal }), refs);
    // BE:EDU-06/24 — giới hạn UX của import; quyền đọc thực tế vẫn do BE kiểm qua token.
    if (
      goal.planLevel !== 'SCHOOL_YEAR' &&
      actor.role === ROLES.TEAM_LEADER &&
      goal.ageGroupId !== actor.ageGroupId &&
      goal.status !== EDU_STATUS.APPROVED
    )
      throw sourceError(403, 'Nhóm tuổi khác chỉ lấy được từ kế hoạch đã ban hành.');
    return {
      ...goal,
      goalCount: goal.domains.reduce((count, domain) => count + domain.rows.filter((row) => row.kind === 'goal').length, 0),
    };
  },
  getAll: async (_actor, filter = {}) => {
    const config = await loadConfig();
    const refs = buildRefs(config);
    const group = filter.ageRange ? config.ageGroups?.find((entry) => ageRangeKey(entry) === filter.ageRange) : null;
    if (filter.ageRange && !group) throw sourceError(400, 'Khoảng tuổi không hợp lệ.');
    // Danh sách đã theo phạm vi người xem (BE)
    const pages = await Promise.all(
      (filter.planLevel ? [filter.planLevel] : ['TEAM', 'SCHOOL_YEAR']).map(async (planLevel) => {
        const params = { page: 0, size: 200, planLevel };
        if (filter.overdue) Object.assign(params, yearParam(filter.schoolYearId), { view: 'OVERDUE' });
        if (filter.schoolYearId != null || filter.schoolYear) {
          params.schoolYearId = filter.schoolYearId == null ? refs.schoolYearId(filter.schoolYear) : serverId(filter.schoolYearId);
          if (params.schoolYearId == null) throw sourceError(400, 'Năm học không hợp lệ.');
        }
        if (group) params.ageGroupId = group.id;
        else if (filter.ageGroupId) {
          params.ageGroupId = refs.ageGroupId(filter.ageGroupId);
          if (params.ageGroupId == null) throw sourceError(400, 'Nhóm tuổi không hợp lệ.');
        }
        const items = [];
        let page;
        do {
          try {
            page = await axiosClient.get(GOALS, { params: { ...params }, timeout: LIST_TIMEOUT });
          } catch (error) {
            if (params.page === 0 && planLevel === 'SCHOOL_YEAR' && error.status === 404) return [];
            throw error;
          }
          items.push(...page.items.filter((item) => planLevel !== 'SCHOOL_YEAR' || (item.planType || item.planLevel) === planLevel));
          params.page++;
        } while (params.page < page.totalPages);
        return items;
      }),
    );
    const items = pages.flat().filter((item) => filter.schoolYearId == null || sameSchoolYearId(item.schoolYearId, filter.schoolYearId));
    const summaries = new Map(items.map((item) => [String(item.id), item]));
    // Chỉ bản tóm tắt; trang nào cần nội dung thì tải chi tiết kế hoạch đó (useGoalDetails) — không tải hết khi vào module
    const goals = [...summaries.values()].map((p) => ({
      ...toUiGoal(p, refs),
      summary: true,
      goalCount: p.goalCount ?? 0,
      themeCount: p.themeCount ?? 0,
    }));
    return { goals, themes: [], lessons: [] };
  },
  // Mở một kế hoạch theo id (vd. bản Chờ duyệt từ hàng chờ, không có trong danh sách); BE trả 403 nếu chưa ban hành
  getGoal: async (id) => fetchGoal(serverId(id) ?? id, buildRefs(await loadConfig())),
  getOverdueGoal: async (id, schoolYearId) => {
    const refs = buildRefs(await loadConfig());
    return toUiGoal(await axiosClient.get(`${GOALS}/${serverId(id)}`, {
      params: { ...yearParam(schoolYearId), view: 'OVERDUE' },
      timeout: LIST_TIMEOUT,
    }), refs);
  },
  // Kế hoạch năm/tổ chờ đúng người gọi duyệt; danh sách thường chỉ có bản đã ban hành (BE spec 002 FR-007)
  getReviewQueue: async (_actor, schoolYearId) => {
    const id = serverId(schoolYearId);
    if (schoolYearId != null && id == null) throw sourceError(400, 'Năm học không hợp lệ.');
    const refs = buildRefs(await loadConfig());
    const items = await axiosClient.get(`${GOALS}/review-queue`, { params: id == null ? {} : { schoolYearId: id } });
    const scoped = id == null ? items : items.filter((p) => sameSchoolYearId(p.schoolYearId, id));
    return Promise.all(scoped.map((p) => fetchGoal(p.id, refs)));
  },
  // Một bản kế hoạch giáo dục ngày đã ban hành trước đây (nội dung + chuỗi ký), chỉ đọc
  getClassDocRelease: (releaseId) => axiosClient.get(`/education-plans/class-docs/releases/${releaseId}`),
  // Trả kế hoạch đã lưu (id do BE cấp) để trang lập kế hoạch dùng tiếp id thật
  saveGoal: async (item, options = {}) => {
    const refs = buildRefs(await loadConfig());
    const explicit = options.edit;
    const edit = explicit ? { ...explicit } : { revision: item.revision ?? 0, requestId: crypto.randomUUID() };
    const id = serverId(item.id);
    const reviewOnly =
      id != null &&
      (known.get(String(id))?.status === 'REVIEW' ||
        item.permissions?.canApprove ||
        item.permissions?.canIssue ||
        item.permissions?.canReturn);
    if (!explicit && id != null && !reviewOnly) {
      const current = await axiosClient.get(`${GOALS}/${id}`);
      if ((item.revision ?? 0) !== (current.contentRevision ?? current.revision ?? 0)) {
        throw Object.assign(new Error('Kế hoạch đã thay đổi. Hãy tải lại và xem nội dung mới trước khi thao tác.'), { status: 409 });
      }
      remember(current, refs);
    }
    const detail = await runSteps(item, refs, edit, !!options.silent, options.action);
    return detail ? toUiGoal(detail, refs) : item;
  },
  // Tương thích caller cũ; EDU-70 không còn tạo hoặc gia hạn phiên sửa.
  startEditingGoal: async (id) => fetchGoal(serverId(id) ?? id, buildRefs(await loadConfig())),
  resolveGoalReview: async (id, reviewItemId, expectedSourcePlanId, edit) => {
    const refs = buildRefs(await loadConfig());
    return remember(
      await axiosClient.post(
        `${GOALS}/${serverId(id) ?? id}/review/${encodeURIComponent(String(reviewItemId))}/resolve`,
        { expectedSourcePlanId: serverId(expectedSourcePlanId) },
        { headers: editHeaders(edit) },
      ),
      refs,
    );
  },
  heartbeatGoal: async (id) => fetchGoal(serverId(id) ?? id, buildRefs(await loadConfig())),
  finishEditingGoal: async () => {},
  // BE:EDU-25 — phiên bản n+1 chép từ bản ban hành mới nhất; người tạo giữ phiên sửa của bản mới
  createGoalVersion: async (id, edit) => {
    const refs = buildRefs(await loadConfig());
    return remember(
      await axiosClient.post(
        `${GOALS}/${serverId(id) ?? id}/versions`,
        edit?.curriculumSourcePlanId ? { curriculumSourcePlanId: serverId(edit.curriculumSourcePlanId) } : null,
        { headers: editHeaders(edit) },
      ),
      refs,
    );
  },
  unlockGoal: async (id, body) => {
    const refs = buildRefs(await loadConfig());
    return toUiGoal(await axiosClient.post(`${GOALS}/${serverId(id) ?? id}/unlock`, body), refs);
  },
  getGoalChanges: (id, fromId) =>
    axiosClient.get(`${GOALS}/${serverId(id) ?? id}/changes`, { params: fromId ? { fromPlanId: serverId(fromId) ?? fromId } : {} }),
  deleteGoal: async (id, revision) => {
    await axiosClient.delete(`${GOALS}/${serverId(id) ?? id}`, { headers: editHeaders({ revision: revision ?? 0 }) });
    known.delete(String(id));
  },
  saveTheme: (item) => axiosClient.put(`/education-plans/themes/${item.id}`, item),
  deleteTheme: (id) => axiosClient.delete(`/education-plans/themes/${id}`),
  saveLesson: (item) => axiosClient.put(`/education-plans/lessons/${item.id}`, item),
  deleteLesson: (id) => axiosClient.delete(`/education-plans/lessons/${id}`),
  // Tài liệu + lớp + giáo viên, tổ trưởng của năm học đang chọn ở header (BE lọc theo phạm vi người xem)
  // Header giữ id số (API) hoặc tên năm "2027-2028" (nối thử qua beClient) ⇒ đổi tên sang id theo cấu hình
  getClassPlans: async (schoolYearId, review = false) => {
    const id = serverId(schoolYearId) ?? (schoolYearId ? buildRefs(await loadConfig()).schoolYearId(String(schoolYearId)) : null);
    if (schoolYearId != null && id == null) throw sourceError(400, 'Năm học không hợp lệ.');
    const params = id == null ? {} : { schoolYearId: id };
    if (review) params.view = 'REVIEW';
    return axiosClient.get('/education-plans/class-docs', { params, timeout: LIST_TIMEOUT });
  },
  getOverdueClassPlans: (schoolYearId) =>
    axiosClient.get('/education-plans/class-docs/overdue', { params: yearParam(schoolYearId), timeout: LIST_TIMEOUT }),
  getOverdueClassDoc: (kind, docKey, schoolYearId) =>
    axiosClient.get(`/education-plans/class-docs/overdue/${encodeURIComponent(kind)}/${encodeURIComponent(docKey)}`, {
      params: yearParam(schoolYearId), timeout: LIST_TIMEOUT,
    }),
  getEduConfig: async () => {
    const [config, workflow, durationPolicy] = await Promise.all([
      loadConfig(true),
      axiosClient.get('/education-plans/workflow-policy'),
      axiosClient.get('/education-plans/duration-policy').catch((error) => {
        if (error.status === 404) return null;
        throw error;
      }),
    ]);
    const fresh = {
      ...config,
      workflow,
      durationPolicyAvailable: !!durationPolicy?.theme && !!durationPolicy?.branch,
      ...(durationPolicy?.theme && durationPolicy?.branch ? { durationPolicy } : {}),
    };
    configCache = Promise.resolve(fresh);
    return toUiEduConfig(fresh);
  },
  // BE:EDU-11 — lưu xong thì dùng luôn bản BE trả về làm dữ liệu tham chiếu của phiên
  saveEduConfig: async (cfg) => {
    const current = await loadConfig();
    let durationPolicy = current.durationPolicy;
    if (
      cfg.durationPolicyAvailable !== false &&
      cfg.durationPolicy &&
      JSON.stringify(cfg.durationPolicy) !== JSON.stringify(durationPolicy)
    ) {
      const { revision, theme, branch } = cfg.durationPolicy;
      durationPolicy = await axiosClient.put('/education-plans/duration-policy', { revision, theme, branch });
    }
    const saved = await axiosClient.put('/education-plans/config', {
      domainLabels: cfg.domainLabels || {},
      extraDomains: cfg.extraDomains || [],
      // Ô ký do BE quản lý và trả lại sau mỗi lần lưu luồng duyệt.
      signers: current.signers ?? cfg.signers,
      weekRows: cfg.weekRows,
    });
    const fresh = {
      ...saved,
      durationPolicyAvailable: current.durationPolicyAvailable ?? true,
      ...(durationPolicy ? { durationPolicy } : {}),
    };
    configCache = Promise.resolve(fresh);
    return toUiEduConfig(fresh);
  },
  saveClassDoc: (kind, doc, options = {}) => {
    const headers = { 'X-Class-Doc-Version': String(doc?.version ?? -1) };
    if (doc?.dossierVersion != null) headers['X-Dossier-Version'] = String(doc.dossierVersion);
    if (options?.headers) Object.assign(headers, options.headers);
    if ((kind === 'week' || kind === 'day') && doc?.dossierVersion == null)
      throw sourceError(409, 'Hãy tải lại kế hoạch giáo dục ngày trước khi lưu tuần.');
    const { version, dossierVersion, review, permissions, ...content } = doc;
    if (kind === 'branch' && content.schemaVersion === 2) {
      delete content.names;
      delete content.notes;
      delete content.calendarRevision;
      delete content.durationPolicySnapshot;
    }
    // Phần II "Đánh giá trẻ trên ngày" đợt này chỉ là giao diện, chưa lưu ở BE (spec 005 FR-008a)
    if (kind === 'day' && Array.isArray(content.days)) content.days = content.days.map(({ review: _review, ...d }) => d);
    return axiosClient.put(`/education-plans/class-docs/${kind}/${doc.id}`, content, { headers });
  },
  actOnClassDoc: (kind, id, body, options = {}) => {
    if (options.version == null) throw sourceError(409, 'Hãy tải lại tài liệu trước khi duyệt.');
    const headers = { 'Idempotency-Key': options?.requestId || crypto.randomUUID() };
    if (options?.version != null) headers['X-Class-Doc-Version'] = String(options.version);
    if (options?.dossierVersion != null) headers['X-Dossier-Version'] = String(options.dossierVersion);
    if (options?.headers) Object.assign(headers, options.headers);
    return axiosClient.post(`/education-plans/class-docs/${kind}/${id}/actions`, body, { headers });
  },
  suggestBranchNames: (input) => axiosClient.post('/education-plans/ai/branch-names', input),
  rewriteBranchName: (input) => axiosClient.post('/education-plans/ai/branch-names/rewrite', input),
  suggestLessonSteps: (input) => axiosClient.post('/education-plans/ai/lesson-steps', input),
  // BE:EDU-95 — gợi ý thẻ hoạt động cho MT chưa có hoạt động
  suggestActivityCards: (input) => axiosClient.post('/education-plans/ai/activities', input),
  // BE:EDU-96 — tiêu chí gửi duyệt đạt / chưa đạt (khung Kiểm tra)
  getClassDocChecks: (kind, docKey) => axiosClient.get(`/education-plans/class-docs/${kind}/${docKey}/checks`),
  // BE:EDU-95 — sửa giáo án ngày theo một câu yêu cầu: trả danh sách ô cũ → mới, không lưu
  editDayByRequest: (docKey, prompt) => axiosClient.post(`/education-plans/ai/class-docs/day/${docKey}/edit`, { prompt }),
  // BE:EDU-96 — tóm tắt giáo án ngày cho người duyệt: gợi ý, không lưu
  reviewDay: (docKey) => axiosClient.post(`/education-plans/ai/class-docs/day/${docKey}/review`),
  // BE:EDU-103 — gom nội dung vào chủ đề của kế hoạch tổ (song song theo lĩnh vực, ~40–60s): timeout riêng dài hơn mặc định
  matchThemeContents: (planId, body) =>
    axiosClient.post(`/education-plans/ai/team-plans/${serverId(planId)}/theme-content-map`, body, { timeout: AI_MATCH_TIMEOUT }),
  matchGoalContents: (planId, options = {}) =>
    axiosClient.post(`/education-plans/ai/year-plans/${serverId(planId)}/goal-content-map`, undefined, { timeout: AI_MATCH_TIMEOUT, signal: options.signal }),
  // BE:EDU-104 — tick kế hoạch tổ đã ban hành năm học liền trước (source null + reason khi không có)
  getPreviousYearTicks: (planId) => axiosClient.get(`/education-plans/goals/${serverId(planId)}/previous-year-ticks`),
  // BE:EDU-103 — số gợi ý / số giữ mỗi lần Áp dụng, BE chỉ ghi log
  sendAiFeedback: (body) => axiosClient.post('/education-plans/ai/feedback', body),
};
