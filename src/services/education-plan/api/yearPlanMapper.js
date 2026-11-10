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
    workflowPolicy: config?.workflow?.policies || config?.workflowPolicy || null,
    durationPolicyAvailable: config?.durationPolicyAvailable ?? true,
    workflowRevision: config?.workflow?.revision ?? config?.workflowRevision ?? 1,
    canConfigure: config?.workflow?.canConfigure ?? false,
    ...(config?.durationPolicy ? { durationPolicy: config.durationPolicy } : {}),
    ...(config?.schoolYearCreationScopes
      ? { schoolYearCreationScopes: config.schoolYearCreationScopes.map((id) => buildRefs(config).ageGroupCode(id)).filter(Boolean) }
      : {}),
    yearCreationScopes: (config?.yearCreationScopes || []).map((id) => buildRefs(config).ageGroupCode(id)).filter(Boolean),
    ...(config?.signers ? { signers: config.signers } : {}),
    ...(config?.weekRows ? { weekRows: config.weekRows } : {}),
    // BE:EDU-21 — họ tên Hiệu trưởng, Phó HT đang hoạt động để in dưới chỗ ký tay
    ...(config?.signerNames ? { signerNames: config.signerNames } : {}),
  };
};

const actor = (a) => (a ? { userId: a.userId, name: a.name, title: a.title || null, at: localDate(a.at) } : null);
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
        ? {
            displayLabel: r.displayLabel ?? null,
            contents: r.contents.map((c) => ({ id: String(c.id), text: c.text, themes: c.themeIds.map(String) })),
          }
        : {}),
      // Dòng lấy từ Chương trình của Bộ (BE:EDU-28): giữ liên kết nguồn để bỏ trùng khi lấy lại, không hiện nhãn
      ...(r.curriculumGoalId
        ? { curriculumGoalId: r.curriculumGoalId, curriculumGoalText: r.curriculumGoalText, curriculumSectionRef: r.curriculumSectionRef }
        : {}),
      ...(r.curriculumSubDomainId ? { curriculumSubDomainId: r.curriculumSubDomainId, curriculumText: r.curriculumText } : {}),
      ...(r.curriculumExpectedResultId
        ? { curriculumExpectedResultId: r.curriculumExpectedResultId, curriculumText: r.curriculumText }
        : {}),
    }));
    const goalNo = Object.fromEntries(d.rows.map((r) => [String(r.id), r.goalNo]));
    return {
      id: `d-${d.domainId}`,
      name: d.name,
      rows,
      items: rows
        .filter((r) => r.kind === 'goal')
        .map((r) => ({
          id: r.id,
          code: r.displayLabel?.trim() || `MT${goalNo[r.id]}`,
          text: r.text,
          contents: r.contents,
          requirements: [],
        })),
    };
  });
  return {
    planLevel: detail.planType || detail.planLevel || 'TEAM',
    planType: detail.planType || detail.planLevel || 'TEAM',
    planTypeLabel: detail.planTypeLabel || ((detail.planType || detail.planLevel) === 'SCHOOL_YEAR' ? 'Kế hoạch năm học' : 'Kế hoạch tổ'),
    previousSourcePlanId: detail.previousSourcePlanId == null ? null : String(detail.previousSourcePlanId),
    contentRevision: detail.contentRevision ?? detail.revision ?? 0,
    reviewItems: (detail.reviewItems || []).map((item) => ({
      ...item,
      reviewItemId: String(item.reviewItemId),
      itemId: String(item.itemId),
      sourcePlanId: String(item.sourcePlanId),
    })),
    newItems: (detail.newItems || []).map((item) => ({ ...item, itemId: String(item.itemId) })),
    sourceMode: detail.sourceMode || 'LEGACY',
    curriculumSourcePlanId: detail.curriculumSourcePlanId == null ? null : String(detail.curriculumSourcePlanId),
    branchTemplates: (detail.branchTemplates || []).map((t) => ({ ...t, id: String(t.id), themeId: String(t.themeId) })),
    durationPolicySnapshot: detail.durationPolicySnapshot,
    sourceChanges: detail.sourceChanges || null,
    remapWarnings: detail.remapWarnings || [],
    id: String(detail.id),
    revision: detail.contentRevision ?? detail.revision ?? 0,
    editExpiresAt: detail.editExpiresAt,
    // Spec 004 Q3b/Q5: khóa từ ngày bắt đầu năm học, Hiệu trưởng mở khóa
    timeLock: detail.timeLock || null,
    code: detail.code,
    schoolYear: toYearLabel(detail.schoolYearName),
    ageGroupId: refs.ageGroupCode(detail.ageGroupId),
    title: detail.title,
    description: detail.description || '',
    status: detail.status === 'EDITING' ? EDU_STATUS.DRAFT : detail.status,
    createdAt: localDate(detail.createdAt),
    sentAt: localDate(detail.sentAt ?? detail.sentBy?.at),
    createdBy: detail.owner?.name || '',
    owner: actor(detail.owner),
    sentBy: actor(detail.sentBy),
    issued: actor(detail.issued),
    editing: null,
    waitingRole: detail.review?.waitingRole ?? detail.waitingRole ?? null,
    waitingRoleLabel: detail.waitingRoleLabel || null,
    creationCapabilities: detail.creationCapabilities || null,
    review: detail.review || null,
    lastReturnNote: detail.lastReturnNote || null,
    history: (detail.history || []).map((h) => ({
      at: localDateTime(h.at),
      by: h.actorName,
      role: h.actorRoleLabel,
      action: h.label,
      code: h.action,
      tone: h.tone,
      ...(h.note ? { note: h.note } : {}),
    })),
    file: null,
    themes,
    breaks: (detail.breaks || []).map((b) => ({ id: String(b.id), label: b.label, start: b.startDate || '', end: b.endDate || '' })),
    domains,
    permissions: detail.permissions,
    // Phiên bản (BE:EDU-25): số phiên bản, phiên bản nguồn, hiện hành, các phiên bản người xem được thấy
    versionNo: detail.versionNo ?? 1,
    sourcePlanId: detail.sourcePlanId == null ? null : String(detail.sourcePlanId),
    current: !!detail.current,
    versions: (detail.versions || []).map((v) => ({
      id: String(v.id),
      versionNo: v.versionNo,
      code: v.code,
      status: v.status,
      ownerName: v.ownerName || '',
      createdAt: localDate(v.createdAt),
      issuedByName: v.issuedByName || '',
      issuedAt: localDate(v.issuedAt),
      current: !!v.current,
    })),
  };
};

/** Kế hoạch năm dạng UI → YearPlanRequest (lưu cả văn bản). Lĩnh vực BE không có thì bỏ qua. */
export const toYearPlanRequest = (goal, refs) => ({
  planLevel: goal.planType || goal.planLevel || 'TEAM',
  planType: goal.planType || goal.planLevel || 'TEAM',
  ...(goal.curriculumSourcePlanId ? { curriculumSourcePlanId: serverId(goal.curriculumSourcePlanId) } : {}),
  branchTemplates: (goal.branchTemplates || []).map((t) => ({
    key: String(t.id),
    id: serverId(t.id),
    themeKey: String(t.themeId),
    name: t.name,
    startDate: t.startDate || null,
    endDate: t.endDate || null,
  })),
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
        ...(r.kind === 'goal' && r.displayLabel != null ? { displayLabel: r.displayLabel } : {}),
        contents: (r.contents || []).map((c) => ({ id: serverId(c.id), text: c.text, themeKeys: (c.themes || []).map(String) })),
        curriculumGoalId: r.kind === 'goal' ? (r.curriculumGoalId ?? null) : null,
        curriculumSubDomainId: r.kind === 'sub' ? (r.curriculumSubDomainId ?? null) : null,
        curriculumExpectedResultId: r.kind === 'group' ? (r.curriculumExpectedResultId ?? null) : null,
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
    if (to === EDU_STATUS.PENDING_VP || to === 'REVIEW') steps.push({ call: 'submit', note: lastNote(goal) });
    else if (to === EDU_STATUS.APPROVED) steps.push({ call: 'issue', note: lastNote(goal) });
    else if (to === EDU_STATUS.REJECTED || (from === 'REVIEW' && to === EDU_STATUS.DRAFT))
      steps.push({ call: 'return', note: lastNote(goal) });
  }
  return steps;
};
