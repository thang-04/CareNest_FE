---
title: Tái thiết kế Trung tâm Phân quyền (Permission Center)
status: in-progress
owner: CareNest Web
jira: none
branch: feature/G94-209-FE-FEAT-53-permission-management
modules: [identity-access]
rules: [AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14]
risk: medium
created: 2026-10-18
updated: 2026-10-18
---
# Tái thiết kế Trung tâm Phân quyền (Permission Center)

## Context

Màn hình phân quyền hiện tại (`src/pages/school-config/RoleDefaultsPage.jsx:18`) là một bảng ma trận lớn (6 vai trò x nhiều quyền) nằm lẫn trong thanh tab Nhân sự (`PeopleTabs.jsx:11`). Phần lớn các vai trò bị khóa cố định; việc quản lý quyền ngoại lệ cho từng nhân sự chỉ có thể làm lẻ tẻ trong hồ sơ từng người (`StaffPersonSheet.jsx:233`) mà không có màn hình tổng quan; tên quyền vẫn mang nặng mã kỹ thuật (`CHILD_PROFILE_VIEW`, `ACCOUNT_MANAGE`...).

Sau phiên phỏng vấn `/grill-me` ngày 2026-10-18, thiết kế chi tiết đã được user duyệt tại artifact `permission-center-design.md`.

## Quyết định đã chốt

1. **Kiến trúc điều hướng độc lập:** Tách hẳn thành **Trung tâm Phân quyền** (`/permissions`) trên Sidebar trong nhóm *Con người*, chỉ hiển thị cho Hiệu trưởng (`PRINCIPAL` với quyền `PERMISSION_MANAGE`). Tab Phân quyền cũ trong `PeopleTabs` được gỡ bỏ.
2. **3 phân khu chức năng:**
   - **Quyền theo vai trò:** Bảng so sánh 2 cột song song (Phó hiệu trưởng - Giáo viên), gom nhóm theo chức năng nghiệp vụ, công tắc bật/tắt trực tiếp, thanh lưu nổi và modal lý do (AUTH-14).
   - **Quyền ngoại lệ từng người:** Bảng danh sách các nhân sự đang có quyền ngoại lệ kèm nút mở **Modal Wizard 3 bước** (Chọn người → Bật/tắt quyền → Nhập lý do).
   - **Lịch sử thay đổi:** Nhật ký kiểm toán trực quan với Badge màu sắc phân biệt đối tượng và hành vi, bộ lọc đa năng.
3. **Thân thiện hóa ngôn ngữ:** Ẩn hoàn toàn mã kỹ thuật tiếng Anh trên UI, dùng ngôn ngữ nghiệp vụ trường mầm non gần gũi kèm mô tả tác động.
4. **Hồ sơ nhân sự:** Tab "Quyền" trong `StaffPersonSheet` chuyển sang dạng xem nhanh (Read-only) với huy hiệu trạng thái và nút mở nhanh Wizard chỉnh sửa.

## Làm rõ nghiệp vụ

- **Actor:** Hiệu trưởng (`PRINCIPAL`) có quyền `PERMISSION_MANAGE`.
- **Outcome:** Cấu hình quyền mặc định cho PHT và GV; quản lý ngoại lệ quyền cho từng nhân sự; theo dõi lịch sử kiểm toán phân quyền.
- **Rules:**
  - `AUTH-10`: Hiệu trưởng bật/tắt quyền trong danh mục cho PHT/GV và cấp ngoại lệ từng người.
  - `AUTH-11`: Quyền `PERMISSION_MANAGE` chỉ dành cho Hiệu trưởng, không thể giao cho vai trò khác.
  - `AUTH-12`: Quyền không cấu hình được thì giữ nguyên theo quy định, không cho sửa.
  - `AUTH-13`: Quyền không vượt qua phạm vi quản lý (access scope).
  - `AUTH-14`: Mọi thay đổi quyền phải ghi lại lịch sử kèm lý do bắt buộc.
- **Đối chiếu thiết kế ban đầu:**
  - Trước đây ma trận dàn trải 6 cột cả các vai trò cố định (Principal, Admin, Parent, Kitchen Staff) gây rối mắt. Thiết kế mới chỉ tập trung 2 cột cấu hình được (PHT & GV).
- **Ảnh hưởng:**
  - Route mới: `/permissions` (Tab 1: `/permissions/roles`, Tab 2: `/permissions/overrides`, Tab 3: `/permissions/history`). Route cũ `/school/roles` và `/school/roles/history` chuyển hướng sang route mới để bảo toàn backward compatibility.
  - Gỡ tab Phân quyền khỏi `src/components/account/PeopleTabs.jsx`.
  - Thêm mục "Phân quyền" vào `src/layouts/menuConfig.js` cho Principal.

### Câu hỏi mở

Không có câu hỏi mở (đã chốt toàn bộ qua `/grill-me`).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Cấu trúc hiển thị phân quyền? | Tách thành Trung tâm Phân quyền riêng (/permissions) gồm 3 phân khu | User | 2026-10-18 | `permission-center-design.md` |
| Bố cục Quyền theo vai trò? | Bảng so sánh 2 cột song song PHT vs GV | User | 2026-10-18 | `permission-center-design.md` |
| Quản lý ngoại lệ từng người? | Bảng danh sách người có ngoại lệ + Modal Wizard 3 bước | User | 2026-10-18 | `permission-center-design.md` |
| Bố cục Lịch sử thay đổi? | Bảng nhật ký kiểm toán với Badge màu và bộ lọc đa chiều | User | 2026-10-18 | `permission-center-design.md` |
| Vị trí trên Sidebar? | Mục 'Phân quyền' trong nhóm 'Con người' trên Sidebar | User | 2026-10-18 | `permission-center-design.md` |
| Tab Quyền trong Hồ sơ nhân sự? | Dạng xem nhanh Read-only kèm nút mở Wizard chỉnh sửa | User | 2026-10-18 | `permission-center-design.md` |
| Diễn giải tên quyền? | Dùng tên tiếng Việt nghiệp vụ mầm non, ẩn mã tiếng Anh | User | 2026-10-18 | `permission-center-design.md` |

## Acceptance criteria

- **AC-1** (`AUTH-11`): Chỉ tài khoản Hiệu trưởng có quyền `PERMISSION_MANAGE` mới truy cập được `/permissions` và thấy mục trên Sidebar.
- **AC-2** (`AUTH-10`): Phân khu "Quyền theo vai trò" hiển thị bảng so sánh 2 cột PHT và GV với các nhóm nghiệp vụ rõ ràng, công tắc bật/tắt chỉ hoạt động trên các ô BE cho phép cấu hình.
- **AC-3** (`AUTH-14`): Khi lưu thay đổi quyền theo vai trò hoặc quyền ngoại lệ cá nhân, người dùng bắt buộc phải nhập lý do (tối đa 500 ký tự); BE nhận payload chuẩn và ghi log.
- **AC-4** (`AUTH-10`): Phân khu "Quyền ngoại lệ từng người" hiển thị danh sách các nhân sự đang có quyền cấp thêm hoặc thu hồi; nút "Thêm ngoại lệ" mở Modal Wizard 3 bước và lưu thành công.
- **AC-5** (`AUTH-14`): Phân khu "Lịch sử thay đổi" hiển thị đúng nhật ký với Badge đối tượng (Vai trò / Cá nhân) và trạng thái (Bật/Tắt, Cấp thêm/Thu hồi) kèm bộ lọc.
- **AC-6**: Tab "Quyền" trong `StaffPersonSheet` hiển thị quyền hiệu lực dạng Read-only, có nút mở Wizard chỉnh sửa ngoại lệ và link sang Lịch sử.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Vị trí phân quyền | Trung tâm Phân quyền riêng `/permissions` trên Sidebar | Nằm chung trong tab Nhân sự `/people` | Phân quyền là tính năng quản trị trọng yếu của Hiệu trưởng, cần không gian chuyên biệt |
| Ma trận vai trò | Bảng 2 cột song song PHT vs GV | Ma trận 6 cột mọi vai trò | Các vai trò khác cố định trong code, hiển thị gây rối mắt và thừa thãi |
| Quản lý ngoại lệ | Bảng danh sách người có ngoại lệ + Modal Wizard 3 bước | Chỉ sửa trong hồ sơ từng người | Hiệu trưởng cần cái nhìn bao quát xem toàn trường ai đang có đặc quyền/ngoại lệ |
| Ngôn ngữ hiển thị | Tên nghiệp vụ tiếng Việt thuần túy | Giữ mã tiếng Anh kỹ thuật | Giúp Hiệu trưởng mầm non hiểu ngay quyền đó cho phép làm việc gì |

## Phases

### Phase 1 — Điều hướng, Route & Layout Trung tâm Phân quyền
- Files:
  - C (tạo mới) src/pages/permissions/PermissionCenterPage.jsx
  - C (tạo mới) src/components/permissions/PermissionTabs.jsx
  - M `src/routes/AppRoutes.jsx`
  - M `src/layouts/menuConfig.js`
  - M `src/components/account/PeopleTabs.jsx`
  - M `src/utils/school-config/breadcrumbs.js`
- Steps:
  1. Thêm route `/permissions`, `/permissions/roles`, `/permissions/overrides`, `/permissions/history` vào `AppRoutes.jsx` bọc dưới `PermissionGuard` quyền `PERMISSION_MANAGE`. Giữ redirect từ `/school/roles` và `/school/roles/history`.
  2. Thêm item `permissions` vào menu `Con người` trong `menuConfig.js` cho role `PRINCIPAL`.
  3. Bỏ tab "Phân quyền" khỏi `PeopleTabs.jsx`.
  4. Tạo khung giao diện `PermissionCenterPage.jsx` với header và tab điều hướng 3 phân khu.
- Tests: AC-1; route guard kiểm tra quyền, chuyển tab mượt mà.
- Exit: `node scripts/verify.mjs` → PASS.
- **Dừng chờ user review.**

### Phase 2 — Phân khu 1: Quyền theo vai trò (So sánh song song 2 cột)
- Files:
  - C (tạo mới) src/pages/permissions/RoleDefaultsTab.jsx
  - M `src/models/account/permissionConstants.js`
  - M `src/styles/modules/staff-hub.css`
- Steps:
  1. Định nghĩa cấu trúc nhóm quyền nghiệp vụ thân thiện trong `permissionConstants.js` (ẩn mã tiếng Anh).
  2. Xây dựng bảng so sánh 2 cột song song Phó hiệu trưởng vs Giáo viên.
  3. Thanh thông báo thay đổi chưa lưu nổi (floating action bar) kèm nút Hủy và Lưu phân quyền.
  4. Tích hợp `ReasonModal` nhập lý do (AUTH-14) và gọi API `updateRolePermissions`.
- Tests: AC-2, AC-3; kiểm tra bật/tắt, hủy thay đổi, lưu kèm lý do, validate lý do.
- Exit: `node scripts/verify.mjs` → PASS.
- **Dừng chờ user review.**

### Phase 3 — Phân khu 2: Quyền ngoại lệ từng người & Modal Wizard
- Files:
  - C (tạo mới) src/pages/permissions/UserOverridesTab.jsx
  - C (tạo mới) src/components/permissions/OverrideWizardModal.jsx
  - M `src/services/account/permissionService.js`
  - M `src/services/account/mock/permissionMockRepository.js`
  - M `src/hooks/account/usePermissions.js`
- Steps:
  1. Bổ sung hàm lấy danh sách tài khoản có ngoại lệ trong service và mock.
  2. Xây dựng bảng hiển thị các nhân sự đang có ngoại lệ với badge Cấp thêm / Thu hồi.
  3. Xây dựng Modal Wizard 3 bước:
     - Bước 1: Chọn nhân sự (từ danh sách PHT/GV).
     - Bước 2: Bật/tắt công tắc cấp thêm / thu hồi quyền so với vai trò.
     - Bước 3: Xem tóm tắt thay đổi và nhập lý do bắt buộc.
  4. Hành động "Đặt lại theo vai trò" (Reset về mặc định) kèm modal lý do.
- Tests: AC-4; luồng wizard 3 bước, gán quyền, thu hồi, reset về mặc định.
- Exit: `node scripts/verify.mjs` → PASS.
- **Dừng chờ user review.**

### Phase 4 — Phân khu 3: Lịch sử kiểm toán & Cập nhật Hồ sơ nhân sự
- Files:
  - C (tạo mới) src/pages/permissions/PermissionAuditTab.jsx
  - M `src/components/account/StaffPersonSheet.jsx`
  - M `src/styles/modules/staff-hub.css`
- Steps:
  1. Xây dựng phân khu Lịch sử kiểm toán với bộ lọc loại đối tượng (Vai trò / Cá nhân), bộ lọc nhân viên và Badge màu trực quan.
  2. Cập nhật tab "Quyền" trong `StaffPersonSheet.jsx` sang dạng Read-only trực quan, hiển thị quyền hiệu lực và nút mở nhanh Wizard chỉnh sửa hoặc link sang Lịch sử.
- Tests: AC-5, AC-6; kiểm tra hiển thị log, lọc lịch sử, xem quyền trong hồ sơ cá nhân.
- Exit: `node scripts/verify.mjs` → PASS.
- **Dừng chờ user review.**

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-11 | Unit / RouteGuard (FE) | Phase 1 | Pass |
| AC-2 | AUTH-10 | Unit / Component (FE) | Phase 2 | Pass |
| AC-3 | AUTH-14 | Unit / Validation (FE) | Phase 2 | Pass |
| AC-4 | AUTH-10 | Component / Wizard (FE) | Phase 3 | Pass |
| AC-5 | AUTH-14 | Component / Log (FE) | Phase 4 | Pass |
| AC-6 | AUTH-10 | Component / Sheet (FE) | Phase 4 | Pass |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| User lưu URL cũ `/school/roles` | Lỗi 404 nếu truy cập bookmark cũ | Giữ redirect từ URL cũ sang `/permissions` | Khôi phục route cũ trong `AppRoutes.jsx` |
| BE chưa có API danh sách tổng hợp override | Tab 2 không tải được trên BE thật nếu chưa có API | Mock FE hỗ trợ đầy đủ; dự phòng fallback duyệt qua accounts hoặc đề xuất API BE | Dùng filter client-side nếu BE chỉ trả danh sách accounts |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] Scope vừa 1 plan
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-10-18 — Tạo plan (chờ duyệt)
- Plan tạo từ template chuẩn theo kết quả phỏng vấn `/grill-me`.

### 2026-10-18 — Triển khai hoàn tất 4 Phase
- **Phase 1 (Route & Điều hướng):** Tạo phân vùng route `/permissions` độc lập với 3 tab, menu item Phân quyền trong nhóm Con người cho Principal, gỡ tab cũ khỏi PeopleTabs, hỗ trợ redirect từ `/school/roles*`.
- **Phase 2 (Quyền theo vai trò):** Thiết kế lại RoleDefaultsPage: bảng so sánh 2 cột PHT vs GV, gom nhóm theo PERMISSION_GROUPS, công tắc bật/tắt trực tiếp, floating action bar khi có thay đổi chưa lưu, ReasonModal bắt buộc lý do, ẩn toàn bộ mã kỹ thuật tiếng Anh.
- **Phase 3 (Ngoại lệ từng người):** Tạo màn hình UserOverridesPage quản lý danh sách nhân sự có ngoại lệ kèm bộ lọc và các nút Thao tác (Sửa, Đặt lại). Xây dựng Modal Wizard 3 bước OverrideWizardModal (Chọn nhân sự → Bật/tắt công tắc quyền → Xác nhận & nhập lý do). Bổ sung getAccountsWithOverrides vào tầng repository/api/service/hook.
- **Phase 4 (Lịch sử & Hồ sơ nhân sự):** Cập nhật PermissionHistoryPage với badge màu phân biệt mục tiêu (Vai trò tím / Nhân sự info), trạng thái BẬT/TẮT, tên quyền tiếng Việt. Nâng cấp tab Quyền trong StaffPersonSheet thành chế độ xem nhanh (Read-only) với badge trạng thái chi tiết, nút "Chỉnh sửa ngoại lệ" kích hoạt Wizard và liên kết xem lịch sử.
- **Kiểm chứng chất lượng:**
  - `npm run test:auth`: 70/70 pass
  - `npm run test:menu`: 47/47 pass
  - `npm run check` (eslint, prettier format, vite build): PASS 0 errors
  - `node scripts/check-ai-layer.mjs`: 0 lỗi
  - `node scripts/verify.mjs`: `VERIFY PASS full | npm run verify | log verify.log`
