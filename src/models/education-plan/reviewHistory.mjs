/**
 * Lần gửi duyệt gần nhất trong lịch sử do BE trả (kế hoạch năm/tổ: `code` = "SUBMIT"; hồ sơ lớp: `action` = "submit").
 * Dùng để hiện ghi chú người gửi cho người duyệt (BE spec 002 FR-005).
 */
export const submitEntryOf = (doc) =>
  [...(doc?.history || [])].reverse().find((h) => h.code === 'SUBMIT' || h.action === 'submit') || null;
