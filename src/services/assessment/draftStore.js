import { draftsOf } from '@/models/draftHistory.mjs';

// Bản giữ ẩn trên máy cho nội dung cấp lớp đang soạn (cách của kế hoạch giáo dục). Không dùng cho đánh giá từng trẻ:
// dữ liệu trẻ không lưu ở máy (rules/state.md), đánh giá từng trẻ đã có bản nháp trên hệ thống
const keyOf = (userId, docKey) => `carenest:assessment-draft:${userId}:${docKey}`;

/** Các mốc chưa lưu (≤2) của một tài liệu; bản hỏng coi như không có. */
export function readDrafts(userId, docKey) {
  try {
    return draftsOf(JSON.parse(localStorage.getItem(keyOf(userId, docKey))));
  } catch {
    return [];
  }
}

export function writeDrafts(userId, docKey, entries) {
  if (entries.length) localStorage.setItem(keyOf(userId, docKey), JSON.stringify({ entries }));
  else localStorage.removeItem(keyOf(userId, docKey));
}
