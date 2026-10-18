---
title: Thiết kế lại khu Nhân sự, Phụ huynh, Trẻ
status: in-progress
owner: CareNest Web
jira: none
branch: feature/G94-209-FE-FEAT-53-permission-management
modules: [identity-access, school-structure, child]
rules: [AUTH-08, AUTH-10, AUTH-11, AUTH-14, AUTH-16, AUTH-18, AUTH-19]
risk: high
created: 2026-10-18
updated: 2026-10-18
---
# Khu Nhân sự, Phụ huynh, Trẻ

## Context

Danh sách nhân sự hiện là cột hẹp cạnh hồ sơ (`src/pages/school-config/StaffHubPage.jsx:82`); nơi làm bị rút gọn và quyền nằm sâu trong một trang dài (`src/components/account/StaffPersonSheet.jsx:54`). Phụ huynh và trẻ ở hai route khác (`src/routes/AppRoutes.jsx:324`). User đã duyệt thiết kế chung trong chat ngày 2026-10-18 và yêu cầu triển khai.

## Quyết định đã chốt

1. Một khu bốn tab Nhân sự / Phân quyền / Phụ huynh / Trẻ; tab Phân quyền chỉ cho Hiệu trưởng có `PERMISSION_MANAGE`. Giữ URL cũ và dữ liệu theo BE; tab Trẻ giữ danh sách hiện có.
2. Nhân sự dùng bảng tổng quan; hồ sơ riêng có Phân công / Quyền / Tài khoản. Bảng không suy đoán quyền cá nhân.
3. Tab Phân quyền hiển thị toàn bộ catalog theo cột PHT/GV; chỉ ô BE cho cấu hình được bật/tắt, ô còn lại hiện khóa. Ngoại lệ từng người giữ trong hồ sơ.
4. Phân công bắt đầu từ điểm trường/lớp; chỉ ghi “Chưa có phân công”, không kết luận thiếu định biên. Nút thêm nhân sự mở modal, cùng modal có thể nhận campus/lớp đã chọn.
5. Phụ huynh giữ thao tác hiện có, không có công tắc quyền.
6. BE cần `GET /accounts?staffOnly=true` và `GET /staff-assignments/roster?campusId=` trước khi xác nhận luồng thật hoàn chỉnh; wire shape đề xuất ở `docs/integration/STAFF_ROSTER_CONTRACT_PROPOSAL.md`.

## Làm rõ nghiệp vụ

- Actor: Hiệu trưởng; Phó hiệu trưởng theo quyền và phạm vi BE. Outcome: tìm người, đọc phân công/quyền, phân công từ nơi làm, quản lý tài khoản phụ huynh.
- Rule: AUTH-08/10/11/14/16/18/19 (CONFIRMED). FE hiển thị, BE kiểm quyền và phạm vi.
- Flow: chọn tab → xem danh sách theo BE → mở đối tượng → thao tác được cấp quyền → BE xác nhận → tải lại.
- Ảnh hưởng: route/menu ba nhóm; identity-access, school-structure, child. Không đổi APP.
- Tài liệu cũ đặt nhân sự và trẻ ở hai nhóm menu; yêu cầu mới gom điều hướng nhưng giữ route hiện có.

### Câu hỏi mở

Không có câu hỏi nghiệp vụ còn mở. Việc sửa BE phụ thuộc quyền sửa repo được yêu cầu riêng trong lượt triển khai.

## Acceptance criteria

- AC-1 (AUTH-08): Danh sách Nhân sự phân trang chỉ gồm vai trò nhân sự và tuân phạm vi BE.
- AC-2 (AUTH-16): Người quản lý chọn campus/lớp, thấy phân công hiện hành và lớp chưa có phân công; thêm/kết thúc bằng endpoint BE hiện có.
- AC-3 (AUTH-10/11/14): Tab Phân quyền hiển thị toàn bộ catalog theo PHT/GV; chỉ ô BE cho cấu hình mới bật/tắt được, lưu kèm lý do.
- AC-4 (AUTH-18/19): Tab Phụ huynh giữ luồng lớp → trẻ và tài khoản; không xuất hiện công tắc quyền.
- AC-5: Tab Trẻ mở danh sách hiện có; tab và menu chỉ hiện với người được phép; URL cũ hoạt động.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Phân quyền | Tab ma trận riêng; ngoại lệ từng người trong hồ sơ | Chỉ một nút ở trang Nhân sự | Tách cấu hình theo vai trò khỏi hồ sơ cá nhân |
| Phân công | Theo campus/lớp, BE trả roster | Ghép dữ liệu tại FE | Tránh tổng hợp sai và lộ phạm vi |
| Phụ huynh | Theo lớp/trẻ hiện có | Mỗi phụ huynh một hàng | Giữ hợp đồng API và liên kết với trẻ |

## Phases

### Phase 1 — Contract và mock
- BE: bổ sung lọc `staffOnly` và roster theo campus; kiểm quyền, phạm vi và ngày hiệu lực. FE: cập nhật service/mock tương ứng sau khi BE contract chốt.
- Tests: AC-1/2; danh sách rỗng, ngoài phạm vi, tài khoản khóa, trang cuối.
- Exit: test BE liên quan và `node scripts/verify.mjs` của FE.

### Phase 2 — Khu bốn tab và nhân sự
- FE: tab theo quyền, bảng nhân sự có lọc phía server, hồ sơ ba phần, tab Phân quyền full catalog dạng ma trận và modal thêm nhân sự; giữ route cũ.
- Tests: AC-1/3/5, loading/403/404, thao tác bàn phím.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`.

### Phase 3 — Phân công theo nơi và đối chiếu UI
- FE: roster campus/lớp, form phân công từ nơi đã chọn, làm mới sau lưu; gắn tab Phụ huynh/Trẻ và dọn mục menu trùng.
- Tests: AC-2/4/5, 375/768/1280 px, mock và BE thật khi sẵn có.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`; `node scripts/check-ai-layer.mjs` exit 0.

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE roster chưa có | Màn phân công không chạy với BE thật | Không trình bày mock là dữ liệu thật; chặn trạng thái thiếu contract rõ ràng | Giữ route phân công theo người hiện tại |
| Workspace đang có nhiều thay đổi | Ghi đè công việc khác | Chỉ sửa file trong plan, xem diff trước/sau | Hoàn tác từng thay đổi của task, không reset toàn repo |

## Validation log

- [x] Nguồn code và BE contract đã đối chiếu trong lượt lập plan.
- [x] Consumer contract: bảng Nhân sự và roster Phân công theo nơi.
- [x] AC và lệnh kiểm chứng được gắn theo phase.
- [x] >8 file nên tách thành ba phase.
- [x] Không dùng rule PENDING/OPEN như đã chốt.

## Progress log

### 2026-10-18 — Bắt đầu triển khai
- Commit: chưa commit (chưa có quyền commit trong tin nhắn hiện tại).
- Đã làm FE: bốn tab, bảng nhân sự + responsive cards, hồ sơ và ma trận cá nhân, tab Phân quyền full catalog theo ma trận PHT/GV, modal thêm nhân sự từ danh sách và roster, modal phân công, link từ dashboard, parent actions, contract proposal; API thật bị gate bằng `VITE_PEOPLE_CONTRACT_READY=false` cho tới khi BE deploy contract.
- Review: sửa stale roster, candidate stale selection, retry matrix; xem incidents trong `docs/knowledge/ISSUE_INDEX.md`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → 0 lỗi, 4 cảnh báo có sẵn.
- UI: mock Chrome đã kiểm 375/768/1280; live API mode xác nhận hai màn mới hiện trạng thái chờ contract, không gọi API mới.
- Tiếp: cần user cho phép sửa `CareNest_BE`, triển khai hai contract và chạy smoke test trước khi bật cờ.
