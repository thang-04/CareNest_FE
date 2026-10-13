import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { buildSeedClassPlans } from '@/mocks/educationClassPlanSeed';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { PLAN_KIND, isEditableStatus } from '@/models/education-plan/yearPlanModel';

/*
 * Fake backend cho kế hoạch năm (theo khối) và tài liệu của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần).
 * Luồng duyệt nằm ở đây để màn hình chỉ gửi hành động; BE thật phải sở hữu các quy tắc này.
 */
const COLLECTIONS = {
  [PLAN_KIND.YEAR]: 'eduYearPlans',
  [PLAN_KIND.BRANCH]: 'eduBranchPlans',
  [PLAN_KIND.THEME]: 'eduThemePlans',
  [PLAN_KIND.WEEK]: 'eduWeekPlans',
};

const ensureSeeded = (db) => {
  const seed = buildSeedClassPlans();
  Object.values(COLLECTIONS).forEach((key) => {
    db[key] ||= clone(seed[key]);
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

const findDoc = (db, kind, id) => {
  const doc = (ensureSeeded(db)[COLLECTIONS[kind]] || []).find((x) => x.id === id);
  if (!doc) throw new ApiError(404, 'Không tìm thấy tài liệu');
  return doc;
};

const classOf = (db, classId) => (db.classes || []).find((c) => c.id === classId);

// Tổ trưởng của khối: tài khoản tổ trưởng cùng nhóm tuổi với lớp.
const teamLeadersOf = (db, cls) => (db.users || []).filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls?.ageGroupId);

const teachesClass = (cls, user) => !!cls && (cls.teacherIds || []).includes(user.id);

/** Người dùng có được sửa tài liệu này không (chỉ phần nội dung, không tính đánh giá cuối ngày). */
const canEdit = (db, kind, doc, user) => {
  if (kind === PLAN_KIND.YEAR) {
    return user.role === ROLES.VICE_PRINCIPAL || (user.role === ROLES.TEAM_LEADER && user.ageGroupId === doc.ageGroupId);
  }
  return teachesClass(classOf(db, doc.classId), user);
};

export const classPlanMockRepository = {
  async getAll() {
    await delay();
    const db = readDb();
    if (Object.values(COLLECTIONS).some((key) => !db[key])) writeDb(ensureSeeded);
    const fresh = readDb();
    return {
      yearPlans: clone(fresh.eduYearPlans),
      branchPlans: clone(fresh.eduBranchPlans),
      themePlans: clone(fresh.eduThemePlans),
      weekPlans: clone(fresh.eduWeekPlans),
    };
  },

  /** Lưu nội dung. Bản đã gửi/đã duyệt chỉ cho ghi phần đánh giá cuối ngày của giáo án tuần. */
  async saveDoc(kind, doc, user) {
    await delay();
    if (!doc?.id) throw new ApiError(400, 'Thiếu mã tài liệu');
    ensureSchoolSeeded();
    return writeDb((db) => {
      const list = ensureSeeded(db)[COLLECTIONS[kind]];
      const i = list.findIndex((x) => x.id === doc.id);
      const current = i === -1 ? null : list[i];
      if (!canEdit(db, kind, current || doc, user)) throw new ApiError(403, 'Bạn không có quyền sửa tài liệu này');
      if (current && !isEditableStatus(current.status)) {
        if (kind !== PLAN_KIND.WEEK) throw new ApiError(409, 'Tài liệu đã gửi duyệt, không sửa được');
        // Sau khi duyệt chỉ ghi đánh giá trẻ trong ngày và kế hoạch điều chỉnh
        const merged = clone(current);
        merged.days.forEach((d, k) => {
          d.evaluation = doc.days[k]?.evaluation ?? d.evaluation;
          d.adjustment = doc.days[k]?.adjustment ?? d.adjustment;
        });
        list[i] = merged;
        return clone(merged);
      }
      const saved = { ...clone(doc), status: current?.status || EDU_STATUS.DRAFT, history: current?.history || doc.history || [] };
      if (i === -1) list.unshift(saved);
      else list[i] = saved;
      return clone(saved);
    });
  },

  async deleteYearPlan(id, user) {
    await delay();
    writeDb((db) => {
      const doc = findDoc(db, PLAN_KIND.YEAR, id);
      if (user.role !== ROLES.VICE_PRINCIPAL) throw new ApiError(403, 'Chỉ Phó hiệu trưởng xóa được kế hoạch năm');
      if (!isEditableStatus(doc.status)) throw new ApiError(409, 'Chỉ xóa được bản nháp hoặc bản bị trả lại');
      db.eduYearPlans = db.eduYearPlans.filter((x) => x.id !== id);
    });
  },

  /**
   * Chuyển trạng thái. action: submit | approve | reject | issue.
   * Kế hoạch năm: tổ trưởng gửi → Phó HT ban hành (Phó HT cũng ban hành thẳng được).
   * Tài liệu của lớp: giáo viên gửi → tổ trưởng → Phó HT; bỏ bước tổ trưởng khi tổ trưởng dạy chính lớp đó.
   */
  async act(kind, id, { action, note, signature }, user) {
    await delay();
    ensureSchoolSeeded();
    return writeDb((db) => {
      const doc = findDoc(db, kind, id);
      const isVp = user.role === ROLES.VICE_PRINCIPAL;
      const fail = (msg, status = 409) => {
        throw new ApiError(status, msg);
      };
      const sig = signature ? { userId: user.id, name: user.fullName, role: ROLE_LABELS[user.role], at: now(), sig: signature } : null;

      if (kind === PLAN_KIND.YEAR) {
        if (action === 'submit') {
          if (!canEdit(db, kind, doc, user) || isVp) fail('Chỉ tổ trưởng của khối gửi được', 403);
          if (!isEditableStatus(doc.status)) fail('Kế hoạch đã được gửi');
          doc.status = EDU_STATUS.PENDING_VP;
          doc.builders = [...(doc.builders || []).filter((b) => b.userId !== user.id), sig].filter(Boolean);
          doc.history.push(entry(user, 'Gửi Phó hiệu trưởng ban hành', '', note));
        } else if (action === 'issue') {
          if (!isVp) fail('Chỉ Phó hiệu trưởng ban hành được', 403);
          // Phó HT chỉ ban hành sau khi tổ trưởng đã gửi
          if (doc.status !== EDU_STATUS.PENDING_VP) fail('Tổ trưởng chưa gửi kế hoạch');
          if (!sig) fail('Cần chữ ký của Phó hiệu trưởng', 400);
          doc.status = EDU_STATUS.APPROVED;
          doc.issued = sig;
          doc.builders = [...(doc.builders || []).filter((b) => b.userId !== user.id), sig];
          doc.history.push(entry(user, 'Ký và ban hành kế hoạch', 'ok', note));
        } else if (action === 'reject') {
          if (!isVp || doc.status !== EDU_STATUS.PENDING_VP) fail('Không trả lại được ở trạng thái này');
          if (!note?.trim()) fail('Cần ghi lý do trả lại', 400);
          doc.status = EDU_STATUS.REJECTED;
          doc.history.push(entry(user, 'Trả lại để sửa', 'err', note));
        } else fail('Hành động không hợp lệ', 400);
        return clone(doc);
      }

      const cls = classOf(db, doc.classId);
      const leaders = teamLeadersOf(db, cls);
      const isGroupLeader = leaders.some((u) => u.id === user.id);
      if (action === 'submit') {
        if (!teachesClass(cls, user)) fail('Chỉ giáo viên của lớp gửi duyệt được', 403);
        if (!isEditableStatus(doc.status)) fail('Tài liệu đã được gửi');
        const skipLeader = !leaders.length || leaders.some((u) => teachesClass(cls, u));
        doc.status = skipLeader ? EDU_STATUS.PENDING_VP : EDU_STATUS.PENDING_TL;
        doc.history.push(entry(user, skipLeader ? 'Gửi duyệt (tổ trưởng dạy lớp này nên chuyển thẳng Phó HT)' : 'Gửi duyệt', '', note));
      } else if (action === 'approve') {
        if (doc.status === EDU_STATUS.PENDING_TL && isGroupLeader) {
          doc.status = EDU_STATUS.PENDING_VP;
          doc.history.push(entry(user, 'Tổ trưởng duyệt, chuyển Phó hiệu trưởng', 'ok', note));
        } else if (doc.status === EDU_STATUS.PENDING_VP && isVp) {
          doc.status = EDU_STATUS.APPROVED;
          doc.approvedBy = sig;
          doc.history.push(entry(user, 'Phó hiệu trưởng duyệt', 'ok', note));
        } else fail('Bạn không duyệt được ở bước này', 403);
      } else if (action === 'reject') {
        const allowed = (doc.status === EDU_STATUS.PENDING_TL && isGroupLeader) || (doc.status === EDU_STATUS.PENDING_VP && isVp);
        if (!allowed) fail('Bạn không trả lại được ở bước này', 403);
        if (!note?.trim()) fail('Cần ghi lý do trả lại', 400);
        doc.status = EDU_STATUS.REJECTED;
        doc.history.push(entry(user, 'Trả lại để sửa', 'err', note));
      } else fail('Hành động không hợp lệ', 400);
      return clone(doc);
    });
  },

  /** Hàng chờ duyệt của người dùng: tổ trưởng thấy tài liệu chờ tổ trưởng của khối mình; Phó HT thấy tài liệu chờ Phó HT. */
  async getReviewQueue(user) {
    await delay(120);
    const db = ensureSchoolSeeded();
    ensureSeeded(db);
    const items = [];
    const push = (kind, doc) => items.push({ kind, id: doc.id, classId: doc.classId || null, status: doc.status, doc: clone(doc) });
    if (user.role === ROLES.VICE_PRINCIPAL) {
      db.eduYearPlans.filter((d) => d.status === EDU_STATUS.PENDING_VP).forEach((d) => push(PLAN_KIND.YEAR, d));
    }
    [PLAN_KIND.BRANCH, PLAN_KIND.THEME, PLAN_KIND.WEEK].forEach((kind) =>
      db[COLLECTIONS[kind]].forEach((doc) => {
        const cls = classOf(db, doc.classId);
        if (user.role === ROLES.VICE_PRINCIPAL && doc.status === EDU_STATUS.PENDING_VP) push(kind, doc);
        if (user.role === ROLES.TEAM_LEADER && doc.status === EDU_STATUS.PENDING_TL && cls?.ageGroupId === user.ageGroupId) push(kind, doc);
      }),
    );
    return items;
  },
};
