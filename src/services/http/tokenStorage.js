/**
 * Single place that stores the access token.
 * "Ghi nhớ đăng nhập" -> localStorage (survives browser restart), otherwise sessionStorage.
 */
const KEY = 'carenest.accessToken';

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // storage blocked (private mode, policy)
  }
};

export const tokenStorage = {
  get: () => safe(() => localStorage.getItem(KEY) || sessionStorage.getItem(KEY)),
  set: (token, remember) =>
    safe(() => {
      (remember ? localStorage : sessionStorage).setItem(KEY, token);
      (remember ? sessionStorage : localStorage).removeItem(KEY);
    }),
  clear: () =>
    safe(() => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    }),
};

/** Fired when the API answers 401: AuthContext logs the user out. */
export const UNAUTHORIZED_EVENT = 'carenest:unauthorized';
