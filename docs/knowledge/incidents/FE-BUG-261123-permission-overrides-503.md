---
id: FE-BUG-261123-permission-overrides-503
type: bug
screens: [permission-overrides]
be_modules: [identity-access]
rules: [AUTH-11, AUTH-20, AUTH-23]
status: workaround
date: 2026-11-23
keywords: [ngoại lệ giáo viên, permission-overrides, Keycloak, 503]
similar_to: []
---

# Ngoại lệ giáo viên không tải được danh sách

## Điều kiện tái hiện

Mở `/permissions/overrides` với tài khoản Hiệu trưởng trên môi trường local có dữ liệu thật.

## Attempts

| Cách thử | Kết quả |
| --- | --- |
| Đọc danh sách nhân sự, điểm trường và lớp từ API | Tất cả trả HTTP 200 |
| Đọc ngoại lệ từng tài khoản song song rồi thử lại tuần tự | Cả hai lần có 33 lượt HTTP 200 và 40 lượt HTTP 503, thông báo “Hệ thống tài khoản đang gián đoạn, vui lòng thử lại sau” |

## Nguyên nhân

`PermissionServiceImpl.rolesOf` đọc vai trò của tài khoản đích từ Keycloak. Luồng này chuyển lỗi tra cứu Keycloak thành lỗi dịch vụ tài khoản. Chưa xác định được mã lỗi gốc của Keycloak trên môi trường đang chạy.

`permissionApi.getAccountsWithOverrides` dùng `Promise.all` để đọc quyền ngoại lệ từng tài khoản. Một lượt đọc thất bại làm cả danh sách báo lỗi.

## Trạng thái

FE giữ các kết quả thành công và báo số tài khoản chưa đọc được khi chỉ một phần yêu cầu trả HTTP 503 với mã 1111. Nút Thử lại tải lại danh sách. Nếu mọi lượt đọc đều thất bại hoặc xuất hiện lỗi khác, trang vẫn báo lỗi tải.

Đã kiểm tra qua lớp API của FE với backend local: trả một dòng có ngoại lệ và báo 40 tài khoản chưa đọc được. `tests/auth/permission-api.test.mjs` kiểm tra kết quả một phần, thất bại toàn bộ và lỗi 403. Lỗi tra vai trò ở Keycloak vẫn cần được xử lý để tải đủ danh sách.
