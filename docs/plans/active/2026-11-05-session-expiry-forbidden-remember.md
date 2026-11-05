---
title: Hết phiên về đăng nhập, 403 tự quay lại sau 5 giây, ghi nhớ đăng nhập
status: in-progress
owner: thangnd
jira: G94-272 (nhánh hiện tại, user chưa nêu task riêng)
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [auth]
rules: []
risk: high
created: 2026-11-05
updated: 2026-11-05
---
# Hết phiên về đăng nhập, 403 tự quay lại sau 5 giây, ghi nhớ đăng nhập

## Context
User (05/11): hết hạn đăng nhập ⇒ về trang đăng nhập ngay; không có quyền nhưng đang đăng nhập ⇒ sau 5 giây tự về màn trước; tích "Ghi nhớ đăng nhập" mà không thấy được lưu.

Hiện trạng: 401 từ `axiosClient`/`beClient`/refresh Keycloak đã phát `UNAUTHORIZED_EVENT` ⇒ `AuthContext.endSession` ⇒ `ProtectedRoute` chuyển `/login` (giữ `from`). Lỗ hổng: (1) chế độ mock không phát hiện token hết hạn khi app đang mở (chỉ khi tải lại), tải lại với token hết hạn về login không có câu báo; (2) lỗi 401 lọt tới `ErrorState` hiện "Không tải được dữ liệu" thay vì về login. Trang 403 (`StatusPage kind="403"`, gồm `AccessDenied`) đứng yên. "Ghi nhớ đăng nhập" chỉ kéo dài phiên (token localStorage/BE cookie), không lưu tài khoản ⇒ đăng xuất xong ô SĐT/email trống, ô tích luôn bật lại.

## Quyết định (agent chọn, chế độ tự chạy)
1. 401 ở bất kỳ đâu ⇒ luồng hết phiên chung (về login, câu "Phiên đăng nhập đã hết hạn"); sau đăng nhập quay về đúng trang (đã có).
2. Mock: kiểm hạn token mỗi 60 giây và khi quay lại tab; hết hạn ⇒ hết phiên.
3. Đếm 5 giây chỉ ở màn 403 cả trang (`StatusPage kind="403"`), không ở khối 403 nhỏ trong trang (`ErrorState`) vì phần còn lại của trang vẫn dùng được. Có nút "Ở lại trang này" để dừng đếm (WCAG 2.2.1). Màn trước = mục lịch sử trước trong app; mở thẳng link (không có lịch sử) ⇒ về trang chủ. Màn "Tài khoản chưa có màn hình phù hợp" không đếm (mọi trang đều chặn).
4. Ghi nhớ đăng nhập = lưu SĐT/email (không lưu mật khẩu; mật khẩu để trình quản lý mật khẩu của trình duyệt lo) + trạng thái ô tích ở localStorage; bỏ tích ⇒ xóa. Ô đã có tài khoản ⇒ con trỏ vào ô mật khẩu.

## Files
- `src/contexts/AuthContext.jsx` — kiểm hạn mock, câu báo khi tải lại với token hết hạn.
- `src/services/authService.js` — `isLocalSessionExpired()`, nhớ tài khoản.
- `src/components/ui/States.jsx` — `ErrorState` 401 ⇒ phát hết phiên.
- `src/components/ui/StatusPage.jsx`, `StandaloneStatus.jsx`, `src/routes/ProtectedRoute.jsx` — đếm 5 giây.
- `src/pages/auth/LoginPage.jsx` — điền sẵn tài khoản đã nhớ.

## Verify
`node scripts/verify.mjs`; thử trình duyệt: đăng nhập có/không tích, đăng xuất, xem ô; mở route không quyền ⇒ đếm và quay lại.

## Progress log
- 2026-11-05 — Viết plan, bắt đầu làm (chế độ tự chạy, không chờ duyệt).
- 2026-11-05 — Xong code; `node scripts/verify.mjs` PASS. Thử trình duyệt (mock, :5181): tích ghi nhớ ⇒ lưu email + token localStorage; bỏ tích ⇒ xóa email, token sessionStorage; 403 mở thẳng link ⇒ 5 giây về `/`; 403 đi từ `/children` ⇒ 5 giây quay lại `/children`; token hết hạn khi app mở ⇒ về `/login` có câu báo, điền sẵn email, con trỏ ở ô mật khẩu; tải lại với token hết hạn ⇒ `/login` có câu báo, giữ `from`. Chưa thử: `ErrorState` 401 (không dựng được 401 lọt tới màn hình ở mock), chế độ gateway/Keycloak dev.
