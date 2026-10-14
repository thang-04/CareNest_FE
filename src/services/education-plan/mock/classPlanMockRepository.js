import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { EDU_SEED_VERSION, ensureEduDemo } from '@/mocks/educationPlanSeed';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { CLASS_DOC, isEditableStatus } from '@/models/education-plan/classPlan';
import { PENDING_OF, SIGN_ROLES, withDefaults } from '@/models/education-plan/eduConfig';

/*
 * Fake backend cho tài liệu kế hoạch của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần).
 * Luồng ký / duyệt nằm ở đây để màn hình chỉ gửi hành động; BE thật phải sở hữu các quy tắc này.
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
  if (!doc) throw new ApiError(404, 'Không tìm thấy tài liệu. Lưu bản nháp trước khi ký hoặc gửi.');
  return doc;
};

export const classPlanMockRepository = {
  async getAll() {
    await delay();
    const db = readDb();
    // Bộ demo cũ: nạp bộ demo hiện hành (kế hoạch năm + bản nháp của lớp) trước khi đọc
    if (db.eduSeedVersion !== EDU_SEED_VERSION) writeDb(ensureEduDemo);
    if (Object.values(COLLECTIONS).some((key) => !readDb()[key])) writeDb(ensureCollections);
    const fresh = readDb();
    return {
      branchPlans: clone(fresh.eduClassBranch),
      classThemePlans: clone(fresh.eduClassTheme),
      weekPlans: clone(fresh.eduClassWeek),
    };
  },

  /** Lưu nội dung. Bản đã gửi / đã duyệt chỉ cho ghi đánh giá cuối ngày của giáo án tuần. */
  async saveDoc(kind, doc, user) {
    await delay();
    if (!doc?.id) throw new ApiError(400, 'Thiếu mã tài liệu');
    ensureSchoolSeeded();
    return writeDb((db) => {
      const list = ensureCollections(db)[COLLECTIONS[kind]];
      const i = list.findIndex((x) => x.id === doc.id);
      const current = i === -1 ? null : list[i];
      if (!teachesClass(classOf(db, doc.classId), user)) throw new ApiError(403, 'Chỉ giáo viên của lớp sửa được tài liệu này');
      if (current && !isEditableStatus(current.status)) {
        if (kind !== CLASS_DOC.WEEK) throw new ApiError(409, 'Tài liệu đã gửi duyệt, không sửa được');
        // Sau khi gửi / duyệt chỉ ghi đánh giá trẻ trong ngày và kế hoạch điều chỉnh
        const merged = clone(current);
        merged.days.forEach((d, k) => {
          d.evaluation = doc.days[k]?.evaluation ?? d.evaluation;
          d.adjustment = doc.days[k]?.adjustment ?? d.adjustment;
        });
        list[i] = merged;
        return clone(merged);
      }
      const saved = {
        ...clone(doc),
        status: current?.status || EDU_STATUS.DRAFT,
        builders: current?.builders || [],
        approvals: current?.approvals || [],
        history: current?.history || [],
      };
      if (i === -1) list.unshift(saved);
      else list[i] = saved;
      return clone(saved);
    });
  },

  /**
   * Ký / gửi / duyệt / trả lại. action: sign | submit | approve | reject.
   * Người duyệt theo cấu hình của trường (eduConfig.signers[kind], theo thứ tự vai trò); bỏ bước tổ trưởng khi
   * tổ trưởng của khối dạy lớp đó. Người duyệt ký ở mỗi bước.
   */
  async act(kind, id, { action, note, signature }, user) {
    await delay();
    ensureSchoolSeeded();
    return writeDb((db) => {
      const doc = findDoc(db, kind, id);
      const cls = classOf(db, doc.classId);
      const leaders = leadersOf(db, cls);
      const isLeader = leaders.some((u) => u.id === user.id);
      const fail = (msg, status = 409) => {
        throw new ApiError(status, msg);
      };
      const sig = signature
        ? { userId: user.id, name: user.fullName, role: ROLE_LABELS[user.role], roleKey: user.role, at: now(), sig: signature }
        : null;
      const skipLeader = !leaders.length || leaders.some((u) => teachesClass(cls, u));
      const chain = withDefaults(db.eduConfig).signers[kind].filter((r) => r !== ROLES.TEAM_LEADER || !skipLeader);
      const waiting = Object.keys(PENDING_OF).find((r) => PENDING_OF[r] === doc.status);
      // Người đang được chờ: đúng vai trò; tổ trưởng phải là tổ trưởng của khối
      const isWaitingFor = waiting && user.role === waiting && (waiting !== ROLES.TEAM_LEADER || isLeader);
      const toStep = (role) => (role ? PENDING_OF[role] : EDU_STATUS.APPROVED);

      if (action === 'sign' || action === 'submit') {
        if (!teachesClass(cls, user)) fail('Chỉ giáo viên của lớp ký / gửi được', 403);
        if (!isEditableStatus(doc.status)) fail('Tài liệu đã được gửi');
        if (!sig) fail('Cần chữ ký của người xây dựng', 400);
        doc.builders = [...(doc.builders || []).filter((b) => b.userId !== user.id), sig];
        if (action === 'sign') {
          doc.history.push(entry(user, 'Ký người xây dựng'));
          return clone(doc);
        }
        doc.status = toStep(chain[0]);
        doc.approvals = [];
        doc.history.push(entry(user, chain[0] ? `Gửi ${SIGN_ROLES[chain[0]]} duyệt` : 'Gửi (không cần duyệt)', '', note));
      } else if (action === 'approve') {
        if (!sig) fail('Cần chữ ký người duyệt', 400);
        if (!isWaitingFor) fail('Bạn không duyệt được ở bước này', 403);
        const next = chain[chain.indexOf(waiting) + 1];
        doc.status = toStep(next);
        doc.approvals = [...(doc.approvals || []), { ...sig, note: note || '' }];
        doc.history.push(
          entry(user, next ? `${SIGN_ROLES[waiting]} duyệt, chuyển ${SIGN_ROLES[next]}` : `${SIGN_ROLES[waiting]} duyệt`, 'ok', note),
        );
      } else if (action === 'reject') {
        if (!isWaitingFor) fail('Bạn không trả lại được ở bước này', 403);
        if (!note?.trim()) fail('Cần ghi lý do trả lại', 400);
        doc.status = EDU_STATUS.REJECTED;
        doc.approvals = [];
        doc.history.push(entry(user, 'Trả lại để sửa', 'err', note));
      } else fail('Hành động không hợp lệ', 400);
      return clone(doc);
    });
  },
};
