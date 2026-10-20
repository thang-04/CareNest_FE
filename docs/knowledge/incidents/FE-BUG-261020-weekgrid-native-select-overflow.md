---
id: FE-BUG-261020-weekgrid-native-select-overflow
type: bug
screens: [weekly-menu]
be_modules: [nutrition]
rules: []
status: fixed
date: 2026-10-20
keywords: [thực đơn tuần, WeekGrid, select, tràn cột, chọn món, thực đơn mẫu, Thêm món, table-layout fixed]
similar_to: [FE-BUG-261020-card-edge-and-table-overflow]
---

# FE-BUG-261020-weekgrid-native-select-overflow — Ô chọn thực đơn mẫu / chọn món trong bảng tuần tràn cột, khó bấm

## Symptom
Bảng thực đơn tuần (`WeekGrid`, `/menu-planning/weekly…`, PHT soạn): ô "Chọn thực đơn mẫu" đầu cột ngày quá dài, tràn sang cột bên cạnh. Bấm "+ Thêm" trong ô món ⇒ ô "Chọn món…" cũng tràn, bị cắt, khó bấm; người dùng báo "không có dữ liệu hay không nhấn được". Không có lỗi console.

## Điều kiện tái hiện
Vai trò PHT, tuần đang soạn (editable), tên thực đơn mẫu/tên món dài (hàng không phân loại còn thêm " (loại món)"). Chrome desktop.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Nghi thiếu dữ liệu: chạy `getMenuCatalog` + `weekSections` trên mock (node + loader test) | Mỗi hàng đều có món ACTIVE (Cơm 2, Mặn 8, Canh 5, Rau 1, Tráng miệng 4, bữa sáng/chiều 25) | Dữ liệu seed đủ; "không có dữ liệu" chỉ xảy ra khi loại món chưa có món "Đang sử dụng" (món Nháp/Ngừng bị lọc) |
| 2 | Xem CSS `.td-week__day .select`, `.td-week__pick` | Không có `width`/`min-width` | Nguyên nhân chính (xem Root cause) |

## Root cause
FE. `<select>` gốc có chiều rộng nội tại = option dài nhất; đặt trong grid item (`.td-week__day` là `display:grid`) / ô bảng `table-layout: fixed` mà không có `width:100%; min-width:0` ⇒ không co theo cột, tràn sang ô bên cạnh (`src/styles/modules/menu-planning.css` `.td-week__day .select`, `.td-week__pick`). Phụ: sau "Thêm" phải bấm lần hai mới mở danh sách; loại món chưa có món đang dùng thì danh sách chỉ có "Chọn món…" không giải thích.

## Fix
- CSS: `.td-week__day .select` và `.td-week__pick` thêm `width:100%; min-width:0; max-width:100%`, cắt "…"; ô thực đơn mẫu có `title` = tên đầy đủ.
- `src/components/menu-planning/WeekGrid.jsx`: bấm "Thêm" gọi `showPicker()` (bọc try/catch) để mở luôn danh sách; Esc đóng; loại món không có món đang dùng ⇒ hiện "Chưa có món … đang sử dụng." + nút Đóng thay vì select rỗng.

## Regression test
Chưa có test tự động (repo chưa có test DOM/trình duyệt). `node scripts/verify.mjs` chỉ kiểm build/lint/test logic. Chưa kiểm bằng trình duyệt trong phiên sửa — cần xem lại `/menu-planning` tuần soạn ở 1280px.

## Ảnh hưởng
Chỉ `WeekGrid` (dùng ở `WeeklyMenuPage`, `AiWeekComposer`). Form dùng `SearchSelect` không bị (có `width:100%`, list cuộn). Không cần BE/APP đổi.

## Lesson
`<select>` gốc trong ô lưới/bảng luôn cần `width:100%; min-width:0` — không thì rộng theo option dài nhất.
