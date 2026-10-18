# Route Map — Role → screen group

Mức chi tiết: **screen group** (chưa có route/URL thật — chưa có source, router chưa chốt). Khi implement, thêm cột route thực tế cho group đó. Không chép rule nghiệp vụ vào đây — cột "BE card" là nơi đọc rule.

Nguyên tắc:
- Menu/route hiển thị theo **permission BE trả về** cho user hiện tại, không hard-code theo tên role. Gán permission → role là cấu hình ở BE (`BE:docs/business/USER_ROLES.md`).
- Route guard ở client chỉ là UX; BE vẫn trả 401/403/404 — màn hình phải xử lý (AUTH-07).
- Phạm vi dữ liệu (campus/lớp) do BE áp: AUTH-02, AUTH-03, AUTH-08.
- **actor PENDING** = người thực hiện chưa chốt ⇒ hiển thị theo permission, không giả định role.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Con người, phân quyền & tài khoản (HT/PHT theo quyền BE — ADR-0017)

| Screen group | Route | Hành động chính | Permission (BE) | BE card |
| --- | --- | --- | --- | --- |
| Khu bốn tab | `/people` → `/school/staff`, `/school/roles`, `/children/activation` hoặc `/children` | Nhân sự / Phân quyền / Phụ huynh / Trẻ; tab Phân quyền chỉ Hiệu trưởng có `PERMISSION_MANAGE`. URL cũ giữ nguyên. Giáo viên giữ danh sách trẻ trong menu riêng | Theo permission và route guard hiện có | `BE:docs/modules/identity-access.md`, `BE:docs/modules/child.md` |
| Nhân sự & quyền | `/school/staff[/:userId]` | Bảng nhân sự lọc/phân trang phía BE; hồ sơ có tab **Phân công / Quyền / Tài khoản**. Quyền hiệu lực chỉ đọc ở hồ sơ, Hiệu trưởng lưu ngoại lệ kèm lý do | `ACCOUNT_MANAGE` \| `ACCOUNT_STATUS_MANAGE` \| `STAFF_ASSIGNMENT_MANAGE` \| `PERMISSION_MANAGE`; tab Quyền chỉ với `PERMISSION_MANAGE` | `BE:docs/modules/identity-access.md` (AUTH-10, AUTH-15..17) |
| Phân công theo nơi | `/school/staff/assignments` | Chọn campus → PHT, bếp, lớp và giáo viên đang phân công; ô trống ghi “Chưa có phân công”; thêm/kết thúc dùng endpoint phân công hiện có. Roster BE mới đang chờ triển khai | `STAFF_ASSIGNMENT_MANAGE` | `BE:docs/modules/school-structure.md` (AUTH-16) |
| Phân quyền | `/school/roles` | Tab riêng; ma trận toàn bộ catalog, cột PHT/GV; chỉ ô BE cho cấu hình có công tắc. Lưu hỏi lý do | `PERMISSION_MANAGE` | như trên (AUTH-10, AUTH-11, AUTH-14) |
| Lịch sử thay đổi | `/school/roles/history[?userId=]` | Ai đổi gì, khi nào, lý do | `PERMISSION_MANAGE` | như trên |
| Thêm nhân sự | Modal ở `/school/staff`; deep link `/school/staff/new` | Tạo kèm nơi làm việc; mở sẵn campus/lớp nếu bắt đầu từ roster | `ACCOUNT_MANAGE` | như trên |
| Tài khoản phụ huynh | `/children/activation` | Chọn điểm trường → cột lớp (tiến độ "có tài khoản" từng lớp) → danh sách bé (chưa có tài khoản lên đầu; dải "Cần xử lý" gom bé chưa có tài khoản) → panel trượt của bé: xem/thêm (SĐT)/gỡ phụ huynh, khóa/mở, cấp mật khẩu mới kèm phiếu in (không SMS). Chưa có: số "đã in phiếu", "đã đăng nhập", in phiếu cả lớp (chờ API BE) | `PARENT_ACCOUNT_MANAGE` | `BE:docs/modules/child.md` (AUTH-18, AUTH-19) |

Route guard: `PermissionGuard` (`src/routes/PermissionGuard.jsx`) theo `permissions` của `/accounts/me`; menu khu Con người và tab chỉ là UX, BE vẫn kiểm quyền/phạm vi. Contract: `BE:docs/contracts/AUTH_CONTRACT.md` mục "Phân quyền cấu hình được". Route cũ `/school/roles/users[/:userId]` và `/school/roles/:role` chuyển hướng về Nhân sự / Phân quyền. Màn mock cũ "Phân công PHT" (`/school/vice-principals`) và "Phân công giáo viên" (`/school/teachers`) theo năm học chưa nối API; menu chính chuyển về Phân công theo nơi.

## System Admin (kỹ thuật)

| Screen group | Hành động chính | Permission (BE) | BE card |
| --- | --- | --- | --- |
| Tài khoản Hiệu trưởng, khóa/mở | Tạo tài khoản PRINCIPAL, khóa/mở | `ACCOUNT_MANAGE`, `ACCOUNT_STATUS_MANAGE` | `BE:docs/modules/identity-access.md` |
| Campus / lớp / năm học | Cấu trúc trường (2 campus) | `admin:accounts` | `BE:docs/modules/school-structure.md` |
| Cấu hình hệ thống | Tham số cấu hình (vd. cut-off khi đã chốt), tiêu chí quan sát (data) | PENDING (permission riêng chưa định nghĩa) | nhiều card |

Admin và dữ liệu trẻ: AUTH-06 (PENDING P-16).

## Principal / Vice Principal (Ban giám hiệu)

| Screen group | Hành động chính | Permission (BE) | BE card | Ghi chú |
| --- | --- | --- | --- | --- |
| Dashboard báo cáo | Xem theo lớp / campus / toàn trường | `report:view` | `BE:docs/modules/reporting.md` | Scope: AUTH-02, AUTH-08 |
| Duyệt thực đơn | Xem MealPlan (thực đơn) DRAFT (kể cả AI gợi ý), duyệt | `menu:approve` | `BE:docs/modules/nutrition.md` | Gán role: cấu hình |
| Luồng dinh dưỡng (PHT) | Quy trình `/menu/flow` → Thiết lập → Thực phẩm `/menu/foods` → Món ăn `/menu/dishes` → Thực đơn mẫu `/menu/menus` → Thực đơn tuần `/menu/weekly` → Dự trù & đi chợ theo tuần `/kitchen/forecast` | chưa có (mock) | `BE:docs/modules/nutrition.md` | Đang làm theo `docs/plans/completed/2026-10-14-nutrition-flow-redesign.md`; màn cũ gỡ dần khi màn thay thế xong |
| Bếp & kho (HT, PHT, Bếp theo cơ sở) | Quy trình hôm nay `/kitchen` · Kiểm nhận hàng tươi `/kitchen/fresh-receipts` (Bếp kiểm, PHT xác nhận) · Phiếu xuất kho `/kitchen/stock-issues` (tự sinh khi chốt suất cả ngày, chỉ xem) · Sổ lưu mẫu `/kitchen/food-samples` (Bếp ghi) · Kho khô `/kitchen/dry-stock`, Kiểm kê `/kitchen/stock-counts`, Phiếu nhập `/kitchen/stock-receipts/new` (HT, PHT) | chưa có (mock, endpoint PROPOSED) | `BE:docs/modules/nutrition.md` | Theo `docs/plans/active/2026-10-16-kitchen-warehouse-flow.md` (khảo sát 18/10/2026); route cũ `required-quantity`, `ingredient-receipts`, `missing-food`, `stock-receipts` chuyển hướng |
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

## Auth routes đã có source2026-10-12

/login, /forgot-password, /verify-otp, /reset-password và /account/password (protected). /account/profile đọc /accounts/me cho auth thật, readonly. Existing layout/route preserved; RoleGuard dùng actual BEroles; ADMIN/PARENT/unsupported khôngmap sangrole khác. UI mockTEAM_LEADER không là permission thật. Contract/code/test trạng thái tại docs/integration/AUTH_FLOW.md; các bảng thiết kế phía trên không chứng minh mọi màn đã có API.
