---
title: Nối màn tài khoản phụ huynh vào BE GuardianController
status: in-progress
owner: thangnd
jira: G94-272
branch: dev
modules: [identity-access, child]
rules: [AUTH-18, AUTH-19]
risk: high
created: 2026-11-01
updated: 2026-11-01
---

# Nối màn tài khoản phụ huynh vào BE GuardianController

## Context

Web chạy `VITE_USE_MOCK=false` nhưng `guardianService` non-mock trả cứng 501 ("đang demo; cần thống nhất contract BE") trong khi BE đã có `GuardianController` + `GET /children`. User yêu cầu nối tiếp sau màn phân quyền (2026-11-01). Chế độ tự chạy: không chờ duyệt plan; quyết định ghi dưới để user soát.

## Quyết định (tự chọn phương án khuyến nghị)

1. Danh sách trẻ: `GET /children?campusId&page&size` (BE đã lọc phạm vi AUTH-18: HT cả trường, PHT campus mình) ⇒ `canManage = true` cho trẻ BE trả; BE kiểm lại mọi thao tác. BE không trả danh sách phụ huynh ⇒ chỉ gọi `GET /children/{id}/guardians` cho trẻ có `guardianCount > 0`, tối đa 6 request song song.
2. Cấu trúc: `GET /campuses` + `GET /school-structure` (guard theo role HT/PHT, không phụ thuộc quyền cấu hình được). PHT chọn campus ngoài phạm vi ⇒ BE 403, UI hiện lỗi (FE không tự suy phạm vi).
3. Thêm phụ huynh theo AUTH-18: tra `POST /children/{id}/guardians/lookup` trước; SĐT đã có tài khoản ⇒ hỏi xác nhận đúng người (họ tên đã che, báo tài khoản nhân sự sẽ thêm vai trò phụ huynh) rồi gửi `confirmUserId`; đã liên kết ⇒ báo lỗi, không gửi. Mock thêm `lookupGuardian` cùng shape để UI một luồng.
4. BE không lưu email phụ huynh ⇒ ẩn ô email khi gọi BE; mock giữ email.
5. Câu chữ "demo / chưa tác động App thật" đổi thành mô tả đúng AUTH-18/19 (mật khẩu tạm in một lần, bắt đổi lần đầu; cấp lại hủy mọi phiên).

## Phases

- [x] P1 `api/guardianApi.js`, facade `guardianService.js`, mock `lookupGuardian`.
- [x] P2 UI: bước xác nhận trong `GuardianPanel`, ẩn email, câu chữ `GuardianPanel` + `ParentActivationPage`.
- [x] P3 Test API + `node scripts/verify.mjs`.
- [ ] P4 Smoke với BE thật (cần người đăng nhập HT/PHT trên web sau deploy).

## Progress log

### 2026-11-01

- Bắt đầu sau khi nối màn phân quyền; worktree `CareNest_FE-gateway-auth-vps` (nội dung = `origin/dev`).
- Xong P1–P3: `src/services/account/api/guardianApi.js` (mới), `guardianService.js` (facade + `lookupGuardian`, `IS_GUARDIAN_DEMO`, sửa `totalPages = 0` gây RangeError), mock `lookupGuardian`, `GuardianPanel` (tra SĐT → xác nhận → `confirmUserId`; ẩn email khi gọi BE), `ParentActivationPage` (banner demo chỉ ở mock, câu khóa/mở). Test: `tests/auth/guardian-api.test.mjs` (4), thêm 1 test mock lookup trong `guardian-compat.test.mjs`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` (373 test, 0 fail, lint/format/design/build OK).
- Giới hạn còn lại: mở màn từ hồ sơ trẻ (`?child=`) gọi `getChildDetail` → FE `GET /children/{id}/profile`, BE chỉ có `GET /children/{id}` ⇒ lỗi ở non-mock (module children, ngoài phạm vi). PHT thấy mọi điểm trường trong bộ lọc (`/campuses`), chọn campus ngoài phạm vi ⇒ BE 403. Mỗi trẻ có phụ huynh tốn 1 request; nên đề xuất BE trả kèm danh sách phụ huynh trong `GET /children`.
