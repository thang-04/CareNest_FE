import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { tokenStorage } from '@/services/http/tokenStorage';
import { authMockRepository, DEMO_PASSWORD, withPermissions } from '@/mocks/authMockRepository';
import { beClient } from '@/services/http/beClient';
import { devKeycloakLogin, devKeycloakLogout, getDevAccessToken } from '@/services/http/devKeycloakAuth';
import { ROLES } from '@/models/User';
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

/*
 * Dev (VITE_SCHOOL_CONFIG_API=true): đăng nhập bằng tài khoản Keycloak dev thật, thông tin người dùng từ GET /accounts/me
 * (Cần chốt 24/10 bỏ đăng nhập demo). Module chưa có BE vẫn chạy mock với người dùng này.
 */
const KEYCLOAK_DEV = SCHOOL_CONFIG_API;

const roleOf = (account) => {
  const roles = account.roles || [];
  if (roles.includes(ROLES.VICE_PRINCIPAL)) return ROLES.VICE_PRINCIPAL;
  if (roles.includes(ROLES.PRINCIPAL)) return ROLES.PRINCIPAL;
  if (account.assignments?.some((a) => a.staffRole === 'AGE_GROUP_TEAM_LEADER')) return ROLES.TEAM_LEADER;
  if (roles.includes(ROLES.TEACHER)) return ROLES.TEACHER;
  if (roles.includes(ROLES.KITCHEN_STAFF)) return ROLES.KITCHEN_STAFF;
  return null;
};

const keycloakDevUser = async () => {
  const account = await beClient.get('/accounts/me');
  const role = roleOf(account);
  if (!role) {
    const err = new Error('Tài khoản này không dùng được trên web (chỉ dành cho Hiệu trưởng, Phó hiệu trưởng, giáo viên, nhân viên bếp).');
    err.status = 403;
    throw err;
  }
  const assignments = account.assignments || [];
  const scoped = assignments.find((a) => a.campusId) || {};
  const leader = assignments.find((a) => a.staffRole === 'AGE_GROUP_TEAM_LEADER');
  const homeroom = assignments.find((a) => a.classroomId);
  return withPermissions({
    id: account.userId,
    fullName: account.fullName,
    name: account.fullName,
    email: account.email,
    role,
    campusId: scoped.campusId || null,
    ageGroupId: leader?.ageGroupId,
    classId: homeroom?.classroomId,
    locationIds: [],
  });
};

export const login = async ({ email, password, remember }) => {
  if (KEYCLOAK_DEV) {
    await devKeycloakLogin({ email, password, remember }); // carenest:allow-secret – mật khẩu người dùng nhập
    try {
      return await keycloakDevUser();
    } catch (error) {
      await devKeycloakLogout();
      throw error;
    }
  }
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
  if (KEYCLOAK_DEV) {
    // Tải lại trang: token có thể đã hết hạn ⇒ làm mới trước khi gọi /accounts/me
    await getDevAccessToken();
    return keycloakDevUser();
  }
  return USE_MOCK ? authMockRepository.me(token) : api.me();
};

export const logout = async () => {
  try {
    if (KEYCLOAK_DEV) await devKeycloakLogout();
    else if (USE_MOCK) await authMockRepository.logout();
    else await api.logout();
  } catch {
    /* logging out locally is enough */
  } finally {
    tokenStorage.clear();
  }
};

/* ---------- Mock-only helpers (hidden in production builds with VITE_USE_MOCK=false) ---------- */
export const IS_DEMO_MODE = USE_MOCK && !KEYCLOAK_DEV;
export const DEMO_LOGIN_PASSWORD = IS_DEMO_MODE ? DEMO_PASSWORD : null; // carenest:allow-secret – tên field, không phải giá trị bí mật
export const getDemoAccounts = () => (IS_DEMO_MODE ? authMockRepository.demoAccounts() : Promise.resolve([]));
export const resetDemoData = async () => {
  if (USE_MOCK) resetDb();
};
