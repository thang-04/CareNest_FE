import { AUTH_USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { tokenStorage } from '@/services/http/tokenStorage';
import { authPost, refreshSession, resetAuthTransport } from '@/services/http/authTransport';
import { normalizeAccountProfile } from './authProfile';
import { clearPasswordChallenge, clearOtpRequest } from './authChallengeStore';
import { authMockRepository, DEMO_PASSWORD } from '@/mocks/authMockRepository';
import { resetDb } from '@/mocks/mockDatabase';

import { AUTH_TAB_ID as TAB_ID, readAuthOperation, withAuthOperation, completeAuthOperation } from './http/authBoundary';
const CHANNEL = 'carenest.auth.session';
const SIGNAL_KEY = 'carenest.auth.signal';

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

export const login = async ({ identifier, email, password, remember }) =>
  withAuthOperation('login', async (operation) => {
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
    const user = AUTH_USE_MOCK ? result.user : normalizeAccountProfile(result.account);
    if (!result.accessToken) {
      const error = new Error('Chưa nhận được phiên đăng nhập hợp lệ.');
      error.status = 503;
      throw error;
    }
    tokenStorage.set(result.accessToken, remember);
    broadcastSessionEvent('login', completeAuthOperation(operation, 'login'));
    return user;
  });

export const getCurrentUser = async () => {
  if (!AUTH_USE_MOCK && readAuthOperation().restoreBlocked) {
    const error = new Error('Phiên đăng nhập đã kết thúc.');
    error.status = 401;
    throw error;
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
  return normalizeAccountProfile(await axiosClient.get('/accounts/me'));
};

export const logout = async () => {
  endLocalSession({ broadcast: false });
  try {
    return await withAuthOperation('logout', async (operation) => {
      try {
        if (AUTH_USE_MOCK) await authMockRepository.logout();
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

export const IS_DEMO_MODE = AUTH_USE_MOCK;
export const DEMO_LOGIN_PASSWORD = AUTH_USE_MOCK ? DEMO_PASSWORD : null; // carenest:allow-secret
export const getDemoAccounts = () => (AUTH_USE_MOCK ? authMockRepository.demoAccounts() : Promise.resolve([]));
export const resetDemoData = async () => {
  if (AUTH_USE_MOCK) resetDb();
};
