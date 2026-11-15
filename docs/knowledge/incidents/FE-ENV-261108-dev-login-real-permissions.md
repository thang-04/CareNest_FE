---
id: FE-ENV-261108-dev-login-real-permissions
type: env
screens: [/school/vice-principals, /menu/foods, /kitchen/food-samples, /children]
be_modules: [identity-access]
rules: [AUTH-07, AUTH-20]
status: fixed
date: 2026-11-08
keywords: [VITE_SCHOOL_CONFIG_API, Keycloak dev, invalid_grant, bePermissions, MSYS, Git Bash, "C:/Program Files/Git/be-api", "Không thể kết nối máy chủ", 8190, 8090]
similar_to: [FE-ENV-261012-auth-browser-unavailable]
---

# FE-ENV-261108-dev-login-real-permissions — Soát quyền với BE thật ở máy local cho kết quả sai

## Symptom
Soát màn giao việc PHT với BE local thì gặp lần lượt:
- Đăng nhập `principal` / `demo123` báo "Sai tài khoản hoặc mật khẩu" (Keycloak trả `invalid_grant`).
- Lưu quyền báo "Bạn không có quyền thực hiện thao tác này" dù đang là Hiệu trưởng.
- Sau đó lưu báo "Không thể kết nối máy chủ", không có request nào trong tab Network.
- PHT không có `NUTRITION_MANAGE` vẫn thấy nút "Thêm thực phẩm", không có dòng "Bạn đang chỉ xem".

## Điều kiện tái hiện
Máy có 2 bộ docker: `carenest_be-*` (API 8080, Keycloak 8180) và `carenest_main_seed-*` (API 8090, Keycloak 8190). Tài khoản dev `principal`, `viceprincipal`… nằm ở bộ 8190. Chạy FE bằng Git Bash với `VITE_SCHOOL_CONFIG_API=true`.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đăng nhập `principal@gmail.com` qua proxy `/kc` mặc định | `invalid_grant` | Proxy `/kc` cố định Keycloak 8180, tài khoản nằm ở 8190 |
| 2 | Cấu hình vite tạm ngoài repo, đổi `/be-api` → 8090, `/kc` → 8190 | Đăng nhập được | Đúng nguyên nhân (1) |
| 3 | Giữ `VITE_USE_MOCK=true` | Lưu bị kho mock từ chối | Đọc quyền qua `beClient` (BE thật) nhưng lưu qua `permissionService` theo `INTEGRATION_MODULES`, build mock rơi vào mock |
| 4 | `VITE_USE_MOCK=false VITE_API_BASE_URL=/be-api` trong Git Bash | `API_BASE_URL` = `C:/Program Files/Git/be-api` | MSYS tự đổi đường dẫn bắt đầu bằng `/`; thêm `MSYS_NO_PATHCONV=1` |
| 5 | Đăng nhập dev (`keycloakDevUser`) | User không có `bePermissions` ⇒ FE coi như bản demo, hiện mọi nút | Đường dev tự dựng user, khác `toWebUser` của bản thật |

## Root cause
Ba lỗi môi trường chồng nhau (1, 3, 4) cộng một lỗi code (5): đường đăng nhập dev dựng user thiếu mã quyền BE nên mọi kiểm tra `hasBePermission` trả true.

## Fix
`keycloakDevUser` (`src/services/authService.js`) dùng chung `toWebUser` với bản thật. Chạy soát quyền local: `MSYS_NO_PATHCONV=1 VITE_SCHOOL_CONFIG_API=true VITE_USE_MOCK=false VITE_API_BASE_URL=/be-api`, proxy trỏ đúng bộ docker có tài khoản dev.

## Prevention
Soát quyền phải đăng nhập bằng tài khoản BE thật và kiểm tra user có `bePermissions`; bản demo không mang mã quyền nên luôn hiện đủ nút.
