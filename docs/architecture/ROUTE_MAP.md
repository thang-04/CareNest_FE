# Route Map — Role → screen group

Mức chi tiết: **screen group** (chưa có route/URL thật — chưa có source, router chưa chốt). Khi implement, thêm cột route thực tế cho group đó. Không chép rule nghiệp vụ vào đây — cột "BE card" là nơi đọc rule.

Nguyên tắc:

- Menu/route hiển thị theo **permission BE trả về** cho user hiện tại, không hard-code theo tên role. Gán permission → role là cấu hình ở BE (`BE:docs/business/USER_ROLES.md`).
- Route guard ở client chỉ là UX; BE vẫn trả 401/403/404 — màn hình phải xử lý (AUTH-07).
- Phạm vi dữ liệu (campus/lớp) do BE áp: AUTH-02, AUTH-03, AUTH-08.
- **actor PENDING** = người thực hiện chưa chốt ⇒ hiển thị theo permission, không giả định role.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Route thực tế bổ sung — ghép chọn lọc 2026-10-19

User chốt ngoại lệ sidebar nhóm Thực đơn sau Phase 2: menu PHT mở trực tiếp `/menu/flow` và `/menu/setup`, rồi foods/dishes/menus/weekly theo thứ tự nguồn. Principal có setup/weekly theo guard cũ. Không đổi nhóm khác hoặc logic giới hạn mảng phụ trách của PHT. Các route legacy còn nguyên, không xóa màn khi bỏ mục sidebar trùng chức năng.

Phase 2: entry/sidebar `/school/roles` giữ nguyên nhưng mở UI G94-209 mới; thêm `/permissions` (alias), `/permissions/overrides`, `/permissions/history`, đều Principal-only như guard hiện tại. URL role form cũ chuyển về màn mới. Không nhận menu Nhân sự/roster. Quyền mới chỉ lưu demo độc lập theo lựa chọn user; không thay quyền/scope đang chạy. Chi tiết [permission-center-demo](../features/permission-center-demo.md).

Phase 1 giữ sidebar và đường vào hiện có; không nhận gateway auth. `/menu/weekly`, `/menu/flow`, `/menu/setup` mở màn tuần, quy trình và thiết lập dinh dưỡng mới. Các URL danh sách/chi tiết thực đơn cũ vẫn được ánh xạ; `:id` chi tiết chuyển thành query `id`.

`/kitchen` là quy trình bếp, đi từ breadcrumb Bếp & kho thực phẩm; có liên kết kho khô. Các route mới `/kitchen/dry-stock`, `/kitchen/food-samples`, `/kitchen/forecast`, `/kitchen/fresh-receipts` sử dụng guard client trong AppRoutes; không chứng minh quyền BE. Màn số suất vẫn đọc attendance từng bữa, không thay điểm danh/chốt suất. UI phân quyền G94-209 chưa ghép ở Phase 1. Xem [plan và kết quả kiểm tra](../plans/active/2026-10-18-selective-nutrition-permission-merge.md).

Nhà cung cấp (BA 01, GĐ2 [plan](../plans/active/2026-10-20-nutrition-ba-master-data.md)): `/kitchen/suppliers`, `/kitchen/suppliers/:id` cho HT + PHT (PHT chỉ xem); `/kitchen/suppliers/new`, `/kitchen/suppliers/:id/edit` chỉ HT. Sidebar HT nhóm "Danh mục thực phẩm", PHT nhóm "Kho thực phẩm" (nhóm Danh mục của PHT ẩn khi PHT không có mảng thực đơn). Guard client, mock; BE chưa có contract (NUT-12 PENDING P-09).

## System Admin

| Screen group           | Hành động chính                                                      | Permission (BE)                            | BE card                               |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Tài khoản              | Tạo/khóa tài khoản, gán role                                         | `admin:accounts`                           | `BE:docs/modules/identity-access.md`  |
| Role & permission      | Xem/gán permission cho role                                          | `admin:accounts`                           | `BE:docs/modules/identity-access.md`  |
| Phân công nhân sự      | StaffAssignment: HT→trường, HP→campus, GV→lớp                        | `admin:accounts`                           | `BE:docs/modules/school-structure.md` |
| Campus / lớp / năm học | Cấu trúc trường (2 campus)                                           | `admin:accounts`                           | `BE:docs/modules/school-structure.md` |
| Cấu hình hệ thống      | Tham số cấu hình (vd. cut-off khi đã chốt), tiêu chí quan sát (data) | PENDING (permission riêng chưa định nghĩa) | nhiều card                            |

Admin và dữ liệu trẻ: AUTH-06 (PENDING P-16).

## Principal / Vice Principal (Ban giám hiệu)

| Screen group               | Hành động chính                                                                                          | Permission (BE)                                        | BE card                                   | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard báo cáo          | Xem theo lớp / campus / toàn trường                                                                      | `report:view`                                          | `BE:docs/modules/reporting.md`            | Scope: AUTH-02, AUTH-08                                                                                                                                                                                                                                                                                                                                                                                                          |
| Xuất bản thực đơn tuần     | PHT xem MealPlan DRAFT (kể cả AI gợi ý), công bố thẳng theo BA (lệch NUT-08, `docs/features/nutrition-inventory.md`) | `menu:approve`                                         | `BE:docs/modules/nutrition.md`            | Gán role: cấu hình                                                                                                                                                                                                                                                                                                                                                                                                               |
| Summary & hồ sơ phát triển | Xem summary đã GV duyệt, hồ sơ phát triển trẻ                                                            | `report:view` (PROPOSED)                               | `BE:docs/modules/learning-observation.md` |                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tổng quan sức khỏe         | Xem measurement/trend, duyệt diễn giải AI                                                                | `health-interpretation:approve` (duyệt)                | `BE:docs/modules/health.md`               | Không hiển thị nhãn chẩn đoán                                                                                                                                                                                                                                                                                                                                                                                                    |
| Đợt khám sức khỏe          | Principal: tạo theo điểm trường, sửa, hủy, đóng, mở lại · VP: xem tiến độ, danh sách theo dõi của campus | `health-check:manage` / `health-check:view` (PROPOSED) | `BE:docs/modules/health.md`               | Route: `/children/health-checks`, `/children/health-checks/new`, `/children/health-checks/:campaignId` (+ `/edit`), phiếu khám Phụ lục II `/children/health-checks/:campaignId/exam/:childId` (`?classId=` để khám trẻ tiếp theo). User chốt 2026-10-15, 2026-10-17, chờ BE; plan `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md`, `docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md` |
| Sự cố CSVC                 | Danh sách theo campus/trạng thái, cập nhật trạng thái                                                    | `facility-issue:manage`                                | `BE:docs/modules/facility-issue.md`       | Chỉ sự cố, không tài sản                                                                                                                                                                                                                                                                                                                                                                                                         |
| Báo nghỉ của campus        | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**)                                                 | theo scope (không có permission duyệt)                 | `BE:docs/modules/attendance.md`           | ATT-05; flow `BE:docs/business/flows/leave-request.md`                                                                                                                                                                                                                                                                                                                                                                           |
| Tài khoản phụ huynh `/children/activation` | Kích hoạt tài khoản theo phụ huynh trên hồ sơ trẻ (mật khẩu tạm gửi qua SMS tới SĐT đăng nhập, không in phiếu), cấp lại mật khẩu, khóa/mở, gỡ khỏi bé · Hiệu trưởng toàn trường, Phó hiệu trưởng điểm trường được giao (user chốt 2026-10-23) | PROPOSED (chưa có contract BE, chế độ thật trả 501) | `BE:docs/modules/identity-access.md` |

## Teacher

| Screen group         | Hành động chính                                          | Permission (BE)                        | BE card                                   | Ghi chú                                         |
| -------------------- | -------------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Điểm danh + báo ăn   | Nhập theo lớp/ngày (batch)                               | `attendance:record`                    | `BE:docs/modules/attendance.md`           | Cut-off PENDING P-03                            |
| Quan sát hằng ngày   | Ghi quan sát theo tiêu chí trường cấu hình               | `observation:record`                   | `BE:docs/modules/learning-observation.md` | Tiêu chí là data, không cứng                    |
| Review/duyệt summary | Sửa và duyệt summary DRAFT (template hoặc AI)            | `summary:approve`                      | `BE:docs/modules/learning-observation.md` | Tần suất PENDING P-12                           |
| Báo sự cố CSVC       | Tạo sự cố (loại, mô tả, vị trí, ảnh)                     | `facility-issue:report`                | `BE:docs/modules/facility-issue.md`       |                                                 |
| Báo nghỉ của lớp     | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**) | theo scope (không có permission duyệt) | `BE:docs/modules/attendance.md`           | ATT-04, ATT-05; GV tạo thay phụ huynh: PROPOSED |
| Đón trẻ `/pickup`    | Danh sách chờ đón theo lớp/ngày; mỗi trẻ có "Trả trẻ" (modal so ảnh, khớp thì ghi giờ trả ngay trong modal) và "Gọi phụ huynh" (modal ghi nội dung cuộc gọi; Trả trẻ / Không trả xác nhận rồi ghi ngay trong modal, user chốt 2026-10-24) — user yêu cầu 2026-10-23 | theo vai (Giáo viên, Tổ trưởng) | chưa có (BE chưa có module card đón trẻ) | Chỉ Giáo viên, Tổ trưởng; Hiệu trưởng, Phó hiệu trưởng không xem (user chốt 2026-10-23) |

## Actor PENDING (hiển thị theo permission, không gán role)

| Screen group        | Hành động chính                                                                                                | Permission (BE)                                       | BE card                        | Ghi chú                                                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xác nhận số suất ăn | Xem số suất theo ngày, xác nhận                                                                                | `meal-count:confirm`                                  | `BE:docs/modules/nutrition.md` | NUT-02; actor PENDING P-05                                                                                                                                                                                                                                 |
| Nhập đo sức khỏe    | Phiếu khám trong đợt (Phụ lục II, kết luận bác sĩ); cân đo ngoài đợt (không kết luận); cập nhật phiếu theo dõi | `health:record`, `health-follow-up:update` (PROPOSED) | `BE:docs/modules/health.md`    | Người nhập PENDING ở BE (HLT-01); user chốt GV phụ trách lớp (2026-10-14, PROPOSED). Route: `/children/:id/health/new` (cân đo ngoài đợt, từ 2026-10-17 không nhận `campaignId`), `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId` |

## Chung

| Screen group                      | Ghi chú                                                |
| --------------------------------- | ------------------------------------------------------ |
| Đăng nhập / đăng xuất / hết phiên | `docs/integration/AUTH_FLOW.md` (SKELETON)             |
| Thông báo trong app (nếu có)      | `BE:docs/modules/notification.md` — kênh Web chưa chốt |
| Trang lỗi 403 / 404 / mất kết nối | Dùng chung mọi group                                   |

## Không có trên Web (mặc định)

Parent (thuộc APP; gửi báo nghỉ qua app) · Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`) · tài sản (ngoài V1) · kho/NCC thật (OPEN — BE ADR-0009; UI mock theo BA, xem `docs/features/nutrition-inventory.md`) · kiểm kê kho thực phẩm (BA: không làm, gỡ 2026-10-20).
