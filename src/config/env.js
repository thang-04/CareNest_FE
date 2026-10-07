export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
// Mock is the default until the Spring Boot backend is ready.
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
export const MOCK_LATENCY_MS = 250;
