# Current State — CareNest_FE

Cập nhật: 2026-10-20 (bảng screen group theo source; mọi màn chạy trên mock, chưa nối BE thật). Cập nhật file này khi một screen group bắt đầu có code hoặc hoàn thành.

## Cập nhật phạm vi 2026-10-19

Phase 2 đã nhận UI phân quyền G94-209: ba tab, wizard và lịch sử; user chọn lưu demo riêng, không áp vào quyền thật hoặc nguồn assignment. Entry `/school/roles` giữ sidebar cũ. Xem [feature và giới hạn](../features/permission-center-demo.md). Phase 3 phụ huynh/hồ sơ trẻ vẫn chưa bắt đầu.

Source thực tế hiện có React/JS, router, mock và build; mô tả baseline 2026-10-04 bên dưới là lịch sử, không phải trạng thái source hiện tại. Không thay stack/auth trong đợt ghép này. Phase 1 dinh dưỡng/bếp và Phase 2 UI phân quyền demo độc lập đã ghép vào working tree, giữ attendance/sức khỏe/suất ăn, login/sidebar và phân công. Phase 3 phụ huynh/hồ sơ trẻ chưa bắt đầu. Chưa commit/push; xem [plan, cổng kiểm tra và giới hạn](../plans/active/2026-10-18-selective-nutrition-permission-merge.md). Các endpoint dinh dưỡng mới vẫn PROPOSED; màn quyền non-mock trả 501, không chứng minh BE đã tích hợp.

## Tổng quan baseline 2026-10-04 (lịch sử)

- **Chưa có source code** (`src/`, `package.json` chưa tồn tại). Chỉ có lớp AI-context + docs.
- Framework, router, state/cache, UI kit, auth flow: chưa chốt (PROPOSED: React + TypeScript, Next.js) ⇒ hỏi trước khi chọn; docs SKELETON không dùng làm nguồn.
- Màn hình có actor PENDING (xác nhận suất P-05, nhập đo sức khỏe) ⇒ ẩn/hiện theo permission BE, không hard-code role.
- BE: đã scaffold Spring Boot với response chuẩn `{code, desc, data}`; trạng thái module BE xem `BE:docs/context/CURRENT_STATE.md`.

## Screen group

Status: `—` chưa bắt đầu · `đang làm` · `xong`. Định nghĩa group: `docs/architecture/ROUTE_MAP.md`.

| Screen group                               | Actor                                         | Module BE                         | Status        |
| ------------------------------------------ | --------------------------------------------- | --------------------------------- | ------------- |
| Đăng nhập / phiên                          | Tất cả                                        | identity-access                   | UI mock (`pages/auth`) |
| Quản trị tài khoản, role, phân công        | System Admin                                  | identity-access, school-structure | UI mock (`school-config`, `account`, `permissions`) |
| Cấu trúc trường: campus, lớp, năm học      | System Admin                                  | school-structure                  | UI mock (`school-config`) |
| Cấu hình hệ thống / master data            | System Admin                                  | nhiều                             | một phần (`school-config`, `menu-planning`) |
| Hồ sơ trẻ / ghi danh                       | System Admin (màn hình Web chưa xác định)     | child                             | UI mock (`children`) |
| Dashboard báo cáo lớp/campus/trường        | Principal, Vice Principal                     | reporting                         | UI mock (`dashboard`) |
| Xác nhận số suất ăn                        | PENDING (P-05)                                | nutrition                         | UI mock (`attendance`, `kitchen`) |
| Xuất bản thực đơn tuần (BA: PHT công bố)   | Vice Principal (lệch NUT-08, xem features/nutrition-inventory.md) | nutrition                         | UI mock (`menu-planning`) |
| Xem summary / hồ sơ phát triển             | Principal, Vice Principal                     | learning-observation              | UI mock (`assessment`) |
| Tổng quan sức khỏe                         | Principal, Vice Principal                     | health                            | UI mock (`children`, `attendance`) |
| Theo dõi sự cố CSVC                        | Principal, Vice Principal                     | facility-issue                    | UI mock, ẩn (`FACILITY_ENABLED=false`) |
| Báo nghỉ của campus (chỉ xem, không duyệt) | Principal, Vice Principal                     | attendance                        | hiển thị trong điểm danh |
| Điểm danh + báo ăn                         | Teacher                                       | attendance                        | UI mock (`attendance`) |
| Quan sát hằng ngày                         | Teacher                                       | learning-observation              | UI mock (`assessment`) |
| Review/duyệt summary                       | Teacher                                       | learning-observation              | UI mock (`assessment`) |
| Nhập đo sức khỏe                           | PENDING (người nhập)                          | health                            | UI mock (`children`) |
| Báo sự cố CSVC                             | Teacher                                       | facility-issue                    | UI mock, ẩn (`FACILITY_ENABLED=false`) |
| Báo nghỉ của lớp (chỉ xem, không duyệt)    | Teacher                                       | attendance                        | hiển thị trong điểm danh |

## Quyết định đang chờ ảnh hưởng FE

| Chủ đề                                 | Status               | Nguồn                                                                 |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Framework/router/state/UI kit          | Đã chốt theo source (2026-10-20) | `docs/architecture/FRONTEND_ARCHITECTURE.md`                          |
| Auth flow, lưu token                   | chưa chốt            | `docs/integration/AUTH_FLOW.md`, `BE:docs/contracts/AUTH_CONTRACT.md` |
| Actor xác nhận suất ăn                 | PENDING P-05         | `BE:docs/business/BUSINESS_RULES.md`                                  |
| Người nhập đo sức khỏe                 | PENDING              | `BE:docs/modules/health.md`                                           |
| Ngữ cảnh hoạt động                     | OPEN (ADR-0006)      | `BE:docs/decisions/`                                                  |
| Màn hình hồ sơ trẻ / ghi danh trên Web | chưa xác định        | `docs/features/README.md`                                             |

Đã chốt gần đây: báo nghỉ = thông báo của phụ huynh qua app, **không có bước duyệt**; GV/BGH trong scope chỉ xem (ATT-05, đóng 2026-10-02 — `BE:docs/business/flows/leave-request.md`).
