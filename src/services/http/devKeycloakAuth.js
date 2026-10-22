import axios from 'axios';
import { DEV_KEYCLOAK_CLIENT, DEV_KEYCLOAK_PASSWORD, DEV_KEYCLOAK_REALM, DEV_KEYCLOAK_URL } from '@/config/env';
import { tokenStorage } from './tokenStorage';

/*
 * CHỈ DÙNG KHI DEV (VITE_SCHOOL_CONFIG_API=true): đăng nhập FE vẫn là mock; khi gọi API Cấu hình trường thật,
 * lấy token Keycloak của user dev cùng vai trò với user mock (password grant qua client carenest-dev).
 * Đăng nhập thật qua cổng /auth của BE (G94-60) sẽ thay phần này.
 */
const DEV_USER_BY_ROLE = {
  PRINCIPAL: 'principal.dev',
  VICE_PRINCIPAL: 'viceprincipal.a',
  TEAM_LEADER: 'teacher.a',
  TEACHER: 'teacher.a',
  KITCHEN_STAFF: 'kitchen.a',
  PARENT: 'parent.a',
};

const cache = new Map(); // username -> { token, exp }

/** Vai trò của user mock đang đăng nhập (đọc từ token mock: header.payload.mock). */
export const currentMockRole = () => {
  const token = tokenStorage.get();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(decodeURIComponent(escape(atob(payload)))).role || null;
  } catch {
    return null;
  }
};

export const devUsernameForRole = (role) => DEV_USER_BY_ROLE[role] || null;

/** Access token Keycloak cho vai trò hiện tại; dùng lại tới 30 giây trước khi hết hạn. */
export const getDevAccessToken = async () => {
  const username = devUsernameForRole(currentMockRole());
  if (!username) return null;
  const hit = cache.get(username);
  if (hit && hit.exp - Date.now() > 30_000) return hit.token;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: DEV_KEYCLOAK_CLIENT,
    username,
    password: DEV_KEYCLOAK_PASSWORD, // carenest:allow-secret (biến môi trường)
  });
  const { data } = await axios.post(`${DEV_KEYCLOAK_URL}/realms/${DEV_KEYCLOAK_REALM}/protocol/openid-connect/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  cache.set(username, { token: data.access_token, exp: Date.now() + data.expires_in * 1000 });
  return data.access_token;
};
