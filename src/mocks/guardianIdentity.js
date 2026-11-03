import { normalizeCitizenId } from '@/utils/citizenId';

/*
 * BE giả — 1 người 1 tài khoản (user chốt 2026-10-21, PROPOSED — chờ BE): CCCD và SĐT của một phụ huynh phải khớp nhau
 * trên mọi tài khoản phụ huynh và mọi bản ghi phụ huynh của hồ sơ trẻ. Dùng chung cho repository trẻ và tài khoản phụ huynh.
 */

const phoneKey = (phone) =>
  String(phone || '')
    .replace(/[\s.\-()]/g, '')
    .replace(/^\+84/, '0');

export const CITIZEN_ID_TAKEN = 'Số CCCD này đã ghi cho phụ huynh khác (số điện thoại khác). Kiểm tra lại số CCCD.';
export const PHONE_HAS_OTHER_ID = 'Số điện thoại này đã thuộc phụ huynh có số CCCD khác. Kiểm tra lại số điện thoại hoặc số CCCD.';

/**
 * Câu lỗi khi { phone, idNumber } lệch với phụ huynh đã ghi, hoặc null. excludeChildId: bỏ bản ghi của hồ sơ đang sửa.
 * sameAccount: tài khoản của chính phụ huynh đang sửa ⇒ bỏ tài khoản đó và bản sao cùng SĐT/CCCD cũ (đổi SĐT, CCCD — user chốt 2026-10-28).
 */
export const identityConflict = (db, { phone, idNumber }, { excludeChildId, sameAccount } = {}) => {
  const id = normalizeCitizenId(idNumber);
  const p = phoneKey(phone);
  if (!id || !p) return null;
  const ownRecord = (r) =>
    !!sameAccount &&
    (r === sameAccount ||
      phoneKey(r.phone) === phoneKey(sameAccount.phone) ||
      (!!sameAccount.idNumber && normalizeCitizenId(r.idNumber) === normalizeCitizenId(sameAccount.idNumber)));
  const records = [
    ...(db.parentAccounts || []),
    ...(db.children || []).filter((c) => c.id !== excludeChildId).flatMap((c) => c.guardians || []),
  ].filter((r) => !ownRecord(r));
  for (const r of records) {
    const rid = normalizeCitizenId(r.idNumber);
    const rp = phoneKey(r.phone);
    if (rid === id && rp && rp !== p) return CITIZEN_ID_TAKEN;
    if (rp === p && rid && rid !== id) return PHONE_HAS_OTHER_ID;
  }
  return null;
};

/** Kiểm các dòng trong cùng một file nhập: dòng sau lệch CCCD/SĐT với dòng trước ⇒ câu lỗi kèm số dòng. */
export const createBatchIdentityCheck = () => {
  const byId = new Map();
  const byPhone = new Map();
  return ({ phone, idNumber }, rowNo) => {
    const id = normalizeCitizenId(idNumber);
    const p = phoneKey(phone);
    if (!id || !p) return null;
    const sameId = byId.get(id);
    if (sameId && sameId.phone !== p) return `Số CCCD phụ huynh trùng dòng ${sameId.rowNo} nhưng khác số điện thoại`;
    const samePhone = byPhone.get(p);
    if (samePhone && samePhone.id !== id) return `Số điện thoại phụ huynh trùng dòng ${samePhone.rowNo} nhưng khác số CCCD`;
    if (!sameId) byId.set(id, { phone: p, rowNo });
    if (!samePhone) byPhone.set(p, { id, rowNo });
    return null;
  };
};

/** Dữ liệu mẫu: CCCD giả "999" + 9 số cuối SĐT (không có mã tỉnh 999; cùng SĐT thì cùng CCCD). */
export const seedCitizenIdFor = (phone) => `999${phoneKey(phone).slice(-9)}`;

/** Dữ liệu mẫu: phụ huynh chưa có CCCD được gán CCCD giả theo SĐT (sửa tại chỗ, trả lại mảng). */
export const addSeedGuardianIds = (children) => {
  children.forEach((c) =>
    (c.guardians || []).forEach((g) => {
      if (!g.idNumber) g.idNumber = seedCitizenIdFor(g.phone);
    }),
  );
  return children;
};

/**
 * DB demo: mọi phụ huynh trên hồ sơ trẻ và mọi tài khoản phụ huynh phải có CCCD (user yêu cầu 2026-10-21), kể cả phụ huynh
 * người dùng nhập trước quy định. Thiếu thì lấy CCCD đã ghi cho cùng SĐT; chưa có thì số giả theo SĐT, không trùng SĐT khác.
 */
export const fillMissingCitizenIds = (db) => {
  const records = [...(db.parentAccounts || []), ...(db.children || []).flatMap((c) => c.guardians || [])];
  const idOfPhone = new Map();
  const phoneOfId = new Map();
  records.forEach((r) => {
    const p = phoneKey(r.phone);
    const id = normalizeCitizenId(r.idNumber);
    if (!p || !id) return;
    if (!idOfPhone.has(p)) idOfPhone.set(p, id);
    if (!phoneOfId.has(id)) phoneOfId.set(id, p);
  });
  const idFor = (phone) => {
    const p = phoneKey(phone);
    if (!idOfPhone.has(p)) {
      let id = seedCitizenIdFor(phone);
      while (phoneOfId.has(id)) id = String(Number(id) + 1);
      idOfPhone.set(p, id);
      phoneOfId.set(id, p);
    }
    return idOfPhone.get(p);
  };
  records.forEach((r) => {
    if (!normalizeCitizenId(r.idNumber) && phoneKey(r.phone)) r.idNumber = idFor(r.phone);
  });
};
