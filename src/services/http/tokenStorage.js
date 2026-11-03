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
