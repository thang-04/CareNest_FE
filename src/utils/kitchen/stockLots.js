/*
 * Trình bày tồn kho khô: gom lô theo thực phẩm và nhắc hạn dùng. Chỉ để đọc cho dễ; lô nào được trừ trước, lô nào còn
 * dùng được do BE quyết định.
 */
const round3 = (n) => Math.round(n * 1000) / 1000;

// Lô còn ít hơn số ngày này thì tô cảnh báo (gợi ý hiển thị, không chặn thao tác)
export const EXPIRY_WARN_DAYS = 14;

const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/** Số ngày từ `today` đến hạn dùng (âm = đã quá hạn); null khi thiếu ngày. */
export const daysUntil = (expiryDate, today) => (expiryDate && today ? dayNumber(expiryDate) - dayNumber(today) : null);

/** { state: 'EXPIRED'|'SOON'|'OK'|'NONE', days } để tô màu nhãn hạn dùng. */
export const expiryStatus = (expiryDate, today) => {
  const days = daysUntil(expiryDate, today);
  if (days == null) return { state: 'NONE', days };
  if (days < 0) return { state: 'EXPIRED', days };
  return { state: days <= EXPIRY_WARN_DAYS ? 'SOON' : 'OK', days };
};

/** Gom lô theo thực phẩm (tên A-Z); trong mỗi thực phẩm giữ thứ tự BE trả (hạn dùng sớm trước). */
export const groupLotsByFood = (lots = []) => {
  const groups = new Map();
  lots.forEach((lot) => {
    const key = String(lot.food?.id ?? lot.id);
    if (!groups.has(key)) groups.set(key, { food: lot.food, lots: [], remaining: 0 });
    const group = groups.get(key);
    group.lots.push(lot);
    group.remaining = round3(group.remaining + Number(lot.remaining || 0));
  });
  return [...groups.values()].sort((a, b) => String(a.food?.name || '').localeCompare(String(b.food?.name || ''), 'vi'));
};

/** Tên người thao tác để hiện; BE trả mã số thay vì tên thì bỏ (không hiện ID cho người dùng). */
export const personName = (value) => (value == null || value === '' || /^\d+$/.test(String(value)) ? '' : String(value));
