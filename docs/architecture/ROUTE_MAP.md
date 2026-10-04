# Route Map — Role → screen group

Mức chi tiết: **screen group** (chưa có route/URL thật — chưa có source, router chưa chốt). Khi implement, thêm cột route thực tế cho group đó. Không chép rule nghiệp vụ vào đây — cột "BE card" là nơi đọc rule.

Nguyên tắc:
- Menu/route hiển thị theo **permission BE trả về** cho user hiện tại, không hard-code theo tên role. Gán permission → role là cấu hình ở BE (`BE:docs/business/USER_ROLES.md`).
- Route guard ở client chỉ là UX; BE vẫn trả 401/403/404 — màn hình phải xử lý (AUTH-07).
- Phạm vi dữ liệu (campus/lớp) do BE áp: AUTH-02, AUTH-03, AUTH-08.
- **actor PENDING** = người thực hiện chưa chốt ⇒ hiển thị theo permission, không giả định role.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## System Admin

| Screen group | Hành động chính | Permission (BE) | BE card |
| --- | --- | --- | --- |
| Tài khoản | Tạo/khóa tài khoản, gán role | `admin:accounts` | `BE:docs/modules/identity-access.md` |
| Role & permission | Xem/gán permission cho role | `admin:accounts` | `BE:docs/modules/identity-access.md` |
| Phân công nhân sự | StaffAssignment: HT→trường, HP→campus, GV→lớp | `admin:accounts` | `BE:docs/modules/school-structure.md` |
| Campus / lớp / năm học | Cấu trúc trường (2 campus) | `admin:accounts` | `BE:docs/modules/school-structure.md` |
| Cấu hình hệ thống | Tham số cấu hình (vd. cut-off khi đã chốt), tiêu chí quan sát (data) | PENDING (permission riêng chưa định nghĩa) | nhiều card |

Admin và dữ liệu trẻ: AUTH-06 (PENDING P-16).

## Principal / Vice Principal (Ban giám hiệu)

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Dashboard báo cáo | Xem theo lớp / campus / toàn trường | `report:view` | `BE:docs/modules/reporting.md` | Scope: AUTH-02, AUTH-08 |
| Duyệt thực đơn | Xem MealPlan (thực đơn) DRAFT (kể cả AI gợi ý), duyệt | `menu:approve` | `BE:docs/modules/nutrition.md` | Gán role: cấu hình |
| Summary & hồ sơ phát triển | Xem summary đã GV duyệt, hồ sơ phát triển trẻ | `report:view` (PROPOSED) | `BE:docs/modules/learning-observation.md` | |
| Tổng quan sức khỏe | Xem measurement/trend, duyệt diễn giải AI | `health-interpretation:approve` (duyệt) | `BE:docs/modules/health.md` | Không hiển thị nhãn chẩn đoán |
| Sự cố CSVC | Danh sách theo campus/trạng thái, cập nhật trạng thái | `facility-issue:manage` | `BE:docs/modules/facility-issue.md` | Chỉ sự cố, không tài sản |
| Báo nghỉ của campus | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**) | theo scope (không có permission duyệt) | `BE:docs/modules/attendance.md` | ATT-05; flow `BE:docs/business/flows/leave-request.md` |

## Teacher

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Điểm danh + báo ăn | Nhập theo lớp/ngày (batch) | `attendance:record` | `BE:docs/modules/attendance.md` | Cut-off PENDING P-03 |
| Quan sát hằng ngày | Ghi quan sát theo tiêu chí trường cấu hình | `observation:record` | `BE:docs/modules/learning-observation.md` | Tiêu chí là data, không cứng |
| Review/duyệt summary | Sửa và duyệt summary DRAFT (template hoặc AI) | `summary:approve` | `BE:docs/modules/learning-observation.md` | Tần suất PENDING P-12 |
| Báo sự cố CSVC | Tạo sự cố (loại, mô tả, vị trí, ảnh) | `facility-issue:report` | `BE:docs/modules/facility-issue.md` | |
| Báo nghỉ của lớp | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**) | theo scope (không có permission duyệt) | `BE:docs/modules/attendance.md` | ATT-04, ATT-05; GV tạo thay phụ huynh: PROPOSED |

## Actor PENDING (hiển thị theo permission, không gán role)

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Xác nhận số suất ăn | Xem số suất theo ngày, xác nhận | `meal-count:confirm` | `BE:docs/modules/nutrition.md` | NUT-02; actor PENDING P-05 |
| Nhập đo sức khỏe | Nhập chiều cao/cân nặng theo lớp/đợt | `health:record` | `BE:docs/modules/health.md` | Người nhập PENDING (HLT-01) |

## Chung

| Screen group | Ghi chú |
| --- | --- |
| Đăng nhập / đăng xuất / hết phiên | `docs/integration/AUTH_FLOW.md` (SKELETON) |
| Thông báo trong app (nếu có) | `BE:docs/modules/notification.md` — kênh Web chưa chốt |
| Trang lỗi 403 / 404 / mất kết nối | Dùng chung mọi group |

## Không có trên Web (mặc định)

Parent (thuộc APP; gửi báo nghỉ qua app) · Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`) · ngữ cảnh hoạt động/giáo án (OPEN ADR-0006 / GoKids) · tài sản (ngoài V1) · kho/NCC (OPEN — BE ADR-0009).
