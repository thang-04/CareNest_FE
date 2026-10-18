---
id: FE-BUG-261018-principal-kitchen-campus-empty
type: bug
screens: [kitchen/food-samples, kitchen/forecast, kitchen/stock-issues, kitchen/fresh-receipts, kitchen/meal-count, kitchen]
be_modules: [school-structure, nutrition]
rules: []
status: fixed
date: 2026-10-18
keywords: [PRINCIPAL, campusId null, ErrorBoundary, food-samples, useKitchenCampus]
similar_to: []
---

# FE-BUG-261018-principal-kitchen-campus-empty — Principal không có campus mặc định ở màn bếp

## Symptom
Tài khoản Hiệu trưởng mở `http://localhost:5173/kitchen/food-samples` thì ErrorBoundary hiện “Đã có lỗi xảy ra” và trang không có dữ liệu.

## Điều kiện tái hiện
Role `PRINCIPAL`, `user.campusId` là `null` (phạm vi toàn trường), danh mục campus có ít nhất một điểm trường. Trang bếp dùng `useKitchenCampus()` không truyền campus mặc định.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Mở đúng localhost trong Chrome với mock auth | Không đăng nhập được bằng tài khoản seed; không thể xác nhận runtime/error stack trên profile đó | Không reset localStorage hoặc thử mật khẩu khác vì dữ liệu phiên do người dùng sở hữu |
| 2 | Truy vết `useKitchenCampus` → `useFoodSampleLog` → render page | Principal campus rỗng làm query disabled, `loading=false`, `data=null`; render đọc `data.meals` và ErrorBoundary bắt exception | Render phải chờ campus hợp lệ khi query bị disable |
| 3 | Mô phỏng Principal `campusId=null` trên origin local cô lập | Trước state guard, `/kitchen/forecast` vào ErrorBoundary với `Cannot read properties of null (reading 'days')`; sau fix cả forecast và food-samples chọn Campus 1, không vào ErrorBoundary | Cần guard `data` khi query vừa đổi từ disabled sang enabled; `useAsync` chưa bật loading trong render đầu |
| 4 | Tái hiện repository trực tiếp với Principal và mock DB mới | Repository trả kết quả không lỗi; ngày nghỉ cho kết quả không có bữa | Lỗi nằm ở FE campus selection/render state, không phải seed repository |

## Root cause
`useKitchenCampus()` khởi tạo campus từ `user.campusId || ''`. Principal có scope toàn trường nên `campusId` thường null; `useFoodSampleLog` vì thế bị disable. `FoodSampleLogPage` chỉ kiểm tra `loading && !data` rồi đọc `data.meals`, làm React `ErrorBoundary` hiển thị lỗi 500 thân thiện.

## Fix
Đang dùng campus đầu tiên trong danh mục master data làm lựa chọn ban đầu cho Principal khi tài khoản không có campus gắn sẵn; quyền xem vẫn dựa trên role/scope hiện có. Màn hình chờ campus và dữ liệu trước khi đọc `data`.

## Regression test
`tests/kitchen/kitchen-campus.test.mjs`: Principal không có campus chọn campus đầu từ master data; lựa chọn đã chọn được giữ; VP/Bếp không bị đổi scope.

## Ảnh hưởng
Các màn dùng `useKitchenCampus`, gồm quy trình bếp, dự trù, phiếu xuất, kiểm nhận, lưu mẫu và số suất. Không đổi API hoặc BE rule.

## Lesson
Principal có thể không có campus trong hồ sơ vì phạm vi của họ là toàn trường; filter campus cần dùng danh mục BE trả về làm giá trị hiển thị ban đầu, còn trang phải chờ query khi campus/data chưa sẵn sàng.
