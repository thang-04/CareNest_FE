import { hasFutureClassContent, validateFutureClassEdit } from './classDocFutureEdit';
import { calendarPlan, projectCalendar, branchWeeks } from '@/models/education-plan/branchCalendar.mjs';
import { DEFAULT_DURATION } from '@/models/education-plan/planLevel.mjs';
import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { CLASS_DOC, createBlocker, dossierWeekDocs, isEditableStatus, submitBlocker, yearWeeks } from '@/models/education-plan/classPlan';
import { PENDING_OF, SIGN_ROLES, withDefaults } from '@/models/education-plan/eduConfig';
import { toRows } from '@/models/education-plan/goalTable';
import { currentPlanOf, diffPlans, unresolvedFlags, versionFlags, versionOf } from '@/models/education-plan/planVersions.mjs';
import { parseCsv } from '@/utils/csv';

/*
 * Fake backend cho tài liệu kế hoạch của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần).
 * Luồng gửi / duyệt nằm ở đây để màn hình chỉ gửi hành động; BE thật phải sở hữu các quy tắc này.
 */
const COLLECTIONS = {
  [CLASS_DOC.BRANCH]: 'eduClassBranch',
  [CLASS_DOC.THEME]: 'eduClassTheme',
  [CLASS_DOC.WEEK]: 'eduClassWeek',
};

const ensureCollections = (db) => {
  Object.values(COLLECTIONS).forEach((key) => {
    db[key] ||= [];
  });
  return db;
};

const now = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const entry = (user, action, tone = '', note) => ({
  action,
  by: user.fullName,
  role: ROLE_LABELS[user.role] || user.role,
  at: now(),
  tone,
  ...(note ? { note } : {}),
});

const classOf = (db, classId) => (db.classes || []).find((c) => c.id === classId);
const teachesClass = (cls, user) => !!cls && (cls.teacherIds || []).includes(user.id);
// Tổ trưởng của khối: tài khoản tổ trưởng cùng nhóm tuổi với lớp
const leadersOf = (db, cls) => (db.users || []).filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls?.ageGroupId);

const findDoc = (db, kind, id) => {
  const doc = (ensureCollections(db)[COLLECTIONS[kind]] || []).find((x) => x.id === id);
  if (!doc) throw eduError('CLASS_DOC_NOT_FOUND');
  return doc;
};

// BE:EDU-26 — phiên bản kế hoạch năm đã có bản ban hành mới hơn thì tài liệu của nó chỉ xem
const isSuperseded = (db, yearPlanId) => {
  const plan = (db.eduGoals || []).find((g) => g.id === yearPlanId);
  const current = plan && currentPlanOf(db.eduGoals, plan.ageGroupId, plan.schoolYear);
  return !!current && versionOf(current) > versionOf(plan);
};
const withRows = (plan) => plan && { ...plan, domains: plan.domains.map((d) => ({ ...d, rows: toRows(d, () => 'x') })) };
const todayIso = () => new Date().toISOString().slice(0, 10);
// BE:EDU-26 — số ô đỏ còn lại của bản chép (tham chiếu bị bỏ hoặc mục đổi chưa kiểm tra)
const unresolvedOf = (db, kind, doc) => {
  if (!doc?.sourceDocKey) return 0;
  const source = Object.values(COLLECTIONS)
    .flatMap((key) => db[key] || [])
    .find((d) => d.id === doc.sourceDocKey);
  const plan = withRows((db.eduGoals || []).find((g) => g.id === doc.yearPlanId));
  const from = (db.eduGoals || []).find((g) => g.id === source?.yearPlanId);
  if (!source || !plan || !from || from.id === plan.id) return 0;
  return unresolvedFlags(versionFlags(kind, doc, diffPlans(from, plan), plan, todayIso()), doc).length;
};
const rolesOf = (user) => [...(user?.roles || []), user?.role];
// BE:EDU-03/12..18 — fake backend tính quyền, UI chỉ đọc capabilities.
const authorsOf = (db, doc) =>
  new Set([
    ...(doc.authorIds || []),
    ...(db.eduClassWeek || [])
      .filter((week) => week.classId === doc.classId && week.yearPlanId === doc.yearPlanId && week.themeId === doc.themeId)
      .flatMap((week) => week.authorIds || []),
  ]);
const canAuthor = (db, kind, classId, user) => {
  const cls = classOf(db, classId);
  if (cls?.homeroomTeacherId && String(cls.homeroomTeacherId) !== String(user?.id)) return false;
  const policy = withDefaults(db.eduConfig).workflowPolicy[kind === 'branch' ? 'branch' : 'theme'];
  if (policy.reviewers.some((role) => rolesOf(user).includes(role))) return false;
  const roles = policy.creators;
  return roles.some(
    (role) =>
      rolesOf(user).includes(role) &&
      (role === ROLES.TEACHER ? teachesClass(cls, user) : role === ROLES.TEAM_LEADER ? user?.ageGroupId === cls?.ageGroupId : true),
  );
};
const decorate = (db, doc, user, kind = doc.kind) => {
  const root =
    kind === 'week'
      ? (db.eduClassTheme || []).find(
          (item) => item.classId === doc.classId && item.yearPlanId === doc.yearPlanId && item.themeId === doc.themeId,
        )
      : null;
  const review = {
    ...(doc.review || {}),
    policyRevision: db.eduConfig?.workflowRevision || 1,
    round: doc.reviewRound || 0,
    roles: withDefaults(db.eduConfig).workflowPolicy[kind === 'branch' ? 'branch' : 'theme'].reviewers,
    waitingRole: doc.waitingRole || null,
    approvals: doc.approvals || [],
    printSnapshot: doc.printSnapshot || null,
  };
  const author = canAuthor(db, kind, doc.classId, user);
  const reviewer =
    kind !== 'week' && doc.status === 'REVIEW' && rolesOf(user).includes(review.waitingRole) && !authorsOf(db, doc).has(user?.id);
  return {
    ...doc,
    version: doc.version ?? 0,
    dossierVersion: kind === 'week' ? (root?.version ?? null) : null,
    review,
    superseded: isSuperseded(db, doc.yearPlanId),
    adjustments: doc.adjustments || {},
    ...(user
      ? {
          permissions: {
            canEdit: author && doc.status !== 'REVIEW' && root?.status !== 'REVIEW' && !isSuperseded(db, doc.yearPlanId) && hasFutureClassContent(kind, doc, (db.eduGoals || []).find((plan) => plan.id === doc.yearPlanId)),
            canSubmit: kind !== 'week' && author && isEditableStatus(doc.status),
            canApprove: reviewer,
            canReject: reviewer,
            canEditAdjustments: kind === 'week' && author,
          },
        }
      : {}),
  };
};
const assertVersion = (current, expected) => {
  if (expected != null && expected !== (current?.version ?? -1)) throw eduError('YEAR_PLAN_REVISION_STALE');
};
const bumpRoot = (db, kind, doc, expected) => {
  if (kind !== 'week') return;
  const root = (db.eduClassTheme || []).find(
    (item) => item.classId === doc.classId && item.yearPlanId === doc.yearPlanId && item.themeId === doc.themeId,
  );
  assertVersion(root, expected);
  if (root) root.version = (root.version || 0) + 1;
};

export const classPlanMockRepository = {
  // BE:EDU-47 — demo CSV; Word/Excel được đọc bởi BE thật.
  async previewBranchFile(file, { classId, yearPlanId, draftCalendar }, user) {
    await delay();
    const db = readDb();
    const cls = classOf(db, classId);
    if (user?.role !== ROLES.TEACHER || !teachesClass(cls, user)) throw eduError('CLASS_DOC_TEACHER_ONLY');
    const plan = (db.eduGoals || []).find((g) => g.id === yearPlanId);
    if (!plan) throw eduError('YEAR_PLAN_NOT_FOUND');
    if (plan.ageGroupId !== cls.ageGroupId || plan.schoolYear?.replace(' – ', '-') !== cls.schoolYear)
      throw eduError('YEAR_PLAN_CLASS_MISMATCH');
    if (plan.status !== EDU_STATUS.APPROVED) throw eduError('YEAR_PLAN_NOT_ISSUED');
    if (isSuperseded(db, yearPlanId)) throw eduError('YEAR_PLAN_SUPERSEDED');
    const doc = (db.eduClassBranch || []).find((d) => d.classId === classId && d.yearPlanId === yearPlanId);
    if (doc && !isEditableStatus(doc.status)) throw eduError('CLASS_DOC_SUBMITTED');
    if (!file || !file.size) throw eduError('BRANCH_FILE_UNSUPPORTED');
    if (file.size > 2 * 1024 * 1024) throw eduError('BRANCH_FILE_TOO_LARGE');
    if (!/\.csv$/i.test(file.name)) throw eduError('BRANCH_FILE_UNSUPPORTED');
    const table = parseCsv(await file.text());
    if (table.length > 2000) throw eduError('BRANCH_FILE_TOO_LARGE');
    const norm = (text) =>
      String(text || '')
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('vi');
    const header = table.findIndex((row) => row.some((c) => norm(c) === 'chủ đề') && row.some((c) => norm(c) === 'chủ đề nhánh'));
    if (header < 0) throw eduError('BRANCH_FILE_NO_TABLE');
    const themeCol = table[header].findIndex((c) => norm(c) === 'chủ đề');
    const nameCol = table[header].findIndex((c) => norm(c) === 'chủ đề nhánh');
    const calendar = draftCalendar || doc;
    const weeks = yearWeeks(calendarPlan(plan, calendar)).filter((r) => r.type === 'week');
    const used = new Map();
    const matches = [];
    const warnings = [];
    let themeName = '';
    table.slice(header + 1).forEach((row, i) => {
      themeName = row[themeCol]?.trim() || themeName;
      const text = row[nameCol]?.trim() || '';
      const lower = norm(text);
      if (
        !text ||
        lower.startsWith('nghỉ') ||
        lower.startsWith('ôn tập') ||
        (/^(từ\s+)?\d/u.test(lower) && (lower.includes('nghỉ') || lower.includes('ôn tập')))
      )
        return;
      const name = text.replace(/^[-–•]?\s*nhánh\s*\d+\s*[:.)-]?\s*/iu, '').trim();
      if (!name) return;
      const themes = (plan.themes || []).filter((t) => norm(t.name) === norm(themeName));
      const target = themes.length === 1 ? weeks.filter((w) => w.theme.id === themes[0].id) : [];
      const index = used.get(norm(themeName)) || 0;
      if (!target[index]) warnings.push({ row: header + i + 2, message: 'Chủ đề không khớp, mơ hồ hoặc tên nhánh vượt số tuần' });
      else {
        const branch = calendar?.branches?.find(
          (b) => b.themeId === themes[0].id && target[index].start >= b.startDate && target[index].start <= b.endDate,
        );
        const weekStarts = branch ? branchWeeks(branch, plan, calendar).map((w) => w.start) : [target[index].start];
        matches.push({
          row: header + i + 2,
          themeId: themes[0].id,
          themeName: themes[0].name,
          weekStart: target[index].start,
          weekStarts,
          name,
          operation: branch ? 'RENAME' : 'CREATE_CUSTOM',
          branchKey: branch?.key || null,
          sourceTemplateId: branch?.sourceTemplateId || null,
          startDate: branch?.startDate || target[index].start,
          endDate: branch?.endDate || target[index].end,
        });
        used.set(norm(themeName), index + weekStarts.length);
      }
    });
    return { matches, warnings };
  },
  /** BE:EDU-27 — "Kế hoạch điều chỉnh và bổ sung" ghi được ở mọi trạng thái, chỉ giáo viên của lớp. */
  async saveAdjustments(id, adjustments, user, options = {}) {
    await delay();
    ensureSchoolSeeded();
    return writeDb((db) => {
      const doc = findDoc(db, CLASS_DOC.WEEK, id);
      assertVersion(doc, options.version);
      bumpRoot(db, 'week', doc, options.dossierVersion);
      if (!canAuthor(db, 'week', doc.classId, user)) throw eduError('CLASS_DOC_TEACHER_ONLY');
      const days = new Set((doc.days || []).map((d) => d.date));
      const next = {};
      Object.entries(adjustments || {}).forEach(([day, text]) => {
        const value = String(text || '').trim();
        if (!days.has(day) || value.length > 4000) throw eduError('CLASS_DOC_ADJUSTMENT_INVALID');
        if (value) next[day] = value;
      });
      if (JSON.stringify(next) !== JSON.stringify(doc.adjustments || {})) {
        doc.adjustments = next;
        doc.version = (doc.version || 0) + 1;
        doc.history = [...(doc.history || []), entry(user, 'Cập nhật kế hoạch điều chỉnh và bổ sung')];
      }
      return clone(decorate(db, doc, user, 'week'));
    });
  },

  async getAll(user) {
    await delay();
    const db = readDb();
    // Bộ demo cũ: nạp bộ demo hiện hành (kế hoạch năm + bản nháp của lớp) trước khi đọc
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureEduDemo);
    if (Object.values(COLLECTIONS).some((key) => !readDb()[key])) writeDb(ensureCollections);
    ensureSchoolSeeded();
    const fresh = readDb();
    return {
      branchPlans: clone(fresh.eduClassBranch.map((d) => decorate(fresh, d, user, 'branch'))),
      classThemePlans: clone(fresh.eduClassTheme.map((d) => decorate(fresh, d, user, 'theme'))),
      weekPlans: clone(fresh.eduClassWeek.map((d) => decorate(fresh, d, user, 'week'))),
      creationCapabilities: (fresh.classes || []).flatMap((cls) =>
        ['branch', 'theme', 'week'].map((kind) => ({
          classId: cls.id,
          kind,
          canCreate: canAuthor(fresh, kind, cls.id, user),
          requires: kind === 'week' ? 'THEME_DOSSIER' : 'ISSUED_TEAM_PLAN',
          reasonCode: null,
        })),
      ),
      // Lớp và giáo viên, tổ trưởng (giống GET /education-plans/class-docs của BE)
      classes: clone(fresh.classes || []),
      staff: (fresh.users || [])
        .filter((u) => u.role === ROLES.TEACHER || u.role === ROLES.TEAM_LEADER)
        .map((u) => ({ id: u.id, fullName: u.fullName, role: u.role, ageGroupId: u.ageGroupId })),
    };
  },

  /** Lưu nội dung; bản đã gửi / đã duyệt không sửa được (đánh giá trẻ ghi ở trang Đánh giá hằng ngày). */
  async saveDoc(kind, doc, user) {
    await delay();
    if (!doc?.id) throw eduError('REQUIRED_FIELD_MISSING', 'mã tài liệu');
    ensureSchoolSeeded();
    return writeDb((db) => {
      const list = ensureCollections(db)[COLLECTIONS[kind]];
      const i = list.findIndex((x) => x.id === doc.id);
      const current = i === -1 ? null : list[i];
      assertVersion(current, doc.version);
      bumpRoot(db, kind, doc, doc.dossierVersion);
      if (!canAuthor(db, kind, doc.classId, user)) throw eduError('CLASS_DOC_TEACHER_ONLY');
      if (isSuperseded(db, doc.yearPlanId)) throw eduError('YEAR_PLAN_SUPERSEDED');
      if (!current) {
        const blocker = createBlocker(kind, doc, { branchPlans: db.eduClassBranch, classThemePlans: db.eduClassTheme });
        if (blocker) throw eduError('CLASS_DOC_NOT_READY', `Chưa thể bắt đầu: ${blocker.message}`);
      }
      if (current?.status === 'REVIEW') throw eduError('CLASS_DOC_SUBMITTED');
      const { superseded, review, permissions, dossierVersion, ...body } = clone(doc);
      const plan = (db.eduGoals || []).find((g) => g.id === doc.yearPlanId);
      if (!plan || plan.planLevel === 'SCHOOL_YEAR' || plan.status !== EDU_STATUS.APPROVED) throw eduError('YEAR_PLAN_NOT_ISSUED');
      const normalized = kind === 'branch' && body.schemaVersion === 2 ? projectCalendar(body, plan) : body;
      const affected = validateFutureClassEdit(kind, current, normalized, plan);
      for (const themeId of affected) {
        const members = [...db.eduClassTheme, ...db.eduClassWeek].filter(
          (member) => member.classId === doc.classId && member.yearPlanId === doc.yearPlanId && member.themeId === themeId,
        );
        if (members.some((member) => member.status === 'REVIEW')) throw eduError('CLASS_DOC_LOCKED');
        for (const member of members) {
          if (member.status !== EDU_STATUS.APPROVED) continue;
          member.history = [...(member.history || []), {
            action: 'revise_future', actorId: user.id, by: user.fullName, at: new Date().toISOString(),
            round: member.reviewRound || 0, previousApprovals: clone(member.approvals || []),
            previousPrintSnapshot: member.printSnapshot || null,
          }];
          member.status = EDU_STATUS.DRAFT;
          member.waitingRole = null;
          member.approvals = [];
          member.printSnapshot = null;
          member.completionMode = null;
          member.completionPolicy = null;
          member.completedAt = null;
          if (member !== current) member.version = (member.version || 0) + 1;
        }
      }
      const saved = {
        ...normalized,
        ...(kind === 'branch'
          ? {
              durationPolicySnapshot:
                current?.durationPolicySnapshot ||
                (current
                  ? { mode: 'LEGACY_UNBOUNDED' }
                  : { mode: 'BOUNDED', ...clone(withDefaults(db.eduConfig).durationPolicy || DEFAULT_DURATION) }),
            }
          : {}),
        version: (current?.version ?? -1) + 1,
        authorIds: [...new Set([...(current?.authorIds || []), user.id])],
        sourceDocKey: current ? current.sourceDocKey : body.sourceDocKey,
        adjustments: current?.adjustments || {},
        status: current?.status || EDU_STATUS.DRAFT,
        printSnapshot: current?.printSnapshot || null,
        completionMode: current?.completionMode || null,
        completionPolicy: current?.completionPolicy || null,
        completedAt: current?.completedAt || null,
        approvals: current?.approvals || [],
        history: current?.history || [],
      };
      if (i === -1) list.unshift(saved);
      else list[i] = saved;
      return clone(decorate(db, saved, user, kind));
    });
  },

  /**
   * Gửi / duyệt / trả lại (không còn chữ ký trong hệ thống: duyệt xong thì in ra ký tay). action: submit | approve | reject.
   * - Chủ đề nhánh (branch): giáo viên của lớp gửi khi đủ tên các tuần; người duyệt theo eduConfig.signers.branch (Phó HT).
   * - Hồ sơ chủ đề (theme): giáo viên gửi MỘT lần kế hoạch chủ đề + giáo án tất cả các nhánh; duyệt / trả lại cả hồ sơ
   *   theo eduConfig.signers.week (Tổ trưởng → Phó HT). Giáo án các tuần mang cùng trạng thái với hồ sơ.
   * Bỏ bước tổ trưởng khi tổ trưởng của khối dạy lớp đó (gửi thẳng Phó HT).
   */
  async act(kind, id, { action, note }, user, options = {}) {
    await delay();
    ensureSchoolSeeded();
    return writeDb((db) => {
      const fail = (name, ...args) => {
        throw eduError(name, ...args);
      };
      if (kind === CLASS_DOC.WEEK) fail('WEEKLY_LESSON_VIA_THEME');
      if (kind === CLASS_DOC.BRANCH) fail('INVALID_VALUE', 'chủ đề nhánh gửi cùng hồ sơ chủ đề');
      const doc = findDoc(db, kind, id);
      assertVersion(doc, options.version);
      const cls = classOf(db, doc.classId);
      const yearPlan = (db.eduGoals || []).find((g) => g.id === doc.yearPlanId);
      const leaders = leadersOf(db, cls);
      const isLeader = leaders.some((u) => u.id === user.id);
      const policy = withDefaults(db.eduConfig).workflowPolicy?.[kind === CLASS_DOC.BRANCH ? 'branch' : 'theme'];
      const rawChain = policy?.reviewers || withDefaults(db.eduConfig).signers[kind === CLASS_DOC.BRANCH ? 'branch' : 'week'] || [];
      // BE:EDU-54 — chỉ bỏ bước giữa thiếu người hợp lệ; bước cuối luôn giữ chờ.
      const chain = rawChain.filter((role, index) => index === rawChain.length - 1 || (db.users || []).some(
        (candidate) => candidate.status !== 'INACTIVE' && rolesOf(candidate).includes(role) &&
          !authorsOf(db, doc).has(candidate.id) &&
          (role !== ROLES.TEAM_LEADER || candidate.ageGroupId === cls?.ageGroupId),
      ));
      const waiting = doc.waitingRole || Object.keys(PENDING_OF).find((r) => PENDING_OF[r] === doc.status);
      // Người đang được chờ: đúng vai trò; tổ trưởng phải là tổ trưởng của khối
      const isWaitingFor =
        waiting && user.status !== 'INACTIVE' && rolesOf(user).includes(waiting) &&
        (waiting !== ROLES.TEAM_LEADER || isLeader) && !authorsOf(db, doc).has(user.id);
      const lists = { branchPlans: db.eduClassBranch, weekPlans: db.eduClassWeek, classThemePlans: db.eduClassTheme, yearPlan };
      // Hồ sơ chủ đề: giáo án các tuần đi cùng trạng thái của kế hoạch chủ đề
      const weekDocs = kind === CLASS_DOC.THEME ? dossierWeekDocs(doc, yearPlan, db.eduClassWeek).map((x) => x.doc) : [];
      const all = [doc, ...weekDocs.filter(Boolean)];
      const setStatus = (status, waitingRole, approval) =>
        all.forEach((d) => {
          d.status = status;
          d.waitingRole = waitingRole || null;
          d.version = (d.version || 0) + 1;
          if (kind === CLASS_DOC.THEME || d.dossierVersion != null) {
            d.dossierVersion = (d.dossierVersion || 0) + 1;
          }
          d.approvals = approval ? [...(d.approvals || []), approval] : status === EDU_STATUS.DRAFT ? [] : d.approvals || [];
          if (status === EDU_STATUS.APPROVED) {
            d.completedAt = new Date().toISOString();
            d.completionMode = 'MANUAL';
            const slots = [
              {
                roleKey: 'CREATOR',
                label: 'Người soạn',
                names: (db.users || []).filter((account) => authorsOf(db, doc).has(account.id)).map((account) => account.fullName),
              },
              ...chain.map((r) => {
                const app = (d.approvals || []).find((a) => a.roleKey === r || a.role === SIGN_ROLES[r]);
                return {
                  roleKey: r,
                  label: SIGN_ROLES[r] || r,
                  names: app?.name ? [app.name] : [],
                };
              }),
            ];
            d.printSnapshot = {
              schemaVersion: 1,
              origin: 'PUBLICATION',
              documentType: kind,
              policyRevision: db.eduConfig?.workflowRevision || 1,
              capturedAt: d.completedAt,
              slots,
            };
          }
        });
      const log = (e) =>
        all.forEach((d, i) => {
          d.history = [...(d.history || []), i === 0 ? e : { ...e, action: `${e.action} (kế hoạch chủ đề)` }];
        });

      if (action === 'submit') {
        if (!canAuthor(db, kind, doc.classId, user)) fail('CLASS_DOC_TEACHER_ONLY');
        if (!isEditableStatus(doc.status)) fail('CLASS_DOC_SUBMITTED');
        if (isSuperseded(db, doc.yearPlanId)) fail('YEAR_PLAN_SUPERSEDED');
        const blocker = submitBlocker(kind, doc, lists);
        if (blocker) fail('CLASS_DOC_NOT_READY', blocker);
        const unresolved = all.reduce((n, d) => n + unresolvedOf(db, d.kind || (d === doc ? kind : CLASS_DOC.WEEK), d), 0);
        if (unresolved) fail('CLASS_DOC_VERSION_FIX_REQUIRED', unresolved);
        if (kind === CLASS_DOC.BRANCH) {
          if (doc.schemaVersion === 2) {
            const limits = doc.durationPolicySnapshot;
            const effective = calendarPlan(yearPlan, doc);
            const valid = (start, end) =>
              start &&
              end &&
              start <= end &&
              new Date(start + 'T00:00:00Z').getUTCDay() === 1 &&
              new Date(end + 'T00:00:00Z').getUTCDay() === 5;
            for (const t of effective.themes || []) {
              if (!valid(t.start, t.end)) fail('INVALID_VALUE', 'chủ đề phải trọn tuần Thứ Hai–Thứ Sáu');
              if (effective.themes.some((o) => o.id !== t.id && o.start <= t.end && o.end >= t.start))
                fail('INVALID_VALUE', 'các chủ đề bị trùng thời gian');
              const count = yearWeeks({ ...effective, themes: [t] }).filter((w) => w.type === 'week').length;
              if (limits?.mode === 'BOUNDED' && (count < limits.theme.minWeeks || count > limits.theme.maxWeeks))
                fail('INVALID_VALUE', 'thời lượng chủ đề vượt giới hạn hồ sơ');
            }
            for (const b of doc.branches || []) {
              const parent = effective.themes.find((t) => String(t.id) === String(b.themeId));
              if (!parent || !valid(b.startDate, b.endDate) || b.startDate < parent.start || b.endDate > parent.end)
                fail('INVALID_VALUE', 'nhánh phải nằm trong chủ đề cha và trọn tuần học');
              if (doc.branches.some((o) => o.key !== b.key && o.startDate <= b.endDate && o.endDate >= b.startDate))
                fail('INVALID_VALUE', 'các nhánh bị trùng thời gian');
              const count = branchWeeks(b, yearPlan, doc).length;
              if (limits?.mode === 'BOUNDED' && (count < limits.branch.minWeeks || count > limits.branch.maxWeeks))
                fail('INVALID_VALUE', 'thời lượng nhánh vượt giới hạn hồ sơ');
            }
          }
          const empty = (yearPlan ? yearWeeks(calendarPlan(yearPlan, doc)).filter((w) => w.type === 'week') : []).filter(
            (w) => !doc.names?.[w.start]?.trim(),
          ).length;
          if (empty) fail('BRANCH_WEEKS_UNNAMED', empty);
        }
        all.forEach((d) => {
          d.reviewRound = (d.reviewRound || 0) + 1;
          d.approvals = [];
        });
        const firstRole = chain[0] || null;
        setStatus(firstRole ? 'REVIEW' : EDU_STATUS.APPROVED, firstRole);
        log(entry(user, firstRole ? `Gửi ${SIGN_ROLES[firstRole] || firstRole} duyệt` : 'Gửi (không cần duyệt)', '', note));
      } else if (action === 'approve') {
        if (!isWaitingFor) fail('NOT_YOUR_REVIEW_STEP', 'duyệt');
        const nextIdx = chain.indexOf(waiting) + 1;
        const next = nextIdx < chain.length ? chain[nextIdx] : null;
        setStatus(next ? 'REVIEW' : EDU_STATUS.APPROVED, next, {
          userId: user.id,
          name: user.fullName,
          role: ROLE_LABELS[user.role] || user.role,
          roleKey: waiting,
          at: now(),
          note: note || '',
        });
        // setStatus cộng dồn người duyệt vào từng tài liệu; giữ lại người duyệt các bước trước
        log(
          entry(
            user,
            next
              ? `${SIGN_ROLES[waiting] || waiting} duyệt, chuyển ${SIGN_ROLES[next] || next}`
              : `${SIGN_ROLES[waiting] || waiting} duyệt`,
            'ok',
            note,
          ),
        );
      } else if (action === 'reject') {
        if (!isWaitingFor) fail('NOT_YOUR_REVIEW_STEP', 'trả lại');
        if (!note?.trim()) fail('RETURN_REASON_REQUIRED');
        all.forEach((d) => {
          d.lastReturnNote = note;
        });
        setStatus(EDU_STATUS.DRAFT, null);
        log(entry(user, 'Trả lại để sửa', 'err', note));
      } else fail('INVALID_VALUE', 'hành động');
      return clone(decorate(db, doc, user, kind));
    });
  },
};
