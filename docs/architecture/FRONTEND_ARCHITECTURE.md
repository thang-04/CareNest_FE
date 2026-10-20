# Frontend Architecture

Bảng quyết định theo **source thực tế** (đo 2026-10-20). Chi tiết cách làm: `docs/architecture/CODING_GUIDE.md`; giao diện: `DESIGN.md`. Đổi một dòng "Đã chốt" ⇒ làn L, hỏi user.

| Chủ đề | Hiện trạng | Status | Nguồn / chi tiết |
| --- | --- | --- | --- |
| BE là source of truth cho rule, authorization, contract | — | CONFIRMED | `../CareNest_BE/docs/system/CROSS_REPO_MAP.md` |
| 1 trường / 2 campus, scope dữ liệu do BE áp | — | CONFIRMED | `../CareNest_BE/docs/context/PROJECT_CONTEXT.md` |
| Response BE `{code, desc, data}`, prefix cấu hình được | `src/services/http/axiosClient.js` | CONFIRMED | `docs/integration/BACKEND_INTEGRATION.md` |
| AI output là DRAFT, cần người duyệt | — | CONFIRMED | BE ADR-0008 |
| Ngôn ngữ | JavaScript/JSX (không TypeScript) | Đã chốt theo source | `.claude/rules/javascript.md` |
| Rendering / build | SPA, Vite | Đã chốt theo source | `vite.config.js` |
| Router | `react-router-dom` v7, route khai báo một nơi | Đã chốt theo source | `src/routes/AppRoutes.jsx`, `docs/architecture/ROUTE_MAP.md` |
| Điều hướng theo role | `RoleGuard` + `layouts/menuConfig.js` (menu duy nhất) | Đã chốt theo source | CODING_GUIDE §5 bước 9–10 |
| Tầng dữ liệu | Page → hook → service facade → mock (localStorage) / api (axios), chọn bằng `VITE_USE_MOCK` | Đã chốt theo source | CODING_GUIDE §2, §4 |
| Server state | `useAsync` + sự kiện đổi dữ liệu, không thư viện cache | Đã chốt theo source | `docs/architecture/STATE_MANAGEMENT.md` |
| UI state toàn cục | React Context: `AuthContext`, `ToastContext`, `SchoolYearContext`, `AppearanceContext` | Đã chốt theo source | `src/contexts/` |
| UI kit | Tự viết: `src/components/ui/`, `src/styles/components.css`, token `tokens.css` | Đã chốt theo source | `DESIGN.md` §6 |
| Icon | `@tabler/icons-react` chỉ qua `src/components/ui/icons.js` | Đã chốt, lint chặn | `.eslintrc.cjs` |
| Ranh giới module | Module A không import code riêng module B; ngoại lệ: trang ở gốc `src/pages` | Đã chốt (user 20/10/2026), lint chặn | `.claude/rules/architecture.md` |
| Test | `node:test` trong `tests/`, chạy qua `npm run verify` | Đã chốt theo source | `docs/quality/VERIFICATION.md` |
| Auth thật / lưu token | Mock: `tokenStorage` (localStorage/sessionStorage); contract BE chưa chốt | PROPOSED | `docs/integration/AUTH_FLOW.md` |
| i18n | Chỉ tiếng Việt | Đã chốt theo source | `DESIGN.md` §10 |
