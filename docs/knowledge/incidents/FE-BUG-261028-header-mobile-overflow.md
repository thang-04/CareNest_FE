---
id: FE-BUG-261028-header-mobile-overflow
type: bug
screens: [layout-header, education-plan]
be_modules: []
rules: []
status: open
date: 2026-10-28
keywords: [header, mobile, overflow, 390px, notification]
similar_to: [FE-BUG-261020-layout-css-loaded-before-components]
---

# Header tràn ngang ở viewport 390px

## Symptom

Chromium, viewport 390 × 844, mock Phó hiệu trưởng: document scrollWidth 424px, clientWidth 390px. Nút thông báo có cạnh phải khoảng 422.55px, badge khoảng 423.55px.

## Điều kiện tái hiện

Browser context riêng, dữ liệu giả; mở danh sách `/education/goals` hoặc chi tiết kế hoạch. Không cần vào chế độ sửa.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đo sau thay đổi preview bảng | Document rộng 424px; khối `.ga-page` vẫn nằm trọn trong 390px | Cần tách nội dung trang khỏi header |
| 2 | Điều hướng sang danh sách kế hoạch chưa sửa source | Vẫn 424/390px | Hiện tượng cũng có ở màn danh sách, không riêng bảng preview mới |

## Root cause

Chưa xác định đầy đủ. Phần tử gây tràn nhìn thấy là nút thông báo/header. Chưa khẳng định cùng nguyên nhân CSS với incident liên quan.

## Fix

Chưa sửa; cần xử lý header dùng chung ở task riêng. Task preview không sửa layout chung.

## Regression test

Kiểm Chromium với mock tại 390px: so scrollWidth/clientWidth trên chi tiết và danh sách. Mục tiêu khi sửa header: scrollWidth không vượt clientWidth; bảng nhiều cột vẫn cuộn bên trong `.table-wrap`.
