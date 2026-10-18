---
id: FE-BUG-261018-roster-modal-hmr-state
type: bug
screens: [staff-roster]
be_modules: []
rules: []
status: fixed
date: 2026-10-18
keywords: [HMR, roster, existingUserIds, includes]
similar_to: []
---

# FE-BUG-261018-roster-modal-hmr-state — Modal lỗi sau khi hot reload

## Symptom

Khi modal phân công đang mở và source của `StaffRosterPage` được cập nhật, ErrorBoundary hiện:

```text
Cannot read properties of undefined (reading 'includes')
```

## Điều kiện tái hiện

Web mock, vai trò PHT, `/school/staff/assignments`: mở modal chọn người; trong khi modal còn mở, thêm trường `existingUserIds` vào state của dialog rồi để Vite HMR cập nhật component.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Giữ modal mở khi HMR cập nhật component | ErrorBoundary, stack tại `AssignFromPlaceModal` gọi `.includes` | Fast Refresh giữ state dialog được tạo theo cấu trúc cũ |
| 2 | Cho phép `existingUserIds` thiếu khi render, tải lại và mở modal | Modal mở; người đã phân công bị vô hiệu hóa chọn | Render phải chịu được state cũ sau HMR |

## Root cause

`src/pages/school-config/StaffRosterPage.jsx` đọc `place.existingUserIds.includes(...)` trong khi React Fast Refresh giữ dialog cũ chưa có trường `existingUserIds`. Đây là lỗi FE ở trạng thái phát triển, không phải BE.

## Fix

Dùng truy cập tùy chọn khi đọc `existingUserIds`; dialog mới vẫn truyền danh sách ID để chặn chọn trùng ở UI. BE tiếp tục kiểm trùng khi lưu.

## Regression test

Kiểm runtime mock: lỗi xuất hiện trước sửa khi HMR; sau sửa, tải lại và mở modal bình thường, radio của người đang ở lớp có nhãn “Đã phân công ở đây” và bị disabled. Chưa thêm test tự động vì harness Node hiện không render JSX/HMR.

## Ảnh hưởng

Chỉ modal phân công theo nơi trên FE; không đổi BE/APP.

## Lesson

Component nhận state dialog từ cha nên có giá trị mặc định cho trường mới nếu Fast Refresh có thể giữ state cũ.
