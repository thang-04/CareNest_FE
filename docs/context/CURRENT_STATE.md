# Current State — CareNest_FE

Cập nhật: 2026-10-04. Cập nhật file này khi một screen group bắt đầu có code hoặc hoàn thành.

## Tổng quan

- **Chưa có source code** (`src/`, `package.json` chưa tồn tại). Chỉ có lớp AI-context + docs.
- Framework, router, state/cache, UI kit, auth flow: chưa chốt (PROPOSED: React + TypeScript, Next.js) ⇒ hỏi trước khi chọn; docs SKELETON không dùng làm nguồn.
- Màn hình có actor PENDING (xác nhận suất P-05, nhập đo sức khỏe) ⇒ ẩn/hiện theo permission BE, không hard-code role.
- BE: đã scaffold Spring Boot với response chuẩn `{code, desc, data}`; trạng thái module BE xem `BE:docs/context/CURRENT_STATE.md`.

## Screen group

Status: `—` chưa bắt đầu · `đang làm` · `xong`. Định nghĩa group: `docs/architecture/ROUTE_MAP.md`.

| Screen group | Actor | Module BE | Status |
| --- | --- | --- | --- |
| Đăng nhập / phiên | Tất cả | identity-access | — |
| Quản trị tài khoản, role, phân công | System Admin | identity-access, school-structure | — |
| Cấu trúc trường: campus, lớp, năm học | System Admin | school-structure | — |
| Cấu hình hệ thống / master data | System Admin | nhiều | — |
| Hồ sơ trẻ / ghi danh | System Admin (màn hình Web chưa xác định) | child | chưa xác định |
| Dashboard báo cáo lớp/campus/trường | Principal, Vice Principal | reporting | — |
| Xác nhận số suất ăn | PENDING (P-05) | nutrition | — |
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
