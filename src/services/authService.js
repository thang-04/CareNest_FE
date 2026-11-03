import { AUTH_USE_MOCK, KEYCLOAK_DEV_LOGIN } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { tokenStorage } from '@/services/http/tokenStorage';
import { authPost, refreshSession, resetAuthTransport } from '@/services/http/authTransport';
import { beClient } from '@/services/http/beClient';
import { devKeycloakLogin, devKeycloakLogout, getDevAccessToken } from '@/services/http/devKeycloakAuth';
import { ROLES } from '@/models/User';
import { normalizeAccountProfile } from './authProfile';
import { clearPasswordChallenge, clearOtpRequest } from './authChallengeStore';
import { authMockRepository, DEMO_PASSWORD, withPermissions } from '@/mocks/authMockRepository';
import { resetDb } from '@/mocks/mockDatabase';

import { AUTH_TAB_ID as TAB_ID, readAuthOperation, withAuthOperation, completeAuthOperation } from './http/authBoundary';
const CHANNEL = 'carenest.auth.session';
const SIGNAL_KEY = 'carenest.auth.signal';

/*
 * Dev (VITE_SCHOOL_CONFIG_API=true, VITE_AUTH_MODE=mock): đăng nhập bằng tài khoản Keycloak dev thật (client carenest-dev),
 * thông tin người dùng từ GET /accounts/me
 * (Cần chốt 24/10 bỏ đăng nhập demo). Module chưa có BE vẫn chạy mock với người dùng này.
 */
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

export const broadcastSessionEvent = (type, operation = null) => {
  try {
    const message = { type, source: TAB_ID, version: (operation || readAuthOperation()).version, nonce: Date.now() + Math.random() };
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(message);
      channel.close();
    } else {
      localStorage.setItem(SIGNAL_KEY, JSON.stringify(message));
    }
  } catch {
    /* Đồng bộ tab không thay thế việc kiểm phiên tại server. */
  }
};

export const subscribeSessionEvents = (callback) => {
  const receive = (message) => {
    if (message?.source === TAB_ID || !['logout', 'login'].includes(message?.type) || !Number.isSafeInteger(message.version)) return;
    try {
      if (message.version < readAuthOperation().version) return;
      callback(message.type);
    } catch {
      /* Không nhận tín hiệu khi metadata phiên chưa đọc được. */
    }
  };
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => receive(event.data);
    return () => channel.close();
  }
  const onStorage = (event) => {
    if (event.key !== SIGNAL_KEY) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      /* Bỏ qua tín hiệu không hợp lệ. */
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
};

export const endLocalSession = ({ broadcast = true, operation = null } = {}) => {
  tokenStorage.clear();
  resetAuthTransport();
  clearPasswordChallenge();
  clearOtpRequest();
  if (broadcast) broadcastSessionEvent('logout', operation);
};

// "Vai trò & quyền" của UI vẫn là demo ⇒ người dùng thật mang quyền mặc định của vai trò; quyền BE giữ ở bePermissions
const toWebUser = (profile) => {
  const user = normalizeAccountProfile(profile);
  return user.role ? { ...withPermissions(user), bePermissions: user.permissions } : user;
};

const keycloakDevLogin = async ({ identifier, email, password, remember }) => {
  await devKeycloakLogin({ email: identifier || email, password, remember }); // carenest:allow-secret – mật khẩu người dùng nhập
  try {
    return await keycloakDevUser();
  } catch (error) {
    await devKeycloakLogout();
    throw error;
  }
};

export const login = async (credentials) => {
  if (KEYCLOAK_DEV_LOGIN) return keycloakDevLogin(credentials);
  const { identifier, email, password, remember } = credentials;
  return withAuthOperation('login', async (operation) => {
    endLocalSession({ broadcast: false });
    const generation = tokenStorage.getGeneration();
    const result = AUTH_USE_MOCK
      ? await authMockRepository.login({ email: identifier || email, password, remember })
      : await authPost('/auth/login', { identifier: (identifier || email || '').trim(), password, remember });
    if (generation !== tokenStorage.getGeneration()) {
      const error = new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
      error.status = 409;
      throw error;
    }
    const user = AUTH_USE_MOCK ? result.user : toWebUser(result.account);
    if (!result.accessToken) {
      const error = new Error('Chưa nhận được phiên đăng nhập hợp lệ.');
      error.status = 503;
      throw error;
    }
    tokenStorage.set(result.accessToken, remember);
    broadcastSessionEvent('login', completeAuthOperation(operation, 'login'));
    return user;
  });
};

export const getCurrentUser = async () => {
  if (!AUTH_USE_MOCK && readAuthOperation().restoreBlocked) {
    const error = new Error('Phiên đăng nhập đã kết thúc.');
    error.status = 401;
    throw error;
  }
  if (KEYCLOAK_DEV_LOGIN) {
    if (!tokenStorage.get()) {
      const error = new Error('Chưa đăng nhập');
      error.status = 401;
      throw error;
    }
    // Tải lại trang: token có thể đã hết hạn ⇒ làm mới trước khi gọi /accounts/me
    await getDevAccessToken();
    return keycloakDevUser();
  }
  if (AUTH_USE_MOCK) {
    const token = tokenStorage.get();
    if (!token) {
      const error = new Error('Chưa đăng nhập');
      error.status = 401;
      throw error;
    }
    return authMockRepository.me(token);
  }
  if (!tokenStorage.get()) await refreshSession();
  return toWebUser(await axiosClient.get('/accounts/me'));
};

export const logout = async () => {
  endLocalSession({ broadcast: false });
  try {
    return await withAuthOperation('logout', async (operation) => {
      try {
        if (KEYCLOAK_DEV_LOGIN) await devKeycloakLogout();
        else if (AUTH_USE_MOCK) await authMockRepository.logout();
        else await authPost('/auth/logout');
        return null;
      } catch (error) {
        return error;
      } finally {
        endLocalSession({ operation });
      }
    });
  } catch (error) {
    return error;
  }
};

// Đăng nhập Keycloak dev dùng tài khoản thật ⇒ không hiện tài khoản demo
export const IS_DEMO_MODE = AUTH_USE_MOCK && !KEYCLOAK_DEV_LOGIN;
export const DEMO_LOGIN_PASSWORD = IS_DEMO_MODE ? DEMO_PASSWORD : null; // carenest:allow-secret
export const getDemoAccounts = () => (IS_DEMO_MODE ? authMockRepository.demoAccounts() : Promise.resolve([]));
export const resetDemoData = async () => {
  if (AUTH_USE_MOCK) resetDb();
};
