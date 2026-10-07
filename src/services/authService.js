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
const api = {
  login: (body) => axiosClient.post('/auth/login', body),
  me: () => axiosClient.get('/auth/me'),
  logout: () => axiosClient.post('/auth/logout'),
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
