export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE === 'gateway' ? 'gateway' : 'mock';
export const AUTH_USE_MOCK = AUTH_MODE === 'mock';
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';
export const PEOPLE_CONTRACT_READY = String(import.meta.env.VITE_PEOPLE_CONTRACT_READY ?? 'false') === 'true';
export const MOCK_LATENCY_MS = 250;
