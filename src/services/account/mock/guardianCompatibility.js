import { normalizePhone } from '@/utils/account/guardianValidation';
import { uid } from '@/utils/id';

export const parentAccountOf = (db, guardian) => {
  const phone = normalizePhone(guardian.phone);
  const accounts = db.parentAccounts || [];
  return accounts.find((account) => guardian.accountId && account.id === guardian.accountId && (!phone || normalizePhone(account.phone) === phone))
    || accounts.find((account) => phone && normalizePhone(account.phone) === phone);
};

// Seed cũ dùng ID theo trẻ: hai phụ huynh khác nhau có thể trùng ID. Không seed lại liên kết đã gỡ.
export const migrateGuardianAccounts = (db) => {
  const used = new Set();
  (db.parentAccounts || []).forEach((account) => {
    if (used.has(account.id)) {
      const previous = account.id;
      account.id = uid('pa');
      (db.children || []).forEach((child) => (child.guardians || []).forEach((guardian) => {
        if (guardian.accountId === previous && normalizePhone(guardian.phone) === normalizePhone(account.phone)) guardian.accountId = account.id;
      }));
    }
    used.add(account.id);
  });
  db.guardianCompatibilityVersion = 1;
};

export const healthNotificationRecipients = (db, child) => {
  const seen = new Set();
  return (child.guardians || []).flatMap((guardian) => {
    const account = parentAccountOf(db, guardian);
    if (guardian.accountStatus !== 'ACTIVE') return [];
    if (account && (account.status !== 'ACTIVE' || !(account.childIds || []).includes(child.id))) return [];
    const recipientKey = guardian.email || (account && `parent:${account.id}`);
    const identity = account?.id || recipientKey;
    if (!recipientKey || seen.has(identity)) return [];
    seen.add(identity);
    return [{ ...guardian, recipientKey }];
  });
};
