---
id: FE-BUG-261104-approval-intro-mismatch
type: bug
screens: [approvals]
be_modules: []
rules: []
status: open
date: 2026-11-04
keywords: [chờ duyệt, khen thưởng, sĩ số suất ăn, lời dẫn]
similar_to: []
---

# FE-BUG-261104-approval-intro-mismatch — Lời dẫn Chờ duyệt không khớp yêu cầu đang chờ

## Symptom

Trên bản demo trực tiếp ngày 04/11/2026, tài khoản Hiệu trưởng mở `/approvals`: lời dẫn ghi “Đề xuất khen thưởng cuối năm đang chờ Hiệu trưởng quyết định”, nhưng các thẻ đếm hiển thị 0 Khen thưởng và 4 Sĩ số suất ăn; bảng bên dưới chỉ có yêu cầu suất ăn.

## Điều kiện tái hiện

Đăng nhập Hiệu trưởng demo, mở Chờ duyệt khi có yêu cầu suất ăn mà không có đề xuất khen thưởng.

## Attempts — đã thử

| #   | Cách thử                                           | Kết quả                               | Bài học                                         |
| --- | -------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| 1   | Mở Chờ duyệt và đối chiếu lời dẫn với thẻ đếm/bảng | Không khớp loại yêu cầu đang hiển thị | Lời dẫn cần phản ánh bộ lọc hoặc dùng câu chung |

## Root cause

Chưa rõ; chưa đối chiếu mã trang và dữ liệu API.

## Fix

Chưa sửa. Kiểm tra nguồn của lời dẫn; đổi theo loại yêu cầu hoặc dùng mô tả chung, không suy ra quyền duyệt ở FE.

## Regression test

Chưa chạy. Cần kiểm tra trường hợp chỉ có suất ăn, chỉ có khen thưởng, và có cả hai loại.

## Ảnh hưởng

Hiệu trưởng có thể hiểu sai phạm vi chờ duyệt. Chưa xác định ảnh hưởng BE/APP.

## Lesson

Mô tả ở đầu danh sách tổng hợp phải khớp các loại yêu cầu thực tế và quyền của người xem.
