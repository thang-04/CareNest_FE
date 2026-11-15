---
title: Nhận xét theo lĩnh vực trên phiếu cuối năm
status: draft
owner: Cần
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [learning-observation]
rules: [OBS-28]
risk: high
created: 2026-11-06
updated: 2026-11-06
---

# Nhận xét theo lĩnh vực trên phiếu cuối năm

## Context

`src/components/assessment/YearEndSheetCard.jsx:154` hiển thị mục tiêu theo lĩnh vực. DTO `BE:src/main/java/com/carenest/dto/observation/YearEndSheetDtos.java:24` chưa có nhận xét riêng cho lĩnh vực.

## Quyết định đã chốt

- Đặt phần nhận xét của giáo viên ngay sau mục tiêu cuối cùng trong từng lĩnh vực, theo yêu cầu ngày 06/11/2026.
- Dùng luồng chỉnh sửa, lưu và xác nhận của phiếu cuối năm hiện tại theo OBS-28.

## Làm rõ nghiệp vụ

- Giáo viên có quyền sửa phiếu nhập nhận xét tùy chọn cho từng trẻ và từng lĩnh vực. Người có quyền xem phiếu đọc nội dung đã lưu.
- Đề xuất giữ nhận xét chung và bốn lưu ý hiện có. Phiếu đã xác nhận chỉ xem, bản cũ không có nhận xét lĩnh vực sẽ để trống.

## Acceptance criteria

- AC-1: Mỗi lĩnh vực có ô nhận xét riêng sau danh sách mục tiêu. Lưu, tải lại và xóa nội dung ở một lĩnh vực không ảnh hưởng lĩnh vực khác.
- AC-2: Phiếu đã xác nhận giữ đúng nhận xét và chặn sửa. Phiếu cũ vẫn mở được.
- AC-3: Bản xem trước, bản in và Word hiển thị nhận xét ngay dưới lĩnh vực tương ứng.

## Phases

1. BE bổ sung dữ liệu lưu theo phiếu và ID lĩnh vực. Bổ sung trường tùy chọn vào GET/PUT `/assessment/evaluations/{id}/year-sheet`. Request cũ bỏ qua trường mới sẽ giữ nhận xét đã lưu. Xác thực lĩnh vực thuộc phiếu, áp dụng quyền sửa hiện có và cập nhật OpenAPI snapshot. Kiểm thử lưu/xóa từng nhận xét, giữ dữ liệu của client cũ và khóa sau xác nhận.
2. FE hiển thị, lưu và đưa nhận xét vào bản in qua `YearEndSheetCard.jsx` và `yearEndSheetDoc.js`. Kiểm thử trường hợp phiếu cũ, thay đổi chưa lưu, lưu lại và xem bản đã xác nhận. Chạy `node scripts/verify.mjs` ở hai repo trước khi bàn giao.

## Rủi ro và tương thích

- Cần cập nhật BE trước hoặc cùng FE. Khi BE chưa trả trường mới, bản FE hiện tại vẫn dùng hợp đồng cũ.
- Chờ duyệt thay đổi hợp đồng theo `.ai/workflows/plan-change.md` trước khi sửa BE và nối FE.
