---
title: Đồng bộ mẫu màn đánh giá
status: in-progress
owner: Cần
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [learning-observation]
rules: [OBS-27, OBS-28]
risk: medium
created: 2026-11-05
updated: 2026-11-05
---
# Đồng bộ mẫu màn đánh giá

## Context
User duyệt ảnh học kỳ, cuối chủ đề, cuối năm dựa mẫu giấy trường và giao diện hiện có, yêu cầu sửa cả ba ngày 05/11/2026. Giai đoạn độc lập đầu chỉnh trình bày cuối chủ đề/cuối năm; học kỳ cần contract BE riêng và chốt cách tổng hợp trước khi triển khai.

## Quyết định đã chốt
- Giữ shell, token, component hiện có; bảng cuối chủ đề trẻ × MT +/−, cuối năm MT theo lĩnh vực Đạt/Chưa đạt.
- Thời gian học kỳ lấy cấu hình Hiệu trưởng, không hardcode số tuần hay ngày.
- Không đổi API, kết quả hoặc dữ liệu xác nhận trong giai đoạn trình bày này.

## Làm rõ nghiệp vụ
User đã duyệt mẫu, yêu cầu đồng bộ cả ba. OBS-27/28 giữ nguyên; triển khai học kỳ là giai đoạn riêng sau khi chốt phạm vi dữ liệu. Giai đoạn hiện tại không phụ thuộc hai câu hỏi học kỳ.

### Câu hỏi mở
Không có câu hỏi chặn phần trình bày cuối chủ đề/cuối năm; câu hỏi học kỳ quản lý riêng, chưa triển khai nghiệp vụ học kỳ.

## Acceptance criteria
- AC-1: dùng cùng tiêu đề biểu mẫu, tiêu đề phụ và cách trình bày cho cuối chủ đề/cuối năm.
- AC-2: giữ dữ liệu, sửa tay, lưu, xác nhận, in và trạng thái chỉ xem.
- AC-3: lĩnh vực/MT và nhãn năm đọc dữ liệu, không gán các lĩnh vực hoặc ngày mẫu vào code.

## Key decisions
Dùng component riêng module assessment cho tiêu đề biểu mẫu; không thay shell hay component nền. Dùng nhãn cấu hình năm học thay suy từ ngày bắt đầu/kết thúc chủ đề.

## Phases
### Phase 1 — Trình bày cuối chủ đề/cuối năm
- Thêm heading riêng module, áp dụng hai màn và CSS token.
- Verify node scripts/verify.mjs; node scripts/check-ai-layer.mjs. Kiểm browser read-only.
- Dừng review khi xong, không đổi contract học kỳ hoặc BE khi chưa chốt.

## Test matrix
AC-1..3: verify, test in/xác nhận hiện có và browser.

## Rủi ro & rollback
Không thay state hoặc callback lưu. Hoàn tác hunk trình bày nếu chưa duyệt, không tác động source đổi quy tắc 50% đã có.

## Validation log
Source: ThemeEvaluationPage.jsx và YearEndSheetCard.jsx đã đọc. Giao diện và mẫu trường đã xem qua Chrome. User chốt sửa cả ba; phần học kỳ chưa đủ quy tắc và contract nên tách giai đoạn.

## Progress log
### 2026-11-05 — Đang triển khai
- User duyệt ảnh và chốt sửa cả cuối chủ đề/cuối năm; bắt đầu phần trình bày độc lập.

### 2026-11-05 — Phase 1 chờ review
- Source/test cuối: VERIFY PASS full. Học kỳ/cách tính năm chưa đổi: plan chính mới tại BE:docs/plans/active/2026-11-05-semester-domain-assessment.md, user đã chốt tính kỳ II riêng, năm cả năm, tỷ lệ trực tiếp trong học kỳ; chờ duyệt contract/migration.
