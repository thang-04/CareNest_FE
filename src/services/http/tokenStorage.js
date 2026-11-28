import { AUTH_USE_MOCK } from '@/config/env';

const LEGACY_KEY = 'carenest.accessToken';
const MOCK_KEY = 'carenest.mock.accessToken';
let accessToken = null;
let generation = 0;

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const erase = (key) => {
  safe(() => localStorage.removeItem(key));
  safe(() => sessionStorage.removeItem(key));
};
// Token thật của phiên cũ không được tồn tại trong browser storage.
erase(LEGACY_KEY);

export const tokenStorage = {
  get: () => (AUTH_USE_MOCK ? safe(() => localStorage.getItem(MOCK_KEY) || sessionStorage.getItem(MOCK_KEY)) : accessToken),
  set: (token, remember = false) => {
    if (!AUTH_USE_MOCK) {
      accessToken = token;
      return;
    }
    safe(() => {
      (remember ? localStorage : sessionStorage).setItem(MOCK_KEY, token);
      (remember ? sessionStorage : localStorage).removeItem(MOCK_KEY);
    });
  },
  clear: () => {
    generation += 1;
    accessToken = null;
    erase(LEGACY_KEY);
    erase(MOCK_KEY);
  },
  getGeneration: () => generation,
};

export const UNAUTHORIZED_EVENT = 'carenest:unauthorized';

// 403 mang mã 1014 (chưa cấp quyền) / 1015 (tài khoản bị vô hiệu hóa): phiên không dùng tiếp được ⇒ kết thúc phiên như 401
export const SESSION_BLOCKED_CODES = [1014, 1015];

/** Lỗi axios 403 + errorCode khóa/chưa cấp quyền ⇒ phát sự kiện hết phiên kèm câu của BE; trả true nếu đã phát. */
export const notifySessionBlocked = (error) => {
  const response = error?.response;
  const errorCode = response?.data?.errorCode;
  if (response?.status !== 403 || !SESSION_BLOCKED_CODES.includes(errorCode)) return false;
  const message = response.data?.desc || null;
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { errorCode, message } }));
  return true;
};
