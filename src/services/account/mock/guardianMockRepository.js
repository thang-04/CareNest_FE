import { readDb, writeDb, clone, delay, ApiError, applyMockSeedMigration, needsMockSeedMigration } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { credentialOf } from '@/mocks/authMockRepository';
import { staffScopeOf } from '@/services/account/mock/staffMockRepository';
import { hasPermission } from '@/utils/account/permissionManagementPermissions';
import { normalizePhone, validateGuardian } from '@/utils/account/guardianValidation';
import { PERMISSIONS } from '@/models/account/permissionConstants';
import { uid } from '@/utils/id';

/*
 * Fake backend tài khoản phụ huynh — chép luật BE (AUTH-18, AUTH-19):
 * - tạo kèm liên kết trẻ; username = SĐT chuẩn hóa; mật khẩu tạm hệ thống sinh, trả 1 lần;
 * - SĐT đã là phụ huynh ⇒ chỉ thêm liên kết; SĐT của nhân sự ⇒ 409; đã liên kết ⇒ 409;
 * - HT mọi trẻ; PHT trẻ đang học trong campus mình; phụ huynh quản lý được khi có trẻ liên kết trong campus đó.
 */

const RELATION_FROM_SEED = { Bố: 'FATHER', Mẹ: 'MOTHER' };
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const forbid = (message = 'Bạn không có quyền thực hiện thao tác này') => new ApiError(403, message);
const badRequest = (message, details) => new ApiError(400, message, details);
const now = () => new Date().toISOString();

const generatePassword = () => {
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const required = [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'), pick('23456789')];
  const rest = Array.from({ length: 7 }, () => pick(PASSWORD_CHARS));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('');
};

// Lần đầu: phụ huynh trong hồ sơ trẻ mẫu thành tài khoản + liên kết; cứ 4 trẻ chừa 1 trẻ chưa có để demo
const seedLinks = (db) => {
  db.users ||= [];
  db.guardianLinks = [];
  (db.children || []).forEach((child, index) =>
    (index % 4 === 3 ? [] : child.guardians || []).forEach((g) => {
      const phone = normalizePhone(g.phone);
      if (!phone) return;
      let parent = db.users.find((u) => u.username === phone);
      if (!parent) {
        parent = { id: `pa_${child.id}`, username: phone, fullName: g.fullName, role: 'PARENT', status: 'ACTIVE' };
        db.users.push(parent);
      }
      db.guardianLinks.push({
        userId: parent.id,
        childId: child.id,
        relationship: RELATION_FROM_SEED[g.relation] || 'GUARDIAN',
        linkedAt: '2026-08-16T02:00:00.000Z',
      });
    }),
  );
  return db;
};

const seeded = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (needsMockSeedMigration(db, 'guardian-links', 1, ['guardianLinks']))
    writeDb((d) => {
      const seededDb = clone(d);
      seedLinks(seededDb);
      d.users = seededDb.users;
      return applyMockSeedMigration(d, 'guardian-links', 1, { guardianLinks: seededDb.guardianLinks });
    });
  return readDb();
};

const campusOfChild = (db, child) => db.classes?.find((c) => c.id === child?.classId)?.campusId || null;

const canManageChild = (db, actor, child) => {
  const scope = staffScopeOf(actor);
  return scope.wholeSchool || (!!child && scope.campuses.has(campusOfChild(db, child)));
};

const requirePermission = (actor) => {
  if (!hasPermission(actor, PERMISSIONS.PARENT_ACCOUNT_MANAGE)) throw forbid();
};

const loadChild = (db, actor, childId) => {
  const child = db.children.find((c) => c.id === childId);
  // PHT: trẻ không tồn tại và trẻ ngoài campus cùng 403 (giống BE)
  if (!canManageChild(db, actor, child)) throw forbid('Bạn không quản lý phụ huynh của trẻ này');
  if (!child) throw new ApiError(404, 'Không tìm thấy trẻ');
  return child;
};

const loadParent = (db, actor, userId) => {
  if (userId === actor.id) throw badRequest('Không thể tự thao tác tài khoản của chính mình');
  const parent = db.users.find((u) => u.id === userId);
  const scope = staffScopeOf(actor);
  if (!parent) throw scope.wholeSchool ? new ApiError(404, 'Không tìm thấy tài khoản') : forbid();
  const childIds = db.guardianLinks.filter((l) => l.userId === userId).map((l) => l.childId);
  const allowed =
    scope.wholeSchool ||
    childIds.some((id) =>
      scope.campuses.has(
        campusOfChild(
          db,
          db.children.find((c) => c.id === id),
        ),
      ),
    );
  if (!allowed) throw forbid('Bạn không quản lý tài khoản này');
  if (parent.role !== 'PARENT') throw badRequest('Tài khoản này không phải tài khoản phụ huynh');
  return parent;
};

const guardianView = (parent, link) => ({
  userId: parent.id,
  username: parent.username,
  fullName: parent.fullName,
  relationship: link.relationship,
  status: parent.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  linkedAt: link.linkedAt,
});

export const guardianMockRepository = {
  async searchChildren({ campusId, classroomId, q, page = 0, size = 20 } = {}, actor) {
    await delay(100);
    requirePermission(actor);
    const db = seeded();
    const scope = staffScopeOf(actor);
    if (campusId && !scope.wholeSchool && !scope.campuses.has(campusId)) throw forbid('Bạn không phụ trách điểm trường này');
    const keyword = (q || '').trim().toLowerCase();
    const rows = db.children
      .map((c) => ({ child: c, campus: campusOfChild(db, c) }))
      .filter(({ campus }) => scope.wholeSchool || scope.campuses.has(campus))
      .filter(({ child, campus }) => (!campusId || campus === campusId) && (!classroomId || child.classId === classroomId))
      .filter(({ child }) => !keyword || child.fullName.toLowerCase().includes(keyword))
      .sort((a, b) => a.child.fullName.localeCompare(b.child.fullName))
      .map(({ child, campus }) => {
        const links = db.guardianLinks.filter((l) => l.childId === child.id);
        const guardians = links
          .map((l) => {
            const parent = db.users.find((u) => u.id === l.userId);
            return parent ? guardianView(parent, l) : null;
          })
          .filter(Boolean);
        return {
          id: child.id,
          fullName: child.fullName,
          dateOfBirth: child.dateOfBirth,
          classroomId: child.classId || null,
          campusId: campus,
          guardianCount: links.length,
          guardians,
        };
      });
    return clone({
      items: rows.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / size)),
    });
  },

  async listGuardians(childId, actor) {
    await delay(80);
    requirePermission(actor);
    const db = seeded();
    loadChild(db, actor, childId);
    return clone(
      db.guardianLinks
        .filter((l) => l.childId === childId)
        .map((l) => [db.users.find((u) => u.id === l.userId), l])
        .filter(([parent]) => parent)
        .map(([parent, l]) => guardianView(parent, l)),
    );
  },

  async addGuardian(childId, form, actor) {
    await delay();
    requirePermission(actor);
    const errors = validateGuardian(form);
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0], errors);
    seeded();
    return writeDb((db) => {
      loadChild(db, actor, childId);
      const username = normalizePhone(form.phone);
      const existing = db.users.find((u) => (u.username || '') === username);
      if (existing && existing.role !== 'PARENT') throw new ApiError(409, 'Số điện thoại này thuộc tài khoản nhân sự');
      if (existing && db.guardianLinks.some((l) => l.userId === existing.id && l.childId === childId))
        throw new ApiError(409, 'Phụ huynh đã được liên kết với trẻ này');

      let parent = existing;
      let temporaryPassword = null;
      if (!parent) {
        temporaryPassword = generatePassword(); // carenest:allow-secret
        parent = { id: uid(), username, fullName: form.fullName.trim(), role: 'PARENT', status: 'ACTIVE' };
        db.users.push(parent);
        Object.assign(credentialOf(db, parent.id), { password: temporaryPassword, mustChange: true }); // carenest:allow-secret
      }
      const link = { userId: parent.id, childId, relationship: form.relationship, linkedAt: now() };
      db.guardianLinks.push(link);
      return clone({ ...guardianView(parent, link), newAccount: !existing, temporaryPassword });
    });
  },

  async removeGuardian(childId, userId, actor) {
    await delay();
    requirePermission(actor);
    seeded();
    return writeDb((db) => {
      loadChild(db, actor, childId);
      const index = db.guardianLinks.findIndex((l) => l.childId === childId && l.userId === userId);
      if (index < 0) throw new ApiError(404, 'Không tìm thấy liên kết phụ huynh');
      db.guardianLinks.splice(index, 1);
      return null;
    });
  },

  async updateParentStatus(userId, status, actor) {
    await delay();
    requirePermission(actor);
    seeded();
    return writeDb((db) => {
      const parent = loadParent(db, actor, userId);
      parent.status = status;
      return clone({ userId: parent.id, username: parent.username, fullName: parent.fullName, email: null, status });
    });
  },

  async resetParentPassword(userId, actor) {
    await delay();
    requirePermission(actor);
    seeded();
    return writeDb((db) => {
      const parent = loadParent(db, actor, userId);
      const temporaryPassword = generatePassword(); // carenest:allow-secret
      Object.assign(credentialOf(db, userId), { password: temporaryPassword, mustChange: true }); // carenest:allow-secret
      return clone({ userId: parent.id, username: parent.username, temporaryPassword });
    });
  },
};
