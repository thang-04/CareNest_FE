# Auth Flow (Web)

**Status: PROPOSED** — `BE:docs/contracts/AUTH_CONTRACT.md` chưa chốt. Mục "Hiện thực mock" mô tả code đang chạy; không coi là quyết định cuối. Đổi cách lưu token / cơ chế auth ⇒ làn L, hỏi trước.

## Hiện thực mock (source 2026-10-20)

- Endpoint đang giả định và luồng đăng nhập: `docs/architecture/CODING_GUIDE.md` §6.1.
- Token chỉ do `src/services/http/tokenStorage.js` đọc/ghi ("Ghi nhớ đăng nhập" ⇒ localStorage, không ⇒ sessionStorage). Nơi khác không đụng token.
- `src/services/http/axiosClient.js` gắn `Authorization: Bearer`; 401 ⇒ phát `UNAUTHORIZED_EVENT`, `AuthContext` đăng xuất và về `/login`.
- User hiện tại: `useAuth()` (`src/contexts/AuthContext.jsx`); route: `ProtectedRoute`, `RoleGuard` (`src/routes/`).

## Chờ BE chốt

- Cơ chế (session cookie / JWT access + refresh) và nơi lưu token phía Web; refresh.
- Permission/scope (campus/lớp) BE trả để ẩn/hiện menu, thay cho suy theo `user.role`.
- Bảo vệ CSRF/XSS tương ứng cơ chế đã chọn.

Ràng buộc đã biết: BE kiểm tra quyền thật; FE không tự quyết quyền (`docs/integration/BACKEND_INTEGRATION.md`).
