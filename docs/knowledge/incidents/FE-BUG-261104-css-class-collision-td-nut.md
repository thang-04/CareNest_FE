---
id: FE-BUG-261104-css-class-collision-td-nut
type: bug
screens: [menu-templates]
be_modules: []
rules: []
status: fixed
date: 2026-11-04
keywords: [tràn ngang, 375px, class trùng, td-nut, display grid, table-wrap]
similar_to: []
---

# FE-BUG-261104 — Trùng tên class `.td-nut` làm trang mẫu ngày tràn ngang ở 375px

- **Vùng:** `src/styles/modules/menu-planning.css`, thẻ "Thông tin dinh dưỡng 1 trẻ / ngày" ở `/menu/templates/:id`.
- **Triệu chứng:** ở 375px trang cuộn ngang 412px dù bảng đã nằm trong `.table-wrap`.
- **Nguyên nhân:** class mới `.td-nut` trùng `.td-nut { display: grid }` có sẵn (NutrientBars). Card thành grid cột `auto` nên giãn theo bảng bên trong, `.table-wrap` không còn cắt.
- **Cách tìm:** in chuỗi cha của phần tử rộng kèm `display` (thấy `SECTION.card.td-nut d=grid`), không chỉ đo phần tử lá.
- **Sửa:** đổi tên class của thẻ mới thành `td-daynut`. Trước khi đặt class mới trong file CSS module lớn: grep `^\.ten-class` trong file.
- **Trạng thái:** fixed (2026-11-04).
