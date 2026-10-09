---
title: Màn tùy chỉnh tranh nền giao diện (cả trường) + tự chọn tranh theo dịp/giờ/mùa
status: approved
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: [school-structure]
rules: []
risk: high
created: 2026-10-09
updated: 2026-10-09
---
# Màn tùy chỉnh tranh nền giao diện

Làn L: thêm route + mục menu tài khoản, trạng thái giao diện dùng chung toàn app, cần BE thêm API cấu hình mới (đổi contract), thêm ~20 ảnh.

## Context

- Tranh nền hiện cố định: `login-scene.webp` (nền app, đăng nhập, dải đầu trang) và `hero-scene.webp` (dải chào dashboard) — `src/layouts/layout.css` (`.app-shell`), `src/styles/components.css` (`.page__head::before`), `src/components/dashboard/DashboardHeader.jsx:4`.
- User đã chọn 20 tranh sáp màu (2026-10-09, trang chọn `$TMPDIR/evon-design/tranh/`): T0 Sân chơi, T1 Vườn rau, T2 Dã ngoại, T3 Biển, T4 Đêm sao, T5 Mùa thu, T6 Tết, T7 Góc học tập, T8 Bé khỏe, T9 Ao cá, T10 Vũ trụ, T11 Mưa cầu vồng, T12 Sở thú, T13 Trung thu, T14 Đến trường, T15 Đồi cầu vồng, T16 Sinh nhật, S1 Cầu vồng sáp đậm, S3 Biển sáp dầu, S8 Góc học tập sáp đậm.
- Mẫu cấu hình cấp trường có sẵn để bám: giờ chốt suất ăn — `src/services/school-config/api/schoolConfigApi.js:22-23`, repo mock `src/services/school-config/mock/*.js:326-346`, quyền `src/utils/school-config/schoolConfigPermissions.js:30`.

## Quyết định đã chốt

1. Cài đặt **cả trường dùng chung** (không theo từng người) — user, 2026-10-09.
2. Màn đặt ở **menu tài khoản → "Tùy chỉnh giao diện"**, mọi vai trò vào được — user, 2026-10-09.
3. **Người được đổi:** Hiệu trưởng, Phó hiệu trưởng, Admin hệ thống; vai trò khác chỉ xem — user, 2026-10-09. Quyền thật do BE kiểm; FE chỉ ẩn/khóa nút.
4. Quy tắc tự động: dịp lễ → giờ đêm → mùa → ngẫu nhiên theo ngày (chi tiết dưới) — user đồng ý đề xuất, 2026-10-09.
5. Tranh ở màn trống (`EmptyState`, vd. "Chưa có hồ sơ trẻ") cũng lấy ngẫu nhiên trong các tranh đang bật — user, 2026-10-09.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor = BGH đổi cấu hình, mọi người dùng thấy kết quả · outcome = tranh nền app đổi theo cấu hình · chỉ là trình bày, không đụng dữ liệu trẻ.
- **Đối chiếu thiết kế ban đầu:** chưa có trong tài liệu BE (`BE:docs/modules/school-structure.md` không có cấu hình giao diện) ⇒ đề xuất mới.
- **Ảnh hưởng:** FE: `/settings/appearance` (mới), menu tài khoản, nền app, dải đầu trang, dải chào dashboard, màn đăng nhập (chưa đăng nhập ⇒ chưa đọc được cấu hình, dùng T0 hoặc cache lần trước). BE: API mới. APP: không.

### Câu hỏi mở

- [x] Vai trò: làm với các vai trò đã có (HT, PHT sửa; còn lại chỉ xem); Admin để sau — user, 2026-10-09.
- [x] Contract BE: user mang đề xuất sang BE; FE chạy mock trước (user không phản đối, 2026-10-09).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Áp cho ai | Cả trường | user | 2026-10-09 | plan này |
| Vị trí màn | Menu tài khoản | user | 2026-10-09 | plan này |
| Ai được sửa | HT + PHT + Admin | user | 2026-10-09 | plan này |
| Quy tắc tự động | Theo đề xuất | user | 2026-10-09 | plan này |

## Đề xuất contract BE (cần thống nhất, chưa tồn tại)

```
GET /school/appearance            → 200 { mode, pinnedSceneId, enabledSceneIds[], updatedBy, updatedAt }
PUT /school/appearance            body { mode, pinnedSceneId?, enabledSceneIds[] } → 200 (cùng shape)
mode ∈ FIXED | AUTO | DAILY_RANDOM ; sceneId là mã tranh FE (T0…T16, S1, S3, S8)
Quyền PUT: PRINCIPAL, VICE_PRINCIPAL, SYSTEM_ADMIN; GET: mọi người dùng đã đăng nhập. 403 khi không quyền.
400: enabledSceneIds rỗng; pinnedSceneId thiếu khi mode=FIXED.
```

## Quy tắc tự động (FE tính, chỉ chọn tranh — không phải business rule)

Chỉ chọn trong `enabledSceneIds`; nhóm nào không có tranh bật thì bỏ qua bước đó.
1. **Dịp lễ:** Tết (từ 3 ngày trước đến 7 ngày sau mùng 1 Tết) → T6; Trung thu (3 ngày quanh rằm tháng 8) → T13; khai giảng 5/9 → T14. Ngày âm lịch lấy bảng dương lịch dựng sẵn 2026–2030 (không thêm thư viện).
2. **Giờ đêm** 18:00–06:00 → T4, T10.
3. **Mùa:** tháng 6–8 → T3, S3, T9; tháng 9–11 → T5.
4. **Còn lại:** ngẫu nhiên trong nhóm tranh ngày, cố định trong một ngày (hạt giống = ngày).
`DAILY_RANDOM` bỏ bước 1–3; `FIXED` luôn dùng `pinnedSceneId`.
**Màn trống:** mỗi màn trống chọn ngẫu nhiên một tranh trong `enabledSceneIds` (không theo chế độ), cố định theo ngày + tên màn để không nhảy khi màn render lại; dùng bản cắt khung nhỏ (dải chào).

## Acceptance criteria

- **AC-1:** Given HT/PHT, When mở Tùy chỉnh giao diện, chọn chế độ/bật tranh rồi Lưu, Then toast "Đã lưu", mọi trang dùng tranh theo cấu hình.
- **AC-2:** Given Giáo viên/Tổ trưởng/Bếp, When mở màn, Then thấy cấu hình ở chế độ chỉ xem, không có nút Lưu.
- **AC-3:** Given mode AUTO và đang 20:00, Then tranh là T4 hoặc T10 (nếu đang bật).
- **AC-4:** Given ngày trong khoảng Tết, Then tranh là T6 (nếu bật), bất kể giờ.
- **AC-5:** Given DAILY_RANDOM, When tải lại trang nhiều lần trong cùng ngày, Then cùng một tranh.
- **AC-7:** Given hai màn trống khác nhau trong cùng ngày, Then có thể hiện hai tranh khác nhau; tải lại cùng màn ⇒ vẫn tranh đó.
- **AC-6:** BE trả 403 khi lưu ⇒ hiện lỗi, giữ lựa chọn trên màn; lỗi tải ⇒ dùng T0.

## Phases

### Phase 1 — Ảnh + bộ chọn tranh + mock service
- Files: C `src/assets/illustrations/scenes/*.webp` (20 tranh nền 1600×900 + 20 tranh dải chào cắt khung) · C `src/models/appearance/scenes.js` (danh sách, nhóm ngày/đêm/mùa/dịp) · C `src/utils/appearance/pickScene.js` (quy tắc tự động, thuần, có bảng Tết/Trung thu) · C `src/services/appearance/{appearanceService.js,api/appearanceApi.js,mock/appearanceMockRepository.js}` · M `mockups/illustrations/` (chép script sinh tranh).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`. **Dừng chờ review.**

### Phase 2 — Áp tranh vào app
- Files: C `src/contexts/AppearanceContext.jsx` · M `src/App.jsx` (bọc provider) · M `src/layouts/MainLayout.jsx` (đặt biến CSS `--scene-bg`, `--scene-hero`) · M `src/layouts/layout.css`, `src/styles/components.css` (dùng biến thay url cố định) · M `src/components/dashboard/DashboardHeader.jsx` · M `src/components/ui/States.jsx` (`EmptyState` lấy tranh ngẫu nhiên).
- Exit: verify PASS; ảnh 1440 ở 3 tranh khác nhau. **Dừng chờ review.**

### Phase 3 — Màn Tùy chỉnh giao diện
- Files: C `src/pages/settings/AppearancePage.jsx` + css · M `src/routes/AppRoutes.jsx` (route `/settings/appearance`) · M `src/layouts/UserMenu.jsx` (mục mới).
- Bố cục: đầu trang có xem trước dải đầu trang; khối "Chế độ" (3 lựa chọn dạng card); lưới tranh (ảnh, tên, nhóm, công tắc bật/tắt, nút Ghim khi FIXED); thanh nút Lưu dính đáy (chỉ HT/PHT).
- Exit: verify PASS; Playwright AC-1/2/5. **Dừng chờ review.**

## Test matrix
Repo chưa có framework test ⇒ kiểm chứng = verify + Playwright + kiểm `pickScene` bằng script node với ngày giả.

| AC | Kiểm chứng | Phase |
| --- | --- | --- |
| AC-3, AC-4, AC-5 | script node gọi `pickScene` với ngày/giờ giả | 1 |
| AC-1, AC-2, AC-6 | Playwright mock theo vai trò | 3 |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| 40 ảnh làm nặng bundle (~8–10MB) | Tải chậm | Import động theo tranh đang dùng (Vite tách file), không nạp cả bộ | Bỏ bớt tranh |
| BE chưa có API | Màn chỉ chạy mock | Service theo cờ `VITE_USE_MOCK` như module khác | Giữ T0 cố định |
| Bảng ngày âm lịch sai | Tranh Tết/Trung thu lệch ngày | Đối chiếu lịch 2026–2030 | Sửa bảng |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: chỉ FE `appearanceService`
- [x] Mỗi AC có cách kiểm; mỗi phase có Exit
- [x] >8 file ⇒ đã chia 3 phase
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review

## Progress log

### 2026-10-09 — Phase 1 (chờ review)

- Commit: chưa commit
- Đã làm: 20 tranh WebP 1280×720 (~3,4MB tổng, tải theo tranh đang dùng) ở `src/assets/illustrations/scenes/`; `src/models/appearance/scenes.js` (danh sách, nhóm ngày/đêm/mùa/dịp, `sceneUrl`); `src/utils/appearance/pickScene.js` (`pickScene`, `pickEmptyScene`, bảng Tết/Trung thu 2026–2030); `src/utils/appearance/appearancePermissions.js` (HT, PHT); service + API đề xuất + mock repo `src/services/appearance/`; chép `build_theme_scenes.py`, `build_more_scenes.py` vào `mockups/illustrations/`.
- Kiểm quy tắc (chạy trong trình duyệt với ngày giả): Tết 08/02/2027 → T6; 20:00 → T10; Trung thu 25/09/2026 → T13; 05/09 → T14; tháng 7 → T3; tháng 10 → T5; DAILY_RANDOM 9h = 15h cùng ngày; FIXED → tranh ghim; tắt tranh đêm ⇒ rơi về tranh ngày; màn trống cùng tên cùng ngày ⇒ cùng tranh.
- Verify: xem dòng VERIFY.
- Tiếp: Phase 2 áp tranh vào app.

### 2026-10-09 — Phase 2 (chờ review)

- Commit: chưa commit
- Đã làm: `src/contexts/AppearanceContext.jsx` (tải cấu hình, chọn tranh, tính lại mỗi 10 phút, đặt `--scene-bg` trên `<html>`, lỗi ⇒ T0); provider trong `App.jsx`; nền `.app-shell` và dải đầu trang dùng `var(--scene-bg, login-scene)`; dải chào dashboard lấy tranh đang chọn (cover, mờ mép trái); `EmptyState` lấy `pickEmptyScene` theo tiêu đề qua `--empty-scene`. Màn đăng nhập giữ T0.
- Kiểm: Playwright ghim T7/T10/T13 ⇒ nền, dải, dải chào đổi theo; AUTO tháng 10 ⇒ T5; màn trống "Không có trẻ phù hợp" ⇒ tranh riêng; không lỗi console.
- Verify: xem dòng VERIFY.
- Tiếp: Phase 3 màn `/settings/appearance`.

### 2026-10-09 — Phase 3 (chờ review)

- Commit: chưa commit
- Đã làm: `src/pages/settings/AppearancePage.jsx` + `src/styles/modules/appearance.css` (dải đầu trang xem trước tranh hôm nay theo lựa chọn đang sửa; 3 card chế độ; lưới 20 tranh có nhãn ngày/đêm/mùa/dịp, công tắc bật/tắt, nút Ghim khi Cố định; thanh Hoàn tác/Lưu dính đáy chỉ HT/PHT); route `/settings/appearance`; mục "Tùy chỉnh giao diện" trong menu tài khoản.
- Kiểm Playwright: HT mở từ menu ⇒ chọn Cố định, ghim "Đi thăm sở thú", Lưu ⇒ toast + `--scene-bg` đổi sang so-thu; tắt hết tranh ⇒ báo "Cần bật ít nhất một tranh"; GV mở thẳng URL ⇒ chỉ xem (radio/công tắc khóa, không có nút Lưu); không lỗi console.
- Verify: xem dòng VERIFY.
- Còn lại: BE chưa có `GET/PUT /school/appearance` (đang PROPOSED, chạy mock).
