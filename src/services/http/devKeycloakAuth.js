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
  safe(() => [localStorage, sessionStorage].forEach((s) => [REFRESH_KEY, EXP_KEY].forEach((k) => s.removeItem(k))));
};

const requestToken = async (params, remember) => {
  const body = new URLSearchParams({ client_id: DEV_KEYCLOAK_CLIENT, ...params });
  try {
    const { data } = await axios.post(`${DEV_KEYCLOAK_URL}/realms/${DEV_KEYCLOAK_REALM}/protocol/openid-connect/token`, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    tokenStorage.set(data.access_token, remember);
    safe(() => {
      const store = remember ? localStorage : sessionStorage;
      store.setItem(REFRESH_KEY, data.refresh_token);
      store.setItem(EXP_KEY, String(Date.now() + data.expires_in * 1000));
    });
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

// Realm xoay vòng refresh token (dùng 1 lần): gộp các lần làm mới song song thành 1 request
let refreshing = null;
const refresh = () => {
  const refreshToken = read(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve(null);
  refreshing ??= requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken }, remembered())
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
