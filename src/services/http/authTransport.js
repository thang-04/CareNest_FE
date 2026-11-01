import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { tokenStorage } from './tokenStorage';
import { normalizeApiError, unwrapResponse } from './apiError';

const transport = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});
let csrf = null;
let csrfPromise = null;
let refreshPromise = null;
let transportGeneration = 0;

const canceled = () => new axios.CanceledError('Phiên đăng nhập đã thay đổi');
transport.interceptors.request.use((config) => {
  // Gateway chỉ dùng cookie và CSRF, kể cả khi Axios có default Bearer.
  delete config.headers.Authorization;
  delete config.headers.authorization;
  return config;
});

export const authGet = async (path) => {
  try {
    return unwrapResponse((await transport.get(path)).data);
  } catch (error) {
    throw normalizeApiError(error);
  }
};

const getCsrf = () => {
  if (csrf) return Promise.resolve(csrf);
  if (csrfPromise) return csrfPromise;
  const currentGeneration = transportGeneration;
  const pending = authGet('/auth/csrf').then((value) => {
    if (currentGeneration !== transportGeneration) throw canceled();
    if (!value?.token || value.headerName !== 'X-XSRF-TOKEN') {
      throw normalizeApiError(new Error('Không thể xác nhận phiên bảo mật'));
    }
    csrf = value;
    return value;
  });
  csrfPromise = pending;
  const clearPending = () => {
    if (csrfPromise === pending) csrfPromise = null;
  };
  pending.then(clearPending, clearPending);
  return pending;
};

// CSRF sai và chặn role Web cùng trả 403 errorCode 1101 (AUTH_CONTRACT) ⇒ lấy CSRF mới rồi gửi lại 1 lần để phân biệt
const FORBIDDEN = 1101;
const isForbidden = (error) => error.response?.status === 403 && error.response?.data?.errorCode === FORBIDDEN;
// Vẫn 1101 với CSRF mới ở đăng nhập, làm mới phiên, đổi mật khẩu lần đầu ⇒ tài khoản bếp/phụ huynh (AUTH-21)
const APP_ONLY_PATHS = ['/auth/login', '/auth/refresh', '/auth/password/reset'];
export const APP_ONLY_MESSAGE = 'Tài khoản này chỉ dùng trên ứng dụng di động CareNest, không đăng nhập được trên trang Web.';

const toAuthError = (path, error) => {
  const normalized = normalizeApiError(error);
  if (isForbidden(error) && APP_ONLY_PATHS.includes(path)) {
    normalized.message = APP_ONLY_MESSAGE;
    normalized.appOnly = true;
  }
  return normalized;
};

export const authPost = async (path, body) => {
  const currentGeneration = transportGeneration;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const csrfValue = await getCsrf();
      if (currentGeneration !== transportGeneration) throw canceled();
      return unwrapResponse((await transport.post(path, body, { headers: { [csrfValue.headerName]: csrfValue.token } })).data);
    } catch (error) {
      if (error.response?.status === 403 && currentGeneration === transportGeneration) csrf = null;
      if (attempt === 0 && isForbidden(error) && currentGeneration === transportGeneration) continue;
      throw toAuthError(path, error);
    }
  }
};

export const refreshSession = ({ force = false } = {}) => {
  if (refreshPromise) return refreshPromise;
  const currentGeneration = tokenStorage.getGeneration();
  const currentTransportGeneration = transportGeneration;
  const pending = authPost('/auth/refresh', { force }).then((session) => {
    if (currentGeneration !== tokenStorage.getGeneration() || currentTransportGeneration !== transportGeneration) {
      throw canceled();
    }
    tokenStorage.set(session.accessToken);
    return session;
  });
  refreshPromise = pending;
  const clearPending = () => {
    if (refreshPromise === pending) refreshPromise = null;
  };
  pending.then(clearPending, clearPending);
  return pending;
};

export const resetAuthTransport = () => {
  transportGeneration += 1;
  csrf = null;
  csrfPromise = null;
  refreshPromise = null;
};
