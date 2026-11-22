---
title: Thiết kế lại luồng cấu hình thông báo (trang gộp 3 tab + form hai cột)
status: in-progress  # user duyệt 2026-11-21, câu hỏi mở đã đóng
owner: thangnd
jira: G94-288 / FE-FEAT-55   # task chính của nhánh; chưa rõ có task Jira riêng cho đợt giao diện này — hỏi user trước khi commit
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [notification]
rules: []            # chỉ đổi bố cục/điều hướng, không đổi nghiệp vụ hay contract BE
risk: medium         # đổi route, menu, quyền hiển thị tab và CSS dùng chung; không đổi dữ liệu
created: 2026-11-21
updated: 2026-11-21
---
# Thiết kế lại luồng cấu hình thông báo

Làn L (`.ai/workflows/plan-change.md`): đổi route/menu theo vai trò, sửa `.row-actions` dùng chung, ≥2 nhóm màn hình.
Mã nguồn thông báo chỉ có trên `origin/feature/G94-288-FE-FEAT-55-school-notifications`; nhánh `feature/G94-340-FE-FEAT-56-ui-layout-sync` chưa có.

## Context
User phản hồi bốn điểm trên các màn Mẫu thông báo, Quy tắc thông báo, Lịch gửi thông báo và form Sửa lịch gửi:
1. Icon thao tác sát nhau, tiêu đề "Thao tác" bị đè.
2. Bấm vào dòng không mở chi tiết.
3. Form xếp một cột nên nửa phải trống, thông tin dàn xuống dưới.
4. Cần thiết kế lại luồng cấu hình để dễ dùng, giao diện đẹp hơn.

Hiện trạng trên nhánh G94-288:
- `RowActions` có icon "Xem" riêng và các bảng không truyền `onRowClick`: `AnnouncementTemplatesPage.jsx:91`, `NotificationRulesPage.jsx:74`, `AnnouncementSchedulesPage.jsx:152`. Trái `UI_CARD.md` luật 15.
- `AnnouncementHeader` vẽ thanh `PageToolbar` chỉ có dòng mô tả và nút: `announcementUi.jsx:18-33`.
- Form xếp 4–5 thẻ một cột, ô nhập giới hạn 64rem: `AnnouncementForm.jsx:146-232`, `announcement.css:27-40`.
- Ba mục menu riêng cho Hiệu trưởng (`menuConfig.js:439`), Phó hiệu trưởng chỉ có Mẫu (`menuConfig.js:490`); route Hiệu trưởng-only ở `AppRoutes.jsx:596-600`.
- Khoảng cách `.row-actions` là `--space-1` ở `src/styles/components.css:3716-3721` (nhánh hiện tại).

## Quyết định đã chốt
1. Form soạn dùng **phương án B**: hai cột, cột phải là thẻ Tóm tắt dính khi cuộn — user, 2026-11-21.
2. **Gộp** Mẫu, Quy tắc, Lịch gửi thành trang "Cấu hình thông báo" có 3 tab — user, 2026-11-21.
3. Sửa **chung** `.row-actions` (mọi bảng) — user, 2026-11-21.
4. Nút Lưu ở đầu trang và trong thẻ Tóm tắt; dưới 1024px thẻ Tóm tắt xuống cuối form. Chấp nhận lệch nhẹ luật 14 — user, 2026-11-21.
5. Làm trên nhánh G94-288 — user, 2026-11-21.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor là Hiệu trưởng và Phó hiệu trưởng; outcome là cấu hình mẫu, quy tắc, lịch gửi dễ tìm và dễ sửa; không đổi rule BE.
- **Đối chiếu thiết kế ban đầu:** quyền xem giữ nguyên route hiện tại (Mẫu cho cả hai vai trò; Quy tắc và Lịch gửi chỉ Hiệu trưởng). Dữ liệu và API không đổi.
- **Ảnh hưởng:** module `notification`; route `/announcement-templates`, `/notification-rules`, `/announcement-schedules*`, mới `/notification-settings`; menu hai vai trò; `.row-actions` ảnh hưởng mọi bảng có `RowActions`.

### Câu hỏi mở
- [x] Task Jira cho đợt giao diện này.
- [x] Phó hiệu trưởng chỉ có một tab: hiện hay ẩn thanh tab.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Task Jira | `G94-288` | user | 2026-11-21 | plan |
| Thanh tab của Phó hiệu trưởng | Hiện thanh tab một mục | user | 2026-11-21 | AC-2 |
| Nơi làm việc | Worktree `../CareNest_FE-notif-ui`, detached tại `origin/feature/G94-288-FE-FEAT-55-school-notifications` | user | 2026-11-21 | plan |

## Acceptance criteria
- **AC-1:** Given Hiệu trưởng mở `/notification-settings`, When trang tải, Then thấy 3 tab Mẫu, Quy tắc, Lịch gửi; tab đang chọn nằm trong `?tab=` và giữ khi tải lại.
- **AC-2:** Given Phó hiệu trưởng mở trang đó, When trang tải, Then chỉ thấy tab Mẫu (thanh tab hiện một mục); mở `?tab=schedules` thì rơi về Mẫu (không lộ dữ liệu).
- **AC-3:** Given link cũ `/announcement-templates`, `/notification-rules`, `/announcement-schedules`, When mở, Then chuyển đúng tab; trang tạo/sửa/chi tiết Lịch gửi giữ route cũ, nút Quay lại về tab Lịch gửi.
- **AC-4:** Given một bảng trong ba tab, When bấm vào dòng hoặc nhấn Enter khi dòng có tiêu điểm, Then mở chi tiết (modal chỉ xem cho Mẫu và Quy tắc, trang chi tiết cho Lịch gửi); không còn icon "Xem".
- **AC-5:** Given cột Thao tác, When hiển thị, Then icon rộng 32px, cách nhau 8px, tiêu đề "Thao tác" không bị đè, ở 1440 và 768px.
- **AC-6:** Given form soạn ≥1024px, When mở, Then hai cột; thẻ Tóm tắt dính khi cuộn; <1024px thẻ Tóm tắt nằm cuối form; nút Lưu cùng nhãn, cùng handler ở đầu trang và trong thẻ Tóm tắt.
- **AC-7:** Given form soạn, When đã bấm "Xem trước người nhận", Then Tóm tắt hiện số người nhận lấy từ API xem trước hiện có; chưa xem trước thì hiện "Chưa xem trước".
- **AC-8:** Given modal Tạo mẫu, When mở, Then "Tên mẫu" và "Phạm vi" cùng một hàng (≥768px).
- **AC-9:** Given Hiệu trưởng hoặc Phó hiệu trưởng đã đăng nhập, When xem menu Thông báo, Then thấy đúng mục: Thông báo của tôi, Thông báo nhà trường, Cấu hình thông báo.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bố cục form | B: hai cột + Tóm tắt dính | A hai cột thuần; C từng bước | Hết khoảng trống nửa phải; thấy kết quả khi cuộn; C bất tiện khi sửa lịch có sẵn |
| Cấu trúc menu | Gộp 3 tab | Giữ 4 mục | Người dùng không rành kỹ thuật tìm một chỗ; đổi route nên làn L |
| Khoảng cách icon | Sửa chung `.row-actions` | Riêng module | Nhất quán toàn app; cần chụp lại các bảng chính |
| Chi tiết Mẫu/Quy tắc | Modal chỉ xem | Trang chi tiết riêng | Dữ liệu ngắn, giữ modal hiện có |

## Phases
### Phase 1 — Danh sách: dòng bấm được, icon thoáng, bỏ dải xanh
- Files: M `src/styles/components.css` (`.row-actions`, `.cell--actions`) · M `AnnouncementTemplatesPage.jsx` · M `NotificationRulesPage.jsx` · M `AnnouncementSchedulesPage.jsx` · M `AnnouncementsPage.jsx` (đưa nút "Mẫu thông báo" thành liên kết sang trang Cấu hình) · M `announcementUi.jsx` (bỏ thanh `PageToolbar` thừa)
- Steps: 1. In bản tác động (`node scripts/ai-layer/impact.mjs src/styles/components.css`) và chờ đồng ý. 2. Thêm `onRowClick` và bỏ `view` trong `RowActions`. 3. Đưa ô tìm và nút Tạo vào đầu thẻ bảng. 4. Chỉnh khoảng cách và kích thước icon.
- Tests: AC-4, AC-5 → test khung bảng + chụp 1440/768 để so sánh.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.
- **Dừng chờ user review.**

### Phase 2 — Trang "Cấu hình thông báo" + route + menu
- Files: C `src/pages/announcement/NotificationSettingsPage.jsx` · M `src/routes/AppRoutes.jsx` · M `src/layouts/menuConfig.js` · M `src/config/integrationModules.js` · M `tests/menu/notification-module.test.mjs`
- Steps: 1. In bản tác động route/menu. 2. Trang gồm `Tabs` + ba nội dung hiện có, tab đọc/ghi `?tab=`. 3. Redirect ba route cũ. 4. Menu hai vai trò. 5. Tab theo vai trò (AC-2).
- Tests: AC-1, AC-2, AC-3, AC-9 → test menu và route.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.
- **Dừng chờ user review.**

### Phase 3 — Form hai cột + thẻ Tóm tắt, modal Tạo mẫu
- Files: C `src/components/announcement/AnnouncementSummary.jsx` · M `AnnouncementForm.jsx` · M `AnnouncementScheduleFields.jsx` · M `RecipientTargetForm.jsx` · M `src/styles/modules/announcement.css` · M `AnnouncementTemplatesPage.jsx` (modal)
- Steps: 1. Lưới 3fr/2fr, `position: sticky` cho Tóm tắt, xuống cuối ở <1024px. 2. Ba mục đánh số trong một thẻ. 3. Tóm tắt đọc từ state form và kết quả xem trước, không tính nghiệp vụ. 4. Nút Lưu cùng handler hai chỗ. 5. Hàng hai ô cho modal Tạo mẫu.
- Tests: AC-6, AC-7, AC-8 → test model Tóm tắt; chụp 1440, 1024, 768, 360px.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0; `node scripts/check-design.mjs` pass.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2, AC-3, AC-9 | — | route/menu (`tests/menu/`) | 2 | chưa chạy |
| AC-4, AC-5 | — | khung bảng + chụp | 1 | chưa chạy |
| AC-6, AC-7, AC-8 | — | model Tóm tắt + chụp | 3 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Sửa `.row-actions` làm vỡ bảng hẹp | Cột Thao tác tràn ở bảng nhiều cột | Chụp các bảng chính ở 360–1440px trước khi báo xong | Hoàn lại giá trị khoảng cách cũ |
| Link cũ hỏng sau khi gộp route | Người dùng mở dấu trang cũ gặp trang trống | Redirect cả ba route | Gỡ route mới, giữ route cũ |
| Phó hiệu trưởng thấy tab không có quyền | Lộ giao diện Quy tắc/Lịch gửi | Tab lọc theo vai trò; BE vẫn chặn 403 | Ẩn thanh tab |
| Thẻ Tóm tắt tính sai số người nhận | Hiển thị lệch | Chỉ hiển thị số từ API xem trước | Bỏ thẻ Tóm tắt, giữ hai cột |

## Validation log
- [x] Khẳng định về code có `file:line` (mục Context)
- [x] Không đổi contract BE; consumer của `.row-actions` là mọi bảng dùng `RowActions` — cần kiểm ở Phase 1
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] 14 file vượt ngưỡng 8 file; không tách thành plan riêng vì ba phase cùng một luồng, mỗi phase ≤6 file và dừng chờ review riêng. Nếu user muốn tách thì mỗi phase thành một plan.
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [ ] Tự review lần cuối sau khi trả lời câu hỏi mở

## Progress log
### 2026-11-21 — Phase 1 (chờ review)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui` (detached tại `ab52f11f`)
- Làm: Mẫu, Quy tắc, Lịch gửi dùng `ListPage` (ô tìm + nút Tạo trong thanh lọc), bấm dòng mở chi tiết, bỏ icon "Xem"; `.row-actions` gap `--space-2`; cột Thao tác trong bảng kẻ ô lề ngang `--space-4`; cột giá trị ngắn căn giữa. Nút "Bật/Tắt/Xóa đã chọn" của Lịch gửi chỉ hiện khi có dòng được tick.
- Verify: `npx eslint src/pages/announcement src/components/announcement` → sạch · `npx prettier --check` các file đã sửa → sạch · `npx vite build` → built · `node scripts/check-design.mjs` → `check-design: ok` · test thông báo (`tests/menu/notification-module.test.mjs`, `tests/notifications/*.test.mjs`) → pass 34, fail 0 · `tests/menu/table-alignment.test.mjs` + `tests/education-plan/branch-template-enter.test.mjs` → pass 20, fail 0. Chưa chạy toàn bộ `npm run verify`; chưa xem bằng trình duyệt.
- Khác plan: không sửa `announcementUi.jsx` và `AnnouncementsPage.jsx` ở phase này (dải `AnnouncementHeader` còn dùng ở danh sách Thông báo nhà trường, trang chi tiết và form; sẽ bỏ ở Phase 2–3). Sửa `tests/notifications/announcement-model.test.mjs` vì test cũ buộc mỗi trang có đúng một dải thao tác. Thêm căn giữa cho cột giá trị ngắn theo quy ước bảng.
- Tiếp: Phase 2 sau khi user duyệt Phase 1.

### 2026-11-21 — Phase 2 (chờ review)
- Commit: chưa commit; cùng worktree `../CareNest_FE-notif-ui`
- Làm: trang mới `NotificationSettingsPage` (route `/notification-settings`, `only(LEADERS)`) có `PageHeader` + `Tabs`, tab nằm trong `?tab=` (tab đầu thì bỏ tham số). Ba trang cũ thành nội dung tab (bỏ `ListPage`, chỉ còn thẻ bảng). Logic tab theo vai trò tách ra `notificationSettingsTabs.mjs` để test. Route cũ `announcement-templates`, `notification-rules`, `announcement-schedules` chuyển hướng về đúng tab; tạo/sửa/chi tiết lịch gửi giữ route cũ. Menu Hiệu trưởng và Phó hiệu trưởng: Thông báo của tôi, Thông báo nhà trường, Cấu hình thông báo (`also: ['/announcement-schedules/']` để trang con vẫn chọn đúng mục). Breadcrumb và nút Quay lại của trang lịch gửi trỏ về `?tab=schedules`.
- Verify: `npx eslint` (thư mục thông báo, `menuConfig.js`, `AppRoutes.jsx`, `integrationModules.js`) → sạch · `npx vite build` → built · `tests/menu/*.test.mjs` + `tests/notifications/*.test.mjs` → tests 258, pass 258, fail 0 · `tests/hardening/*.test.mjs` → tests 121, pass 121, fail 0 · `node scripts/check-design.mjs` → `check-design: ok` · `node scripts/check-api-contract.mjs` → 0 lỗi, 2 cảnh báo cũ (be-api-routes.json lệch openapi BE, attendance pending) không liên quan. Chưa chạy toàn bộ `npm run verify`; chưa xem bằng trình duyệt.
- Khác plan: không thêm test render SSR trang gộp theo vai trò (cần giả lập user); thay bằng test hàm chọn tab và test nội dung `AppRoutes.jsx`. Sửa 3 test cũ buộc menu có ba mục riêng. `integrationModules.js` thêm `/notification-settings`, giữ ba route cũ vì còn chuyển hướng.
- Tiếp: Phase 3 sau khi user duyệt Phase 2.

### 2026-11-21 — Phase 3 (chờ review)
- Commit: chưa commit; cùng worktree `../CareNest_FE-notif-ui`
- Làm: form soạn (`AnnouncementForm`, dùng cho Soạn thông báo và Lịch gửi) thành lưới hai cột ≥1024px: trái một thẻ có 3 bước đánh số (Nội dung, Người nhận, Khi nào gửi) + Tệp đính kèm, phải thẻ Tóm tắt dính khi cuộn (`AnnouncementSummary`, mới); <1024px Tóm tắt xuống cuối form. Nút Lưu cùng một JSX ở đầu trang và trong Tóm tắt. Hàng "Dùng mẫu" + "Tiêu đề" cùng một hàng, Nội dung trọn chiều ngang thẻ; thêm nhãn "Gửi cho vai trò:" trước các ô vai trò. Tóm tắt chỉ hiển thị giá trị đã nhập, kết quả xem trước (`preview.total`, `byRole`) và `nextRunAt` do BE trả. Modal Tạo mẫu: "Tên mẫu" cạnh "Phạm vi mẫu".
- Verify: `npx eslint` thư mục thông báo → sạch · `npx vite build` → built · `node scripts/check-design.mjs` → `check-design: ok` (lần đầu fail vì selector `.btn` trong CSS module, đã đổi sang `> button`) · `tests/menu` + `tests/hardening` + `tests/notifications` → tests 380, pass 380, fail 0 (sau đó chạy lại `tests/notifications` → pass 32). `prettier --check` còn cảnh báo ở 3 test menu có sẵn, không do thay đổi này. Chưa chạy toàn bộ `npm run verify`; chưa xem bằng trình duyệt ở 1440/1024/768/360px.
- Khác plan: không sửa `AnnouncementScheduleFields.jsx` (đã một hàng Tần suất/Ngày/Giờ). Test cũ buộc đúng một nút submit nên đổi thành hai (đầu trang + Tóm tắt); thêm test Tóm tắt. Dải `AnnouncementHeader` còn ở danh sách Thông báo nhà trường và trang chi tiết thông báo, chưa đổi (ngoài phạm vi 3 phase đã duyệt).
- Tiếp: user xem bằng trình duyệt; quyết định có đổi tiếp danh sách Thông báo nhà trường hay không.

### 2026-11-21 — Bổ sung ngoài 3 phase: danh sách Thông báo nhà trường (chờ review)
- Commit: chưa commit; cùng worktree `../CareNest_FE-notif-ui`. Làm theo yêu cầu "Đổi tiếp" của user sau Phase 3.
- Làm: `AnnouncementsPage` dùng `ListPage`, bỏ dải `AnnouncementHeader`; thanh lọc có ô tìm, chọn trạng thái, nút "Mẫu thông báo" và "Soạn thông báo" (primary); "Xóa đã chọn (n)" chỉ hiện khi có dòng được tick. Bấm dòng mở `/announcements/:id`, bỏ icon "Xem" (còn "Sửa" nếu `canEdit` và menu Xóa nếu `canDelete`). Cột Phạm vi, Thời gian gửi căn giữa. Test duyệt bố cục thêm `/announcements` vào nhóm danh sách.
- Verify: `npx eslint src/pages/announcement` → sạch · `npx vite build` → built · `node scripts/check-design.mjs` → `check-design: ok` · `tests/menu` + `tests/hardening` + `tests/notifications` → tests 380, pass 380, fail 0. Chưa chạy toàn bộ `npm run verify`; chưa xem bằng trình duyệt.
- Khác plan: không đổi các trang chi tiết (`AnnouncementDetailPage`, `AnnouncementScheduleDetailPage`, `NotificationDetailPage`): dải trên cùng ở đó chứa nút Quay lại và nút thao tác của bản ghi, khác với danh sách.

### 2026-11-22 — Sửa theo góp ý: khu tệp đính kèm lệch khuôn dự án
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui`.
- Làm: `AnnouncementAttachments.jsx` bỏ chip đếm, nút "Thêm tệp" nhỏ lệch phải, `EmptyState` và danh sách thẻ tự vẽ; dùng khuôn dự án như `FileUploader`: vùng kéo thả `.dropzone` (thẻ `label` bọc ô chọn tệp, bấm hoặc Enter/Space khi đang focus mở hộp chọn tệp, hiện viền focus bằng `:focus-within`), hàng tệp `.file-row` có icon theo loại tệp, nút icon `Button variant="icon"` cho Tải/Bỏ/Giữ lại. Đủ 5 tệp thì thay vùng kéo thả bằng dòng báo. Xóa CSS tự vẽ không còn dùng trong `announcement.css`.
- Verify: `npx eslint src/components/announcement` → sạch · prettier → sạch · `node scripts/check-design.mjs` → ok (lần đầu fail vì `onClick` trên `div`, đã đổi sang `label`) · `tests/menu` + `tests/hardening` + `tests/notifications` → 399 pass · `npx vite build` → built. Thử trên trình duyệt: thêm 2 tệp qua ô chọn tệp → hai `.file-row` "Chờ tải lên", bộ đếm "2/5 tệp đã chọn".
- Khác plan: sửa 2 assertion trong `tests/notifications/announcement-model.test.mjs` cho khớp markup mới. Chưa kiểm kéo thả bằng chuột thật và phím Enter/Space trên vùng kéo thả.
