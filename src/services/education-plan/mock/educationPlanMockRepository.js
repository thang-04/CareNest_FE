import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { parseGoalsCsv } from '@/utils/education-plan/goalCsv';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ROLES } from '@/models/User';
import { duplicateAbbrThemeIds, toRows } from '@/models/education-plan/goalTable';
import { chainOf, currentPlanOf, diffPlans, versionOf } from '@/models/education-plan/planVersions.mjs';

/*
 * Fake backend for yearly goals, theme plans and lesson plans.
 * Status changes are decided by the pages for now; this layer stores records and blocks
 * deleting anything that has already been sent. Backend must own the approval flow.
 */
const COLLECTIONS = { goals: 'eduGoals', themes: 'eduThemes', lessons: 'eduLessons' };

// BE:EDU-06/24 — Phó HT lấy mọi bản; Tổ trưởng lấy mọi bản nhóm mình và bản đã ban hành của nhóm khác.
const sourceGroup = (actor, requested) => {
  if (actor?.role === ROLES.VICE_PRINCIPAL || (actor?.role === ROLES.TEAM_LEADER && actor.ageGroupId)) return requested;
  throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
};
const sourceVisible = (actor, goal) =>
  actor.role !== ROLES.TEAM_LEADER || goal.ageGroupId === actor.ageGroupId || goal.status === EDU_STATUS.APPROVED;
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

// BE:EDU-10 — khóa "Đang sửa" của kế hoạch năm; tự nhả sau 90 giây không liên lạc
const EDIT_LOCK_MS = 90 * 1000;
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const lockedByOther = (goal, user) =>
  goal.status === EDU_STATUS.EDITING && goal.editing?.userId !== user.id && Date.now() - (goal.editingAt || 0) < EDIT_LOCK_MS;
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
const saveGoal = async (item, options = {}) => {
  await delay();
  if (!item?.id) throw eduError('REQUIRED_FIELD_MISSING', 'mã bản ghi');
  // BE:EDU-42 viết tắt chủ đề trùng bị chặn ngay khi lưu
  if (duplicateAbbrThemeIds(item.themes || []).size) throw eduError('THEME_ABBR_DUPLICATE');
  return writeDb((db) => {
    const list = ensureSeeded(db).eduGoals;
    const prev = list.find((x) => x.id === item.id);
    const edit = options.edit;
    if (prev?.status === EDU_STATUS.APPROVED) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    if (prev?.editSessionId && !edit && Date.now() - (prev.editingAt || 0) < EDIT_LOCK_MS)
      throw eduError('YEAR_PLAN_LOCKED_BY_OTHER', prev.editing?.name || 'người khác');
    if (prev && !edit && (item.revision || 0) !== (prev.revision || 0)) throw eduError('YEAR_PLAN_REVISION_STALE');
    if (prev?.editSessionId && edit && Date.now() - (prev.editingAt || 0) >= EDIT_LOCK_MS) throw eduError('EDIT_SESSION_LOST');

    if (prev && edit) {
      if (prev.editSessionId && prev.editSessionId !== edit.sessionId && Date.now() - (prev.editingAt || 0) < EDIT_LOCK_MS)
        throw eduError('EDIT_SESSION_LOST');
      if (prev.lastSaveRequestId === edit.requestId) return clone(prev);
      if ((prev.revision || 0) !== edit.revision) throw eduError('YEAR_PLAN_REVISION_STALE');
    }
    const { editing, editingAt, editingFrom, editSessionId, ...rest } = clone(item);
    const draftLike = rest.status === EDU_STATUS.DRAFT || rest.status === EDU_STATUS.REJECTED;
    const keep = prev?.status === EDU_STATUS.EDITING && draftLike;
    const next = keep
      ? { ...rest, status: EDU_STATUS.EDITING, editing: prev.editing, editingFrom: prev.editingFrom, editingAt: Date.now() }
      : rest;
    if (edit) {
      next.revision = (prev?.revision || 0) + 1;
      next.lastSaveRequestId = edit.requestId;
      if (
        rest.status !== EDU_STATUS.APPROVED &&
        rest.status !== EDU_STATUS.REJECTED &&
        !(rest.status === EDU_STATUS.PENDING_VP && prev?.status !== EDU_STATUS.PENDING_VP)
      ) {
        next.editSessionId = edit.sessionId;
        next.editingAt = Date.now();
        next.editing = prev?.editing || { userId: item.owner?.userId, name: item.createdBy, at: stamp() };
        next.editingFrom = prev?.editingFrom || rest.status;
        next.status = rest.status === EDU_STATUS.PENDING_VP ? rest.status : EDU_STATUS.EDITING;
      }
    }
    return clone(upsert(list, next));
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
  async createGoalVersion(id, user) {
    await delay();
    return writeDb((db) => {
      const list = ensureSeeded(db).eduGoals;
      const source = list.find((g) => g.id === id);
      if (!source) throw eduError('YEAR_PLAN_NOT_FOUND');
      const allowed = user.role === ROLES.VICE_PRINCIPAL || (user.role === ROLES.TEAM_LEADER && user.ageGroupId === source.ageGroupId);
      if (!allowed) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
      const chain = chainOf(list, source);
      const open = chain.find((g) => g.status !== EDU_STATUS.APPROVED);
      if (open) throw eduError('YEAR_PLAN_OPEN_VERSION_EXISTS', open.code);
      if (currentPlanOf(list, source.ageGroupId, source.schoolYear)?.id !== source.id) throw eduError('YEAR_PLAN_VERSION_SOURCE_INVALID');
      const versionNo = versionOf(source) + 1;
      const plan = copyPlan(source, user, versionNo, `${chain[0].code}-V${versionNo}`);
      list.unshift(plan);
      return clone(plan);
    });
  },
  async getGoalChanges(id, fromId) {
    await delay();
    const list = sourceGoals();
    const plan = list.find((g) => g.id === id);
    const from = list.find((g) => g.id === (fromId || plan?.sourcePlanId));
    if (!plan || !from) throw eduError('YEAR_PLAN_NOT_FOUND');
    return diffPlans(from, plan);
  },
  async listGoalSources({ schoolYear, ageGroupId, excludeId } = {}, actor) {
    const group = sourceGroup(actor, ageGroupId);
    await delay();
    return sourceGoals()
      .filter(
        (goal) =>
          (!schoolYear || goal.schoolYear === schoolYear) &&
          (!group || goal.ageGroupId === group) &&
          sourceVisible(actor, goal) &&
          String(goal.id) !== String(excludeId),
      )
      .map(sourceSummary);
  },
  async getGoalSource(id, actor) {
    sourceGroup(actor);
    await delay();
    const goal = sourceGoals().find((item) => String(item.id) === String(id));
    if (!goal) throw eduError('YEAR_PLAN_NOT_FOUND');
    if (!sourceVisible(actor, goal)) throw eduError('YEAR_PLAN_EDIT_FORBIDDEN');
    return clone({ ...goal, id: String(goal.id), revision: goal.revision ?? 0, goalCount: goalCount(goal) });
  },
  async getAll() {
    await delay();
    const db = readDb();
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureSeeded);
    const fresh = readDb();
    return { goals: clone(fresh.eduGoals), themes: clone(fresh.eduThemes), lessons: clone(fresh.eduLessons) };
  },
  saveGoal,
  startEditingGoal: editGoal((goal, user, edit) => {
    if (lockedByOther(goal, user)) throw eduError('YEAR_PLAN_LOCKED_BY_OTHER', goal.editing.name);
    // BE:EDU-10 (27/10) — cùng tài khoản mở lại thì phiên mới nhận quyền ngay; người khác vẫn chờ hết hạn (lockedByOther)
    if (goal.status === EDU_STATUS.PENDING_VP && !edit) return goal;
    if (
      goal.status !== EDU_STATUS.DRAFT &&
      goal.status !== EDU_STATUS.REJECTED &&
      goal.status !== EDU_STATUS.EDITING &&
      goal.status !== EDU_STATUS.PENDING_VP
    )
      throw eduError('YEAR_PLAN_INVALID_STATUS', 'sửa');
    const mine = goal.status === EDU_STATUS.EDITING && goal.editing?.userId === user.id;
    const from = goal.status === EDU_STATUS.EDITING ? goal.editingFrom : goal.status;
    return {
      ...goal,
      status: from === EDU_STATUS.PENDING_VP ? from : EDU_STATUS.EDITING,
      editSessionId: edit?.sessionId,
      editingFrom: from,
      editing: mine ? goal.editing : { userId: user.id, name: user.fullName, at: stamp() },
      editingAt: Date.now(),
    };
  }),
  heartbeatGoal: editGoal((goal, user, edit) => {
    if (goal.editSessionId !== edit.sessionId || Date.now() - (goal.editingAt || 0) >= EDIT_LOCK_MS) throw eduError('EDIT_SESSION_LOST');
    return { ...goal, editingAt: Date.now() };
  }),
  finishEditingGoal: editGoal((goal, user, options) =>
    goal.editing?.userId === user.id && (!options?.edit || options.edit.sessionId === goal.editSessionId) ? releaseLock(goal) : goal,
  ),
  deleteGoal: async (id, revision) => {
    const goal = ensureSeeded(readDb()).eduGoals.find((item) => item.id === id);
    if (goal?.editSessionId && Date.now() - (goal.editingAt || 0) < EDIT_LOCK_MS)
      throw eduError('YEAR_PLAN_LOCKED_BY_OTHER', goal.editing?.name || 'người khác');
    if (goal && (revision ?? 0) !== (goal.revision ?? 0)) throw eduError('YEAR_PLAN_REVISION_STALE');
    if (goal?.editSessionId)
      writeDb((db) => {
        const found = db.eduGoals.findIndex((item) => item.id === id);
        if (found >= 0) db.eduGoals[found] = releaseLock(db.eduGoals[found]);
      });
    return remove('goals')(id);
  },
  saveTheme: save('themes'),
  deleteTheme: remove('themes'),
  saveLesson: save('lessons'),
  deleteLesson: remove('lessons'),
};
