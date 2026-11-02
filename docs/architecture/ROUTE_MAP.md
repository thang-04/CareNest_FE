# Route Map — Role → screen group

Mức chi tiết: **screen group** (chưa có route/URL thật — chưa có source, router chưa chốt). Khi implement, thêm cột route thực tế cho group đó. Không chép rule nghiệp vụ vào đây — cột "BE card" là nơi đọc rule.

Nguyên tắc:

- Menu/route hiển thị theo **permission BE trả về** cho user hiện tại, không hard-code theo tên role. Gán permission → role là cấu hình ở BE (`BE:docs/business/USER_ROLES.md`).
- Route guard ở client chỉ là UX; BE vẫn trả 401/403/404 — màn hình phải xử lý (AUTH-07).
- Phạm vi dữ liệu (campus/lớp) do BE áp: AUTH-02, AUTH-03, AUTH-08.
- **actor PENDING** = người thực hiện chưa chốt ⇒ hiển thị theo permission, không giả định role.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Ẩn menu/route theo mã quyền BE (2026-11-01)

- `hasBePermission(user, ...codes)` (`src/utils/account/accountPermissions.js`) đọc `user.bePermissions` từ `/accounts/me`; chế độ mock không có dữ liệu này ⇒ không lọc thêm, menu theo vai trò như cũ.
- Mục menu gắn mã quyền (`ITEM_BE_PERMISSIONS` trong `src/layouts/menuConfig.js`): `parentActivation` → `PARENT_ACCOUNT_MANAGE`, `schoolRoles` → `PERMISSION_MANAGE`. Bị thu hồi quyền ⇒ đăng nhập lại không thấy mục; mở thẳng đường dẫn ⇒ 403 chuẩn.
- `/children/activation` (Tài khoản phụ huynh): Hiệu trưởng và Phó hiệu trưởng có `PARENT_ACCOUNT_MANAGE` (AUTH-18); Hiệu trưởng có mục menu trong nhóm Trẻ.

## Route thực tế bổ sung — ghép chọn lọc 2026-10-19

User chốt ngoại lệ sidebar nhóm Thực đơn sau Phase 2: menu PHT mở trực tiếp `/menu/flow` và `/menu/setup`, rồi foods/dishes/menus/weekly theo thứ tự nguồn. Principal có setup/weekly theo guard cũ. Không đổi nhóm khác hoặc logic giới hạn mảng phụ trách của PHT. Các route legacy còn nguyên, không xóa màn khi bỏ mục sidebar trùng chức năng.

Phase 2: entry/sidebar `/school/roles` giữ nguyên nhưng mở UI G94-209 mới; thêm `/permissions` (alias), `/permissions/overrides`, `/permissions/history`, đều Principal-only như guard hiện tại. URL role form cũ chuyển về màn mới. Không nhận menu Nhân sự/roster. Quyền mới chỉ lưu demo độc lập theo lựa chọn user; không thay quyền/scope đang chạy. Chi tiết [permission-center-demo](../features/permission-center-demo.md).

Phase 1 giữ sidebar và đường vào hiện có; không nhận gateway auth. `/menu/weekly`, `/menu/flow`, `/menu/setup` mở màn tuần, quy trình và thiết lập dinh dưỡng mới. Các URL danh sách/chi tiết thực đơn cũ vẫn được ánh xạ; `:id` chi tiết chuyển thành query `id`.

`/kitchen` là quy trình bếp, đi từ breadcrumb Bếp & kho thực phẩm; có liên kết kho khô. Các route mới `/kitchen/dry-stock`, `/kitchen/food-samples`, `/kitchen/forecast`, `/kitchen/fresh-receipts` sử dụng guard client trong AppRoutes; không chứng minh quyền BE. Màn số suất vẫn đọc attendance từng bữa, không thay điểm danh/chốt suất. UI phân quyền G94-209 chưa ghép ở Phase 1. Xem [plan và kết quả kiểm tra](../plans/active/2026-10-18-selective-nutrition-permission-merge.md).

Nhà cung cấp (BA 01, GĐ2 [plan](../plans/active/2026-10-20-nutrition-ba-master-data.md)): `/kitchen/suppliers`, `/kitchen/suppliers/:id` cho HT + PHT (PHT chỉ xem); `/kitchen/suppliers/new`, `/kitchen/suppliers/:id/edit` chỉ HT. Sidebar HT nhóm "Danh mục thực phẩm", PHT nhóm "Kho thực phẩm" (nhóm Danh mục của PHT ẩn khi PHT không có mảng thực đơn). Guard client, mock; BE chưa có contract (NUT-12 CONFIRMED, đóng P-09). Lệch BE (28/10): BE giao danh mục NCC cho PHT mảng dinh dưỡng (`BE:docs/business/USER_ROLES.md`), trường NCC theo NUT-12 — cần sửa UI khi tích hợp.

Lệch BE (28/10) ở các route bếp/suất ăn trên — cần sửa UI khi tích hợp: bếp chỉ dùng App (AUTH-21) nên guard Web cho `KITCHEN_STAFF` (`/kitchen/*`, `/attendance/meal-count`, `/attendance/meal-handover`) không còn đúng; `/kitchen/preparation` (+ `/update`) và `/attendance/meal-handover` thuộc NUT-14/NUT-15 đã `REMOVED`; `/kitchen/stock-issues` (phiếu xuất, bếp chọn lô) thay bằng trừ dự kiến + điều chỉnh (NUT-11); `/kitchen/fresh-receipts` do PHT ghi kiểm nhận 2 lần (NUT-12); `/kitchen/forecast` ngoài phạm vi ADR-0009; ảnh mẫu, sổ lưu mẫu làm trên App (NUT-16, NUT-21); `/kitchen/missing-food`: thiếu nguyên liệu báo ngoài hệ thống (NUT-22).

## System Admin

| Screen group           | Hành động chính                                                      | Permission (BE)                            | BE card                               |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Tài khoản              | Tạo/khóa tài khoản, gán role                                         | `admin:accounts`                           | `BE:docs/modules/identity-access.md`  |
| Role & permission      | Xem/gán permission cho role                                          | `admin:accounts`                           | `BE:docs/modules/identity-access.md`  |
| Phân công nhân sự      | StaffAssignment: HT→trường, HP→campus, GV→lớp                        | `admin:accounts`                           | `BE:docs/modules/school-structure.md` |
| Campus / lớp / năm học | Cấu trúc trường (2 campus)                                           | `admin:accounts`                           | `BE:docs/modules/school-structure.md` |
| Cấu hình hệ thống      | Tham số cấu hình kỹ thuật, tiêu chí quan sát (data); giờ chốt do HT cấu hình (ATT-06), không thuộc Admin | PENDING (permission riêng chưa định nghĩa) | nhiều card                            |

Admin và dữ liệu trẻ: AUTH-06 (PENDING P-16).

## Principal / Vice Principal (Ban giám hiệu)

| Screen group               | Hành động chính                                                                                          | Permission (BE)                                        | BE card                                   | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard báo cáo          | Xem theo lớp / campus / toàn trường; báo cáo ngày (RPT-01), báo cáo định kỳ xuất Excel + PDF (RPT-03) | `report:view` | `BE:docs/modules/reporting.md` | Scope: AUTH-02, AUTH-08; tổng kết năm học P-34 |
| Xuất bản thực đơn tuần     | PHT mảng dinh dưỡng xem MealPlan DRAFT (kể cả AI gợi ý), công bố thẳng; công bố = duyệt, không cần HT (NUT-08). Còn lệch: sửa sau công bố, chặn khi chưa cân đối (`docs/features/nutrition-inventory.md`) | `menu:approve`                                         | `BE:docs/modules/nutrition.md`            | Gán role: cấu hình                                                                                                                                                                                                                                                                                                                                                                                                               |
| Xác nhận số suất ăn        | Xem số suất theo ngày, xác nhận                                                                          | `meal-count:confirm`                                   | `BE:docs/modules/nutrition.md`            | NUT-02 (đóng P-05): PHT đang phân công tại cơ sở, HT thay khi PHT vắng; số sai trả GV qua mở lại điểm danh (ATT-08). Lệch BE (28/10): mock chỉ cho VP xác nhận, sửa sau khóa không cần xác nhận lại (NUT-03) — cần sửa UI khi tích hợp |
| Nhận xét định kỳ & hồ sơ phát triển | Xem nhận xét GV đã xác nhận (không có bước BGH duyệt — OBS-05), hồ sơ phát triển trẻ (OBS-03) | `report:view` (PROPOSED) | `BE:docs/modules/learning-observation.md` | |
| Tổng quan sức khỏe         | Xem cân đo, trend, phân loại WHO (HLT-03, HLT-10), duyệt diễn giải AI; trẻ ốm/bất thường theo lớp (HLT-14, RPT-01) | `health-interpretation:approve` (duyệt) | `BE:docs/modules/health.md` | Không hiển thị nhãn chẩn đoán |
| Đợt khám sức khỏe          | Principal: tạo theo điểm trường, sửa, hủy, đóng, mở lại · VP: xem tiến độ, danh sách theo dõi của campus | `health-check:manage` / `health-check:view` (PROPOSED) | `BE:docs/modules/health.md`               | Route: `/children/health-checks`, `/children/health-checks/new`, `/children/health-checks/:campaignId` (+ `/edit`), phiếu khám Phụ lục II `/children/health-checks/:campaignId/exam/:childId` (`?classId=` để khám trẻ tiếp theo). User chốt 2026-10-15, 2026-10-17, chờ BE; plan `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md`, `docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md` Lệch BE (29/10): BE chỉ có HLT-08 (bác sĩ khám 2 lần/năm), nội dung phiếu khám chưa có rule; mức theo dõi, phiếu theo dõi trái HLT-12 (chỉ đánh dấu). |
| ~~Sự cố CSVC~~            | Màn ẩn (`FACILITY_ENABLED=false`) | — | — | BE FAC REMOVED 29/10 |
| Báo nghỉ của campus        | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**)                                                 | theo scope (không có permission duyệt)                 | `BE:docs/modules/attendance.md`           | ATT-05; flow `BE:docs/business/flows/leave-request.md`                                                                                                                                                                                                                                                                                                                                                                           |
| Kế hoạch giáo dục          | Mục tiêu năm học theo nhóm tuổi: Phó HT hoặc Tổ trưởng nhóm tuổi soạn, Tổ trưởng gửi, Phó HT ban hành/trả lại (EDU-02..05); phiên bản (EDU-25); chủ đề Thứ 2 → Thứ 6, không trùng (EDU-39, EDU-40); HT xem toàn trường; cấu hình lĩnh vực, chuỗi người ký, dòng hoạt động (EDU-11) | `goals.view` · `goals.edit` · `goals.approve` · `plans.config` — gán theo role (EDU-08) | `BE:docs/modules/education-plan.md` | `/education/goals`, `/education/school`, `/education/settings`, `/education/curriculum-sources`; gọi BE thật khi `VITE_USE_MOCK=false` |
| Khen thưởng cuối năm       | PHT xét, HT duyệt đề xuất của GV (OBS-14) | `reward:approve` (PROPOSED) | `BE:docs/modules/learning-observation.md` | P-31 |
| Thông báo của trường       | BGH gửi, push + trong App, không theo dõi đã đọc (PAR-05) | `notification:send` (PROPOSED) | `BE:docs/modules/notification.md` | |

## Teacher

| Screen group         | Hành động chính                                          | Permission (BE)                        | BE card                                   | Ghi chú                                         |
| -------------------- | -------------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Điểm danh + báo ăn   | Nhập theo lớp/ngày (batch); có mặt là ăn đủ bữa, không nhập tham gia ăn riêng (ATT-02); đo nhiệt độ đầu ngày cùng màn (HLT-07) | `attendance:record`                    | `BE:docs/modules/attendance.md`           | Cut-off ATT-06 (đóng P-03); đến muộn sau giờ chốt không nhận (ATT-03); sửa sau giờ chốt chỉ khi PHT mở lại (ATT-08) |
| Đánh giá hằng ngày   | Mọi trẻ có mặt, mặc định bình thường; 7 mặt, 3 mức (OBS-01, OBS-02); kiến thức–kỹ năng theo mục tiêu kế hoạch ngày (OBS-07); khóa hết ngày (OBS-12) | `observation:record` | `BE:docs/modules/learning-observation.md` | Tiêu chí P-11; lệch BE: `docs/features/daily-assessment.md` |
| Nhận xét định kỳ     | Sửa nháp (mẫu nền hoặc AI), GV xác nhận là xong (OBS-05); kỳ tuần/tháng/học kỳ/năm (OBS-06) | `summary:confirm` (PROPOSED) | `BE:docs/modules/learning-observation.md` | Mẫu của trường P-30 |
| ~~Báo sự cố CSVC~~   | Màn ẩn (`FACILITY_ENABLED=false`) | — | — | BE FAC REMOVED 29/10 |
| Báo nghỉ của lớp     | Xem báo nghỉ phụ huynh đã gửi (chỉ xem, **không duyệt**) | theo scope (không có permission duyệt) | `BE:docs/modules/attendance.md`           | ATT-04, ATT-05; GV **không** tạo thay phụ huynh (ATT-05); trẻ có đơn vẫn đến lớp: P-20 |
| Đón trẻ              | Chọn trẻ ⇒ danh sách phụ huynh; người lạ thì gọi phụ huynh, ghi lý do; lưu người đón, giờ đón, về sớm (PCK-02, PCK-04) | `pickup:confirm` (PROPOSED) | `BE:docs/modules/attendance.md` | Flow flow pickup của BE (chưa merge nhánh chính BE); ảnh đối chiếu P-33 |
| Kế hoạch giáo dục lớp | GV soạn chủ đề nhánh, kế hoạch chủ đề, giáo án tuần/ngày (EDU-12..16); hồ sơ chủ đề gửi một lần (EDU-17); duyệt theo chuỗi người ký, bỏ bước Tổ trưởng khi không có hoặc dạy chính lớp đó (EDU-18); ô điều chỉnh kế hoạch ngày (EDU-27); ngày nghỉ lẻ hiện "Nghỉ", tuần vẫn soạn (EDU-41) | `goals.*` theo role (EDU-08) | `BE:docs/modules/education-plan.md` | `/education/class/:classId/...`, `/education/branches/:classId`, `/education/plan-reviews` |
| Sức khỏe trong ngày, cân đo | Ghi triệu chứng, xử trí (HLT-14); cân đo lớp mình, công bố (HLT-09, HLT-11) | `health:record`, `health:publish` (PROPOSED) | `BE:docs/modules/health.md` | `docs/features/daily-reception.md` |
| Phiếu bé ngoan, đề xuất khen | Cắm cờ, tự chọn trẻ nhận phiếu (OBS-10); đề xuất khen cuối năm (OBS-14) | `observation:record` | `BE:docs/modules/learning-observation.md` | P-31 |

## Phiếu khám, cân đo (actor chốt 29/10: GV — HLT-09)

| Screen group        | Hành động chính                                                                                                | Permission (BE)                                       | BE card                        | Ghi chú                                                                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhập đo sức khỏe    | Phiếu khám trong đợt (Phụ lục II, kết luận bác sĩ); cân đo ngoài đợt (không kết luận); cập nhật phiếu theo dõi | `health:record`, `health-follow-up:update` (PROPOSED) | `BE:docs/modules/health.md`    | Người nhập: GV (BE HLT-09, chốt 29/10). Phiếu khám, phiếu theo dõi lệch HLT-10, HLT-12 (`docs/context/CURRENT_STATE.md`). Route: `/children/:id/health/new` (cân đo ngoài đợt, từ 2026-10-17 không nhận `campaignId`), `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId` |

## Chung

| Screen group                      | Ghi chú                                                |
| --------------------------------- | ------------------------------------------------------ |
| Đăng nhập / đăng xuất / hết phiên | `docs/integration/AUTH_FLOW.md` (SKELETON)             |
| Thông báo trong app (nếu có)      | `BE:docs/modules/notification.md` — kênh Web chưa chốt |
| Trang lỗi 403 / 404 / mất kết nối | Dùng chung mọi group                                   |

## Không có trên Web (mặc định)

Parent (thuộc APP; gửi báo nghỉ qua app) · Kitchen: chỉ App, gateway Web từ chối (AUTH-21, `BE:docs/business/USER_ROLES.md`) · CSVC: sự cố, tài sản (BE FAC REMOVED 29/10; code ẩn) · kho/NCC thật (BE ADR-0009 ACCEPTED 28/10, chưa có API; UI mock theo BA, xem `docs/features/nutrition-inventory.md`) · kiểm kê kho thực phẩm (BA: không làm, gỡ 2026-10-20; BE NUT-11 cũng không).
