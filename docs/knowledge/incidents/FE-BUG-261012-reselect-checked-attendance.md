---
id: FE-BUG-261012-reselect-checked-attendance
type: bug
screens: [attendance-entry]
be_modules: [attendance]
rules: []
status: fixed
date: 2026-10-12
keywords: [radio, checked, chọn lại trẻ, điểm danh]
similar_to: []
---
# Chọn lại trẻ qua ô điểm danh đã tích không chuyển panel

## Symptom

Người dùng báo: “ấn lại trẻ cũ không nhảy về trẻ cũ mà nó cứ giữ ở trẻ hiện tại”.

## Điều kiện tái hiện

Mock `/attendance`, giáo viên có hai trẻ đã Có mặt. Chọn trẻ B, nhấn ô Có mặt đã checked của trẻ A. Trước sửa, panel vẫn B; nhấn tên trẻ A thì hoạt động.

## Attempts

| # | Cách thử | Kết quả |
| --- | --- | --- |
| 1 | Nhấn tên trẻ cũ trong bản QA cách ly | Chuyển đúng, không phải stale data/busy |
| 2 | Nhấn radio đã checked của trẻ cũ | Không chuyển; tái hiện lỗi |
| 3 | Chọn trẻ bằng click dòng, giữ button tên cho keyboard | Browser chuyển đúng khi nhấn lại radio checked |

## Root cause

FE: `setStatus` gọi chọn trẻ chỉ qua `onChange` radio; radio checked không phát change. `src/pages/attendance/AttendancePage.jsx`, các handler `setStatus`, `selectChild` và dòng bảng.

## Fix

Thêm click handler dòng gọi `selectChild` độc lập với đổi điểm danh. Không đổi status/meals khi chỉ chọn lại. Busy guard và xác nhận bản nháp sức khỏe giữ nguyên.

## Regression test

Browser mock fail trước/pass sau: chọn B, click Có mặt đã checked của A, panel hiện tên A. Lint/format/build kiểm tra qua verify.

## Ảnh hưởng và Lesson

Chỉ màn tiếp nhận Web; không đổi BE/APP. Chọn đối tượng và thay đổi dữ liệu là hai hành vi riêng; không dựa vào change của giá trị đã chọn để điều hướng.
