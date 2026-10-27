# Auth Flow — React gateway

Status: IMPLEMENTED (code/local tests),2026-10-12; ghép vào `dev` 2026-10-22. Owner contract: BE:docs/contracts/AUTH_CONTRACT.md, ADR-0013. Report: docs/quality/reports/2026-10-12-react-auth-integration.md. UI trực tiếp trong browser chưa kiểm chứng vì công cụ không có browser kết nối.

## Chế độ và dữ liệu
- VITE_AUTH_MODE=mock là mặc định (user chốt 2026-10-18 để cả nhóm đăng nhập tài khoản demo khi chưa dùng Keycloak). VITE_AUTH_MODE=gateway mới dùng Keycloak qua CareNest backend; không tự fallback khi backend lỗi.
- VITE_USE_MOCK quyết định dữ liệu nghiệp vụ độc lập với auth. Gateway + data mock có nhãn dữ liệu mẫu; không coi dữ liệu đó là dữ liệu thật.
- VITE_API_BASE_URL gồm origin/prefix backend, mặc định http://localhost:8080/api. Không có client secret ở FE. Không sửa .env hiện có khi chạy task này.

## Token và phiên
- Token thật chỉ ở memory. carenest.accessToken cũ bị xóa ở cả localStorage/sessionStorage; mock token dùng key riêng.
- GET /auth/csrf trả token và headerName; cookie path /api/auth nên dùng token từ response body. Auth POST withCredentials+X-XSRF-TOKEN, không Bearer.
- Bootstrap cookie: POST /auth/refresh rồi GET /accounts/me. API nghiệp vụ dùng Bearer, không cookie.
- Resource401: coalesce refresh, retry1 lần.401 tiếp theo kết thúc local session.403/503 không tự logout/retry vô hạn.
-403 chưa provision/inactive trả cho UI;503 có thông báo thử lại. Hết phiên khác sai mật khẩu hiện tại: pre-refresh401 -> sessionExpired/endSession, PUT /me/password401 -> field error.
- remember chỉ gửi về BE để định thời cookie; không đổi chỗ lưu token thật.

## Cookie ordering và nhiều tab
- Login/logout/reset/change-password phối hợp qua native Web Locks cùng origin, không thư viện mới. Từ chối mutation nếu browser thiếu coordination an toàn; không fallback mutex chỉ trong tab.
- Metadata carenest.auth.operation chỉ chứa version/type/source/restoreBlocked, không token/proof/user. Version kiểm dưới cùng lock để queued intent cũ không phát request sau logout.
- BroadcastChannel (storage event fallback) chỉ chứa type/source/version/nonce; bỏ tín hiệu cũ hơn metadata hiện tại, không broadcast credentials.
- Cookie response login được xử lý trước logout tiếp theo trong lock. Logout không dựa riêng generation memory. restoreBlocked giữ qua mutation pending/lỗi, chỉ successful login đã xác minh mở lại; reload sau offline logout không tự khôi phục cookie cũ.
- Cơ sở semantics: [W3C Web Locks](https://www.w3.org/TR/web-locks/). Test race cookie hiện dùng adapter/cookie model; real multi-tab browser test vẫn pending.

## Forms và profile
- Login nhận username hoặc email, bắt buộc password; typed428 dùng existing first-login form, chưa authenticated.
- OTP request và reset/first-login proof giữ riêng trong memory; không URL/history/Web Storage. Reload mất proof thì bắt đầu lại; không phục hồi từ lịch sử trình duyệt.
- OTP demo chỉ khi AUTH_MODE=mock, kể cả business data đang mock. Recovery text generic, không suy luận email tồn tại từ response.
- Password length8–128 theo DTO; policy do Keycloak quyết định, không thêm regex policy gateway. Reset503/network uncertain bỏ proof và hướng dẫn thử đăng nhập/bắt đầu lại.
- Map userId -> id:string; roles/permissions/assignments/childIds từ BE; `permissions` (ADR-0017) dùng cho `hasPermission`, `PermissionGuard`, menu — gọi lại `/accounts/me` để nhận quyền mới. Không suy luận campus/class nếu BE không trả. TEAM_LEADER chỉ có ở mock UI, không tự map quyền thật.
- Priority menu cho multi-role: PRINCIPAL,VICE_PRINCIPAL,TEACHER,KITCHEN_STAFF; RoleGuard kiểm toàn bộ roles BE hợp lệ. ADMIN/PARENT/unknown không được gán role khác; có landing/đăng xuất.
- Profile thật GET /accounts/me, field thiếu để trống/chưa có thông tin. Không gọi /me/profile hoặc giả endpoint sửa profile; real profile read-only.
- Logout/đổi account remount protected pages; async response cũ bị epoch/generation fence. Password change thành công clear session và yêu cầu login lại.

## Chạy local
Giữ .env của user. Chỉ bật backend gateway sau khi cài extension/bootstrap theo BE:docker/keycloak/auth/README.md; không tự apply realm thật. Trong PowerShell tại FE:

```powershell
$env:VITE_AUTH_MODE = 'gateway'
$env:VITE_API_BASE_URL = 'http://localhost:8080/api'
npm.cmd run dev
```

Không đặt VITE_AUTH_MODE (hoặc đặt mock) thì đăng nhập bằng tài khoản demo; đổi biến thì restart Vite. Không thay source/backend contract để chạy demo.

## Kiểm chứng
- npm.cmd run test:auth:40 tests (modules thật, existing Axios adapter + Node test runner).
- node scripts/verify.mjs giữ lint/format/build và chạy auth tests; no dependency/version/lockfile change.
- node scripts/auth-e2e.mjs: stack Docker riêng, Java backend thật, Keycloak/Mailpit/Postgres, Vite process riêng envDir:false;9 HTTP smokes. --serve giữ runtime, nhập stop để dọn đúng process/project test.
- HTTP real smoke không thay thế kiểm tra layout/keyboard/responsive hoặc real browser multi-tab; các mục đó chưa quan sát.
