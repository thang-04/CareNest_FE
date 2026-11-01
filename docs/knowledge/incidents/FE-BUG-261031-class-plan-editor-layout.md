---
id: FE-BUG-261031-class-plan-editor-layout
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-09]
status: fixed
date: 2026-10-31
keywords: [sticky save, kế hoạch tuần, kế hoạch ngày, tab keyboard, chủ đề nhánh]
similar_to: []
---

# FE-BUG-261031-class-plan-editor-layout — thao tác soạn chưa đồng bộ với kế hoạch năm

## Symptom

Màn chủ đề nhánh, chủ đề và tuần/ngày mất nút Lưu khi cuộn. Màn chủ đề và tuần có hai nút chính cạnh nhau. Tab ngày nằm ngoài khung nhìn ở 375px, thiếu điều khiển bằng phím mũi tên và liên kết tab–panel.

## Điều kiện tái hiện

Mock riêng tại 127.0.0.1:5191, tài khoản mẫu, các màn chủ đề nhánh/tuần/chủ đề. Chỉ dùng dữ liệu mẫu trong browser context riêng, không tác động BE thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chụp và đo ở 1440, 1024, 375px | Tái hiện mất Lưu khi cuộn, tab ngày nằm ngoài vùng nhìn và hai nút chính | So sánh trực tiếp với `GoalFormPage`, không tạo style mới |
| 2 | Chạy kiểm tra UI trước sửa | Ba ca đại diện thất bại đúng triệu chứng: Lưu có viewport ratio 0, tab Thứ 4 ngoài viewport, số nút chính 2 thay vì 1 | Có bằng chứng trước sửa |
| 3 | Kiểm ảnh sau sửa và bổ sung ca breadcrumb ở 1024px | Test phát hiện nút đè chữ lớp/tuần; chuyển hàng nút về flow thường như chi tiết kế hoạch năm | Sticky không tự giải quyết việc hàng nút absolute che breadcrumb |
| 4 | Ghi đè vị trí hàng nút bằng selector phạm vi màn lớp | Selector đầu có độ ưu tiên thấp hơn rule chung chứa các pseudo-class; bổ sung quan hệ `.breadcrumb + .page__head` để rule phạm vi thắng | So sánh specificity với rule gốc, không dùng `!important` |

## Root cause

Các màn lớp dùng `PageHead` trực tiếp, không có khối `.ga-sticky-head` của màn năm. Thanh ngày dùng `.tabs` cuộn ngang và chỉ xử lý click. Nút Dạy học và Lưu đều dùng `btn--primary`. Quy tắc chung đặt action absolute lên hàng breadcrumb làm các nút che đường dẫn ở 1024px.

## Fix

User yêu cầu lấy mục tiêu năm học làm chuẩn, chỉ sửa local, không commit/push. Nhánh backup cùng HEAD và bản sao 59 file đang sửa đã được tạo trước khi thay đổi.

- Dùng lại `.ga-sticky-head`, đặt hàng nút trong flow riêng để không che breadcrumb.
- Dạy học là nút phụ khi soạn; Lưu giữ nút chính. Danh sách tuần của chủ đề gọn thành các liên kết có ngày bên dưới.
- Khung thông tin tuần dùng bề mặt trung tính; tab tuần/ngày đủ sáu lựa chọn, hỗ trợ ArrowLeft/ArrowRight/Home/End và liên kết ARIA với panel.
- Bảng hai/ba cột trên điện thoại chia lại cột nhãn/ghi chú để dành chỗ đọc nội dung.

## Regression test

`tests/e2e/ui/education-plan-layout.spec.mjs`; kiểm tra thao tác lưu còn trong viewport, toàn bộ tab ngày hiện trên màn hẹp, chọn tab bằng bàn phím và phân cấp nút chính.

13 ca Playwright trên mock riêng: 3 loại màn × 3 bề rộng, bàn phím, phân cấp nút và đổi tab–Ctrl+S–tải lại. Ca đại diện thất bại trước sửa; lượt cuối sau sửa selector đạt `13 passed (47.1s)`.

- Chạy lại: `node node_modules/@playwright/test/cli.js test --config tests/e2e/ui/playwright.config.mjs`. Config tự chạy Vite mock ở 5191; test kiểm nhãn Tài khoản demo trước khi đăng nhập.
- Cổng bắt buộc: `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`; bằng chứng đầy đủ tại `verify.log` và output bàn giao.
- Đã chụp đối chiếu ở 1440, 1024, 375px; không có page error trong 15 trạng thái năm/nhánh/chủ đề/tuần/ngày. Reviewer độc lập không phát hiện hồi quy quan trọng.

## Ảnh hưởng

Chỉ trình bày và tương tác chọn tab trong education-plan; giữ quyền, lưu tay, bản phục hồi, luồng duyệt và contract hiện có. Không sửa BE/APP.

Giới hạn: lỗi header chung tràn 49px tại 375px đã tồn tại cả ở màn năm, thuộc `FE-BUG-261028-header-mobile-overflow`; không mở rộng sửa header dùng chung trong đợt này. Kiểm chứng bằng dữ liệu mock, chưa kiểm BE thật.
