---
id: FE-BUG-261123-food-modal-mock-logout
type: bug
screens: [menu-foods]
be_modules: [nutrition]
rules: [NUT-05]
status: fixed
date: 2026-11-23
keywords: [FoodEditModal, getActiveSuppliers, 401, logout, mock]
similar_to: []
---

# FE-BUG-261123-food-modal-mock-logout — Mở form thực phẩm mock làm hết phiên

## Symptom

Người dùng báo mở modal trên bản localhost thì bị đưa về đăng nhập. Với modal thêm/sửa thực phẩm, form tải nhà cung cấp qua BE dù `VITE_USE_MOCK=true`. BE local trả HTTP 401 cho `/api/nutrition/suppliers` khi không có phiên BE.

## Điều kiện tái hiện

Ở `/menu/foods`, mở modal thêm hoặc sửa thực phẩm trong chế độ mock khi BE trả 401. `FoodEditor` gọi `useActiveSuppliers` lúc mount.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Lần theo `FoodEditModal` → `FoodEditor` → `getActiveSuppliers` → `nutritionCatalogApi` | Thấy lời gọi BE không qua facade chọn mock/API | Trang đang mock vẫn có thể phát 401 từ BE |
| 2 | Thêm test tải nhà cung cấp khi mock | Fail `Không thể kết nối máy chủ` tại `beClient`; HTTP local BE trả 401 | Test xác nhận đường gọi sai nguồn; môi trường Node báo mất kết nối |
| 3 | Đổi sang facade nhà cung cấp dùng chung, chạy test lại | 33/33 test liên quan đạt; ESLint, Prettier và `git diff --check` đạt | Tránh gọi BE khi đang dùng dữ liệu mock |

## Root cause

`menuPlanningService.getActiveSuppliers` gọi thẳng `nutritionCatalogApi.getSuppliers` dù màn đang dùng mock. Khi BE trả 401, `beClient` phát `carenest:unauthorized`; `AuthContext` kết thúc phiên. Đây là lỗi chọn nguồn ở FE, không phải modal tự gọi logout.

## Fix

Đưa facade nhà cung cấp vào `src/services/supplierCatalogService.js` để cả thực phẩm và bếp chọn mock/API theo `nutrition-catalog`. `getActiveSuppliers` truyền user qua facade; hook tương ứng truyền user khi tải.

## Regression test

`tests/menu/food-units.test.mjs`: “form thực phẩm ở chế độ mock tải nhà cung cấp mà không cần BE” fail trước sửa, pass sau sửa. Chạy cùng `tests/kitchen/supplier.test.mjs` và `tests/menu/nutrition-catalog-api.test.mjs`: 33/33 đạt.

## Ảnh hưởng

Modal thêm/sửa thực phẩm mock; danh sách nhà cung cấp của bếp vẫn dùng cùng facade. Không đổi contract BE. Chưa xác nhận bằng trình duyệt do công cụ browser không mở được localhost trong phiên này.

## Lesson

Mọi dữ liệu phụ tải khi modal mount phải theo cùng nguồn mock/API với màn chính; 401 từ lời gọi BE ngoài ý muốn có thể kết thúc phiên mock.
