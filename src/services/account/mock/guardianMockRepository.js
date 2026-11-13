import { selectedRecipients, recipientError } from '@/utils/children/accountRecipient';
import { uid } from '@/utils/id';
import { readDb, writeDb, clone, ApiError, delay } from '@/mocks/mockDatabase';
import { childrenMockRepository as children } from '@/services/children/mock/childrenMockRepository';
import { canActivateParent, canViewChild, canViewChildren, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { areaAllows } from '@/utils/school-config/schoolConfigPermissions';
import { normalizePhone, validateGuardian } from '@/utils/account/guardianValidation';
import { issuePassword } from '@/mocks/authMockRepository';
// Thêm phụ huynh kèm tạo tài khoản ngay (POST /children/{id}/guardians) đã bỏ: phụ huynh nhập ở hồ sơ trẻ rồi kích hoạt
// (AUTH-20; user chốt 2026-10-28, C-4 A). Phần tạo/liên kết tài khoản dùng chung ở parentAccountMock.
import {
  activatePendingGuardians,
  guardianForm,
  parentAccountView,
  pendingGuardiansOf,
  sendPasswordSms,
  temporaryPassword,
} from '@/mocks/parentAccountMock';
import { migrateGuardianAccounts, parentAccountOf } from './guardianCompatibility';
import { activeYearId } from '@/mocks/roomManagers';

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
  if (readDb().recipientSelectionVersion !== 1)
    writeDb((db) => {
      for (const child of db.children) {
        const contacts = child.guardians || [];
        contacts.forEach((g) => {
          g.id ||= uid('cg');
        });
        if (contacts.some((g) => Object.hasOwn(g, 'accountRecipient'))) continue;
        const linked = contacts.filter((g) => (accountOf(db, g)?.childIds || []).includes(child.id));
        const chosen = contacts.length === 1 ? contacts[0] : linked.length === 1 ? linked[0] : null;
        contacts.forEach((g) => {
          g.accountRecipient = g === chosen;
        });
      }
      db.recipientSelectionVersion = 1;
    });
  return readDb();
};
const loadChild = (db, id, actor, writing = false) => {
  const child = db.children.find((row) => row.id === id);
  if (!child || !visible(db, child, actor) || (child.status === 'LEFT' && actor.role !== 'PRINCIPAL')) forbid();
  if (writing && !canActivateParent(child, actor)) forbid();
  return child;
};
const guardiansOf = (db, child) =>
  selectedRecipients(child.guardians).flatMap((guardian) => {
    const account = accountOf(db, guardian);
    return account && (account.childIds || []).includes(child.id) ? [parentAccountView(account, guardian)] : [];
  });
const relatedChildren = (db, account) =>
  db.children.filter(
    (child) => (account.childIds || []).includes(child.id) && (child.guardians || []).some((g) => accountOf(db, g)?.id === account.id),
  );
const loadAccount = (db, id, actor) => {
  const account = db.parentAccounts.find((row) => row.id === id);
  if (
    !account ||
    !relatedChildren(db, account).some(
      (child) => visible(db, child, actor) && (child.status !== 'LEFT' || actor.role === 'PRINCIPAL') && canActivateParent(child, actor),
    )
  )
    forbid();
  return account;
};
const syncStatus = (db, account) =>
  relatedChildren(db, account).forEach((child) =>
    (child.guardians || []).forEach((guardian) => {
      if (accountOf(db, guardian)?.id === account.id) guardian.accountStatus = account.status;
    }),
  );
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
          accountRecipient: selectedRecipients(child.guardians)[0] || null,
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
  async getAccountCandidates(childId, actor) {
    const db = await initialize(actor);
    return clone(loadChild(db, childId, actor, true).guardians || []);
  },
  async selectAccountRecipient(childId, guardianId, actor) {
    await initialize(actor);
    return writeDb((db) => {
      const child = loadChild(db, childId, actor, true);
      const chosen = child.guardians.find((g) => g.id === guardianId);
      if (!chosen) throw new ApiError(400, 'Phụ huynh không thuộc hồ sơ trẻ.');
      const old = child.guardians.find((g) => g.accountRecipient);
      if (old && old !== chosen && (accountOf(db, old)?.childIds || []).includes(childId))
        throw new ApiError(409, 'Phụ huynh nhận tài khoản đã được kích hoạt.');
      if (old !== chosen) {
        child.guardians.forEach((g) => {
          g.accountRecipient = g === chosen;
        });
        child.history ||= [];
        child.history.push({
          action: 'UPDATED',
          userId: actor.id,
          at: new Date().toISOString(),
          note: 'Chọn phụ huynh nhận tài khoản: ' + chosen.fullName,
          changes: [{ field: 'accountRecipient', from: old?.id || null, to: chosen.id }],
        });
      }
      return null;
    });
  },
  async listGuardians(childId, actor) {
    const db = await initialize(actor);
    return clone(guardiansOf(db, loadChild(db, childId, actor)));
  },
  /** Phụ huynh trên hồ sơ trẻ chưa có tài khoản liên kết với trẻ; thông tin lấy từ hồ sơ, không sửa ở màn này (user chốt 2026-10-23). */
  async listPendingGuardians(childId, actor) {
    const db = await initialize(actor);
    const child = loadChild(db, childId, actor);
    return clone(
      pendingGuardiansOf(db, child).map((g) => ({
        id: g.id,
        accountRecipient: true,
        fullName: g.fullName,
        relation: g.relation,
        phone: g.phone,
        idNumber: g.idNumber || '',
        email: g.email || '',
        // SĐT đã có tài khoản (trẻ khác): kích hoạt chỉ liên kết thêm trẻ, không cấp mật khẩu mới.
        hasAccount: !!accountOf(db, g),
        problems: Object.values(validateGuardian(guardianForm(g))),
      })),
    );
  },
  /** Kích hoạt một lần cho mọi phụ huynh chưa có tài khoản của trẻ (user chốt 2026-10-23); lỗi một người thì không tạo ai. */
  async activateGuardians(childId, actor, guardianId) {
    await initialize(actor);
    return writeDb((db) => {
      const child = loadChild(db, childId, actor, true);
      const chosen = selectedRecipients(child.guardians);
      if (recipientError(child.guardians) || (guardianId && chosen[0].id !== guardianId))
        throw new ApiError(409, 'Người nhận tài khoản đã thay đổi. Tải lại và chọn đúng phụ huynh.');
      return clone(activatePendingGuardians(db, child));
    });
  },
  // Cùng shape BE GuardianCandidateResponse
  async lookupGuardian(childId, phone, actor) {
    const db = await initialize(actor);
    loadChild(db, childId, actor, true);
    const account = db.parentAccounts.find((row) => normalizePhone(row.phone) === normalizePhone(phone));
    if (!account) return { exists: false, userId: null, maskedFullName: null, staffAccount: false, alreadyLinked: false, status: null };
    return {
      exists: true,
      userId: account.id,
      maskedFullName: account.fullName
        .split(/\s+/)
        .map((word) => `${word[0]}***`)
        .join(' '),
      staffAccount: false,
      alreadyLinked: (account.childIds || []).includes(childId),
      status: account.status,
    };
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
      issuePassword(db, account.id, temporaryPassword());
      const smsStatus = sendPasswordSms(db, account);
      return { userId: account.id, username: account.username, phone: account.phone, smsStatus };
    });
  },
};
