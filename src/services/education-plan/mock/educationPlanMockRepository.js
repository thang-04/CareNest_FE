import { branchScheduleIssue } from '@/models/education-plan/branchTemplateSchedule.mjs';
import { inheritAnnual, planLevel, workflowKey, curriculumShape, DEFAULT_DURATION } from '@/models/education-plan/planLevel.mjs';
import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { parseGoalsCsv } from '@/utils/education-plan/goalCsv';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, withDefaults } from '@/models/education-plan/eduConfig';
import { ROLES } from '@/models/User';
import { duplicateAbbrThemeIds, toRows } from '@/models/education-plan/goalTable';
import { chainOf, currentPlanOf, diffPlans, versionOf } from '@/models/education-plan/planVersions.mjs';

/*
 * Fake backend for yearly goals, theme plans and lesson plans.
 * Status changes are decided by the pages for now; this layer stores records and blocks
 * deleting anything that has already been sent. Backend must own the approval flow.
 */
const COLLECTIONS = { goals: 'eduGoals', themes: 'eduThemes', lessons: 'eduLessons' };

// EDU-65/57: tổ được sửa/thêm nội dung, giữ cấu trúc và không xóa nội dung nguồn.
const teamStructure = (plan) => curriculumShape(plan).map((domain) => ({
  ...domain, rows: domain.rows.map(({ contents, ...row }) => row),
}));
const validTeamContents = (baseline, item, plans) => {
  const rows = (plan) => (plan.domains || []).flatMap((domain) => domain.rows || []);
  const knownIds = new Set(plans.flatMap((plan) => rows(plan).flatMap((row) => (row.contents || []).map((c) => String(c.id)))));
  const previous = new Map(rows(baseline).map((row) => [String(row.id), row]));
  return rows(item).every((row) => {
    const oldIds = new Set((previous.get(String(row.id))?.contents || []).map((c) => String(c.id)));
    const seen = new Set();
    for (const content of row.contents || []) {
      const id = String(content.id);
      if (seen.has(id) || (knownIds.has(id) && !oldIds.has(id)) || (oldIds.has(id) && !content.text?.trim())) return false;
      seen.add(id);
    }
    return [...oldIds].every((id) => seen.has(id));
  });
};

// BE:EDU-06/24 — Phó HT lấy mọi bản; Tổ trưởng lấy mọi bản nhóm mình và bản đã ban hành của nhóm khác.
const sourceGroup = (actor, requested) => {
  if (actor?.role === ROLES.VICE_PRINCIPAL || (actor?.role === ROLES.TEAM_LEADER && actor.ageGroupId)) return requested;
  throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
};
const sourceVisible = (actor, goal) =>
  planLevel(goal) === 'SCHOOL_YEAR'
    ? annualVisible(readDb(), goal, actor)
    : actor.role !== ROLES.TEAM_LEADER || goal.ageGroupId === actor.ageGroupId || goal.status === EDU_STATUS.APPROVED;
const sourceGoals = () => {
  const db = readDb();
  if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureSeeded);
  return readDb().eduGoals;
};
const goalCount = (goal) =>
  (goal.domains || []).reduce(
    (count, domain) => count + (domain.rows ? domain.rows.filter((row) => row.kind === 'goal').length : (domain.items || []).length),
    0,
  );
const sourceSummary = (goal) => ({
  id: String(goal.id),
  code: goal.code,
  title: goal.title,
  schoolYear: goal.schoolYear,
  ageGroupId: goal.ageGroupId,
  status: goal.status,
  revision: goal.revision ?? 0,
  goalCount: goalCount(goal),
});

// Trình duyệt còn bộ dữ liệu demo cũ (hoặc chưa có): nạp bộ demo kế hoạch giáo dục hiện hành
const ensureSeeded = (db) => {
  ensureEduDemo(db);
  return db;
};

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.unshift(item);
  else list[i] = item;
  return item;
};

const save = (kind) => async (item) => {
  await delay();
  if (!item?.id) throw eduError('REQUIRED_FIELD_MISSING', 'mã bản ghi');
  return writeDb((db) => clone(upsert(ensureSeeded(db)[COLLECTIONS[kind]], clone(item))));
};

const remove = (kind) => async (id) => {
  await delay();
  writeDb((db) => {
    const list = ensureSeeded(db)[COLLECTIONS[kind]];
    const found = list.find((x) => x.id === id);
    if (!found) throw eduError('YEAR_PLAN_NOT_FOUND');
    if (found.status !== EDU_STATUS.DRAFT && found.status !== EDU_STATUS.REJECTED) {
      throw eduError('YEAR_PLAN_DELETE_DRAFT_ONLY');
    }
    db[COLLECTIONS[kind]] = list.filter((x) => x.id !== id);
  });
};

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const releaseLock = ({ editing, editingAt, editingFrom, editSessionId, ...goal }) => ({ ...goal, status: editingFrom || EDU_STATUS.DRAFT });

const editGoal = (apply) => async (id, user, edit) => {
  if (!edit?.keepalive) await delay();
  return writeDb((db) => {
    const list = ensureSeeded(db).eduGoals;
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) throw eduError('YEAR_PLAN_NOT_FOUND');
    list[i] = apply(list[i], user, edit);
    return clone(list[i]);
  });
};

// Lưu: trang soạn gửi status Nháp; đang giữ khóa thì vẫn là Đang sửa (BE:EDU-10), gửi / ban hành thì nhả khóa
const mockRoles = (user) => [...(user?.roles || []), user?.role];
const authorOf = (db, goal, user) =>
  !withDefaults(db.eduConfig).workflowPolicy[workflowKey(goal)].reviewers.some((role) => mockRoles(user).includes(role)) &&
  withDefaults(db.eduConfig).workflowPolicy[workflowKey(goal)].creators.some(
    (role) =>
      mockRoles(user).includes(role) && (![ROLES.TEACHER, ROLES.TEAM_LEADER].includes(role) || goal.ageGroupId === user?.ageGroupId),
  );
const designatedAuthor = (goal, user) => {
  const owner = goal.owner?.userId ?? goal.authorIds?.[0];
  return owner == null || String(owner) === String(user?.id);
};
// BE:EDU-60 — mock chỉ cấp phạm vi năm theo vai trò/phân công hiệu lực của actor hiện tại.
const annualVisible = (db, goal, user) => {
  if (planLevel(goal) !== 'SCHOOL_YEAR') return true;
  if (!user || user.status === 'INACTIVE') return false;
  const roles = mockRoles(user);
  const policy = withDefaults(db.eduConfig).workflowPolicy.schoolYear;
  if (authorOf(db, goal, user)) return true;
  const reviewer = policy.reviewers.some(
    (r) =>
      roles.includes(r) &&
      ([ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(r) || (user.ageGroupId != null && user.ageGroupId === goal.ageGroupId)),
  );
  if (
    reviewer &&
    (['REVIEW', EDU_STATUS.APPROVED].includes(goal.status) ||
      (policy.reviewers.includes(ROLES.VICE_PRINCIPAL) && roles.includes(ROLES.VICE_PRINCIPAL)))
  )
    return true;
  return goal.status === EDU_STATUS.APPROVED && authorOf(db, { ...goal, planLevel: 'TEAM' }, user);
};

const creatorSlot = (db, goal) => ({
  roleKey: 'CREATOR',
  label: 'Người soạn',
  names: [
    ...new Set(
      [
        ...(db.users || []).filter((user) => (goal.authorIds || []).includes(user.id)).map((user) => user.fullName),
        goal.owner?.name,
      ].filter(Boolean),
    ),
  ],
});
const goalView = (db, goal, user) => {
  const policy = withDefaults(db.eduConfig).workflowPolicy[workflowKey(goal)];
  const review = {
    ...(goal.review || {}),
    policyRevision: db.eduConfig?.workflowRevision || 1,
    round: goal.reviewRound || 0,
    roles: policy.reviewers,
    waitingRole: goal.waitingRole || null,
    approvals: goal.approvals || [],
    printSnapshot: goal.printSnapshot || null,
  };
  if (!user) return { ...goal, editing: null, editExpiresAt: null, review };
  const author = authorOf(db, goal, user) && designatedAuthor(goal, user);
  const open = [EDU_STATUS.DRAFT, EDU_STATUS.EDITING, EDU_STATUS.REJECTED].includes(goal.status);
  const canReview = goal.status === 'REVIEW' && mockRoles(user).includes(review.waitingRole) && !(goal.authorIds || []).includes(user.id);
  return {
    ...goal,
    editing: null,
    editExpiresAt: null,
    status: goal.status === EDU_STATUS.EDITING || goal.status === EDU_STATUS.REJECTED ? EDU_STATUS.DRAFT : goal.status,
    review,
    permissions: {
      canEdit: author && open,
      canSubmit: author && open,
      canApprove: canReview,
      canIssue: canReview,
      canReturn: canReview,
      canDelete: author && open && planLevel(goal) === 'SCHOOL_YEAR',
      canCreateVersion: planLevel(goal) === 'SCHOOL_YEAR' && author && goal.status === EDU_STATUS.APPROVED,
    },
  };
};

const saveGoal = async (item, options = {}) => {
  await delay();
  if (!item?.id) throw eduError('REQUIRED_FIELD_MISSING', 'mã bản ghi');
  // BE:EDU-42 viết tắt chủ đề trùng bị chặn ngay khi lưu
  if (duplicateAbbrThemeIds(item.themes || []).size) throw eduError('THEME_ABBR_DUPLICATE');
  return writeDb((db) => {
    const list = ensureSeeded(db).eduGoals;
    const prev = list.find((x) => x.id === item.id);
    // BE:EDU-58: client cũ không gửi nhãn phải giữ nhãn đã lưu; chuỗi rỗng mới xóa.
    const oldLabels = new Map((prev?.domains || []).flatMap((d) => (d.rows || []).map((row) => [row.id, row.displayLabel])));
    item = {
      ...item,
      domains: (item.domains || []).map((d) => ({
        ...d,
        rows: (d.rows || []).map((row) => {
          if (row.kind !== 'goal') return row;
          const label = row.displayLabel ?? oldLabels.get(row.id);
          if (label == null) return row;
          if (label.length > 100) throw eduError('INVALID_VALUE', 'nhãn mục tiêu tối đa 100 ký tự');
          return { ...row, displayLabel: label.trim() || null };
        }),
      })),
    };
    // BE:FR-013/014/016 — mock giữ nguồn và cây kế thừa cố định, tick content vẫn được sửa.
    if (prev && planLevel(prev) !== planLevel(item)) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (prev?.curriculumSourcePlanId && prev.curriculumSourcePlanId !== item.curriculumSourcePlanId)
      throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (item.planLevel === 'TEAM' && !prev && !item.curriculumSourcePlanId)
      throw eduError('INVALID_VALUE', 'chọn kế hoạch năm học đã ban hành');
    if (item.curriculumSourcePlanId) {
      const source = list.find((g) => g.id === item.curriculumSourcePlanId);
      if (
        !source ||
        planLevel(source) !== 'SCHOOL_YEAR' ||
        source.status !== EDU_STATUS.APPROVED ||
        (!prev && currentPlanOf(list, source.ageGroupId, source.schoolYear, 'SCHOOL_YEAR')?.id !== source.id) ||
        source.ageGroupId !== item.ageGroupId ||
        source.schoolYear !== item.schoolYear
      )
        throw eduError('INVALID_VALUE', 'nguồn năm học không hợp lệ');
      const baseline = prev || source;
      if (
        JSON.stringify(teamStructure(baseline)) !== JSON.stringify(teamStructure(item)) ||
        !validTeamContents(baseline, item, list) ||
        JSON.stringify(baseline.themes) !== JSON.stringify(item.themes)
      )
        throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
      if (prev && JSON.stringify(prev.branchTemplates || []) !== JSON.stringify(item.branchTemplates || []))
        throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    }
    if (planLevel(item) === 'SCHOOL_YEAR')
      item = {
        ...item,
        domains: item.domains.map((d) => ({
          ...d,
          rows: (d.rows || []).map((row) => ({ ...row, contents: (row.contents || []).map((c) => ({ ...c, themes: [] })) })),
        })),
      };
    item = {
      ...item,
      durationPolicySnapshot:
        prev?.durationPolicySnapshot ||
        (prev
          ? { mode: 'LEGACY_UNBOUNDED' }
          : {
              mode: 'BOUNDED',
              ...clone(withDefaults(db.eduConfig).durationPolicy || DEFAULT_DURATION),
            }),
    };
    const edit = options.edit;
    const actor = options.actor;
    if (
      options.action === 'submit' &&
      planLevel(item) === 'SCHOOL_YEAR' &&
      (item.branchTemplates || []).some((t) => !t.name?.trim() || !item.themes.some((theme) => String(theme.id) === String(t.themeId)))
    )
      throw eduError('INVALID_VALUE', 'chủ đề nhánh / dự án thiếu tên hoặc sai chủ đề cha');
    if (actor && options.action === 'approve') {
      if (!goalView(db, prev, actor).permissions.canApprove) throw eduError('NOT_YOUR_REVIEW_STEP', 'duyệt');
      const roles = withDefaults(db.eduConfig).workflowPolicy[workflowKey(prev)].reviewers;
      const approval = { userId: actor.id, name: actor.name, roleKey: prev.waitingRole, at: stamp(), round: prev.reviewRound || 1 };
      const waitingRole = roles[roles.indexOf(prev.waitingRole) + 1] || null;
      const next = {
        ...prev,
        revision: (prev.revision || 0) + 1,
        approvals: [...(prev.approvals || []), approval],
        waitingRole,
        status: waitingRole ? 'REVIEW' : EDU_STATUS.APPROVED,
      };
      if (!waitingRole)
        next.printSnapshot = {
          schemaVersion: 1,
          origin: 'PUBLICATION',
          capturedAt: new Date().toISOString(),
          documentType: 'year',
          policyRevision: db.eduConfig?.workflowRevision || 1,
          slots: [
            creatorSlot(db, next),
            ...roles.map((role) => ({
              roleKey: role,
              label: SIGN_ROLES[role],
              names: next.approvals.filter((a) => a.roleKey === role).map((a) => a.name),
            })),
          ],
        };
      upsert(list, next);
      if (next.status === EDU_STATUS.APPROVED) ensureTeamAfterPublication(db, next);
      return clone(goalView(db, next, actor));
    }
    if (actor && options.action === 'reject' && !goalView(db, prev, actor).permissions.canReturn)
      throw eduError('NOT_YOUR_REVIEW_STEP', 'trả lại');
    if (actor && !['reject'].includes(options.action) && (!authorOf(db, item, actor) || (prev && !designatedAuthor(prev, actor))))
      throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (prev?.status === EDU_STATUS.APPROVED) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (prev && !edit && (item.revision || 0) !== (prev.revision || 0)) throw eduError('YEAR_PLAN_REVISION_STALE');

    if (prev && edit) {
      if ((prev.revision || 0) !== edit.revision) throw eduError('YEAR_PLAN_REVISION_STALE');
      if (prev.lastSaveRequestId === edit.requestId) return clone(prev);
    }
    const { editing, editingAt, editingFrom, editSessionId, ...rest } = clone(item);
    const isReview = rest.status === 'REVIEW' || rest.status === EDU_STATUS.PENDING_VP;
    if (isReview && (prev?.reviewItems || []).some((reviewItem) => !reviewItem.resolved))
      throw eduError('INVALID_VALUE', 'còn mục cần rà soát');
    if (isReview || rest.status === EDU_STATUS.APPROVED) {
      const issue = branchScheduleIssue(rest.branchTemplates || []);
      if (issue) throw eduError('INVALID_VALUE', issue);
    }
    const next = rest.status === EDU_STATUS.EDITING ? { ...rest, status: EDU_STATUS.DRAFT } : rest;
    if (isReview) {
      next.status = 'REVIEW';
      const yearReviewers = withDefaults(db.eduConfig).workflowPolicy[workflowKey(item)].reviewers;
      next.waitingRole = yearReviewers[0] || 'VICE_PRINCIPAL';
      if (prev?.status === EDU_STATUS.DRAFT || prev?.status === EDU_STATUS.REJECTED || prev?.status === EDU_STATUS.EDITING) {
        next.reviewRound = (prev?.reviewRound || 0) + 1;
        next.approvals = [];
      }
      delete next.editSessionId;
      delete next.editing;
      delete next.editingAt;
      delete next.editingFrom;
    } else if (rest.status === EDU_STATUS.APPROVED) {
      next.status = EDU_STATUS.APPROVED;
      delete next.waitingRole;
      delete next.editSessionId;
      delete next.editing;
      delete next.editingAt;
      delete next.editingFrom;
      if (!next.printSnapshot) {
        const yearReviewers = withDefaults(db.eduConfig).workflowPolicy[workflowKey(item)].reviewers;
        const slots = [
          creatorSlot(db, next),
          ...yearReviewers.map((r) => ({
            roleKey: r,
            label: SIGN_ROLES[r] || r,
            names: next.issued?.name ? [next.issued.name] : [],
          })),
        ];
        next.printSnapshot = {
          schemaVersion: 1,
          origin: 'PUBLICATION',
          documentType: 'year',
          policyRevision: db.eduConfig?.workflowRevision || 1,
          capturedAt: new Date().toISOString(),
          slots,
        };
      }
    } else if (rest.status === EDU_STATUS.DRAFT) {
      delete next.waitingRole;
    }
    if (prev) {
      next.reviewItems = prev.reviewItems || [];
      next.newItems = prev.newItems || [];
      next.previousSourcePlanId = prev.previousSourcePlanId;
    }
    if (edit) {
      next.revision = (prev?.revision || 0) + 1;
      next.lastSaveRequestId = edit.requestId;
    }
    if (actor && (!options.action || options.action === 'submit')) next.authorIds = [...new Set([...(prev?.authorIds || []), actor.id])];
    upsert(list, next);
    if (next.status === EDU_STATUS.APPROVED) ensureTeamAfterPublication(db, next);
    return clone(goalView(db, next, actor));
  });
};

const newId = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

// BE:EDU-25 — chép cả cây sang phiên bản n+1, dòng chép giữ lineage để so sánh và chép tài liệu lớp
const copyPlan = (source, user, versionNo, code) => {
  const themeIds = new Map((source.themes || []).map((t) => [t.id, newId('th')]));
  return {
    ...clone(source),
    id: `${source.id}-v${versionNo}`,
    code,
    versionNo,
    sourcePlanId: source.id,
    status: EDU_STATUS.DRAFT,
    reviewRound: 0,
    approvals: [],
    printSnapshot: null,
    revision: 0,
    owner: { userId: user.id, name: user.fullName, title: null, at: stamp().slice(0, 10) },
    createdBy: user.fullName,
    createdAt: stamp().slice(0, 10),
    sentAt: null,
    sentBy: null,
    issued: null,
    permissions: undefined,
    history: [{ at: stamp(), by: user.fullName, action: `Tạo phiên bản ${versionNo} từ phiên bản ${versionOf(source)}`, tone: '' }],
    themes: (source.themes || []).map((t) => ({ ...t, id: themeIds.get(t.id), lineageId: t.lineageId ?? t.id })),
    branchTemplates: (source.branchTemplates || []).map((t) => ({
      ...t,
      id: newId('tpl'),
      themeId: themeIds.get(t.themeId),
      lineageId: t.lineageId || t.id,
    })),
    breaks: (source.breaks || []).map((b) => ({ ...b, id: newId('br'), lineageId: b.lineageId ?? b.id })),
    domains: (source.domains || []).map((d) => ({
      id: d.id,
      name: d.name,
      rows: toRows(d, () => newId('r')).map((r) => ({
        ...r,
        id: newId('r'),
        lineageId: r.lineageId ?? r.id,
        ...(r.kind === 'goal'
          ? {
              contents: (r.contents || []).map((c) => ({
                ...c,
                id: newId('c'),
                lineageId: c.lineageId ?? c.id,
                themes: (c.themes || []).map((t) => themeIds.get(t)).filter(Boolean),
              })),
            }
          : {}),
      })),
    })),
  };
};

// BE:EDU-62 — bản tổ đầu tiên tự sinh khi năm ban hành; không cần thao tác lập tổ.
const ensureTeamAfterPublication = (db, annual) => {
  if (planLevel(annual) !== 'SCHOOL_YEAR' || annual.status !== EDU_STATUS.APPROVED) return;
  const list = db.eduGoals;
  const sameScope = (plan) => plan.schoolYear === annual.schoolYear && plan.ageGroupId === annual.ageGroupId;
  if (list.some((plan) => sameScope(plan) && planLevel(plan) === 'SCHOOL_YEAR' && plan.status === EDU_STATUS.APPROVED && versionOf(plan) > versionOf(annual))) return;
  const teams = list.filter((plan) => sameScope(plan) && planLevel(plan) === 'TEAM').sort((a, b) => versionOf(b) - versionOf(a));
  const prior = teams.find((plan) => plan.status !== EDU_STATUS.APPROVED) || teams[0];
  if (prior?.curriculumSourcePlanId === annual.id || prior && !prior.curriculumSourcePlanId) return;
  if (!prior) {
    const leaders = (db.users || []).filter((user) => user.status !== 'INACTIVE' && user.ageGroupId === annual.ageGroupId && mockRoles(user).includes(ROLES.TEAM_LEADER));
    if (leaders.length !== 1) throw eduError('INVALID_VALUE', 'cần đúng một tổ trưởng đang được phân công cho nhóm tuổi để soạn kế hoạch tổ');
    const team = copyPlan({ ...annual, ...inheritAnnual(annual) }, leaders[0], 1, annual.code.replace(/^KHN-/, ''));
    Object.assign(team, { id: newId('team'), title: 'Kế hoạch giáo dục tổ', description: '', sourcePlanId: null, authorIds: [leaders[0].id], durationPolicySnapshot: clone(annual.durationPolicySnapshot || { mode: 'MISSING_OR_UNKNOWN' }) });
    list.unshift(team);
    return;
  }
  const baseline = list.find((plan) => plan.id === prior.curriculumSourcePlanId);
  const inherited = inheritAnnual(annual, prior, baseline);
  if (prior.status !== EDU_STATUS.APPROVED) {
    Object.assign(prior, inherited, { previousSourcePlanId: prior.curriculumSourcePlanId, status: EDU_STATUS.DRAFT, approvals: [], waitingRole: null, printSnapshot: null, revision: (prior.revision || 0) + 1 });
  } else {
    const owner = (db.users || []).find((user) => user.id === prior.owner?.userId) || { id: prior.owner?.userId, fullName: prior.owner?.name };
    const team = copyPlan({ ...prior, ...inherited }, owner, versionOf(prior) + 1, `${teams.at(-1).code}-V${versionOf(prior) + 1}`);
    team.previousSourcePlanId = prior.curriculumSourcePlanId;
    list.unshift(team);
  }
};

export const educationPlanMockRepository = {
  // BE giả cho BE:EDU-46: chỉ đọc CSV mẫu cũ (Word/Excel cần BE thật)
  async previewGoalFile(file) {
    await delay();
    if (!/\.csv$/i.test(file?.name || '')) throw eduError('GOAL_FILE_UNSUPPORTED');
    const { domains, skipped } = parseGoalsCsv(await file.text());
    const themeAbbrs = [...new Set(domains.flatMap((d) => d.rows.flatMap((r) => (r.contents || []).flatMap((c) => c.themes))))];
    return {
      domains: domains.map((d) => ({ name: d.domain, rows: d.rows })),
      themeAbbrs,
      warnings: skipped ? [{ row: 0, message: `Bỏ qua ${skipped} dòng không hợp lệ` }] : [],
    };
  },
  async createGoalVersion(id, user, edit = {}) {
    await delay();
    return writeDb((db) => {
      const list = ensureSeeded(db).eduGoals;
      const source = list.find((g) => g.id === id);
      if (!source) throw eduError('YEAR_PLAN_NOT_FOUND');
      const allowed = authorOf(db, source, user);
      if (!allowed) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
      const chain = chainOf(list, source);
      const open = chain.find((g) => g.status !== EDU_STATUS.APPROVED);
      if (open) throw eduError('YEAR_PLAN_OPEN_VERSION_EXISTS', open.code);
      if (currentPlanOf(list, source.ageGroupId, source.schoolYear, planLevel(source))?.id !== source.id)
        throw eduError('YEAR_PLAN_VERSION_SOURCE_INVALID');
      const versionNo = versionOf(source) + 1;
      let base = source;
      if (edit.curriculumSourcePlanId) {
        const annual = list.find((g) => g.id === edit.curriculumSourcePlanId);
        if (
          !annual ||
          planLevel(annual) !== 'SCHOOL_YEAR' ||
          annual.status !== EDU_STATUS.APPROVED ||
          annual.ageGroupId !== source.ageGroupId ||
          annual.schoolYear !== source.schoolYear ||
          planLevel(source) !== 'TEAM'
        )
          throw eduError('YEAR_PLAN_VERSION_SOURCE_INVALID');
        const priorAnnual = list.find((g) => g.id === source.curriculumSourcePlanId);
        base = { ...source, ...inheritAnnual(annual, source, priorAnnual) };
      }
      const plan = copyPlan(base, user, versionNo, `${chain[0].code}-V${versionNo}`);
      plan.durationPolicySnapshot = { mode: 'BOUNDED', ...clone(withDefaults(db.eduConfig).durationPolicy) };
      list.unshift(plan);
      return clone(plan);
    });
  },
  async getGoalChanges(id, fromId, user) {
    await delay();
    const list = sourceGoals();
    const plan = list.find((g) => g.id === id);
    const from = list.find((g) => g.id === (fromId || plan?.sourcePlanId));
    if (!plan || !from) throw eduError('YEAR_PLAN_NOT_FOUND');
    if (!annualVisible(readDb(), plan, user) || !annualVisible(readDb(), from, user)) throw eduError('YEAR_PLAN_ACCESS_DENIED');
    return diffPlans(from, plan);
  },
  async listGoalSources({ schoolYear, ageGroupId, excludeId, planLevel = 'TEAM' } = {}, actor) {
    const group = planLevel === 'SCHOOL_YEAR' ? ageGroupId : sourceGroup(actor, ageGroupId);
    await delay();
    return sourceGoals()
      .filter(
        (goal) =>
          (goal.planLevel || 'TEAM') === planLevel &&
          (!schoolYear || goal.schoolYear === schoolYear) &&
          (!group || goal.ageGroupId === group) &&
          sourceVisible(actor, goal) &&
          String(goal.id) !== String(excludeId),
      )
      .map(sourceSummary);
  },
  async getGoalSource(id, actor) {
    await delay();
    const goal = sourceGoals().find((item) => String(item.id) === String(id));
    if (!goal) throw eduError('YEAR_PLAN_NOT_FOUND');
    if (planLevel(goal) !== 'SCHOOL_YEAR') sourceGroup(actor);
    if (!sourceVisible(actor, goal))
      throw eduError(planLevel(goal) === 'SCHOOL_YEAR' ? 'YEAR_PLAN_ACCESS_DENIED' : 'YEAR_PLAN_EDIT_FORBIDDEN');
    return clone({ ...goal, id: String(goal.id), revision: goal.revision ?? 0, goalCount: goalCount(goal) });
  },
  async getAll(user) {
    await delay();
    const db = readDb();
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureSeeded);
    const current = readDb();
    const published = current.eduGoals.filter((plan) => planLevel(plan) === 'SCHOOL_YEAR' && plan.status === EDU_STATUS.APPROVED && currentPlanOf(current.eduGoals, plan.ageGroupId, plan.schoolYear, 'SCHOOL_YEAR')?.id === plan.id);
    const pending = published.filter((annual) => {
      const teams = current.eduGoals.filter((plan) => planLevel(plan) === 'TEAM' && plan.ageGroupId === annual.ageGroupId && plan.schoolYear === annual.schoolYear).sort((a, b) => versionOf(b) - versionOf(a));
      const prior = teams.find((plan) => plan.status !== EDU_STATUS.APPROVED) || teams[0];
      return !prior || prior.curriculumSourcePlanId && prior.curriculumSourcePlanId !== annual.id;
    });
    if (pending.length) writeDb((next) => pending.forEach((annual) => ensureTeamAfterPublication(next, annual)));
    const fresh = readDb();
    return {
      goals: clone(fresh.eduGoals.filter((goal) => annualVisible(fresh, goal, user)).map((goal) => goalView(fresh, goal, user))),
      themes: clone(fresh.eduThemes),
      lessons: clone(fresh.eduLessons),
    };
  },
  saveGoal,
  startEditingGoal: editGoal((goal, user) => {
    if (!authorOf(readDb(), goal, user) || !designatedAuthor(goal, user)) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (
      goal.status !== EDU_STATUS.DRAFT &&
      goal.status !== EDU_STATUS.REJECTED &&
      goal.status !== EDU_STATUS.EDITING &&
      goal.status !== EDU_STATUS.PENDING_VP
    )
      throw eduError('YEAR_PLAN_INVALID_STATUS', 'sửa');
    return releaseLock(goal);
  }),
  // EDU-62: xác nhận từng mục chỉ sau khi lưu mapping với nguồn/phiên/revision hiện tại.
  resolveGoalReview: async (id, reviewItemId, expectedSourcePlanId, edit, actor) => {
    await delay();
    return writeDb((db) => {
      const goal = ensureSeeded(db).eduGoals.find((item) => item.id === id);
      if (!goal) throw eduError('YEAR_PLAN_NOT_FOUND');
      if (planLevel(goal) !== 'TEAM' || !authorOf(db, goal, actor) || !designatedAuthor(goal, actor)) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
      if (!['DRAFT', 'EDITING'].includes(goal.status)) throw eduError('YEAR_PLAN_INVALID_STATUS', 'rà soát');
      if ((goal.revision ?? 0) !== (edit.revision ?? 0) || String(goal.curriculumSourcePlanId) !== String(expectedSourcePlanId))
        throw eduError('YEAR_PLAN_REVISION_STALE');
      const item = (goal.reviewItems || []).find((reviewItem) => String(reviewItem.reviewItemId) === String(reviewItemId));
      if (!item) throw eduError('YEAR_PLAN_NOT_FOUND');
      if (String(item.sourcePlanId) !== String(expectedSourcePlanId)) throw eduError('YEAR_PLAN_REVISION_STALE');
      const themeIds = new Set((goal.themes || []).map((theme) => String(theme.id)));
      if (
        (goal.domains || []).some((domain) =>
          domain.rows.some((row) =>
            (row.contents || []).some((content) => (content.themes || []).some((themeId) => !themeIds.has(String(themeId)))),
          ),
        )
      )
        throw eduError('INVALID_VALUE', 'liên kết chủ đề không còn hợp lệ');
      if (!item.resolved) {
        item.resolved = true;
        item.resolvedBy = actor.id;
        item.resolvedAt = new Date().toISOString();
        goal.revision = (goal.revision || 0) + 1;
      }
      return clone(goalView(db, goal, actor));
    });
  },
  heartbeatGoal: editGoal((goal, user) => {
    if (!authorOf(readDb(), goal, user) || !designatedAuthor(goal, user)) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    return goal;
  }),
  finishEditingGoal: editGoal((goal) => goal),
  deleteGoal: async (id, revision, _actor) => {
    const goal = ensureSeeded(readDb()).eduGoals.find((item) => item.id === id);
    if (planLevel(goal) === 'TEAM') throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (goal && (revision ?? 0) !== (goal.revision ?? 0)) throw eduError('YEAR_PLAN_REVISION_STALE');
    return remove('goals')(id);
  },
  saveTheme: save('themes'),
  deleteTheme: remove('themes'),
  saveLesson: save('lessons'),
  deleteLesson: remove('lessons'),
};
