import { test, expect } from '@playwright/test';

// Web dev gọi thẳng BE :8080 (khác origin), không qua proxy /be-api như bộ e2e ⇒ header tùy biến phải có trong CORS,
// thiếu thì trình duyệt chặn preflight và Web báo "Không thể kết nối máy chủ" (BE:docs/knowledge/incidents/BUG-261110-class-doc-cors-headers.md).
test('IT-CORS gọi BE trực tiếp từ Web (không qua proxy): preflight cho phép header phiên bản tài liệu lớp', async () => {
  const res = await fetch(`${process.env.E2E_BE_URL || 'http://localhost:8080/api'}/education-plans/class-docs/branch/x`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'authorization,content-type,x-class-doc-version,x-dossier-version',
    },
  });
  const allowed = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
  expect(allowed, 'BE cần restart để nạp SecurityConfig mới').toContain('x-class-doc-version');
  expect(allowed).toContain('x-dossier-version');
});
