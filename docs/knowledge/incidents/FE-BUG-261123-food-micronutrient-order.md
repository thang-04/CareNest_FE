---
id: FE-BUG-261123-food-micronutrient-order
type: bug
screens: [food-catalog, meal-planning]
be_modules: [nutrition]
rules: [NUT-26]
status: fixed
date: 2026-11-23
keywords: [vi chất, seed, Kẽm, thứ tự cột, phosphorus, iron]
similar_to: []
---

# Vi chất mẫu bị lệch sau khi đổi nhóm hiển thị

## Symptom
Trong trình duyệt mock, gạo hiển thị Sắt 104 mg thay vì 1,3 mg; Phospho thành 0,03 mg và Kẽm nhận nhầm số liệu Sắt.

## Điều kiện tái hiện
Khởi tạo database mock mới, mở `/menu/foods/f01`. Tái hiện cả khi bổ sung vi chất vào database mock cũ chưa có dữ liệu vi chất.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chạy bộ test menu cũ | Đạt nhưng chỉ kiểm Canxi mẫu | Chất đầu tiên không đổi vị trí nên không phát hiện lệch các cột sau |
| 2 | Xem ảnh chi tiết rồi kiểm cả chín khóa vi chất của gạo | Test fail với Sắt 104, Phospho 0,03, Kẽm 1,3 | Dãy giá trị nguồn có thứ tự riêng, không được dùng thứ tự nhóm UI |

## Root cause
`seedMicronutrientsOf` ghép `MICRO_ROWS` tám cột với `MICRONUTRIENTS`, trong khi danh sách này đã được sắp lại thành năm chất chính và bốn chất bổ sung, đồng thời chèn Kẽm.

## Fix
Dùng `MICRO_ROW_KEYS` cố định theo tám cột nguồn. Kẽm chưa có nguồn số liệu giữ `null`; giữ nguyên số 0. Không sửa dữ liệu browser đang có của người dùng.

## Regression test
`tests/menu/food-micronutrients.test.mjs`: `đổi thứ tự hiển thị vi chất không làm lệch dữ liệu mẫu theo cột cũ`. Đã thấy fail trước và pass sau sửa.

## Ảnh hưởng
Danh mục và phép tính món/thực đơn dùng dữ liệu mock mới. Không đổi API hoặc dữ liệu BE/APP.

## Lesson
Thứ tự trình bày không phải schema dữ liệu nguồn; ánh xạ các cột có tên trước khi thay đổi nhóm UI.
