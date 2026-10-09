---
paths:
  - "src/**/*.jsx"
  - "src/**/*.css"
  - "src/components/ui/icons.js"
---

# UI style rules

> Nguồn: `DESIGN.md` (design system chung web + app). Đọc mục 1–2 trước khi sửa giao diện.

- Màu, cỡ chữ, khoảng cách, bo góc, bóng, thời lượng chỉ qua `var(--token)` lớp semantic/component trong `src/styles/tokens.css`; không mã hex, không px cứng, không primitive (`--blue-700`) trong component.
- Dùng component/class chung theo bảng mục 6 (`.btn`, `.card`, `StatusBadge`, `ConfirmationModal`, `SubmitOverlay`, `EmptyState`…); thiếu thì thêm vào phần dùng chung.
- Tông trạng thái theo bảng 3.2 (`purple` ở web = vàng chờ duyệt); mỗi feature một bảng map qua `createStatusBadge`.
- Icon chỉ qua `@/components/ui/icons`; thêm icon mới ở `icons.js`.
- `style={{}}` chỉ cho giá trị động. Phần tử bấm được dùng được bằng bàn phím. CSS đặt ở đâu, đặt tên: `docs/architecture/CODING_GUIDE.md` mục 3.
- Đủ trạng thái mục 9; câu chữ, thuật ngữ mục 10.
- Trước khi báo xong: lệnh mục 13.1 + `node scripts/verify.mjs`.
