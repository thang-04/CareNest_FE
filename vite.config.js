import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // '@/x' = 'src/x'. Use it for imports across folders (see docs/architecture/CODING_GUIDE.md).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    open: false,
    // Dev: nối thử API thật cùng origin — /be-api -> BE :8080/api, /kc -> Keycloak :8180.
    // Bỏ header Origin để BE (CORS) và Keycloak (web origins) coi như gọi server-to-server
    proxy: {
      '/be-api': {
        target: process.env.DEV_BE_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/be-api/, '/api'),
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
      '/kc': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kc/, ''),
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
});
