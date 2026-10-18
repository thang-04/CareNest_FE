# Current State — CareNest_FE

Cập nhật: 2026-10-18. Cập nhật file này khi một screen group bắt đầu có code hoặc hoàn thành.

## Tổng quan

- Source hiện có: React18/JSX, Vite8, ReactRouter7, Axios và ReactContext (đọc package.json/src). Auth integration2026-10-12: code/test/build đã kiểm chứng, browserUI pending; xem docs/quality/reports/2026-10-12-react-auth-integration.md.
- Task auth không đổi framework/toolchain/dependency. Gateway/auth modes theo docs/integration/AUTH_FLOW.md; business scopes chưa có API giữ rõ mock/planned, không suy luận từ UI.
- Màn hình có actor PENDING (xác nhận suất P-05, nhập đo sức khỏe) ⇒ ẩn/hiện theo permission BE, không hard-code role.
- BE: đã scaffold Spring Boot với response chuẩn `{code, desc, data}`; trạng thái module BE xem `BE:docs/context/CURRENT_STATE.md`.

## Screen group

Status: `—` chưa bắt đầu · `đang làm` · `xong`. Định nghĩa group: `docs/architecture/ROUTE_MAP.md`.

| Screen group | Actor | Module BE | Status |
| --- | --- | --- | --- |
| Đăng nhập / phiên | Tất cả | identity-access | Code+40 tests+HTTP9/9; browserUI pending |
| Khu Con người (`/people`): bốn tab Nhân sự / Phân quyền / Phụ huynh / Trẻ; tab Phân quyền là ma trận full catalog PHT/GV; tạo nhân sự bằng modal; roster theo nơi (`/school/staff/assignments`) | Principal; PHT theo quyền (AUTH-08, AUTH-10..19) | identity-access, school-structure, child | FE + mock đã kiểm; full verify pass. API thật gated bởi `VITE_PEOPLE_CONTRACT_READY=false`; `staffOnly` và roster mới chưa có trên BE. |
| Tài khoản phụ huynh gắn trẻ: SĐT, mật khẩu tạm hệ thống sinh + phiếu in, gỡ liên kết, khóa/mở (`/children/activation`) | Principal / PHT theo quyền (AUTH-18, AUTH-19) | identity-access, child | Code + mock + 4 test (`tests/auth/guardians.test.mjs`); chưa thử với BE thật. Đã gỡ mock kích hoạt/SMS cũ; hồ sơ trẻ chỉ giữ thông tin liên lạc phụ huynh |
| Cấu trúc trường: campus, lớp, năm học | System Admin | school-structure | — |
| Cấu hình hệ thống / master data | System Admin | nhiều | — |
| Hồ sơ trẻ / ghi danh | System Admin (màn hình Web chưa xác định) | child | chưa xác định |
| Dashboard báo cáo lớp/campus/trường | Principal, Vice Principal | reporting | — |
| Xác nhận số suất ăn (chốt cả ngày một lần) | PHT cơ sở, HT thay (khảo sát 18/10/2026; BE P-05 chưa đóng) | attendance, nutrition | Code + mock + test (`tests/kitchen/stock-issue.test.mjs`) |
| Bếp & kho: dự trù tuần, kiểm nhận hàng tươi, xuất kho tự động, sổ lưu mẫu, kho khô, kiểm kê | HT, PHT, Bếp theo cơ sở | nutrition | Code + mock + test (`tests/kitchen/*.test.mjs`); endpoint PROPOSED, BE chưa có module |
| Duyệt thực đơn | Principal/VP (theo permission `menu:approve`) | nutrition | — |
| Xem summary / hồ sơ phát triển | Principal, Vice Principal | learning-observation | — |
| Tổng quan sức khỏe | Principal, Vice Principal | health | — |
| Theo dõi sự cố CSVC | Principal, Vice Principal | facility-issue | — |
| Báo nghỉ của campus (chỉ xem, không duyệt) | Principal, Vice Principal | attendance | — |
| Điểm danh + báo ăn | Teacher | attendance | — |
| Quan sát hằng ngày | Teacher | learning-observation | — |
| Review/duyệt summary | Teacher | learning-observation | — |
| Nhập đo sức khỏe | PENDING (người nhập) | health | — |
| Báo sự cố CSVC | Teacher | facility-issue | — |
| Báo nghỉ của lớp (chỉ xem, không duyệt) | Teacher | attendance | — |

## Quyết định đang chờ ảnh hưởng FE

| Chủ đề | Status | Nguồn |
| --- | --- | --- |
| Framework/router/state/UI kit | PROPOSED / chưa chốt | `docs/architecture/FRONTEND_ARCHITECTURE.md` |
| Auth flow, lưu token | chưa chốt | `docs/integration/AUTH_FLOW.md`, `BE:docs/contracts/AUTH_CONTRACT.md` |
| Actor xác nhận suất ăn | PENDING P-05 | `BE:docs/business/BUSINESS_RULES.md` |
| Người nhập đo sức khỏe | PENDING | `BE:docs/modules/health.md` |
| Ngữ cảnh hoạt động | OPEN (ADR-0006) | `BE:docs/decisions/` |
| Màn hình hồ sơ trẻ / ghi danh trên Web | chưa xác định | `docs/features/README.md` |

Đã chốt gần đây: báo nghỉ = thông báo của phụ huynh qua app, **không có bước duyệt**; GV/BGH trong scope chỉ xem (ATT-05, đóng 2026-10-02 — `BE:docs/business/flows/leave-request.md`).
