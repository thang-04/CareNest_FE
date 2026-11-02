import { defineConfig, devices } from '@playwright/test';

// Kiểm thử Playwright module Kế hoạch giáo dục (tests/e2e). Cần BE thật :8080 + Keycloak :8180 (profile dev) và Docker
// Postgres (bộ test tự dọn dữ liệu [E2E] của mình) — xem tests/e2e/README.md. Chạy: npm run test:e2e
const PORT = 5181;
// Bản build chạy bằng vite preview (dùng chung proxy /be-api, /kc của vite.config.js); không dùng dev server vì
// dev server tự tối ưu lại dependency giữa chừng làm trang tải lại.
const OUT = 'node_modules/.e2e-dist';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Các bước của một luồng dùng chung dữ liệu trên BE ⇒ chạy tuần tự
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'vi-VN',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'integration', testDir: './tests/e2e/integration', use: { ...devices['Desktop Chrome'] } },
    { name: 'system', testDir: './tests/e2e/system', dependencies: ['integration'], use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite build --outDir ${OUT} --emptyOutDir && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // VITE_SCHOOL_CONFIG_API: đăng nhập Keycloak dev thật (authService); DEV_BE_TARGET: BE khác :8080 nếu cần
    env: { VITE_USE_MOCK: 'false', VITE_API_BASE_URL: '/be-api', VITE_SCHOOL_CONFIG_API: 'true', DEV_BE_TARGET: process.env.DEV_BE_TARGET || 'http://localhost:8080' },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
