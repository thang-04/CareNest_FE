---
paths:
  - "src/**/*.tsx"
  - "src/**/*.jsx"
---

# Component rules (React, framework-neutral)

> Framework (Next.js hay khác), router, UI kit: PROPOSED/chưa chốt. Không dùng API riêng của framework (server component, `next/*`, loader...) khi source chưa có — hỏi trước.

- Component hiển thị (presentational) nhận dữ liệu qua props; logic gọi API/state nằm ở hook hoặc container. Không gọi `fetch` trực tiếp trong component — đi qua API client (`.claude/rules/api-client.md`).
- Mỗi màn hình dữ liệu xử lý đủ: **loading, empty, error, 403 (không quyền), 404 (không tồn tại/ngoài scope)**. Không render màn hình trắng khi lỗi.
- **Không tính lại dữ liệu nghiệp vụ** trong component (số suất, tổng hợp báo cáo, trend sức khỏe, trạng thái duyệt). Hiển thị giá trị BE trả về; chỉ format (số, ngày, đơn vị).
- Ẩn/disable hành động theo permission BE trả về là UX; BE vẫn kiểm tra. Không dựa vào ẩn nút để bảo vệ dữ liệu.
- Nội dung do AI tạo: hiển thị rõ nhãn DRAFT/chờ duyệt, có hành động duyệt/sửa theo quyền; màn hình phải dùng được khi AI không khả dụng.
- Dữ liệu sức khỏe: chỉ hiển thị số đo và chênh lệch BE trả; không tự gắn nhãn chẩn đoán (xem Known pitfalls `../CareNest_BE/docs/modules/health.md`).
- Form: label gắn với input, thông báo lỗi field từ response 400 của BE, chặn double submit khi đang gửi, giữ dữ liệu người dùng khi lỗi.
- Accessibility: phần tử tương tác dùng `button`/`a` đúng nghĩa, focus thấy được, dùng được bằng bàn phím, ảnh có `alt`.
- Không render HTML thô từ dữ liệu người dùng/AI (`dangerouslySetInnerHTML`) khi chưa sanitize.
- Không `console.log` dữ liệu trẻ, sức khỏe, token. Text hiển thị tiếng Việt.
