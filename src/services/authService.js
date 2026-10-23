import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { tokenStorage } from '@/services/http/tokenStorage';
import { authMockRepository, DEMO_PASSWORD } from '@/mocks/authMockRepository';
import { resetDb } from '@/mocks/mockDatabase';

/*
 * Authentication API (JWT).
 *   POST /auth/login  -> { accessToken, expiresAt, user }
 *   GET  /auth/me     -> user
 *   POST /auth/logout
 * The token is kept by tokenStorage and sent by axiosClient as "Authorization: Bearer".
 */
// TEMP DEMO SHIM (KHÔNG COMMIT): đăng nhập Keycloak qua client carenest-dev, dựng user từ /accounts/me
const toUser = async () => {
  const a = await axiosClient.get('/accounts/me');
  const cfg = await axiosClient.get('/education-plans/config');
  const tl = a.assignments.find((x) => x.staffRole === 'AGE_GROUP_TEAM_LEADER');
  const role = a.roles.includes('VICE_PRINCIPAL')
    ? 'VICE_PRINCIPAL'
    : a.roles.includes('PRINCIPAL')
      ? 'PRINCIPAL'
      : tl
        ? 'TEAM_LEADER'
        : a.roles[0];
  const ageGroupId = tl ? cfg.ageGroups.find((g) => g.id === tl.ageGroupId)?.code : undefined;
  return { id: a.userId, name: a.fullName, fullName: a.fullName, email: a.email, role, ageGroupId };
};
// Access token Keycloak chỉ sống 5 phút: giữ refresh_token và làm mới trước khi hết hạn để không bị đá ra login
const REFRESH_KEY = 'carenest.demoRefreshToken';
let refreshTimer;
const kcToken = async (params) => {
  const res = await fetch('/kc/realms/carenest/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'carenest-dev', ...params }),
  });
  const body = await res.json();
  if (!body.access_token) {
    const err = new Error(
      params.grant_type === 'password' ? 'Email hoặc mật khẩu không đúng' : 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    );
    err.status = 401;
    throw err;
  }
  tokenStorage.set(body.access_token, true);
  localStorage.setItem(REFRESH_KEY, body.refresh_token);
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshSession().catch(() => {}), Math.max(body.expires_in - 30, 10) * 1000);
  return body.access_token;
};
// Realm xoay vòng refresh token (dùng 1 lần): gộp các lần refresh song song (StrictMode chạy effect 2 lần) thành 1 request
let refreshing = null;
const refreshSession = () => {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return Promise.resolve();
  refreshing ??= kcToken({ grant_type: 'refresh_token', refresh_token: refreshToken }).finally(() => {
    refreshing = null;
  });
  return refreshing;
};
const api = {
  login: async ({ email, password }) => {
    const accessToken = await kcToken({ grant_type: 'password', username: email, password });
    return { accessToken, user: await toUser() };
  },
  // Tải lại trang thì token cũ có thể đã hết hạn: làm mới trước khi gọi /accounts/me
  me: async () => {
    await refreshSession();
    return toUser();
  },
  logout: async () => {
    clearTimeout(refreshTimer);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const login = async ({ email, password, remember }) => {
  const result = USE_MOCK ? await authMockRepository.login({ email, password, remember }) : await api.login({ email, password, remember });
  tokenStorage.set(result.accessToken, remember);
  return result.user;
};

/** Current user from the stored token; throws 401 when there is no valid session. */
export const getCurrentUser = async () => {
  const token = tokenStorage.get();
  if (!token) {
    const err = new Error('Chưa đăng nhập');
    err.status = 401;
    throw err;
  }
  return USE_MOCK ? authMockRepository.me(token) : api.me();
};

export const logout = async () => {
  try {
    if (USE_MOCK) await authMockRepository.logout();
    else await api.logout();
  } catch {
    /* logging out locally is enough */
  } finally {
    tokenStorage.clear();
  }
};

/* ---------- Mock-only helpers (hidden in production builds with VITE_USE_MOCK=false) ---------- */
export const IS_DEMO_MODE = USE_MOCK;
export const DEMO_LOGIN_PASSWORD = USE_MOCK ? DEMO_PASSWORD : null; // carenest:allow-secret – tên field, không phải giá trị bí mật
export const getDemoAccounts = () => (USE_MOCK ? authMockRepository.demoAccounts() : Promise.resolve([]));
export const resetDemoData = async () => {
  if (USE_MOCK) resetDb();
};
