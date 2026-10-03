# Route Map — Role → screen group

Mức chi tiết: **screen group** (chưa có route/URL thật — chưa có source, router chưa chốt). Khi implement, thêm cột route thực tế cho group đó. Không chép rule nghiệp vụ vào đây — cột "BE card" là nơi đọc rule.

Nguyên tắc:
- Menu/route hiển thị theo **permission BE trả về** cho user hiện tại, không hard-code theo tên role. Gán permission → role là cấu hình ở BE (`../CareNest_BE/docs/business/USER_ROLES.md`).
- Route guard ở client chỉ là UX; BE vẫn trả 401/403/404 — màn hình phải xử lý.
- Phạm vi dữ liệu (campus/lớp) do BE áp: Vice Principal chỉ thấy campus được phân công, Teacher chỉ thấy lớp được phân công.
- **actor PENDING** = người thực hiện chưa chốt ⇒ hiển thị theo permission, không giả định role.

`BE:` = `../CareNest_BE/docs/modules/`.

## System Admin

| Screen group | Hành động chính | Permission (BE) | BE card |
| --- | --- | --- | --- |
| Tài khoản | Tạo/khóa tài khoản, gán role | `admin:accounts` | `BE:identity-access.md` |
| Role & permission | Xem/gán permission cho role | `admin:accounts` | `BE:identity-access.md` |
| Phân công nhân sự | StaffAssignment: HT→trường, HP→campus, GV→lớp | `admin:accounts` | `BE:school-structure.md` |
| Campus / lớp / năm học | Cấu trúc trường (2 campus) | `admin:accounts` | `BE:school-structure.md` |
| Cấu hình hệ thống | Tham số cấu hình (vd. cut-off khi đã chốt), tiêu chí quan sát (data) | PENDING (permission riêng chưa định nghĩa) | nhiều card |

Admin mặc định không xem dữ liệu trẻ (AUTH-06, PENDING P-16).

## Principal / Vice Principal (Ban giám hiệu)

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Dashboard báo cáo | Xem theo lớp / campus / toàn trường | `report:view` | `BE:reporting.md` | VP: chỉ campus được phân công |
| Xác nhận số suất ăn | Xem số suất theo ngày, xác nhận | `meal-count:confirm` | `BE:nutrition.md` | **actor PENDING (P-05)** |
| Duyệt thực đơn | Xem Menu DRAFT (kể cả AI gợi ý), duyệt | `menu:approve` | `BE:nutrition.md` | Gán role: cấu hình |
| Summary & hồ sơ phát triển | Xem summary đã GV duyệt, hồ sơ phát triển trẻ | `report:view` (PROPOSED) | `BE:learning-observation.md` | |
| Tổng quan sức khỏe | Xem measurement/trend, duyệt diễn giải AI | `health-interpretation:approve` (duyệt) | `BE:health.md` | Không hiển thị nhãn chẩn đoán |
| Sự cố CSVC | Danh sách theo campus/trạng thái, cập nhật trạng thái | `facility-issue:manage` | `BE:facility-issue.md` | Chỉ sự cố, không tài sản |
| Đơn nghỉ | Duyệt đơn | `leave:approve` | `BE:attendance.md` | **actor PENDING (P-15)** |

## Teacher

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Điểm danh + báo ăn | Nhập theo lớp/ngày (batch) | `attendance:record` | `BE:attendance.md` | Cut-off PENDING P-03 |
| Quan sát hằng ngày | Ghi quan sát theo tiêu chí trường cấu hình | `observation:record` | `BE:learning-observation.md` | Tiêu chí là data, không cứng |
| Review/duyệt summary | Sửa và duyệt summary DRAFT (template hoặc AI) | `summary:approve` | `BE:learning-observation.md` | Tần suất PENDING P-12 |
| Nhập đo sức khỏe | Nhập chiều cao/cân nặng theo lớp/đợt | `health:record` | `BE:health.md` | **actor PENDING** |
| Báo sự cố CSVC | Tạo sự cố (loại, mô tả, vị trí, ảnh) | `facility-issue:report` | `BE:facility-issue.md` | |
| Đơn nghỉ | Tạo/xem đơn của lớp | `leave:create` | `BE:attendance.md` | **actor PENDING (P-15)** |

## Chung

| Screen group | Ghi chú |
| --- | --- |
| Đăng nhập / đăng xuất / hết phiên | `docs/integration/AUTH_FLOW.md` (SKELETON) |
| Thông báo trong app (nếu có) | `BE:notification.md` — kênh Web chưa chốt |
| Trang lỗi 403 / 404 / mất kết nối | Dùng chung mọi group |

## Không có trên Web

Parent, Kitchen Staff (thuộc APP) · ngữ cảnh hoạt động/giáo án (OPEN ADR-0006 / GoKids) · tài sản, kho/NCC (ngoài V1).
