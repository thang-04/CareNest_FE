# Đề xuất contract BE — danh sách nhân sự và phân công theo nơi

Status: **PROPOSED, chưa có trong CareNest_BE** · Consumer: khu Con người Web (`/school/staff`, `/school/staff/assignments`) · Nguồn quyết định UX: user xác nhận 2026-10-18.

## 1. Lọc danh sách nhân sự

Mở rộng `GET /api/accounts` bằng query tùy chọn `staffOnly=true`. Khi bật, BE lọc `primary_role` thuộc `PRINCIPAL`, `VICE_PRINCIPAL`, `TEACHER`, `KITCHEN_STAFF` **trước** phân trang và tính `totalElements`. Giữ nguyên `role`, `status`, `campusId`, `q`, `page`, `size`, response `PageResponse<AccountSummaryResponse>` và kiểm tra phạm vi hiện có (AUTH-08). Bỏ tham số hoặc `false` giữ hành vi cũ. `PARENT`, `ADMIN`, `primary_role=null` không nằm trong bảng Nhân sự.

## 2. Roster theo điểm trường

Thêm `GET /api/staff-assignments/roster?campusId={id}`. `campusId` bắt buộc; BE lấy ngày hiện tại theo `Clock`, chỉ trả phân công có hiệu lực ngày đó (hai đầu ngày đều tính). Response trong envelope `{code, desc, data}`:

```json
{
  "campusId": 1,
  "asOf": "2026-10-18",
  "vicePrincipals": [{ "assignmentId": 10, "userId": 20, "fullName": "Nhân sự mẫu", "status": "ACTIVE", "validFrom": "2026-09-01", "validTo": null }],
  "kitchenStaff": [],
  "classrooms": [{ "classroomId": 30, "name": "Lớp mẫu", "teachers": [] }]
}
```

BE trả mọi lớp hiện hành của campus, kể cả `teachers: []`. PHT chỉ nhận giáo viên/bếp thuộc campus mình; `vicePrincipals: []` với PHT theo AUTH-08. Hiệu trưởng nhận PHT, bếp và giáo viên ở campus đã chọn. Phân công tài khoản `INACTIVE` vẫn hiện với `status` để người quản lý thấy tình trạng tài khoản, không lặng lẽ mất khỏi roster.

Quyền đọc như `GET /accounts` (một trong `ACCOUNT_MANAGE`, `ACCOUNT_STATUS_MANAGE`, `STAFF_ASSIGNMENT_MANAGE`, `PERMISSION_MANAGE`), sau đó BE kiểm phạm vi campus. `403` cho campus ngoài phạm vi PHT; `404` cho campus không tồn tại với HT; `400` khi thiếu/sai `campusId`. Không cấp quyền sửa qua endpoint GET.

## 3. Kiểm chứng BE khi được cho phép sửa repo

- Test controller cho query/response và 400/403/404; test service/query cho ngày hiệu lực, lớp trống, PHT không thấy campus khác hoặc PHT khác.
- Test `staffOnly` phân trang sau lọc, kết hợp role/status/q/campus; kiểm `staffOnly` bị bỏ qua vẫn tương thích caller cũ.
- Cập nhật `BE:docs/contracts/AUTH_CONTRACT.md`, module card và OpenAPI snapshot. FE chỉ xác nhận chế độ API thật sau khi endpoint BE được triển khai và chạy smoke test.
- Sau smoke test hai contract, cấu hình Web đặt `VITE_PEOPLE_CONTRACT_READY=true` khi build; mặc định `false`. Cờ chỉ kiểm soát tính sẵn sàng của UI, không thay kiểm quyền/scope BE.
