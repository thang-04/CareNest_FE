import { ApiError } from '@/mocks/mockDatabase';
import { issuePassword } from '@/mocks/authMockRepository';
import { identityConflict } from '@/mocks/guardianIdentity';
import { parentAccountOf } from '@/services/account/mock/guardianCompatibility';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/account/guardianConstants';
import { normalizePhone, validateGuardian } from '@/utils/account/guardianValidation';
import { normalizeCitizenId } from '@/utils/citizenId';
import { uid } from '@/utils/id';

/*
 * Tạo / liên kết tài khoản phụ huynh (BE giả, AUTH-18 theo các quyết định FE). Dùng chung cho kích hoạt ở màn Tài khoản phụ huynh
 * và lưu form tiếp nhận (user chốt 2026-10-28, L-14); để ở đây vì module tài khoản đã import module trẻ (tránh vòng import).
 */

const relationOf = (value) =>
  Object.keys(GUARDIAN_RELATIONSHIP_LABELS).find((key) => GUARDIAN_RELATIONSHIP_LABELS[key] === value) || value || 'GUARDIAN';

// Email liên hệ của tài khoản lưu chữ thường như BE (L-17, `user_accounts.email`).
const accountEmail = (email) => (email || '').trim().toLowerCase();

export const parentAccountView = (account, guardian) => ({
  userId: account.id,
  username: account.username || account.phone,
  fullName: guardian.fullName || account.fullName,
  idNumber: guardian.idNumber || account.idNumber || '',
  relationship: relationOf(guardian.relation),
  // Quan hệ như hồ sơ trẻ (Ông, Bà… không có mã riêng) để hiển thị.
  relation: guardian.relation || '',
  status: account.status,
  linkedAt: guardian.linkedAt || account.createdAt,
});

export const temporaryPassword = () =>
  `Cn${uid('demo')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)}7`;

/**
 * Mật khẩu tạm gửi qua SMS tới SĐT đăng nhập, không trả về giao diện, không in phiếu (user bỏ màn in phiếu 2026-10-23).
 * SMS giả lập: SĐT kết thúc 99 lỗi ở lần gửi đầu để thử đường gửi lại (như kích hoạt ở hồ sơ trẻ). Trạng thái ghi vào phụ huynh
 * của mọi trẻ dùng tài khoản này (hồ sơ trẻ hiện "Gửi SMS lỗi").
 */
export const sendPasswordSms = (db, account) => {
  account.sms ||= [];
  const status = /99$/.test(account.phone) && account.sms.length === 0 ? 'FAILED' : 'SENT';
  const at = new Date().toISOString();
  account.sms.push({ at, status });
  db.children.forEach((c) =>
    (c.guardians || []).forEach((g) => {
      if (parentAccountOf(db, g)?.id === account.id) Object.assign(g, { smsStatus: status, smsAt: at });
    }),
  );
  return status;
};

// Quan hệ trên hồ sơ trẻ (Bố, Mẹ, Ông…) sang mã quan hệ của tài khoản; quan hệ khác Bố/Mẹ/Người giám hộ là "Khác".
const relationshipOf = (label) =>
  Object.keys(GUARDIAN_RELATIONSHIP_LABELS).find((key) => GUARDIAN_RELATIONSHIP_LABELS[key] === label) || 'OTHER';

export const guardianForm = (g) => ({
  phone: g.phone,
  fullName: g.fullName,
  idNumber: g.idNumber,
  email: g.email || '',
  relationship: relationshipOf(g.relation),
});

export const pendingGuardiansOf = (db, child) =>
  (child.guardians || []).filter((g) => {
    const account = parentAccountOf(db, g);
    return !account || !(account.childIds || []).includes(child.id);
  });

/** Tạo hoặc liên kết tài khoản cho một phụ huynh của trẻ. relationLabel: giữ quan hệ như hồ sơ trẻ (kích hoạt từ hồ sơ). */
export const linkGuardian = (db, child, form, relationLabel) => {
  const childId = child.id;
  const phone = normalizePhone(form.phone);
  child.guardians ||= [];
  // Tài khoản nhân sự tách riêng, không chặn SĐT/email phụ huynh; email chỉ là liên hệ nên chỉ tìm tài khoản theo SĐT
  // (user chốt 2026-10-28, PROPOSED — chờ BE, lệch AUTH-18 "SĐT của nhân sự ⇒ từ chối").
  let account = db.parentAccounts.find((row) => normalizePhone(row.phone) === phone);
  if (account && (account.childIds || []).includes(childId)) throw new ApiError(409, 'Phụ huynh đã liên kết với trẻ.');
  // CCCD bắt buộc; 1 người 1 tài khoản: lệch tài khoản/hồ sơ khác hoặc trùng phụ huynh khác của trẻ ⇒ 409 (user chốt 2026-10-21).
  const idNumber = normalizeCitizenId(form.idNumber);
  const conflict = identityConflict(db, { phone, idNumber }, { excludeChildId: childId });
  if (conflict) throw new ApiError(409, conflict, { idNumber: conflict });
  const sibling = child.guardians.find((g) => normalizePhone(g.phone) !== phone && normalizeCitizenId(g.idNumber) === idNumber);
  if (sibling)
    throw new ApiError(409, 'Hai phụ huynh không được dùng chung số CCCD.', { idNumber: 'Trùng CCCD của phụ huynh khác của trẻ' });
  const newAccount = !account;
  const password = newAccount ? temporaryPassword() : null; // carenest:allow-secret – tên biến, mật khẩu tạm sinh ngẫu nhiên trong mock
  if (!account) {
    account = {
      id: uid('pa'),
      username: phone,
      phone,
      fullName: form.fullName.trim(),
      email: accountEmail(form.email),
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
    relation: relationLabel || GUARDIAN_RELATIONSHIP_LABELS[form.relationship],
    accountStatus: account.status,
    linkedAt: new Date().toISOString(),
  };
  if (old) Object.assign(old, guardian);
  else child.guardians.push(guardian);
  if (newAccount) issuePassword(db, account.id, password);
  // Tài khoản có sẵn giữ mật khẩu cũ, không gửi SMS.
  const smsStatus = newAccount ? sendPasswordSms(db, account) : null;
  return { ...parentAccountView(account, guardian), phone: account.phone, newAccount, smsStatus };
};

/** Thông tin phụ huynh trên hồ sơ khác tài khoản (họ tên, SĐT, email, CCCD)? */
export const differsFromAccount = (account, g) =>
  account.fullName !== (g.fullName || '').trim() ||
  normalizePhone(account.phone) !== normalizePhone(g.phone) ||
  accountEmail(account.email) !== accountEmail(g.email) ||
  (!!normalizeCitizenId(g.idNumber) && normalizeCitizenId(account.idNumber) !== normalizeCitizenId(g.idNumber));

/**
 * Sửa thông tin phụ huynh ở hồ sơ trẻ ⇒ tài khoản đổi theo (user chốt 2026-10-28). Đổi SĐT ⇒ tên đăng nhập đổi sang SĐT mới, cấp mật
 * khẩu tạm mới, gửi SMS tới SĐT mới. Bản sao phụ huynh ở mọi hồ sơ trẻ của tài khoản đổi theo (phụ huynh nối tài khoản theo SĐT).
 */
export const applyGuardianEdits = (db, account, g) => {
  const copies = (db.children || []).flatMap((c) => (c.guardians || []).filter((x) => parentAccountOf(db, x)?.id === account.id));
  const phone = normalizePhone(g.phone);
  const phoneChanged = !!phone && phone !== normalizePhone(account.phone);
  account.fullName = g.fullName.trim();
  account.email = accountEmail(g.email);
  account.idNumber = normalizeCitizenId(g.idNumber) || account.idNumber;
  if (phoneChanged) Object.assign(account, { phone, username: phone, mustChangePassword: true });
  copies.forEach((x) =>
    Object.assign(x, { fullName: account.fullName, phone: account.phone, email: account.email, idNumber: account.idNumber }),
  );
  if (!phoneChanged) return { phoneChanged: false, smsStatus: null };
  issuePassword(db, account.id, temporaryPassword());
  return { phoneChanged: true, smsStatus: sendPasswordSms(db, account) };
};

/** Tạo / liên kết tài khoản cho mọi phụ huynh chưa có tài khoản với trẻ; một người sai thì không tạo ai (gọi trong writeDb). */
export const activatePendingGuardians = (db, child) => {
  const pending = pendingGuardiansOf(db, child);
  const bad = pending.find((g) => Object.keys(validateGuardian(guardianForm(g))).length);
  if (bad)
    throw new ApiError(
      400,
      `Thông tin của ${bad.fullName || 'phụ huynh'} trên hồ sơ trẻ chưa đủ hoặc chưa đúng. Sửa ở hồ sơ trẻ rồi kích hoạt lại.`,
    );
  return pending.map((g) => linkGuardian(db, child, guardianForm(g), g.relation));
};
