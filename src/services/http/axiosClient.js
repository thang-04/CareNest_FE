import axios from 'axios';
import { API_BASE_URL, AUTH_USE_MOCK } from '@/config/env';
import { tokenStorage, UNAUTHORIZED_EVENT } from './tokenStorage';
import { refreshSession } from './authTransport';
import { normalizeApiError, unwrapResponse } from './apiError';
import { getDevAccessToken, hasDevSession, tokenForRetry } from './devKeycloakAuth';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use(async (config) => {
  // Đăng nhập Keycloak dev: access token chỉ sống 5 phút ⇒ làm mới trước khi gửi (dùng chung với beClient)
  const token = hasDevSession() ? await getDevAccessToken().catch(() => tokenStorage.get()) : tokenStorage.get();
  delete config.headers.authorization;
  config.authAccessToken = token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  config.authGeneration ??= tokenStorage.getGeneration();
  return config;
});

const notifyUnauthorized = (generation) => {
  if (generation === tokenStorage.getGeneration()) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
};

axiosClient.interceptors.response.use(
  (response) => unwrapResponse(response.data),
  async (error) => {
    if (axios.isCancel(error) || error.config?.signal?.aborted) {
      throw new axios.CanceledError('Yêu cầu đã bị hủy');
    }
    const config = error.config;
    if (error.response?.status !== 401 || config?.skipAuthRefresh) {
      throw normalizeApiError(error);
    }
    const generation = config?.authGeneration ?? tokenStorage.getGeneration();
    if (generation !== tokenStorage.getGeneration()) {
      throw new axios.CanceledError('Phiên đăng nhập đã thay đổi');
    }
    // Phiên Keycloak dev: làm mới rồi gửi lại đúng một lần; chỉ hết phiên khi làm mới thất bại
    if (hasDevSession() && config && !config.authRetried) {
      config.authRetried = true;
      if (await tokenForRetry(config.headers?.Authorization)) return axiosClient(config);
    }
    if (!AUTH_USE_MOCK && config && !config.authRetried) {
      config.authRetried = true;
      try {
        // Request cũ có thể trả 401 sau khi request khác vừa refresh xong.
        if (!tokenStorage.get() || config.authAccessToken === tokenStorage.get()) {
          await refreshSession({ force: true });
        }
      } catch (refreshError) {
        if (refreshError.status === 401) notifyUnauthorized(generation);
        throw normalizeApiError(refreshError);
      }
      if (config.signal?.aborted || generation !== tokenStorage.getGeneration()) {
        throw new axios.CanceledError('Yêu cầu đã bị hủy');
      }
      return axiosClient(config);
    }
    notifyUnauthorized(generation);
    throw normalizeApiError(error);
  },
);
