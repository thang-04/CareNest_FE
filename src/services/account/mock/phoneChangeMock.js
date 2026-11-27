import { ApiError, readDb, writeDb } from '@/mocks/mockDatabase';
import { ensureChildRecordsSeeded } from '@/services/children/mock/childrenMockRepository';
import { canActivateParent, canEditChild } from '@/utils/children/childrenPermissions';
import { isValidPhone, normalizePhone } from '@/utils/children/childrenValidation';
import { uid } from '@/utils/id';
import { parentAccountOf } from './guardianCompatibility';

function target(db, childId, guardianId) {
  const child = db.children.find((c) => c.id === childId);
  const guardian = child?.guardians.find((g) => g.id === guardianId);
  if (!guardian) throw new ApiError(404, 'Không tìm thấy phụ huynh.');
  return { child, guardian };
}

function checkAvailable(db, value, original) {
  const phone = normalizePhone(value);
  if (!isValidPhone(phone) || phone === normalizePhone(original))
    throw new ApiError(422, 'Số mới không hợp lệ.', { newPhone: 'Nhập số hợp lệ khác số đang dùng.' });
  if (db.parentAccounts.some((a) => normalizePhone(a.phone) === phone) ||
      db.children.some((c) => c.guardians?.some((g) => normalizePhone(g.phone) === phone)))
    throw new ApiError(409, 'Số điện thoại đã được sử dụng.');
  return phone;
}

function decide(id, actor, status, note) {
  return writeDb((db) => {
    const row = db.phoneChangeRequests?.find((r) => r.id === id);
    if (!row || row.status !== 'PENDING') throw new ApiError(409, 'Yêu cầu không còn chờ duyệt.');
    const { child, guardian } = target(db, row.childId, row.guardianId);
    if (!canActivateParent(child, actor))
      throw new ApiError(403, 'Không có quyền duyệt yêu cầu.');
    if (status === 'APPROVED') {
      if (normalizePhone(guardian.phone) !== normalizePhone(row.oldPhone)) throw new ApiError(409, 'Số cũ đã thay đổi.');
      checkAvailable(db, row.newPhone, guardian.phone);
      const account = parentAccountOf(db, guardian);
      if (account) {
        const contacts = db.children.flatMap((c) => c.guardians || []).filter((g) => parentAccountOf(db, g)?.id === account.id);
        contacts.forEach((g) => { g.phone = row.newPhone; });
        account.phone = row.newPhone;
        account.username = row.newPhone;
      }
      guardian.phone = row.newPhone;
    } else if (!note?.trim() || note.trim().length > 300) throw new ApiError(422, 'Nhập lý do từ chối (tối đa 300 ký tự).');
    return { ...Object.assign(row, { status, decisionNote: note?.trim(), decidedBy: actor.id }), canDecide: false };
  });
}

// CP-18: yêu cầu giữ nguyên số cũ đến lúc duyệt.
export const phoneChangeMock = {
  requestPhoneChange(childId, guardianId, { newPhone, reason }, actor) {
    ensureChildRecordsSeeded();
    return writeDb((db) => {
      const { child, guardian } = target(db, childId, guardianId);
      if (!canEditChild(child, actor)) throw new ApiError(403, 'Không có quyền sửa hồ sơ.');
      const phone = checkAvailable(db, newPhone, guardian.phone);
      if (!reason?.trim() || reason.trim().length > 300) throw new ApiError(422, 'Nhập lý do đổi số (tối đa 300 ký tự).');
      const requests = db.phoneChangeRequests ||= [];
      const userId = parentAccountOf(db, guardian)?.id;
      requests.filter((r) => r.status === 'PENDING' && (r.guardianId === guardianId || (userId && r.userId === userId)))
        .forEach((r) => { r.status = 'CANCELLED'; });
      const row = { id: uid('phone'), childId, guardianId, userId, childName: child.fullName, guardianName: guardian.fullName,
        oldPhone: guardian.phone, newPhone: phone, reason: reason.trim(), status: 'PENDING', requestedBy: actor.id,
        requestedByName: actor.fullName || actor.name, requestedAt: new Date().toISOString() };
      requests.unshift(row);
      return { ...row, canDecide: canActivateParent(child, actor) };
    });
  },
  listPhoneChangeRequests(status, actor) {
    ensureChildRecordsSeeded();
    const db = readDb();
    return (db.phoneChangeRequests || []).flatMap((row) => {
      const child = db.children.find((c) => c.id === row.childId);
      if (!child || !canActivateParent(child, actor) || (status && row.status !== status)) return [];
      return [{ ...row, canDecide: row.status === 'PENDING' }];
    });
  },
  approvePhoneChange: (id, actor) => decide(id, actor, 'APPROVED'),
  rejectPhoneChange: (id, note, actor) => decide(id, actor, 'REJECTED', note),
};
