import { readDb, writeDb, clone, ApiError, delay } from '@/mocks/mockDatabase';
import { childrenMockRepository as children } from '@/services/children/mock/childrenMockRepository';
import { canActivateParent, canViewChild, canViewChildren, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { areaAllows } from '@/utils/school-config/schoolConfigPermissions';
import { normalizePhone, validateGuardian } from '@/utils/account/guardianValidation';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { uid } from '@/utils/id';
import { issuePassword } from '@/mocks/authMockRepository';
import { migrateGuardianAccounts, parentAccountOf } from './guardianCompatibility';
import { activeYearId } from '@/mocks/roomManagers';
import { identityConflict } from '@/mocks/guardianIdentity';
import { normalizeCitizenId } from '@/utils/citizenId';

const relationOf = (value) =>
  Object.keys(GUARDIAN_RELATIONSHIP_LABELS).find((key) => GUARDIAN_RELATIONSHIP_LABELS[key] === value) || value || 'GUARDIAN';
const accountOf = parentAccountOf;
const clsOf = (db, child) => db.classes.find((cls) => cls.id === child.classId);
const visible = (db, child, actor) => canViewChild(child, actor, clsOf(db, child));
const forbid = () => {
  throw new ApiError(403, 'Bạn không có quyền quản lý phụ huynh của trẻ này.');
};
const requireView = (actor) => {
  if (!canViewParentAccounts(actor) || !canViewChildren(actor)) forbid();
};

// Nguồn cũ vẫn là parentAccounts + child.guardians; không seed lại hoặc chuyển user.permissions.
const initialize = async (actor) => {
  requireView(actor);
  await children.listChildren({}, actor);
  if (readDb().guardianCompatibilityVersion !== 1) writeDb(migrateGuardianAccounts);
  return readDb();
};
const loadChild = (db, id, actor, writing = false) => {
  const child = db.children.find((row) => row.id === id);
  if (!child || !visible(db, child, actor)) forbid();
  if (writing && !canActivateParent(child, actor)) forbid();
  return child;
};
const viewOf = (account, guardian) => ({
  userId: account.id,
  username: account.username || account.phone,
  fullName: guardian.fullName || account.fullName,
  idNumber: guardian.idNumber || account.idNumber || '',
  relationship: relationOf(guardian.relation),
  status: account.status,
  linkedAt: guardian.linkedAt || account.createdAt,
});
const guardiansOf = (db, child) =>
  (child.guardians || []).flatMap((guardian) => {
    const account = accountOf(db, guardian);
    return account && (account.childIds || []).includes(child.id) ? [viewOf(account, guardian)] : [];
  });
const relatedChildren = (db, account) =>
  db.children.filter(
    (child) => (account.childIds || []).includes(child.id) && (child.guardians || []).some((g) => accountOf(db, g)?.id === account.id),
  );
const loadAccount = (db, id, actor) => {
  const account = db.parentAccounts.find((row) => row.id === id);
  if (!account || !relatedChildren(db, account).some((child) => visible(db, child, actor) && canActivateParent(child, actor))) forbid();
  return account;
};
const syncStatus = (db, account) =>
  relatedChildren(db, account).forEach((child) =>
    (child.guardians || []).forEach((guardian) => {
      if (accountOf(db, guardian)?.id === account.id) guardian.accountStatus = account.status;
    }),
  );
const temporaryPassword = () =>
  `Cn${uid('demo')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)}7`;

export const guardianMockRepository = {
  async getStructure(actor) {
    const db = await initialize(actor);
    const campuses = db.campuses.filter((campus) => actor.role === 'PRINCIPAL' || areaAllows(actor, 'children', campus.id));
    const ids = new Set(campuses.map((campus) => campus.id));
    const year = activeYearId(db);
    return clone({ campuses, classrooms: db.classes.filter((cls) => ids.has(cls.campusId) && (!year || cls.schoolYear === year)) });
  },
  async searchChildren({ campusId, page = 0, size = 100 } = {}, actor) {
    const db = await initialize(actor);
    if (campusId && actor.role !== 'PRINCIPAL' && !areaAllows(actor, 'children', campusId)) forbid();
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100)
      throw new ApiError(400, 'Phân trang không hợp lệ.');
    const rows = db.children
      .filter((child) => child.status !== 'LEFT' && visible(db, child, actor) && (!campusId || child.campusId === campusId))
      .map((child) => {
        const guardians = guardiansOf(db, child);
        return {
          id: child.id,
          fullName: child.fullName,
          dateOfBirth: child.dateOfBirth,
          classroomId: child.classId || null,
          campusId: child.campusId,
          guardianCount: guardians.length,
          guardians,
          canManage: canActivateParent(child, actor),
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
    const db = await initialize(actor);
    return clone(guardiansOf(db, loadChild(db, childId, actor)));
  },
  async addGuardian(childId, form, actor) {
    await initialize(actor);
    const errors = validateGuardian(form);
    if (Object.keys(errors).length) throw new ApiError(400, 'Kiểm tra thông tin phụ huynh.', errors);
    return writeDb((db) => {
      const child = loadChild(db, childId, actor, true);
      const phone = normalizePhone(form.phone);
      child.guardians ||= [];
      const email = (form.email || '').trim().toLowerCase();
      if (
        db.users.some(
          (user) => user.role !== 'PARENT' && (normalizePhone(user.phone) === phone || (email && user.email?.toLowerCase() === email)),
        )
      )
        throw new ApiError(409, 'Số điện thoại hoặc email thuộc tài khoản nhân sự.');
      const byPhone = db.parentAccounts.find((row) => normalizePhone(row.phone) === phone);
      const byEmail = email ? db.parentAccounts.find((row) => row.email?.toLowerCase() === email) : null;
      if (byPhone && byEmail && byPhone.id !== byEmail.id)
        throw new ApiError(409, 'Số điện thoại và email thuộc hai tài khoản phụ huynh khác nhau.');
      let account = byPhone || byEmail;
      if (account && (account.childIds || []).includes(childId)) throw new ApiError(409, 'Phụ huynh đã liên kết với trẻ.');
      // CCCD bắt buộc; 1 người 1 tài khoản: lệch tài khoản/hồ sơ khác hoặc trùng phụ huynh khác của trẻ ⇒ 409 (user chốt 2026-10-21).
      const idNumber = normalizeCitizenId(form.idNumber);
      const conflict = identityConflict(db, { phone: account ? account.phone : phone, idNumber }, { excludeChildId: childId });
      if (conflict) throw new ApiError(409, conflict, { idNumber: conflict });
      const sibling = child.guardians.find((g) => normalizePhone(g.phone) !== phone && normalizeCitizenId(g.idNumber) === idNumber);
      if (sibling)
        throw new ApiError(409, 'Hai phụ huynh không được dùng chung số CCCD.', { idNumber: 'Trùng CCCD của phụ huynh khác của trẻ' });
      const newAccount = !account;
      const password = newAccount ? temporaryPassword() : null;
      if (!account) {
        account = {
          id: uid('pa'),
          username: phone,
          phone,
          fullName: form.fullName.trim(),
          email: (form.email || '').trim(),
          idNumber,
          status: 'ACTIVE',
          childIds: [],
          createdAt: new Date().toISOString(),
          mustChangePassword: true,
          sms: [],
        };
        db.parentAccounts.push(account);
      }
      (account.childIds ||= []).push(childId);
      if (!account.idNumber) account.idNumber = idNumber;
      const old = child.guardians.find((guardian) => normalizePhone(guardian.phone) === phone);
      const guardian = {
        ...old,
        accountId: account.id,
        fullName: old?.fullName || account.fullName,
        phone: account.phone,
        idNumber: account.idNumber,
        email: old?.email || account.email || '',
        relation: GUARDIAN_RELATIONSHIP_LABELS[form.relationship],
        accountStatus: account.status,
        linkedAt: new Date().toISOString(),
      };
      if (old) Object.assign(old, guardian);
      else child.guardians.push(guardian);
      if (newAccount) issuePassword(db, account.id, password);
      return clone({ ...viewOf(account, guardian), newAccount, temporaryPassword: password });
    });
  },
  async removeGuardian(childId, id, actor) {
    await initialize(actor);
    return writeDb((db) => {
      const child = loadChild(db, childId, actor, true);
      const index = child.guardians.findIndex((guardian) => accountOf(db, guardian)?.id === id);
      if (index < 0) throw new ApiError(404, 'Không tìm thấy liên kết phụ huynh.');
      const account = accountOf(db, child.guardians[index]);
      // Giữ liên hệ và lịch sử trên hồ sơ; chỉ gỡ quyền tài khoản với trẻ.
      child.guardians[index].accountStatus = 'NOT_ACTIVATED';
      account.childIds = account.childIds.filter((value) => value !== childId);
      return null;
    });
  },
  async updateParentStatus(id, status, actor) {
    await initialize(actor);
    if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new ApiError(400, 'Trạng thái không hợp lệ.');
    return writeDb((db) => {
      const account = loadAccount(db, id, actor);
      account.status = status;
      syncStatus(db, account);
      return clone({ userId: account.id, fullName: account.fullName, username: account.username, status });
    });
  },
  async resetParentPassword(id, actor) {
    await initialize(actor);
    await delay(80);
    return writeDb((db) => {
      const account = loadAccount(db, id, actor);
      account.mustChangePassword = true;
      const password = temporaryPassword();
      issuePassword(db, account.id, password);
      return { userId: account.id, username: account.username, temporaryPassword: password };
    });
  },
};
