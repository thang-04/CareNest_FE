---
paths:
  - "src/**/*.jsx"
  - "src/**/*.css"
  - "src/components/ui/icons.js"
---

# UI style rules

> Đọc `docs/design/UI_CARD.md` trước khi sửa giao diện (1 trang: component nào cho việc gì, luật cứng, tự kiểm). `DESIGN.md` là bản đầy đủ, chỉ tra khi cần; số mục dưới đây là mục của `DESIGN.md`.

- Màn mới và màn đang sửa dùng component nền từ `@/components` (`ListPage`, `PageHeader`, `DataTable`, `Button`, `TextField`/`SelectField`/`TextAreaField`, `LABELS`); không viết tay `<button>`, `<table>`, `<input>`, `<select>`, `<textarea>` ngoài `components/ui`, `components/form`. Nút gửi dùng `loading` để chặn gửi hai lần.

- Màu, cỡ chữ, khoảng cách, bo góc, bóng, thời lượng chỉ qua `var(--token)` lớp semantic/component trong `src/styles/tokens.css`; không mã hex, không px cứng, không primitive (`--blue-700`) trong component.
- Dùng component/class chung theo bảng mục 6.3 (có cột File); thiếu thì thêm vào phần dùng chung, không dựng bản riêng trong module. Mẫu đang bị nhân bản (tabs, ô chọn điểm trường, KPI, lịch sử, nhãn AI, thanh lọc riêng): mục 14.1 — **không nhân bản thêm**; chạm tới thì promote.
- CSS module không viết lại class đã có trong `components.css` (`.tabs`, `.stat-card`, `.filter-bar`, `.page__head`…); chỉ thêm phần đặc thù, tiền tố module.
- Tông trạng thái theo bảng 3.2 (`purple` ở web = vàng chờ duyệt); mỗi feature một bảng map qua `createStatusBadge`.
- Icon chỉ qua `@/components/ui/icons`; thêm icon mới ở `icons.js`.
- `style={{}}` chỉ cho giá trị động. Phần tử bấm được dùng được bằng bàn phím. CSS đặt ở đâu, đặt tên: `docs/architecture/CODING_GUIDE.md` mục 3.
- Đủ trạng thái mục 9; câu chữ, thuật ngữ mục 10.
- Trước khi báo xong: `node scripts/verify.mjs` (đã gồm `scripts/check-design.mjs` = lệnh mục 13.1, fail khi vượt baseline).
