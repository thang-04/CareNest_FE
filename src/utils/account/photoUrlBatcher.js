/**
 * Gom yêu cầu link ảnh đại diện của nhiều tài khoản trên một màn thành một lần gọi BE (BE AUTH-27, `POST /accounts/photos/urls`).
 * Link có hạn ⇒ cache tới `expiresAt` trừ biên an toàn; người không có ảnh/không được xem cache ngắn để không hỏi lại liên tục.
 * Lỗi mạng không cache (lần sau hỏi lại), trả null để Avatar hiện chữ cái đầu.
 */
export function createPhotoUrlBatcher({
  fetchUrls,
  now = () => Date.now(),
  delayMs = 0,
  maxBatch = 100,
  missTtlMs = 5 * 60 * 1000,
  refreshMarginMs = 60 * 1000,
}) {
  const cache = new Map();
  let pending = new Map();
  let timer = null;

  const isFresh = (entry) => entry !== undefined && entry.until > now();

  const settle = (resolvers, url) => resolvers.forEach((resolve) => resolve(url));

  async function flush() {
    timer = null;
    const batch = pending;
    pending = new Map();
    const ids = [...batch.keys()];
    for (let i = 0; i < ids.length; i += maxBatch) {
      const chunk = ids.slice(i, i + maxBatch);
      let rows;
      try {
        rows = await fetchUrls(chunk);
      } catch {
        // Lỗi tạm thời: không cache để lần hiển thị sau thử lại
        chunk.forEach((id) => settle(batch.get(id), null));
        continue;
      }
      const found = new Map((rows || []).map((row) => [Number(row.userId), row]));
      for (const id of chunk) {
        const row = found.get(id);
        const expiresAt = row ? Date.parse(row.expiresAt) : NaN;
        const entry = row
          ? { url: row.url, until: Number.isFinite(expiresAt) ? expiresAt - refreshMarginMs : now() + refreshMarginMs }
          : { url: null, until: now() + missTtlMs };
        cache.set(id, entry);
        settle(batch.get(id), entry.url);
      }
    }
  }

  return {
    /** Link ảnh của tài khoản `userId` (null nếu không có ảnh, không được xem hoặc lỗi). */
    get(userId) {
      const entry = cache.get(userId);
      if (isFresh(entry)) return Promise.resolve(entry.url);
      return new Promise((resolve) => {
        if (!pending.has(userId)) pending.set(userId, []);
        pending.get(userId).push(resolve);
        if (timer === null) timer = setTimeout(flush, delayMs);
      });
    },
    /** Bỏ cache một tài khoản (sau khi đổi/xóa ảnh). */
    invalidate(userId) {
      cache.delete(userId);
    },
  };
}

/** Id tài khoản BE của đối tượng người dùng hiển thị (`userId` hoặc `id` dạng số); id mock/không hợp lệ ⇒ null. */
export function photoUserId(user) {
  const raw = user?.userId ?? user?.id;
  const value = typeof raw === 'number' ? raw : /^\d+$/.test(String(raw ?? '')) ? Number(raw) : NaN;
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
