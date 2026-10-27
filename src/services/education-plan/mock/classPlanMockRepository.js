import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { CLASS_DOC, createBlocker, dossierWeekDocs, isEditableStatus, submitBlocker, yearWeeks } from '@/models/education-plan/classPlan';
import { PENDING_OF, SIGN_ROLES, withDefaults } from '@/models/education-plan/eduConfig';

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

export const classPlanMockRepository = {
  async getAll() {
    await delay();
    const db = readDb();
    // Bộ demo cũ: nạp bộ demo hiện hành (kế hoạch năm + bản nháp của lớp) trước khi đọc
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureEduDemo);
    if (Object.values(COLLECTIONS).some((key) => !readDb()[key])) writeDb(ensureCollections);
    ensureSchoolSeeded();
    const fresh = readDb();
    return {
      branchPlans: clone(fresh.eduClassBranch),
      classThemePlans: clone(fresh.eduClassTheme),
      weekPlans: clone(fresh.eduClassWeek),
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
      if (!teachesClass(classOf(db, doc.classId), user)) throw eduError('CLASS_DOC_TEACHER_ONLY');
      if (!current) {
        const blocker = createBlocker(kind, doc, { branchPlans: db.eduClassBranch, classThemePlans: db.eduClassTheme });
        if (blocker) throw eduError('CLASS_DOC_NOT_READY', `Chưa thể bắt đầu: ${blocker.message}`);
      }
      if (current && !isEditableStatus(current.status)) throw eduError('CLASS_DOC_SUBMITTED');
      const saved = {
        ...clone(doc),
        status: current?.status || EDU_STATUS.DRAFT,
        approvals: current?.approvals || [],
        history: current?.history || [],
      };
      if (i === -1) list.unshift(saved);
      else list[i] = saved;
      return clone(saved);
    });
  },

  /**
   * Gửi / duyệt / trả lại (không còn chữ ký trong hệ thống: duyệt xong thì in ra ký tay). action: submit | approve | reject.
   * - Chủ đề nhánh (branch): giáo viên của lớp gửi khi đủ tên các tuần; người duyệt theo eduConfig.signers.branch (Phó HT).
   * - Hồ sơ chủ đề (theme): giáo viên gửi MỘT lần kế hoạch chủ đề + giáo án tất cả các nhánh; duyệt / trả lại cả hồ sơ
   *   theo eduConfig.signers.week (Tổ trưởng → Phó HT). Giáo án các tuần mang cùng trạng thái với hồ sơ.
   * Bỏ bước tổ trưởng khi tổ trưởng của khối dạy lớp đó (gửi thẳng Phó HT).
   */
  async act(kind, id, { action, note }, user) {
    await delay();
    ensureSchoolSeeded();
    return writeDb((db) => {
      const fail = (name, ...args) => {
        throw eduError(name, ...args);
      };
      if (kind === CLASS_DOC.WEEK) fail('WEEKLY_LESSON_VIA_THEME');
      const doc = findDoc(db, kind, id);
      const cls = classOf(db, doc.classId);
      const yearPlan = (db.eduGoals || []).find((g) => g.id === doc.yearPlanId);
      const leaders = leadersOf(db, cls);
      const isLeader = leaders.some((u) => u.id === user.id);
      const skipLeader = !leaders.length || leaders.some((u) => teachesClass(cls, u));
      const chain = withDefaults(db.eduConfig).signers[kind === CLASS_DOC.BRANCH ? 'branch' : 'week'].filter(
        (r) => r !== ROLES.TEAM_LEADER || !skipLeader,
      );
      const waiting = Object.keys(PENDING_OF).find((r) => PENDING_OF[r] === doc.status);
      // Người đang được chờ: đúng vai trò; tổ trưởng phải là tổ trưởng của khối
      const isWaitingFor = waiting && user.role === waiting && (waiting !== ROLES.TEAM_LEADER || isLeader);
      const toStep = (role) => (role ? PENDING_OF[role] : EDU_STATUS.APPROVED);
      const lists = { branchPlans: db.eduClassBranch, weekPlans: db.eduClassWeek, classThemePlans: db.eduClassTheme, yearPlan };
      // Hồ sơ chủ đề: giáo án các tuần đi cùng trạng thái của kế hoạch chủ đề
      const weekDocs = kind === CLASS_DOC.THEME ? dossierWeekDocs(doc, yearPlan, db.eduClassWeek).map((x) => x.doc) : [];
      const all = [doc, ...weekDocs.filter(Boolean)];
      const setStatus = (status, approval) =>
        all.forEach((d) => {
          d.status = status;
          d.approvals = approval ? [...(d.approvals || []), approval] : [];
        });
      const log = (e) =>
        all.forEach((d, i) => {
          d.history = [...(d.history || []), i === 0 ? e : { ...e, action: `${e.action} (kế hoạch chủ đề)` }];
        });

      if (action === 'submit') {
        if (!teachesClass(cls, user)) fail('CLASS_DOC_TEACHER_ONLY');
        if (!isEditableStatus(doc.status)) fail('CLASS_DOC_SUBMITTED');
        const blocker = submitBlocker(kind, doc, lists);
        if (blocker) fail('CLASS_DOC_NOT_READY', blocker);
        if (kind === CLASS_DOC.BRANCH) {
          const empty = (yearPlan ? yearWeeks(yearPlan).filter((w) => w.type === 'week') : []).filter(
            (w) => !doc.names?.[w.start]?.trim(),
          ).length;
          if (empty) fail('BRANCH_WEEKS_UNNAMED', empty);
        }
        setStatus(toStep(chain[0]));
        log(entry(user, chain[0] ? `Gửi ${SIGN_ROLES[chain[0]]} duyệt` : 'Gửi (không cần duyệt)', '', note));
      } else if (action === 'approve') {
        if (!isWaitingFor) fail('NOT_YOUR_REVIEW_STEP', 'duyệt');
        const next = chain[chain.indexOf(waiting) + 1];
        setStatus(toStep(next), {
          userId: user.id,
          name: user.fullName,
          role: ROLE_LABELS[user.role],
          roleKey: user.role,
          at: now(),
          note: note || '',
        });
        // setStatus cộng dồn người duyệt vào từng tài liệu; giữ lại người duyệt các bước trước
        log(entry(user, next ? `${SIGN_ROLES[waiting]} duyệt, chuyển ${SIGN_ROLES[next]}` : `${SIGN_ROLES[waiting]} duyệt`, 'ok', note));
      } else if (action === 'reject') {
        if (!isWaitingFor) fail('NOT_YOUR_REVIEW_STEP', 'trả lại');
        if (!note?.trim()) fail('RETURN_REASON_REQUIRED');
        setStatus(EDU_STATUS.REJECTED);
        log(entry(user, 'Trả lại để sửa', 'err', note));
      } else fail('INVALID_VALUE', 'hành động');
      return clone(doc);
    });
  },
};
