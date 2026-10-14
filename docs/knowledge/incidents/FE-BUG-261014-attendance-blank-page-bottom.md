---
id: FE-BUG-261014-attendance-blank-page-bottom
type: bug
screens: [attendance-entry]
be_modules: []
rules: []
status: fixed
date: 2026-10-14
keywords: [khoảng trắng cuối trang, cuộn, overflow, sr-only, position absolute, bảng điểm danh, lớp đông]
similar_to: []
---

# Cuối trang điểm danh thừa khoảng trắng lớn khi lớp đông

## Symptom

Cuộn hết trang `/attendance`, khung sidebar và footer kết thúc giữa màn hình; bên dưới là vùng trắng dài. Danh sách trẻ biến khỏi màn hình.

## Điều kiện tái hiện

Lớp 25 trẻ, viewport 1280×800, bảng có `max-height` và `overflow: auto`. Trước khi sửa, `document.scrollHeight` là 2000 trong khi `.app-shell` cao 1688.

## Attempts

| #   | Cách thử                                                               | Kết quả                                                      |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Dò từ bảng ngược lên `body`: so `scrollHeight` với chiều cao từng tầng | Thấy phần tràn từ trong bảng, dù bảng đã có `overflow: auto` |
| 2   | Thêm `position: relative` cho khung bảng                               | Tài liệu cao bằng `.app-shell`, hết vùng trắng               |

## Root cause

Ô chọn ẩn `.sr-only` (radio Có mặt/Vắng) dùng `position: absolute`. Khung bảng `.dd-reception__table` là `position: static`, nên khối chứa của các ô này là `.app-main`, nằm ngoài khung cuộn. `overflow: auto` không cắt chúng, nên ô của các hàng bị cuộn khuất vẫn kéo dài trang.

## Fix

Thêm `position: relative` cho `.dd-reception__table` trong `src/styles/modules/attendance.css`.

## Regression test

Kiểm tra trên trình duyệt ở 1280×800 và 1920×1080, lớp 25 trẻ: cuộn hết trang thì `document.scrollHeight` bằng mép dưới footer.

## Ảnh hưởng và Lesson

Mọi khung có `overflow: auto/hidden` chứa phần tử `position: absolute`, ví dụ `.sr-only` hoặc tooltip, phải là khối chứa (`position: relative`). Thiếu nó, phần tử absolute thoát khỏi khung cắt và làm trang dài thêm.
