---
title: Bỏ màn đánh giá tháng trên Web
status: in-progress
owner: Cần
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [learning-observation]
rules: [OBS-03, OBS-05, OBS-26]
risk: medium
created: 2026-11-05
updated: 2026-11-05
---
# Bỏ màn đánh giá tháng trên Web

## Context
User yêu cầu bỏ màn đánh giá tháng cho GV, PHT, HT ngày 05/11/2026.
Menu hiện khai báo tại src/layouts/menuConfig.js:271; route danh sách, chi tiết, AI tại src/routes/AppRoutes.jsx:469–471; dashboard dẫn vào tháng tại src/components/dashboard/ClassTodayPanel.jsx:245.

## Quyết định đã chốt
- Bỏ màn đánh giá tháng cho ba vai trò theo yêu cầu user.
- Chưa được phép sửa BE hoặc xóa dữ liệu lịch sử.

## Làm rõ nghiệp vụ
- Actor: GV, PHT, HT. Outcome: không còn vào màn đánh giá tháng trên Web.
- OBS-05 và module BE vẫn có đánh giá MONTH/SEMESTER/YEAR; yêu cầu mới chỉ bỏ màn tháng, chưa thay contract.
- OBS-03: hồ sơ phát triển vẫn đọc lịch sử; OBS-26: nhận xét chung lớp tháng là luồng riêng.
- Giữ chất lượng tháng, phiếu bé ngoan, học kỳ và cuối năm; giữ dữ liệu đánh giá tháng cũ và phần tổng hợp lịch sử.
- Link cũ /assessment/periodic và các route con chuyển về /assessment/children bằng replace.

### Câu hỏi mở
User duyệt phạm vi bằng ảnh màn /assessment/periodic và yêu cầu “đây này bạn bỏ đi” ngày 05/11/2026.

## Acceptance criteria
- AC-1: menu mọi vai trò liên quan không có Đánh giá tháng.
- AC-2: route tháng cũ không render màn danh sách/chi tiết/AI, chuyển tới hồ sơ phát triển.
- AC-3: dashboard không đếm hoặc dẫn người dùng đến việc đánh giá tháng; vẫn hiển thị học kỳ/cuối năm.
- AC-4: chất lượng tháng, phiếu bé ngoan, học kỳ/cuối năm và lịch sử không bị xóa.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Phạm vi | Bỏ đường vào và route màn tháng | Xóa toàn bộ tính năng/dữ liệu BE | User chỉ yêu cầu bỏ màn, lịch sử còn phục vụ tổng hợp |
| URL cũ | Chuyển hồ sơ phát triển | Hiện 404 | Link thông báo cũ vẫn dẫn tới nơi xem lịch sử |

## Phases
### Phase 1 — Bỏ màn tháng và kiểm tra hồi quy
- Sửa src/layouts/menuConfig.js, src/routes/AppRoutes.jsx, src/components/dashboard/ClassTodayPanel.jsx.
- Bổ sung kiểm tra menu/route/dashboard vào test phù hợp; cập nhật docs/features và docs/quality/VERIFICATION.md.
- Tests: AC-1..4 → kiểm tra điều hướng tháng và bảo toàn các đường vào còn lại.
- Exit: node scripts/verify.mjs; node scripts/check-ai-layer.mjs. Báo output thật, không coi skip là pass.
- Dừng chờ user review.

## Test matrix
| AC | Test | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-1 | Menu GV/PHT/HT không có assessPeriodic | 1 | Chưa chạy |
| AC-2 | Route cũ chuyển hồ sơ phát triển | 1 | Chưa chạy |
| AC-3 | Dashboard chỉ đưa việc học kỳ/cuối năm | 1 | Chưa chạy |
| AC-4 | Các menu và route còn lại giữ nguyên | 1 | Chưa chạy |

## Rủi ro & rollback
Link lịch sử tháng vẫn tồn tại: chuyển về hồ sơ thay vì xóa dữ liệu. Hoàn tác từng hunk của task nếu user đổi quyết định, không tác động thay đổi khác.

## Validation log
- Đã xác định menu/route/dashboard bằng source.
- Không đổi API, dữ liệu, quyền BE hoặc repo khác.
- Chưa sửa source và chưa chạy kiểm tra chức năng.

## Progress log
### 2026-11-05 — Chuẩn bị
- User đã duyệt; bỏ menu tháng, chuyển route cũ về hồ sơ phát triển, bỏ tải/nhắc đánh giá tháng trên dashboard. Chờ verify.

### 2026-11-05 — Phase 1 chờ review
- Source, menu và dashboard đã sửa theo AC-1..4. Test menu bốn vai trò đạt; route cũ dùng Navigate replace về hồ sơ, không lazy load màn tháng.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Check AI-layer 0 lỗi, 21 cảnh báo cũ. Chưa kiểm trình duyệt thật.
- Khác plan: không xóa file page cũ hoặc dữ liệu; không commit/push. Chờ user review.
