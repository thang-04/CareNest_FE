---
title: Tái cấu trúc Modal Hồ sơ và Nút thao tác nhanh Nhân sự & Phụ huynh
status: in-progress
owner: CareNest Web
jira: none
branch: feature/G94-209-FE-FEAT-53-permission-management
modules: [identity-access]
rules: [AUTH-10, AUTH-16, AUTH-17, AUTH-18, AUTH-19]
risk: low
created: 2026-10-18
updated: 2026-10-18
---
# Tái cấu trúc Modal Hồ sơ và Nút thao tác nhanh Nhân sự & Phụ huynh

## Context

Màn hình quản lý Nhân sự (`src/pages/school-config/StaffHubPage.jsx:54`) hiện tại khi mở hồ sơ một nhân sự sẽ thay thế toàn bộ trang bằng `StaffPersonSheet`, làm mất ngữ cảnh bảng danh sách. Màn hình quản lý Phụ huynh (`src/pages/children/ParentActivationPage.jsx:246`) hiện tại khi mở thông tin bé dùng ngăn kéo `SidePanel` hẹp bên phải. Các thao tác quản lý tài khoản thường dùng như **Cấp lại mật khẩu tạm** và **Khóa / Mở khóa tài khoản** nằm ẩn sâu bên trong các sheet/panel này, khiến người quản lý trường mất nhiều thao tác click chuột khi cần xử lý nhiều tài khoản.

Sau phiên phỏng vấn `/grill-me`, thiết kế chi tiết đã được chốt tại artifact `modal-and-quick-actions-design.md`.

## Quyết định đã chốt

1. **Hồ sơ nhân sự dạng Modal (`StaffPersonModal`):**
   - Chuyển `StaffPersonSheet` thành Modal nổi ở giữa màn hình (`size="lg"` hoặc `size="xl"`), giữ danh sách nhân sự luôn hiển thị ở background.
   - Đồng bộ URL 2 chiều: Mở modal nhân sự cập nhật URL `/school/staff/:userId`; đóng modal quay về `/school/staff`.
2. **Thao tác nhanh ngoài danh sách Nhân sự:**
   - Cột Thao tác trực tiếp trên từng dòng nhân sự: Nút Xem (mở modal), Nút Cấp lại MK (mở `ResetPasswordModal`), Nút Khóa / Mở khóa (màu phân biệt, có `ConfirmationModal`).
3. **Thông tin Phụ huynh dạng Modal (`GuardianModal`):**
   - Thay thế ngăn kéo `SidePanel` hẹp bên phải bằng Modal nổi ở giữa màn hình (`size="lg"`), bố cục rõ ràng thông tin bé và danh sách phụ huynh.
4. **Thao tác nhanh trên dòng Bé ở danh sách Phụ huynh:**
   - Trên mỗi dòng bé: Hiển thị thẻ từng phụ huynh kèm nút thao tác Cấp lại MK (sinh ngẫu nhiên + in phiếu) và Khóa / Mở khóa (có xác nhận). Nếu bé chưa có phụ huynh -> nút "+ Thêm phụ huynh".

## Làm rõ nghiệp vụ

- **Actor:** Hiệu trưởng (`PRINCIPAL`), Phó hiệu trưởng (`VICE_PRINCIPAL`) có quyền tương ứng (`ACCOUNT_MANAGE`, `ACCOUNT_STATUS_MANAGE`, `PARENT_ACCOUNT_MANAGE`).
- **Outcome:** Xem nhanh hồ sơ không mất ngữ cảnh; thực hiện các thao tác quản trị tài khoản ngay ngoài danh sách.
- **Rules:**
  - `AUTH-16`: Quản lý tài khoản nhân sự (cấp lại mật khẩu tạm, không được tự thao tác với chính mình `isSelf`).
  - `AUTH-17`: Khóa / Mở khóa tài khoản nhân sự (người dùng bị đăng xuất ngay khi bị khóa).
  - `AUTH-18`: Quản lý tài khoản phụ huynh theo trẻ (thêm, liên kết SĐT).
  - `AUTH-19`: Cấp lại mật khẩu phụ huynh và khóa / mở khóa tài khoản phụ huynh.

### Câu hỏi mở

Không có câu hỏi mở (đã chốt toàn bộ qua `/grill-me`).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Modal Nhân sự & URL? | Modal nổi giữa màn hình, đồng bộ URL `/school/staff/:userId` | User | 2026-10-18 | `modal-and-quick-actions-design.md` |
| Thao tác Nhân sự ngoài list? | Cột thao tác có nút icon kèm nhãn ngắn (Xem, Cấp lại MK, Khóa/Mở) | User | 2026-10-18 | `modal-and-quick-actions-design.md` |
| Bố cục Modal Phụ huynh? | Modal nổi giữa màn hình thay cho SidePanel bên phải | User | 2026-10-18 | `modal-and-quick-actions-design.md` |
| Thao tác Phụ huynh ngoài list? | Thẻ từng phụ huynh trên dòng bé kèm nút Cấp lại MK và Khóa/Mở | User | 2026-10-18 | `modal-and-quick-actions-design.md` |
| Cơ chế sinh mật khẩu tạm? | Nhân sự mở modal nhập MK; Phụ huynh sinh ngẫu nhiên + modal in phiếu | User | 2026-10-18 | `modal-and-quick-actions-design.md` |
| Xác nhận khi Khóa/Mở? | Luôn hiện ConfirmationModal trước khi thực hiện | User | 2026-10-18 | `modal-and-quick-actions-design.md` |

## Acceptance Criteria

- [x] AC-1: Bấm vào nhân sự trong danh sách hoặc truy cập `/school/staff/:userId` hiển thị `StaffPersonSheet` trong Modal nổi, nền danh sách nhân sự vẫn hiện ở dưới. Đóng modal thì URL quay về `/school/staff`.
- [x] AC-2: Cột Thao tác trên danh sách Nhân sự có đầy đủ nút Xem, Cấp lại MK, Khóa/Mở khóa theo đúng phân quyền và trạng thái.
- [x] AC-3: Bấm Cấp lại MK trên danh sách Nhân sự mở `ResetPasswordModal` và thực hiện đổi mật khẩu tạm thành công.
- [x] AC-4: Bấm Khóa/Mở khóa trên danh sách Nhân sự mở `ConfirmationModal` và cập nhật trạng thái tài khoản thành công.
- [x] AC-5: Trang Phụ huynh thay thế `SidePanel` bằng `Modal` nổi ở giữa màn hình.
- [x] AC-6: Trên mỗi dòng bé ở trang Phụ huynh, hiển thị thẻ phụ huynh kèm các nút thao tác Cấp lại MK và Khóa/Mở khóa hoạt động chính xác.
- [x] AC-7: `node scripts/verify.mjs` chạy PASS full không có lỗi.

## Implementation phases

### Phase 1: Thao tác nhanh & Modal Nhân sự
- Refactor `StaffPersonSheet.jsx` để có thể hiển thị dạng Modal (hoặc nhúng vào `Modal` của `StaffHubPage.jsx`).
- Cập nhật `StaffHubPage.jsx`:
  - Giữ danh sách nhân sự luôn render khi có `userId`, đồng thời render Modal chi tiết của `userId`.
  - Thêm cột Thao tác (Xem, Cấp lại MK, Khóa/Mở) vào bảng và mobile card.
  - Tích hợp `ResetPasswordModal` và `ConfirmationModal` xác nhận trạng thái trực tiếp trên `StaffHubPage`.
- Exit: `npm run test:auth` → PASS.

### Phase 2: Dữ liệu & Thao tác nhanh Phụ huynh
- Cập nhật `guardianMockRepository.js` và `guardianApi.js`: hàm `searchChildren` trả về thêm mảng `guardians` cho từng trẻ.
- Refactor `GuardianPanel.jsx` và `ParentActivationPage.jsx`:
  - Thay thế `SidePanel` bằng `Modal size="lg"`.
  - Hiển thị danh sách phụ huynh với nút Cấp lại MK, Khóa/Mở trên mỗi dòng bé.
  - Tích hợp `ConfirmationModal` và Modal kết quả mật khẩu tạm / in phiếu trên `ParentActivationPage`.
- Exit: `npm run test:auth` → PASS.

### Phase 3: Kiểm thử & Nghiệm thu chất lượng
- Chạy `npm run check` (eslint, prettier, build).
- Chạy `node scripts/check-ai-layer.mjs`.
- Chạy `node scripts/verify.mjs` đạt `VERIFY PASS full`.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-10 | Component / Modal (FE) | Phase 1 | Pass |
| AC-2 | AUTH-16, AUTH-17 | Unit / Component (FE) | Phase 1 | Pass |
| AC-3 | AUTH-16 | Component / ResetPassword (FE) | Phase 1 | Pass |
| AC-4 | AUTH-17 | Component / Status (FE) | Phase 1 | Pass |
| AC-5 | AUTH-18 | Component / Modal (FE) | Phase 2 | Pass |
| AC-6 | AUTH-19 | Component / Actions (FE) | Phase 2 | Pass |
| AC-7 | All | Verification script | Phase 3 | Pass |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Modal quá dài trên màn hình nhỏ | Nội dung tab Quyền bị tràn | Giới hạn `max-height: 85vh` và cho phép scroll nội dung bên trong modal | Đặt overflow-y auto cho modal body |
| BE chưa trả mảng guardians trong searchChildren | Không hiện được nút phụ huynh ngoài list | Dự phòng nếu `child.guardians` không có thì hiển thị như cũ (`child.guardianCount`) | Giữ fallback hiển thị số lượng phụ huynh |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] Scope vừa 1 plan
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-10-18 — Tạo plan
- Lập kế hoạch triển khai Modal hồ sơ & Nút thao tác nhanh cho Nhân sự và Phụ huynh theo thiết kế đã thống nhất.

### 2026-10-18 — Triển khai hoàn tất 3 Phase
- **Phase 1 (Nhân sự):**
  - Chuyển `StaffPersonSheet` thành dạng Modal, đồng bộ 2 chiều URL `/school/staff/:userId`, nền danh sách luôn hiển thị.
  - Thêm cột Thao tác vào bảng nhân sự (nút Xem, Cấp lại MK, Khóa/Mở khóa) có màu phân biệt và modal xác nhận.
- **Phase 2 (Phụ huynh):**
  - Mở rộng `searchChildren` trong `guardianMockRepository` trả về mảng `guardians`.
  - Thay thế `SidePanel` bên phải bằng `Modal size="lg"` `GuardianPanel` ở giữa màn hình.
  - Hiển thị danh sách thẻ phụ huynh trực tiếp trên từng dòng bé kèm các nút thao tác nhanh (Cấp lại MK, Khóa/Mở) và nút "+ Thêm phụ huynh" nếu chưa có.
  - Tích hợp `ConfirmationModal` và `AccountSlip` in/sao chép mật khẩu tạm ngay trên `ParentActivationPage`.
- **Phase 3 (Kiểm chứng):**
  - `npm run test:auth`: 71/71 pass
  - `npm run test:menu`: 47/47 pass
  - `npm run test:kitchen`: 23/23 pass
  - `npm run check`: PASS (eslint 0 errors, prettier clean, vite build ok)
  - `node scripts/check-ai-layer.mjs`: 0 lỗi
  - `node scripts/verify.mjs`: `VERIFY PASS full | npm run verify | log verify.log`
