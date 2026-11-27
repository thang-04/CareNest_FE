import { AUTH_USE_MOCK, KEYCLOAK_DEV_LOGIN } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { tokenStorage } from '@/services/http/tokenStorage';
import { authPost, refreshSession, resetAuthTransport } from '@/services/http/authTransport';
import { beClient } from '@/services/http/beClient';
import { devKeycloakLogin, devKeycloakLogout, getDevAccessToken } from '@/services/http/devKeycloakAuth';
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
// Đăng nhập Keycloak dev dựng user như bản thật (toWebUser) để mã quyền BE ẩn/hiện nút giống hệt khi deploy
const keycloakDevUser = async () => {
  // Cùng danh sách role Web với gateway (AUTH-21): ADMIN vào được, bếp/phụ huynh bị chặn
  const user = toWebUser(await beClient.get('/accounts/me'));
  if (!user.role) {
    const err = new Error('Tài khoản này không dùng được trên web');
    err.status = 403;
    throw err;
  }
  return user;
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
  return user.role
    ? {
        ...withPermissions(user),
        bePermissions: user.permissions,
        beSchoolWidePermissions: user.schoolWidePermissions,
        bePinnedCampusPermissions: user.pinnedCampusPermissions,
      }
    : user;
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
    return startSession(result, remember, operation);
  });
};

const startSession = (result, remember, operation) => {
  const user = AUTH_USE_MOCK ? result.user : toWebUser(result.account);
  if (!result.accessToken) {
    const error = new Error('Chưa nhận được phiên đăng nhập hợp lệ.');
    error.status = 503;
    throw error;
  }
  tokenStorage.set(result.accessToken, remember);
  broadcastSessionEvent('login', completeAuthOperation(operation, 'login'));
  return user;
};

// AUTH-28: tài khoản còn phiên Web ở trình duyệt khác ⇒ BE trả 409 1017, chưa cấp phiên, chờ người dùng chọn
export const SESSION_CONFLICT = 1017;
export const TAKEOVER_REJECTED = 1018;
export const TAKEOVER_EXPIRED = 1019;

/** "Dùng ở đây": BE cấp phiên cho trình duyệt này và đăng xuất trình duyệt kia. */
export const confirmTakeover = ({ remember }) =>
  withAuthOperation('login', async (operation) => {
    endLocalSession({ broadcast: false });
    const generation = tokenStorage.getGeneration();
    const result = await authPost('/auth/login/takeover/confirm', {});
    if (generation !== tokenStorage.getGeneration()) {
      const error = new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
      error.status = 409;
      throw error;
    }
    return startSession(result, remember, operation);
  });

/** "Hủy" (mở nhầm): bỏ lượt đăng nhập đang chờ, trình duyệt kia không bị ảnh hưởng. */
export const cancelTakeover = () => authPost('/auth/login/takeover/cancel', {}).catch(() => null);

/** Phiên đang dùng chọn ở lại: lần đăng nhập ở trình duyệt kia bị hủy. */
export const keepSessionHere = (takeoverId) => beClient.post(`/me/session/takeovers/${encodeURIComponent(takeoverId)}/reject`);

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

/** Mock: token hết hạn trong lúc app đang mở (BE thật trả 401 ở request kế tiếp nên không cần kiểm). */
export const isLocalSessionExpired = () => {
  if (!AUTH_USE_MOCK || KEYCLOAK_DEV_LOGIN) return false;
  const token = tokenStorage.get();
  if (!token) return true;
  try {
    const { exp } = JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1]))));
    return !exp || exp < Date.now();
  } catch {
    return true;
  }
};

// AUTH-28: phiên bị đăng nhập Web nơi khác thay thế ⇒ BE trả 401 mã 1016, beClient phát sự kiện hết phiên;
// còn hiệu lực ⇒ { pendingTakeover } nếu trình duyệt khác đang chờ phiên này quyết định
export const SESSION_CHECK_ENABLED = !AUTH_USE_MOCK;
export const checkWebSession = () => beClient.get('/me/session');

// Gateway: token chỉ nằm trong RAM ⇒ dựa vào metadata của lần đăng nhập gần nhất (đăng xuất thì restoreBlocked)
const wasSignedIn = () => {
  if (AUTH_USE_MOCK || KEYCLOAK_DEV_LOGIN) return false;
  try {
    const operation = readAuthOperation();
    return operation.type === 'login' && !operation.restoreBlocked;
  } catch {
    return false; // storage bị chặn/hỏng ⇒ coi như chưa đăng nhập
  }
};

/** Đã có phiên trên máy (token mock/Keycloak dev, hoặc lần đăng nhập gateway chưa đăng xuất) ⇒ tải lại mà nhận 401 nghĩa là phiên đã hết hạn, không phải chưa đăng nhập. */
export const hasStoredSession = () => !!tokenStorage.get() || wasSignedIn();

// "Ghi nhớ đăng nhập": chỉ nhớ SĐT/email để điền sẵn; mật khẩu để trình quản lý mật khẩu của trình duyệt lo
const REMEMBERED_LOGIN_KEY = 'carenest.auth.rememberedLogin';
export const getRememberedLogin = () => {
  try {
    return localStorage.getItem(REMEMBERED_LOGIN_KEY) || '';
  } catch {
    return '';
  }
};
export const setRememberedLogin = (identifier, remember) => {
  try {
    if (remember && identifier) localStorage.setItem(REMEMBERED_LOGIN_KEY, identifier);
    else localStorage.removeItem(REMEMBERED_LOGIN_KEY);
  } catch {
    /* storage bị chặn: chỉ mất phần điền sẵn, đăng nhập vẫn chạy */
  }
};

// Đăng nhập Keycloak dev dùng tài khoản thật ⇒ không hiện tài khoản demo
export const IS_DEMO_MODE = AUTH_USE_MOCK && !KEYCLOAK_DEV_LOGIN;
export const DEMO_LOGIN_PASSWORD = IS_DEMO_MODE ? DEMO_PASSWORD : null; // carenest:allow-secret
export const getDemoAccounts = () => (IS_DEMO_MODE ? authMockRepository.demoAccounts() : Promise.resolve([]));
export const resetDemoData = async () => {
  if (AUTH_USE_MOCK) resetDb();
};
