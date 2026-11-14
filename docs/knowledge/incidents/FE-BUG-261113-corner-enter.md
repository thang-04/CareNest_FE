---
id: FE-BUG-261113-corner-enter
type: bug
screens: [education-plan-week]
be_modules: [education-plan]
rules: [EDU-16, EDU-22]
status: fixed
date: 2026-11-13
keywords: [hoạt động góc, Enter, thêm dòng]
---

# Enter không thêm dòng ở các cột bảng góc

## Symptom / Điều kiện tái hiện
Trong chế độ sửa kế hoạch tuần, Enter ở Nội dung, Mục đích, Chuẩn bị hoặc Cách tiến hành không tạo dòng góc bên dưới.

## Root cause
`WeekPlanBody.jsx`: chỉ ô Tên góc nối `cornerKeys`; các cột còn lại không truyền `onKeyDown`. Handler cũ yêu cầu có tên dù dòng có thể đã nhập ở cột khác. Chuyển focus dựa vào nhãn đánh số thay vì ID.

## Attempts
1. Đối chiếu các Cell: thiếu handler tại bốn cột.
2. Kiểm thử JSX với hook được điều khiển: thêm dòng, giữ thẻ/MT, đồng bộ bảng tuần, không thêm trùng dòng trống, giữ IME/Shift+Enter.

## Fix
Nối handler vào mọi cột, kiểm nội dung cả dòng, tái dùng dòng trống kế tiếp và chuyển focus theo ID góc. Không đổi TableCell dùng chung hoặc API.

## Regression test
`tests/education-plan/week-corner-enter.test.mjs`; liên kết góc–tuần còn được kiểm bởi `day-plan-template.test.mjs`. Chưa kiểm trình duyệt; không chạy e2e khi user chưa yêu cầu.
