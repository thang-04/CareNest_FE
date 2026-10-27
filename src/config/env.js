export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
// Auth tách khỏi dữ liệu nghiệp vụ: mock mặc định, `gateway` đăng nhập qua BE.
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE === 'gateway' ? 'gateway' : 'mock';
export const AUTH_USE_MOCK = AUTH_MODE === 'mock';
// Mock is the default until the Spring Boot backend is ready.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
export const MOCK_LATENCY_MS = 250;
