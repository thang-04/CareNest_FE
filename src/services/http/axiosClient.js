import axios from 'axios';
import { API_BASE_URL } from '@/config/env';
import { tokenStorage, UNAUTHORIZED_EVENT } from './tokenStorage';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// BE trả mọi response dạng { code, desc, data } (ResponseJson): bóc `data` một lần ở đây
const isEnvelope = (body) => !!body && typeof body === 'object' && 'code' in body && 'desc' in body && 'data' in body;

// Normalize Spring Boot errors to { status, message } so UI code handles one shape.
axiosClient.interceptors.response.use(
  (response) => (isEnvelope(response.data) ? response.data.data : response.data),
  (error) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message = body?.desc || body?.message || (status === 0 ? 'Không thể kết nối máy chủ' : error.message);
    const normalized = new Error(message);
    normalized.status = status;
    // Mã lỗi nghiệp vụ của BE (ApiCode); desc đã là câu tiếng Việt
    normalized.errorCode = body?.errorCode ?? null;
    // Lỗi validation 400 của BE: danh sách lỗi theo field nằm trong data
    normalized.details = body?.errors || (isEnvelope(body) ? body.data : undefined);
    // Expired / invalid token: let AuthContext log out. Bỏ qua login (tự xử lý 401) và logout (tránh vòng lặp logout).
    const url = error.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/logout')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(normalized);
  },
);
