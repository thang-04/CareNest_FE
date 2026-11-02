// Khung chờ chỉ hiện sau LOADING_REVEAL_MS (CSS --loading-reveal-delay, tokens.css): dữ liệu về nhanh thì không chớp;
// đã hiện thì giữ tối thiểu LOADING_MIN_VISIBLE_MS để không lóe rồi tắt.
export const LOADING_REVEAL_MS = 300;
export const LOADING_MIN_VISIBLE_MS = 400;

/** Thời gian cần giữ trạng thái loading thêm, khi dữ liệu về sau `elapsed` ms. */
export const loadingHoldMs = (elapsed) =>
  elapsed < LOADING_REVEAL_MS ? 0 : Math.max(0, LOADING_REVEAL_MS + LOADING_MIN_VISIBLE_MS - elapsed);

// Phiên tải: các lượt tải song song hoặc nối tiếp nhau (lượt sau bắt đầu trong CHAIN_GAP_MS) dùng chung khung chờ
// đang hiện, nên thời gian giữ tính từ đầu phiên chứ không từ lúc lượt sau bắt đầu (tránh khung chờ lóe ngắn).
const CHAIN_GAP_MS = 100;
let active = 0;
let sessionStart = 0;
let idleAt = -Infinity;

/** Bắt đầu một lượt tải hiện khung chờ; trả về mốc đầu phiên để truyền cho holdLoading. */
export const beginLoading = () => {
  const now = Date.now();
  if (active === 0 && now - idleAt > CHAIN_GAP_MS) sessionStart = now;
  active += 1;
  return sessionStart;
};

/** Kết thúc lượt tải đã beginLoading (gọi đúng một lần, kể cả khi lỗi). */
export const endLoading = () => {
  active = Math.max(0, active - 1);
  if (active === 0) idleAt = Date.now();
};

export const holdLoading = (startedAt) => {
  const ms = loadingHoldMs(Date.now() - startedAt);
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
};

// Lớp phủ AI hiện ngay khi bấm và giữ tối thiểu AI_MIN_VISIBLE_MS để kịp thấy hoạt hình (user chốt 2 s, 2026-10-21).
export const AI_MIN_VISIBLE_MS = 2000;

export const aiHoldMs = (elapsed) => Math.max(0, AI_MIN_VISIBLE_MS - elapsed);

/** Chạy việc AI, giữ đủ mốc tối thiểu tính từ lúc bấm (thành công hay lỗi) rồi trả kết quả / ném lỗi. */
export const runWithAiHold = async (task) => {
  const startedAt = Date.now();
  try {
    return await task();
  } finally {
    const ms = aiHoldMs(Date.now() - startedAt);
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  }
};

/** Chạy loader có hiện khung chờ: giữ trạng thái loading đủ lâu (thành công hay lỗi) rồi trả kết quả / ném lỗi. */
export const loadWithHold = async (loader) => {
  const startedAt = beginLoading();
  try {
    return await loader();
  } finally {
    await holdLoading(startedAt);
    endLoading();
  }
};
