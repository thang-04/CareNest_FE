export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
// Auth tách khỏi dữ liệu nghiệp vụ: mock mặc định, `gateway` đăng nhập qua BE.
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE === 'gateway' ? 'gateway' : 'mock';
export const AUTH_USE_MOCK = AUTH_MODE === 'mock';
// Mock is the default until the Spring Boot backend is ready.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const MOCK_LATENCY_MS = 250;

/*
 * Các màn đã nối BE thật qua beClient (module khác theo VITE_USE_MOCK). Dev: VITE_SCHOOL_CONFIG_API=true + Vite proxy
 * /be-api -> BE, /kc -> Keycloak (vite.config.js), đăng nhập thẳng Keycloak qua client carenest-dev. Gateway: luôn bật,
 * gọi BE qua VITE_API_BASE_URL bằng token của gateway.
 */
const SCHOOL_CONFIG_DEV = import.meta.env.VITE_SCHOOL_CONFIG_API === 'true';
export const SCHOOL_CONFIG_API = SCHOOL_CONFIG_DEV || AUTH_MODE === 'gateway';
export const KEYCLOAK_DEV_LOGIN = SCHOOL_CONFIG_DEV && AUTH_USE_MOCK;
/** Chỉ dev, đi cùng cờ carenest.dev.activation.* của BE: cho thử kết thúc năm học trước ngày kết thúc. */
export const DEV_SKIP_YEAR_DATES = import.meta.env.VITE_DEV_SKIP_YEAR_DATES === 'true';
export const DEV_BE_BASE_URL = import.meta.env.VITE_DEV_BE_BASE_URL || '/be-api';
export const DEV_KEYCLOAK_URL = import.meta.env.VITE_DEV_KEYCLOAK_URL || '/kc';
export const DEV_KEYCLOAK_REALM = import.meta.env.VITE_DEV_KEYCLOAK_REALM || 'carenest';
export const DEV_KEYCLOAK_CLIENT = import.meta.env.VITE_DEV_KEYCLOAK_CLIENT || 'carenest-dev';
