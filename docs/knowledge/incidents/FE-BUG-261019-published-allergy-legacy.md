---
id: FE-BUG-261019-published-allergy-legacy
type: bug
screens: [kitchen]
be_modules: [nutrition, child]
rules: [AUTH-05, NUT-08]
status: fixed
date: 2026-10-19
keywords: [allergy, legacy, published menu, thay món]
similar_to: []
---

# FE-BUG-261019-published-allergy-legacy — Mất tên món thay thế trong dữ liệu cũ

## Symptom

Phát hiện khi review phần tinh chỉnh thực đơn dị ứng, trước khi bàn giao: dữ liệu seed/legacy không có cặp original/replacement, trong khi UI mới bỏ hàng ALLERGY lặp toàn thực đơn. Vì vậy tên món thay thế biến mất, chỉ còn thông báo thiếu chi tiết.

## Điều kiện tái hiện

Mock weeklyMenus dạng cũ có hai danh sách NORMAL/ALLERGY cùng ngày, bữa, nhóm tuổi; một món khác nhau. Theo ngày, Theo tuần và Quy trình bếp đều dùng read model này.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chỉ giữ metadata thay món ở weeklyMenus chuẩn, legacy trả replacements rỗng | Test legacy fail: removedDishes undefined | Không bỏ danh sách cũ trước khi có dữ liệu hiển thị tương đương |
| 2 | Diff hai danh sách ở tầng mock, trả riêng removedDishes/addedDishes | Test legacy đạt; bữa giữ nguyên không tạo cảnh báo | Không ghép cặp tùy ý khi dữ liệu không xác định quan hệ |

## Root cause

`src/services/kitchen/mock/kitchenMockRepository.js` hàm `publishedAllergyChanges`: nhánh fallback bỏ dishIds trong khi hai trang chỉ hiển thị NORMAL.

## Fix

Fallback trả tên món bỏ/món thêm, component `AllergyMenuChanges` hiển thị rõ dữ liệu cũ chưa có cặp thay món. Không suy ra lý do hoặc danh sách trẻ từ tên món. Danh sách không đổi không sinh khối dị ứng.

## Regression test

`tests/kitchen/published-allergy-menu.test.mjs`: legacy menus preserve the changed dish names without inventing replacement pairs or warnings for unchanged meals. Fail trước fix, pass sau fix.

## Ảnh hưởng

Chỉ read model/UI mock; không sửa BE/APP, không thay số suất hoặc định lượng.

## Lesson

Khi thay cách hiển thị, giữ thông tin của dữ liệu legacy nhưng thể hiện rõ phần metadata còn thiếu.
