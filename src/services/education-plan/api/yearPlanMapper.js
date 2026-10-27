/*
 * Chuyển đổi kế hoạch năm học giữa dạng UI (mock) và DTO của BE (`BE:docs/api/openapi.yaml`, /education-plans/goals).
 * UI dùng id chuỗi, mã nhóm tuổi `ag-3`, năm học dạng "2026 – 2027", lĩnh vực theo tên; BE dùng id số.
 * Dòng / nội dung / chủ đề mới (id do UI sinh) gửi id null để BE cấp id; nội dung tích chủ đề qua key = id chủ đề phía UI.
 */
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

const toYearLabel = (name) => (name ? name.replace('-', ' – ') : name);
const fromYearLabel = (label) => (label ? label.replace(' – ', '-') : label);

/** Id do BE cấp (số); id UI tự sinh (chuỗi chữ) ⇒ null để BE tạo mới. */
export const serverId = (id) => (/^\d+$/.test(String(id ?? '')) ? Number(id) : null);

const pad = (n) => String(n).padStart(2, '0');
// Thời điểm BE (ISO, UTC) → "yyyy-mm-dd HH:mm" giờ máy như lịch sử của mock
const localDateTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localDate = (iso) => localDateTime(iso)?.slice(0, 10) || null;

/** Tra cứu từ GET /education-plans/config. */
export const buildRefs = (config) => {
  const ageGroups = config?.ageGroups || [];
  const schoolYears = config?.schoolYears || [];
  const domains = config?.domains || [];
  return {
    ageGroupCode: (id) => ageGroups.find((a) => a.id === id)?.code ?? null,
    ageGroupId: (code) => ageGroups.find((a) => a.code === code)?.id ?? null,
    schoolYearId: (label) => schoolYears.find((y) => y.name === fromYearLabel(label))?.id ?? null,
    domainId: (name) => domains.find((d) => d.name === name)?.id ?? null,
  };
};

/** Cấu hình BE (GET/PUT /education-plans/config) → dạng cấu hình của UI (eduConfig.js). */
export const toUiEduConfig = (config) => {
  const domains = config?.domains || [];
  return {
    domainLabels: Object.fromEntries(domains.filter((d) => d.displayLabel).map((d) => [d.name, d.displayLabel])),
    extraDomains: domains.filter((d) => !d.standard).map((d) => d.name),
    ...(config?.signers ? { signers: config.signers } : {}),
    ...(config?.weekRows ? { weekRows: config.weekRows } : {}),
  };
};

const actor = (a) => (a ? { userId: a.userId, name: a.name, title: a.title || null, at: localDate(a.at) } : null);
// Người đang giữ khóa "Đang sửa" (BE:EDU-10), at = giờ bắt đầu sửa
const editor = (a) => (a ? { userId: a.userId, name: a.name, at: localDateTime(a.at) } : null);

/** YearPlanDetailResponse → kế hoạch năm dạng UI. */
export const toUiGoal = (detail, refs) => {
  const themes = (detail.themes || []).map((t) => ({
    id: String(t.id),
    name: t.name,
    abbr: t.abbr,
    festivals: t.festivals || '',
    start: t.startDate || '',
    end: t.endDate || '',
    note: t.note || '',
  }));
  const domains = (detail.domains || []).map((d) => {
    const rows = d.rows.map((r) => ({
      id: String(r.id),
      kind: r.kind,
      text: r.text,
      ...(r.kind === 'goal'
        ? { contents: r.contents.map((c) => ({ id: String(c.id), text: c.text, themes: c.themeIds.map(String) })) }
        : {}),
    }));
    const goalNo = Object.fromEntries(d.rows.map((r) => [String(r.id), r.goalNo]));
    return {
      id: `d-${d.domainId}`,
      name: d.name,
      rows,
      items: rows
        .filter((r) => r.kind === 'goal')
        .map((r) => ({ id: r.id, code: `MT${goalNo[r.id]}`, text: r.text, contents: r.contents, requirements: [] })),
    };
  });
  return {
    id: String(detail.id),
    revision: detail.revision ?? 0,
    editExpiresAt: detail.editExpiresAt,
    code: detail.code,
    schoolYear: toYearLabel(detail.schoolYearName),
    ageGroupId: refs.ageGroupCode(detail.ageGroupId),
    title: detail.title,
    description: detail.description || '',
    status: detail.status,
    createdAt: localDate(detail.createdAt),
    sentAt: localDate(detail.sentBy?.at),
    createdBy: detail.owner?.name || '',
    owner: actor(detail.owner),
    sentBy: actor(detail.sentBy),
    issued: actor(detail.issued),
    editing: editor(detail.editing),
    history: (detail.history || []).map((h) => ({
      at: localDateTime(h.at),
      by: h.actorName,
      role: h.actorRoleLabel,
      action: h.label,
      tone: h.tone,
      ...(h.note ? { note: h.note } : {}),
    })),
    file: null,
    themes,
    breaks: (detail.breaks || []).map((b) => ({ id: String(b.id), label: b.label, start: b.startDate || '', end: b.endDate || '' })),
    domains,
    permissions: detail.permissions,
  };
};

/** Kế hoạch năm dạng UI → YearPlanRequest (lưu cả văn bản). Lĩnh vực BE không có thì bỏ qua. */
export const toYearPlanRequest = (goal, refs) => ({
  schoolYearId: refs.schoolYearId(goal.schoolYear),
  ageGroupId: refs.ageGroupId(goal.ageGroupId),
  title: goal.title,
  description: goal.description || '',
  domains: (goal.domains || [])
    .map((d) => ({ domainId: refs.domainId(d.name), rows: d.rows || [] }))
    .filter((d) => d.domainId != null)
    .map((d) => ({
      domainId: d.domainId,
      rows: d.rows.map((r) => ({
        id: serverId(r.id),
        kind: r.kind,
        text: r.text,
        contents: (r.contents || []).map((c) => ({ id: serverId(c.id), text: c.text, themeKeys: (c.themes || []).map(String) })),
      })),
    })),
  themes: (goal.themes || []).map((t) => ({
    key: String(t.id),
    id: serverId(t.id),
    name: t.name,
    abbr: t.abbr,
    startDate: t.start || null,
    endDate: t.end || null,
    festivals: t.festivals || '',
    note: t.note || '',
  })),
  breaks: (goal.breaks || []).map((b) => ({ id: serverId(b.id), label: b.label, startDate: b.start || null, endDate: b.end || null })),
});

const lastNote = (goal) => goal.history?.at(-1)?.note || null;

/**
 * UI đổi trạng thái bằng cách lưu cả văn bản với status mới (GoalFormPage, GoalDetailPage); BE quyết định trạng thái
 * qua endpoint hành động. Trả các bước gọi BE theo trạng thái trước (`prev`, null khi chưa có trên BE) và sau;
 * `changed` = nội dung khác bản BE (chỉ khi đó mới lưu nội dung, để Ban hành / Gửi không ghi thêm "chỉnh sửa").
 */
export const planSteps = (prev, goal, changed = true) => {
  const steps = [];
  const from = prev?.status || null;
  const to = goal.status;
  const canEdit = !prev || prev.permissions?.canEdit;
  if (!prev) steps.push({ call: 'create' });
  else if (changed && canEdit && to !== EDU_STATUS.REJECTED) steps.push({ call: 'update' });
  if (to !== (from || EDU_STATUS.DRAFT)) {
    if (to === EDU_STATUS.PENDING_VP) steps.push({ call: 'submit', note: lastNote(goal) });
    else if (to === EDU_STATUS.APPROVED) steps.push({ call: 'issue', note: lastNote(goal) });
    else if (to === EDU_STATUS.REJECTED) steps.push({ call: 'return', note: lastNote(goal) });
  }
  return steps;
};
