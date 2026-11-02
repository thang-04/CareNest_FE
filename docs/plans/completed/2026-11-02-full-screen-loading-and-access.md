---
title: Màn chờ khởi động và màn chặn (403/404) toàn màn hình
status: done
owner: thangnd
jira: G94-272 / FE-FIX-01
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: []
rules: []
risk: medium
created: 2026-11-02
updated: 2026-11-02
---
# Màn chờ khởi động và màn chặn (403/404) toàn màn hình

## Context
User báo (02/11): lần đầu tải trang, hoặc treo máy rồi mở lại tab (trình duyệt giải phóng tab ⇒ tải lại cả app), UI hiện màn chờ nhưng sidebar/header vẫn còn, phần chờ chỉ nằm một bên; mở URL màn không có quyền (link người khác gửi) cũng vậy.

Tái hiện bằng Playwright (Edge, 1440×900, tài khoản giáo viên mock):
- `index.html` có `#root` rỗng ⇒ trắng hoàn toàn tới khi JS chạy (mạng chậm vài giây).
- `ProtectedRoute` trạng thái `loading` (`src/routes/ProtectedRoute.jsx:9`) chỉ là `LoadingState` nhỏ, không có nền/logo.
- Sau đó `MainLayout` vẽ sidebar + header rồi `Suspense` (`src/layouts/MainLayout.jsx:66`) chờ chunk trang: vỏ trống, phần chờ chỉ ở vùng nội dung.
- `RoleGuard` (`src/routes/RoleGuard.jsx:12`) vẽ 403 trong vỏ app: sidebar của vai trò hiện tại không có mục nào ứng với URL ⇒ lạc lõng; 404 (`NotFoundPage`) tương tự.

## Quyết định đã chốt
Chế độ tự chạy (CLAUDE.md 23/10) ⇒ AI tự chọn phương án khuyến nghị, user soát khi bàn giao:
1. Khởi động app (trước JS, kiểm tra phiên, chờ chunk trang đầu tiên) = **một màn chờ toàn màn hình** có logo + ba chấm, không vỏ app. Splash dựng sẵn trong `index.html` và component React dùng **cùng class/markup** ⇒ chuyển tiếp liền mạch, không chớp.
2. Đổi trang trong app (đã có vỏ) vẫn giữ sidebar — chỉ vùng nội dung chờ, nhưng căn giữa và cao bằng vùng nội dung (cùng khung `status-page`), không còn khối nhỏ trên đầu.
3. 403 do route (`RoleGuard`, `AreaGate`) và 404 route không tồn tại = **màn toàn màn hình** kiểu trang đăng nhập (tranh nền + logo), kèm "Bạn đang đăng nhập bằng …" và 2 nút: "Về trang chủ", "Đăng nhập tài khoản khác" (đăng xuất, đăng nhập lại sẽ quay về đúng link).
4. 403/404 **theo dữ liệu từ BE** (trẻ không thuộc lớp, phiếu không còn…) giữ trong vỏ app như cũ — trang đó đúng là màn có trong menu, chỉ dữ liệu bị chặn.
5. Phiên không xác minh được (`unavailable`) và tài khoản chưa có màn Web (ADMIN) cũng dùng màn toàn màn hình.
6. Màn toàn màn hình render qua portal vào `body` + đặt `inert` cho `#root` ⇒ tab/đọc màn hình không lọt vào vỏ app phía sau, kể cả khi 403 nằm trong layout lồng (`EducationPlanLayout`).

## Làm rõ nghiệp vụ
Không đổi nghiệp vụ/quyền: chỉ cách hiển thị. Quyền vẫn do BE + `RoleGuard` hiện có quyết định (ẩn UI ≠ phân quyền).

## Acceptance criteria
- **AC-1:** Mở app lần đầu / tải lại tab ⇒ thấy splash toàn màn (logo + ba chấm) ngay từ byte HTML đầu, không trắng, không thấy vỏ app trống; hết splash là vỏ + trang cùng lúc.
- **AC-2:** Đổi trang trong app khi chunk chưa tải ⇒ ba chấm căn giữa vùng nội dung (cao bằng vùng nội dung), sidebar giữ nguyên.
- **AC-3:** Giáo viên mở `/attendance/day-unlocks` ⇒ màn 403 toàn màn, không sidebar/header; có tên + vai trò người đang đăng nhập; "Về trang chủ" về `/`; "Đăng nhập tài khoản khác" đăng xuất, đăng nhập lại về lại link.
- **AC-4:** URL không tồn tại ⇒ màn 404 toàn màn tương tự.
- **AC-5:** 403 từ BE trong trang (vd. `ChildAccessState`) không đổi.
- **AC-6:** Màn hẹp (390px) không tràn ngang.

## Phases
### Phase 1 — Splash + màn toàn màn hình
- Files: M `index.html` · C `src/components/ui/AppSplash.jsx` · C `src/components/ui/StandaloneStatus.jsx` · M `src/components/ui/index.js` (nếu có barrel) · M `src/routes/ProtectedRoute.jsx` · M `src/routes/RoleGuard.jsx` · M `src/routes/AppRoutes.jsx` · M `src/layouts/MainLayout.jsx` · M `src/pages/NotFoundPage.jsx` · M `src/layouts/auth.css` · M `src/styles/components.css` · M `DESIGN.md` §9
- Exit: `node scripts/verify.mjs` pass; ảnh chụp Playwright 1440 + 390.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| `inert` trên `#root` kẹt lại | Không bấm được app | Bỏ `inert` ở cleanup effect; chỉ bật khi màn toàn màn đang mount | Revert các file trên |
| Splash che vỏ quá lâu | Chậm cảm nhận | Chỉ che tới khi chunk trang đầu tiên xong; trang tự hiện skeleton dữ liệu | Bỏ nhánh splash trong fallback |

## Progress log
- 2026-11-02: Tái hiện bằng Playwright; chốt quyết định 1–6 (tự chọn theo chế độ tự chạy); bắt đầu Phase 1.
- 2026-11-02: Xong Phase 1. Thêm (ngoài dự kiến, cùng luồng link chia sẻ): sau đăng nhập quay về link **giữ cả query/hash** (`returnPath` ở `ProtectedRoute.jsx`, dùng ở `LoginPage`) — trước đây mất `?…`. CSS splash nằm inline trong `index.html` với mã màu chép từ `tokens.css` (chưa có bundle CSS lúc đó) — đổi màu thương hiệu thì sửa cả hai.
- Kiểm chứng: `node scripts/verify.mjs` → `VERIFY PASS full`. Playwright (Edge, mock): AC-1 splash từ HTML tới khi vỏ + trang hiện cùng lúc; AC-3 403 toàn màn, đổi tài khoản ⇒ đăng nhập Hiệu trưởng về lại `/attendance/day-unlocks`, `#root.inert` = false; giữ `?x=1` sau đăng nhập; AC-4 404 toàn màn; AC-6 390px `scrollWidth` = 390.
- 2026-11-02 (user: "các luồng loading khác thì sao", thấy chờ "thụt lên trên" khi chưa đăng nhập): rà 111 `LoadingState` + mọi `Suspense fallback`. Sửa: fallback trang khách trong `AppRoutes.jsx` (đăng nhập/quên mật khẩu/OTP/đặt lại) ⇒ `AppSplash`; CSS `.page > .state--loading, .app-content > .state--loading` cao bằng vùng nội dung (một chỗ cho ~35 trang chi tiết); fallback đổi trang trong `MainLayout` bỏ card. Phát hiện chưa sửa: thẻ đếm `stat-card__value` hiện "0" khi đang tải (18 file) — đề xuất, chờ user. Bằng chứng trước/sau: `ui-review/loading-access/index.html` (ảnh chờ dữ liệu chụp với `delay` mock bị chặn thành 3 s trong Playwright).
- 2026-11-02 (user chốt "gom component"): thêm `src/components/ui/StatCard.jsx` (`tone label value loading active onClick icon`; `onClick` ⇒ button + `aria-pressed`; `loading` ⇒ `.stat-card__skeleton`). 17 file dựng tay `.stat-card` + ui-kit chuyển sang; 9 trang danh sách truyền `loading` (Hồ sơ trẻ, Phiếu theo dõi sức khỏe, Kích hoạt tài khoản phụ huynh, kiểm kê, 5 trang CSVC đang ẩn). Kích hoạt tài khoản phụ huynh: trước ẩn cả hàng thẻ khi tải, nay hiện thẻ + vạch chờ. Lưu ý: `SchoolPlansPage` trước thiếu `aria-pressed`, nay có. DESIGN §6.3 cập nhật. `node scripts/verify.mjs` → `VERIFY PASS full` (lần đầu FAIL do Prettier ở file mới, đã format).
