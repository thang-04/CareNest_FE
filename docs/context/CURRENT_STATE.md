# Current State — CareNest_FE

Cập nhật: 2026-10-03. Cập nhật file này khi một screen group bắt đầu có code hoặc hoàn thành.

## Tổng quan

- **Chưa có source code** (`src/`, `package.json` chưa tồn tại). Chỉ có lớp AI-context + docs.
- Framework, router, state/cache, UI kit, auth flow: chưa chốt (PROPOSED: React + TypeScript, Next.js).
- BE: đã scaffold Spring Boot với response chuẩn `{code, desc, data}`; trạng thái module BE xem `../CareNest_BE/docs/context/CURRENT_STATE.md`.

## Screen group

Status: `—` chưa bắt đầu · `đang làm` · `xong`. Định nghĩa group: `docs/architecture/ROUTE_MAP.md`.

| Screen group | Actor | Module BE | Status |
| --- | --- | --- | --- |
| Đăng nhập / phiên | Tất cả | identity-access | — |
| Quản trị tài khoản, role, phân công | System Admin | identity-access, school-structure | — |
| Cấu trúc trường: campus, lớp, năm học | System Admin | school-structure | — |
| Cấu hình hệ thống / master data | System Admin | nhiều | — |
| Dashboard báo cáo lớp/campus/trường | Principal, Vice Principal | reporting | — |
| Xác nhận số suất ăn | PENDING (P-05) | nutrition | — |
| Duyệt thực đơn | Principal/VP (theo permission `menu:approve`) | nutrition | — |
| Xem summary / hồ sơ phát triển | Principal, Vice Principal | learning-observation | — |
| Tổng quan sức khỏe | Principal, Vice Principal | health | — |
| Theo dõi sự cố CSVC | Principal, Vice Principal | facility-issue | — |
| Điểm danh + báo ăn | Teacher | attendance | — |
| Quan sát hằng ngày | Teacher | learning-observation | — |
| Review/duyệt summary | Teacher | learning-observation | — |
| Nhập đo sức khỏe | PENDING (người nhập) | health | — |
| Báo sự cố CSVC | Teacher | facility-issue | — |

## Quyết định đang chờ ảnh hưởng FE

| Chủ đề | Status | Nguồn |
| --- | --- | --- |
| Framework/router/state/UI kit | PROPOSED / chưa chốt | `docs/architecture/FRONTEND_ARCHITECTURE.md` |
| Auth flow, lưu token | chưa chốt | `docs/integration/AUTH_FLOW.md`, BE `docs/contracts/AUTH_CONTRACT.md` |
| Actor xác nhận suất ăn | PENDING P-05 | BE `BUSINESS_RULES.md` |
| Người nhập đo sức khỏe | PENDING | BE `docs/modules/health.md` |
| Đơn nghỉ: ai tạo/duyệt | PENDING P-15 | BE `BUSINESS_RULES.md` |
| Ngữ cảnh hoạt động | OPEN (ADR-0006) | BE `docs/decisions/` |
