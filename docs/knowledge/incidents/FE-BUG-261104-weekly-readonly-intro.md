---
id: FE-BUG-261104-weekly-readonly-intro
type: bug
screens: [weekly-menu]
be_modules: [nutrition]
rules: []
status: open
date: 2026-11-04
keywords: [thực đơn tuần, chỉ xem, lời dẫn, Phó hiệu trưởng]
similar_to: []
---

# FE-BUG-261104-weekly-readonly-intro — Lời dẫn hướng dẫn sửa trên màn chỉ xem

## Symptom

Trên bản demo trực tiếp, tài khoản Phó hiệu trưởng Cơ sở A mở `/menu/weekly`: màn ghi `Chỉ xem`, nhưng lời dẫn đầu trang vẫn là “Chọn món theo khối và bữa cho cả tuần, lưu nháp rồi công bố một lần.” Màn không có nút lưu/công bố cho tài khoản này.

## Điều kiện tái hiện

Đăng nhập Phó hiệu trưởng demo không có quyền `MENU_MANAGE`, mở Kế hoạch tuần & công bố.

## Attempts — đã thử

| #   | Cách thử                                                 | Kết quả                                                                                 | Bài học                                                  |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Đối chiếu cùng route giữa Hiệu trưởng và Phó hiệu trưởng | Hiệu trưởng có điều khiển chọn món/lưu nháp; Phó hiệu trưởng chỉ xem nhưng cùng lời dẫn | Hướng dẫn đầu trang phải theo khả năng thực tế của phiên |

## Root cause

Chưa đối chiếu mã. Dấu hiệu là lời dẫn tĩnh, không xét trạng thái chỉ xem.

## Fix

Chưa sửa. Dùng lời dẫn riêng cho chỉ xem hoặc mô tả trung lập; quyền ghi vẫn phải do BE quyết định.

## Regression test

Chưa chạy. Cần kiểm tra có/không `MENU_MANAGE` và trạng thái `DRAFT`/`PUBLISHED`.

## Ảnh hưởng

Người chỉ xem có thể tìm thao tác không tồn tại. Không cần thay đổi BE theo bằng chứng hiện có.

## Lesson

Microcopy phải phản ánh quyền và trạng thái của màn, không hứa thao tác mà người xem không làm được.
