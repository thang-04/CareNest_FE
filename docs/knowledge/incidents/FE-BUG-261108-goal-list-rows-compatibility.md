---
id: FE-BUG-261108-goal-list-rows-compatibility
type: bug
screens: [education-goals]
be_modules: [education-plan]
rules: []
status: open
date: 2026-11-08
keywords: [allGoalItems, items.map, rows, Hệ thống gặp sự cố]
similar_to: []
---

# Danh sách kế hoạch năm học sập với lĩnh vực chỉ có rows

## Symptom

Route `/education/goals` hiện ErrorBoundary. Dữ liệu giả chỉ có domain.rows tái hiện `Cannot read properties of undefined (reading 'map')` trong allGoalItems.

## Điều kiện tái hiện

Kế hoạch có lĩnh vực dạng `{ name, rows: [{ kind: 'goal', text, contents }] }`, không có items. Mở danh sách kế hoạch.

## Attempts

| Cách thử | Kết quả |
| --- | --- |
| Fresh seed mock và fixture API hợp lệ | Trang mở được |
| Fixture mock bỏ items nhưng giữ rows | Tái hiện ErrorBoundary, stack vào allGoalItems |
| Thêm ba test hồi quy trước sửa | Hai test lỗi map/flatMap, test items cũ đạt |
| Hỗ trợ rows khi không có items và lĩnh vực chưa có dữ liệu | Cả ba test đạt |

## Root cause

`src/models/education-plan/educationPlanConstants.js` chỉ gọi domain.items.map dù định dạng bảng mới lưu rows. GoalListPage và SchoolPlansPage dùng hàm này để đếm mục tiêu.

## Fix

Giữ nguyên items nếu có, fallback sang rows chỉ lấy kind=goal. Không thay dữ liệu lưu hoặc tạo lại mã YCCĐ. Kế hoạch chưa có lĩnh vực trả danh sách rỗng.

## Regression test

`tests/education-plan/goal-items-compatibility.test.mjs` kiểm rows, items/YCCĐ cũ và kế hoạch rỗng. Chạy trước sửa có hai test fail, sau sửa ba test pass.

## Ảnh hưởng

Danh sách kế hoạch và thẻ tổng quan dùng allGoalItems. Chưa đọc được console của phiên Edge người dùng vì công cụ không xác định chắc URL, vì vậy stack phiên thật chưa được xác nhận.

## Cập nhật 11/11/2026

- Cần yêu cầu không sửa phần kế hoạch giáo dục của Tiền: đã trả `allGoalItems` và bỏ test `goal-items-compatibility` khỏi nhánh G94-179. Lỗi (nếu còn) do Tiền xử lý ở nhánh của mình.
