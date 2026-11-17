---
title: Web quản trị và đọc thông báo trường
status: draft
owner: Tiền — review; người triển khai chưa phân công
jira: Nguồn BE G94-290/G94-291; mã FE bổ sung chưa cấp
branch: feature/G94-900-FE-FEAT-900-learning-resource-library
modules: [notification]
rules: [PAR-03, PAR-05, PAR-07, PAR-08, PAR-09, PAR-10, PAR-11, PAR-12, EDU-73, EDU-74]
risk: high
created: 2026-11-15
updated: 2026-11-15
---
# Plan client — thông báo trường (902)

## Context

Plan chính [BE](../../../../CareNest_BE/docs/plans/active/2026-11-15-notification-client-readiness.md); thiết kế 902 (`specs/902-notification-client-readiness/plan.md`), map API (`specs/902-notification-client-readiness/contracts/backend-api-map.md`).
notificationService.js:6–16 bỏ announcementId/count; account/api/accountApi.js:38–45 tìm detail trong list; NotificationBell.jsx:24–27 chỉ navigate link; useNotifications.js:31 đếm trên list giới hạn. Các path tương đối src/services, src/layouts, src/hooks.

## Quyết định đã chốt

Giữ API 019, scope/authorization ở BE; HT/PHT quản trị, chỉ HT rules/schedules. Staff Web roles hiện có; phụ huynh nhận/đọc trên App. Không thêm library/CSS/token, không giả endpoint dashboard, không web push.

## Làm rõ nghiệp vụ

[B] Chọn target/nội dung; [S] preview server; [B] gửi; [S] render response/full text/file qua auth. PAR-11/12 ở backend/App, Web không tự tính kết quả từng thiết bị hoặc tạo giao diện ai đã đọc.

### Câu hỏi mở

Không có câu hỏi nghiệp vụ mới. Plan draft chưa được duyệt triển khai. Nhánh FE hiện là học liệu; chưa có chỉ đạo chọn/tạo nhánh mới hoặc mã Jira FE, không tự tạo/commit/push.

## Acceptance criteria

- AC-W1 (PAR-07/08): preview đúng server, gửi/sửa/hủy đúng status và tệp; 403/409 được xử lý.
- AC-W2 (PAR-05): chuông và URL detail mở toàn văn/tệp kể cả tin ngoài 50 dòng; count dùng server; tin cũ/EDU link giữ hành vi.
- AC-W3 (PAR-09/10): HT rules/schedule, toggle gửi request đầy đủ, không reset câu chữ; quyền server là quyết định cuối.
- AC-W4 (AGENTS/DESIGN): loading/empty/error/keyboard/focus, giữ form khi fail, mock/API rõ ràng.

## Key decisions

| Chọn | Không chọn | Vì sao |
| --- | --- | --- |
| Facade announcement mới + API/mock | Gọi axios trong UI | Giữ convention tầng dịch vụ |
| Normalizer giữ body Blob tối thiểu, adapter decode | Đòi adapter đọc body đã bị normalizer bỏ / viết lại auth | Giữ body response không request headers, thêm API-error/auth regressions |
| Giữ exports notification cũ, thêm feed/detail | Đổi list shape làm vỡ caller | Tương thích khi chuyển hook/count |

## Phases

### W1 — nền, gửi và đọc

- C pages/components/services announcement và tests/notifications; M routes/menu/integrationModules, notificationService/accountApi/useNotifications/bell/list/detail.
- Route/DTO/behavior cụ thể theo client-integration (`specs/902-notification-client-readiness/contracts/client-integration.md`).
- M apiError.js giữ non-enumerable blobErrorBody; không đổi auth flow. DataTable không bật phân trang nội bộ với server rows, Pagination riêng map API page 0→UI 1; dùng ErrorState/FormField, không Notice education.
- Test AC-W1/2/4; lệnh node:test notifications + menu/account liên quan, npm run lint/build theo quickstart. Không tự e2e/browser.
- Exit: contract tests/lint/build đạt, ghi giới hạn chưa e2e; dừng review.

### W2 — quy tắc và lịch

- Forms HT-only, rules từ mandatory/editable/variables, lịch dùng mẫu và nextRunAt server.
- Test AC-W3/4, request đủ/race/lỗi; native node:test/lint/build theo tác động.
- Exit: đạt checks liên quan, dừng review; API lỗi không fallback mock.

## Test matrix

| AC | V | Tầng | Kết quả hiện tại |
| --- | --- | --- | --- |
| W1 | V01..V04 | Adapter/mock/role, BE contract | Chưa chạy |
| W2 | V06 | Direct detail/count/full body/blob/EDU-link | Chưa chạy |
| W3 | V05 | Rule/schedule payload/quyền | Chưa chạy |
| W4 | V07 | Unit/state và kiểm UI khi được thực hiện | Chưa chạy |

## Rủi ro & rollback

Giữ auth/axios flow; apiError.js thay đổi nhỏ để không mất body Blob, cần npm run test:auth + API-error regressions. Rollback UI/adapter/normalizer theo version được review, không phá dữ liệu đã gửi. Không tự gửi POST lại khi timeout. Object URL phải revoke; blob errors phải giữ status/errorCode. Đã đề xuất tách W1/W2 do >8 file.

## Validation log

- [x] Có source file:line, danh sách caller cụ thể.
- [x] Không đổi API public; chỉ map endpoint thật và envelope/file khác nhau.
- [x] AC→V/test/exit lệnh được dẫn tới quickstart.
- [x] Phạm vi lớn chia hai gói; không dùng rule PENDING như chốt.
- [x] Chưa duyệt plan/nhánh, không có kết quả test được tự nhận.

## Progress log

2026-11-16: Tiền duyệt implementation và yêu cầu nhánh mã G94-288; checkout riêng `CareNest_FE_288`, nhánh `feature/G94-288-notification-client-readiness` từ `origin/dev` và áp stash không xóa. Đã thêm adapter, màn quản trị, mẫu, quy tắc/lịch và luồng đọc; 108 test auth/menu/thông báo đạt, đã thử giao diện mock bằng tay. Chưa tuyên bố API môi trường thật, phân quyền toàn bộ trường hợp hay e2e đạt; theo dõi tiếp tại spec 902.

2026-11-15: tạo plan FE draft và contract kỹ thuật, chưa sửa source/test/CSS/config hoặc chạy test/build. Tiếp tasks/analyze theo plan chính.
