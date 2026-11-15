---
id: FE-BUG-261108-dropdown-behind-modal
type: bug
screens: [menu-templates, menu-statistics, boarding-today, kitchen-forecast]
be_modules: [nutrition]
rules: []
status: fixed
date: 2026-11-08
keywords: [lọc không bấm được, danh sách xổ nằm sau modal, z-index, SearchSelect, CampusFilter mất nhãn, align-items end, vỡ form]
similar_to: [FE-BUG-261020-card-edge-and-table-overflow]
---

# FE-BUG-261108-dropdown-behind-modal — danh sách xổ nằm sau modal, ô lọc lệch, form vỡ khi có lỗi

## Symptom

User báo trên `dev.carenest.edu.vn`: ô "Tất cả loại món" trong hộp thêm món bấm không có tác dụng; ô điểm trường ở Thống kê định lượng lệch ô bên cạnh; nhập sai kỳ dự trù thì form vỡ, câu lỗi dài hiện hai lần.

## Điều kiện tái hiện

Mẫu thực đơn → Tạo mẫu → Thêm món → bấm ô loại món. Thống kê định lượng với vai có 2 điểm trường. Lập bản dự trù, Từ ngày sau Đến ngày.

## Attempts — đã thử

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đọc `AddDishesModal`, nghi lọc sai logic | Logic lọc đúng | Lỗi ở lớp hiển thị, không ở dữ liệu |

## Root cause

- `.search-select__panel` và `.row-menu__panel` render ra body với `--z-dropdown` (300), thấp hơn modal (1000) nên nằm sau lớp phủ.
- `origin/dev` commit `0d363e7` xóa nhãn trong `CampusFilter`, ô không còn nhãn nên thấp hơn các ô có nhãn.
- `.kb-forecast-form` dùng `align-items: end`: lỗi dưới một ô đẩy các ô còn lại xuống.

## Fix

- Thêm `--z-popover` (1020), hai panel dùng token này.
- Trả lại nhãn trong `CampusFilter`.
- Form dự trù xếp theo hàng, căn đỉnh; lỗi kỳ hiện một lần, ngắn.

## Regression test

Chưa có test tự động cho z-index. Kiểm trên trình duyệt: `document.elementFromPoint` tại panel trả về chính panel.

## Ảnh hưởng

Mọi `SearchSelect`, `RowMenu` đặt trong modal; mọi nơi dùng `CampusFilter`.

## Lesson

Lớp nổi render ra body phải cao hơn modal, kể cả khi hiện chưa màn nào đặt nó trong modal. Hàng ô nhập có thể hiện lỗi thì căn đỉnh, không căn đáy.
