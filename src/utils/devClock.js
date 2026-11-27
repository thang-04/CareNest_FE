/*
 * Dev Mode giả lập ngày giờ (chỉ môi trường dev/kiểm thử, bật bằng VITE_DEV_TOOLS=true khi build).
 * Lưu độ lệch (giờ chọn − giờ thật) nên giờ giả lập vẫn chạy tiếp; request gửi kèm X-Dev-Now để BE tính cùng giờ.
 * Giờ của phiên đăng nhập, token, OTP, id tạm vẫn dùng Date.now() thật — không đi qua file này.
 */
export const DEV_NOW_HEADER = 'X-Dev-Now';
const STORAGE_KEY = 'carenest.devClock.offsetMs';

const safeStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function createDevClock({ enabled, storage = safeStorage(), realNow = () => Date.now() }) {
  const read = () => {
    if (!enabled) return 0;
    try {
      const value = Number(storage?.getItem(STORAGE_KEY));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };
  // Đọc một lần lúc tải trang; đổi giờ thì trang tải lại nên mọi màn tính lại theo giờ mới
  let offsetMs = read();

  const isActive = () => offsetMs !== 0;
  const nowMs = () => realNow() + offsetMs;
  const now = () => new Date(nowMs());

  const setTo = (date) => {
    if (!enabled) return;
    offsetMs = date.getTime() - realNow();
    try {
      storage?.setItem(STORAGE_KEY, String(offsetMs));
    } catch {
      /* storage bị chặn: chỉ giữ trong bộ nhớ */
    }
  };

  const clear = () => {
    offsetMs = 0;
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      /* storage bị chặn */
    }
  };

  const headers = () => (isActive() ? { [DEV_NOW_HEADER]: now().toISOString() } : {});

  return { enabled, isActive, nowMs, now, setTo, clear, headers };
}

const clock = createDevClock({ enabled: import.meta.env?.VITE_DEV_TOOLS === 'true' });

export const DEV_TOOLS_ENABLED = clock.enabled;
export const isDevClockActive = clock.isActive;
export const devNowMs = clock.nowMs;
/** "Bây giờ" cho nghiệp vụ: giờ giả lập khi bật Dev Mode, ngược lại giờ thật. */
export const devNow = clock.now;
export const setDevClockTo = clock.setTo;
export const clearDevClock = clock.clear;
/** Header cho request tới BE khi đang giả lập; tắt Dev Mode thì không gửi gì. */
export const devClockHeaders = clock.headers;

/*
 * Mốc của màn đang mở (giờ chốt, hạn nộp, ngày bắt đầu/kết thúc...) để pop-up Dev Mode gợi ý Trước / Đúng lúc / Sau.
 * Màn khai báo qua useDevClockMarks; chỉ lưu khi bật VITE_DEV_TOOLS.
 */
const markOwners = new Map();
const markListeners = new Set();
let markSnapshot = [];

const publishMarks = () => {
  const seen = new Map();
  for (const marks of markOwners.values()) for (const m of marks) seen.set(`${m.label}|${m.at}`, m);
  markSnapshot = [...seen.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  markListeners.forEach((fn) => fn());
};

export const setDevMarks = (owner, marks) => {
  if (!DEV_TOOLS_ENABLED) return;
  const valid = (marks || []).filter((m) => m?.label && m.at && !Number.isNaN(Date.parse(m.at)));
  if (valid.length) markOwners.set(owner, valid);
  else markOwners.delete(owner);
  publishMarks();
};

export const subscribeDevMarks = (fn) => {
  markListeners.add(fn);
  return () => markListeners.delete(fn);
};

export const getDevMarks = () => markSnapshot;

/** Mốc theo ngày yyyy-mm-dd (giờ trường): đầu ngày cho "bắt đầu từ", cuối ngày cho "hạn đến hết ngày". */
export const dayStartAt = (isoDate) => (isoDate ? `${isoDate}T00:00:00+07:00` : null);
export const dayEndAt = (isoDate) => (isoDate ? `${isoDate}T23:59:00+07:00` : null);
export const dayTimeAt = (isoDate, hhmm) => (isoDate && hhmm ? `${isoDate}T${hhmm.slice(0, 5)}:00+07:00` : null);
export const shiftDays = (isoDate, n) => {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
