// Bản giữ ẩn trên máy cho các màn kế hoạch lưu tay (Tiền chốt 27/10): phòng mất điện/đóng tab khi chưa bấm Lưu.
export const planBackupKey = (userId, docKey) => `carenest:plan-backup:${userId}:${docKey}`;

// Mốc phiên bản bản trên hệ thống: đổi trạng thái (gửi, trả lại, duyệt) hoặc thêm lịch sử ⇒ bản giữ cũ không còn dùng
export const planBaseOf = (doc) => JSON.stringify([doc?.id ?? null, doc?.status ?? null, doc?.history?.length ?? 0, doc?.revision ?? null]);

// Chỉ mời khôi phục khi bản trên hệ thống chưa đổi kể từ lúc giữ và nội dung giữ khác bản trên hệ thống
export function usablePlanBackup(entry, serverDoc) {
  if (!entry?.doc || !serverDoc) return null;
  if (entry.base !== planBaseOf(serverDoc)) return null;
  return JSON.stringify(entry.doc) === JSON.stringify(serverDoc) ? null : entry;
}
