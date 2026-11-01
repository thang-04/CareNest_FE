import axios from 'axios';
import { DEV_KEYCLOAK_CLIENT, DEV_KEYCLOAK_REALM, DEV_KEYCLOAK_URL } from '@/config/env';
import { tokenStorage, UNAUTHORIZED_EVENT } from './tokenStorage';

/*
 * CHỈ DÙNG KHI DEV (VITE_SCHOOL_CONFIG_API=true): đăng nhập bằng tài khoản Keycloak dev thật (password grant qua client
 * carenest-dev, Cần chốt 24/10 bỏ đăng nhập demo). Đăng nhập thật qua cổng /auth của BE (G94-60) sẽ thay phần này.
 * Access token nằm ở tokenStorage; refresh token + hạn dùng lưu cùng nơi (ghi nhớ ⇒ localStorage, không ⇒ sessionStorage).
 */
const REFRESH_KEY = 'carenest.kcRefreshToken';
const EXP_KEY = 'carenest.kcAccessExp';
// Realm xoay vòng refresh token và HỦY CẢ PHIÊN khi một refresh token bị dùng lại. Các tab cùng phiên (tab mở bằng link
// target=_blank / nhân bản tab mang bản sao sessionStorage; "Ghi nhớ" dùng chung localStorage) ghi lại lần đổi token ở
// đây để tab còn giữ token cũ nhận token mới thay vì gửi token cũ lên Keycloak.
const ROTATION_KEY = 'carenest.kcRotation';
const ROTATION_TTL = 15 * 60_000;
const LOCK_NAME = 'carenest-kc-refresh';

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // storage bị chặn (private mode, policy)
  }
};
const read = (key) => safe(() => localStorage.getItem(key) || sessionStorage.getItem(key));
const remembered = () => safe(() => !!localStorage.getItem(REFRESH_KEY), false);

const clearSession = () => {
  tokenStorage.clear();
  safe(() => [localStorage, sessionStorage].forEach((s) => [REFRESH_KEY, EXP_KEY, ROTATION_KEY].forEach((k) => s.removeItem(k))));
};

// Dấu nhận refresh token (phần chữ ký cuối JWT) để so mà không cần chép cả token cũ
const mark = (token) => String(token || '').slice(-32);
const readRotation = () => {
  const r = safe(() => JSON.parse(localStorage.getItem(ROTATION_KEY) || 'null'));
  return r && Date.now() - r.at < ROTATION_TTL ? r : null;
};
const saveTokens = ({ access, refresh, exp }, remember) => {
  tokenStorage.set(access, remember);
  safe(() => {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(REFRESH_KEY, refresh);
    store.setItem(EXP_KEY, String(exp));
  });
};
const recordRotation = (used, latest) =>
  safe(() => {
    const consumed = [...(readRotation()?.consumed || []), mark(used)].slice(-20);
    localStorage.setItem(ROTATION_KEY, JSON.stringify({ at: Date.now(), consumed, latest }));
  });
/** Refresh token của tab này đã được tab khác dùng ⇒ lấy bộ token mới nhất, không gọi Keycloak. */
const adoptRotation = (refreshToken) => {
  const r = readRotation();
  if (!r?.consumed.includes(mark(refreshToken)) || !r.latest?.refresh) return null;
  saveTokens(r.latest, remembered());
  return r.latest.access;
};
// Khóa giữa các tab cùng origin; trình duyệt không có Web Locks thì chạy thẳng (vẫn có bước nhận token đã đổi)
const withTabLock = (fn) => (typeof navigator !== 'undefined' && navigator.locks?.request ? navigator.locks.request(LOCK_NAME, fn) : fn());

const requestToken = async (params, remember) => {
  const body = new URLSearchParams({ client_id: DEV_KEYCLOAK_CLIENT, ...params });
  try {
    const { data } = await axios.post(`${DEV_KEYCLOAK_URL}/realms/${DEV_KEYCLOAK_REALM}/protocol/openid-connect/token`, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    const tokens = { access: data.access_token, refresh: data.refresh_token, exp: Date.now() + data.expires_in * 1000 };
    saveTokens(tokens, remember);
    if (params.grant_type === 'refresh_token') recordRotation(params.refresh_token, tokens);
    return data.access_token;
  } catch (error) {
    const status = error.response?.status ?? 0;
    const err = new Error(
      status === 0
        ? 'Không kết nối được máy chủ đăng nhập (Keycloak). Kiểm tra Keycloak đang chạy.'
        : params.grant_type === 'password'
          ? 'Email hoặc mật khẩu không đúng'
          : 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    );
    err.status = status === 0 ? 0 : 401;
    throw err;
  }
};

export const devKeycloakLogin = ({ email, password, remember }) =>
  requestToken({ grant_type: 'password', username: email, password }, remember); // carenest:allow-secret – mật khẩu người dùng nhập

// Realm xoay vòng refresh token (dùng 1 lần): gộp các lần làm mới song song thành 1 request, khóa giữa các tab; trong khóa
// đọc lại kho: tab khác vừa đổi token (cùng phiên) thì dùng luôn token đó. force: token hiện tại bị BE từ chối (401).
let refreshing = null;
const refresh = (force = false) => {
  if (!read(REFRESH_KEY)) return Promise.resolve(null);
  const sent = tokenStorage.get();
  refreshing ??= withTabLock(async () => {
    const refreshToken = read(REFRESH_KEY);
    if (!refreshToken) return null;
    const adopted = adoptRotation(refreshToken);
    if (adopted) return adopted;
    const current = tokenStorage.get();
    const fresh = Number(read(EXP_KEY) || 0) - Date.now() > 30_000;
    if (current && fresh && (!force || current !== sent)) return current;
    return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken }, remembered());
  })
    .catch((error) => {
      if (error.status === 401) {
        clearSession();
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/** Access token Keycloak còn hạn của người đang đăng nhập; làm mới trước khi hết hạn 30 giây. */
export const getDevAccessToken = async () => {
  const token = tokenStorage.get();
  if (!token) return null;
  const exp = Number(read(EXP_KEY) || 0);
  if (exp - Date.now() > 30_000) return token;
  return refresh();
};

/** Đang đăng nhập bằng Keycloak dev (có refresh token) — mọi client HTTP dùng chung luồng làm mới ở đây. */
export const hasDevSession = () => !!read(REFRESH_KEY);

/**
 * Token để gửi lại một request bị 401: tab/request khác vừa làm mới ⇒ dùng token mới; chưa ⇒ làm mới một lần.
 * null ⇒ không gửi lại (không có phiên dev hoặc làm mới thất bại; refresh 401 đã tự phát hết phiên).
 */
export const tokenForRetry = async (sentAuthorization) => {
  if (!hasDevSession()) return null;
  const current = tokenStorage.get();
  if (current && `Bearer ${current}` !== sentAuthorization) return current;
  try {
    return await refresh(true);
  } catch {
    return null;
  }
};

// Quay lại tab sau lúc ẩn (timer bị trình duyệt hãm): làm mới sớm để request đầu tiên không mang token đã hết hạn
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && hasDevSession()) getDevAccessToken().catch(() => {});
  });
}
// Realm hết phiên sau 30 phút không làm mới: app đang mở mà không có request nào (chỉ đọc, để màn hình) vẫn làm mới
// token đúng hạn để không bị đăng xuất khi quay lại thao tác
if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
  window.setInterval(() => {
    if (hasDevSession()) getDevAccessToken().catch(() => {});
  }, 60_000);
}

export const devKeycloakLogout = async () => {
  const refreshToken = read(REFRESH_KEY);
  clearSession();
  if (!refreshToken) return;
  // Thu hồi phiên ở Keycloak; lỗi mạng vẫn coi như đã đăng xuất ở máy này
  await axios
    .post(
      `${DEV_KEYCLOAK_URL}/realms/${DEV_KEYCLOAK_REALM}/protocol/openid-connect/logout`,
      new URLSearchParams({ client_id: DEV_KEYCLOAK_CLIENT, refresh_token: refreshToken }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
    )
    .catch(() => {});
};
