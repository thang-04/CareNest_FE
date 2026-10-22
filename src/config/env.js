export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
// Mock is the default until the Spring Boot backend is ready.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const MOCK_LATENCY_MS = 250;

/*
 * Nối thử riêng màn Cấu hình trường với BE thật (các module khác vẫn mock). Chỉ dùng khi dev:
 * VITE_SCHOOL_CONFIG_API=true + Vite proxy /be-api -> BE, /kc -> Keycloak (vite.config.js).
 */
export const SCHOOL_CONFIG_API = import.meta.env.VITE_SCHOOL_CONFIG_API === 'true';
/** Chỉ dev, đi cùng cờ carenest.dev.activation.* của BE: cho thử kết thúc năm học trước ngày kết thúc. */
export const DEV_SKIP_YEAR_DATES = import.meta.env.VITE_DEV_SKIP_YEAR_DATES === 'true';
export const DEV_BE_BASE_URL = import.meta.env.VITE_DEV_BE_BASE_URL || '/be-api';
export const DEV_KEYCLOAK_URL = import.meta.env.VITE_DEV_KEYCLOAK_URL || '/kc';
export const DEV_KEYCLOAK_REALM = import.meta.env.VITE_DEV_KEYCLOAK_REALM || 'carenest';
export const DEV_KEYCLOAK_CLIENT = import.meta.env.VITE_DEV_KEYCLOAK_CLIENT || 'carenest-dev';
// Mật khẩu chung của user dev Keycloak (BE .env KEYCLOAK_DEV_USER_PASSWORD); đặt trong .env.local, không commit
export const DEV_KEYCLOAK_PASSWORD = import.meta.env.VITE_DEV_KEYCLOAK_PASSWORD || ''; // carenest:allow-secret (đọc từ .env.local)
