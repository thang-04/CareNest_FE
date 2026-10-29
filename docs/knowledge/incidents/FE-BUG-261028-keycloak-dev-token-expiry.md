---
id: FE-BUG-261028-keycloak-dev-token-expiry
type: bug
screens: [auth, education-plan]
be_modules: [identity-access]
rules: []
status: fixed
date: 2026-10-28
keywords: [keycloak, token, refresh, 401, hết phiên, phiên đăng nhập hết hạn, axiosClient, beClient, VITE_SCHOOL_CONFIG_API]
similar_to: []
---

# Đăng nhập Keycloak dev bị đá ra sau ~5 phút

## Symptom

Chạy Web với `VITE_SCHOOL_CONFIG_API=true` (đăng nhập Keycloak dev, `authService` của G94-179). Khoảng 5 phút sau khi đăng nhập, đang ở màn Kế hoạch giáo dục thì bị đăng xuất / báo "phiên đăng nhập hết hạn".

## Điều kiện tái hiện

Realm `carenest`: `accessTokenLifespan` 300s, `ssoSessionIdleTimeout` 1800s, `revokeRefreshToken` true (refresh token dùng một lần). Đăng nhập, mở màn dùng `axiosClient` (kế hoạch giáo dục gửi heartbeat 20 giây), chờ quá 5 phút. Mô phỏng nhanh: đặt `carenest.kcAccessExp` về quá khứ và làm hỏng `carenest.accessToken`.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đối chiếu cấu hình realm | Access 5 phút, idle 30 phút; refresh token còn hạn lúc bị đá ra | Realm không phải nguyên nhân, không đổi |
| 2 | Đọc `axiosClient` | Gắn token lấy thẳng từ `tokenStorage`, 401 ⇒ phát `UNAUTHORIZED_EVENT` ngay | Không có đường làm mới nào cho client này |

## Root cause

`src/services/http/axiosClient.js` không bao giờ làm mới access token: chỉ `beClient` (gọi `getDevAccessToken`) và lần tải lại trang mới làm mới. Màn dùng `axiosClient` gửi token đã hết hạn sau 5 phút ⇒ BE 401 ⇒ AuthContext đăng xuất dù refresh token vẫn còn hạn. Lộ ra khi module Kế hoạch giáo dục chuyển từ shim đăng nhập riêng (có hẹn giờ làm mới) sang `authService` dùng chung sau merge G94-179.

## Fix

- `devKeycloakAuth.js`: `hasDevSession`, `tokenForRetry` (dùng token mới nếu nơi khác vừa làm mới, chưa thì làm mới một lần qua promise chung); làm mới khi tab hiện lại.
- `axiosClient.js`: phiên Keycloak dev ⇒ `getDevAccessToken()` trước mỗi request; 401 ⇒ làm mới rồi gửi lại đúng một lần, chỉ hết phiên khi làm mới thất bại.
- `beClient.js`: cùng cơ chế gửi lại khi 401.
- Regression: `tests/hardening/dev-keycloak-refresh.test.mjs` (code cũ fail 4/5, sau sửa pass 5/5).

## Lưu ý

Nhiều tab cùng "Ghi nhớ đăng nhập" dùng chung refresh token xoay vòng: hai tab làm mới đúng cùng lúc thì tab chậm hơn có thể bị 401 khi làm mới ⇒ đăng xuất. Chưa gặp khi thử; nếu gặp, cần khóa làm mới giữa các tab (BroadcastChannel/storage event).
