---
paths:
  - "src/**/*.jsx"
---

# Component rules (React 18 SPA)

> Stack: React 18 + Vite + `react-router-dom` v7, UI kit tự viết (`src/components/ui/`). Không đưa API framework khác (Next.js `next/*`, server component, loader) — hỏi trước. Tầng và chung/riêng: `.claude/rules/architecture.md`; giao diện: `.claude/rules/ui-style.md`.

- Component hiển thị nhận dữ liệu qua props; đọc dữ liệu qua hook module, ghi qua facade service. Không gọi `fetch`/axios trong component (`.claude/rules/api-client.md`).
- Mỗi màn hình dữ liệu xử lý đủ: **loading, empty, error, 403, 404** bằng `LoadingState`/`EmptyState`/`ErrorState` (`src/components/ui/States.jsx`, `ErrorState` tự map 403/404). Không render màn hình trắng khi lỗi.
- File >~400 dòng hoặc >~8 `useState` ⇒ tách view con vào `components/<module>/` và logic vào hook `hooks/<module>/` (vd. nợ: `pages/attendance/AttendancePage.jsx`, `components/education-plan/GoalTables.jsx`).
- **Không tính lại dữ liệu nghiệp vụ** trong component (số suất, tổng hợp báo cáo, trend sức khỏe, trạng thái duyệt). Hiển thị giá trị BE trả về; chỉ format (số, ngày, đơn vị).
- Ẩn/disable hành động theo permission BE trả về là UX; BE vẫn kiểm tra. Không dựa vào ẩn nút để bảo vệ dữ liệu.
- Nội dung do AI tạo: hiển thị rõ nhãn DRAFT/chờ duyệt, có hành động duyệt/sửa theo quyền; màn hình phải dùng được khi AI không khả dụng.
- Dữ liệu sức khỏe: chỉ hiển thị số đo và chênh lệch BE trả; không tự gắn nhãn chẩn đoán (xem Known pitfalls `../CareNest_BE/docs/modules/health.md`).
  Ngoại lệ đã chốt 14/10/2026: thân nhiệt đầu ngày được tô màu theo khoảng cố định (`src/utils/attendance/temperatureLevels.js`, giống mọi nhóm tuổi); hệ thống vẫn không tự chọn "Có dấu hiệu" hay tự tích biểu hiện.
- Form: label gắn với input, thông báo lỗi field từ response 400 của BE, chặn double submit khi đang gửi, giữ dữ liệu người dùng khi lỗi.
- Accessibility: phần tử tương tác dùng `button`/`a` đúng nghĩa, focus thấy được, dùng được bằng bàn phím, ảnh có `alt`.
- Không render HTML thô từ dữ liệu người dùng/AI (`dangerouslySetInnerHTML`) khi chưa sanitize.
- Không `console.log` dữ liệu trẻ, sức khỏe, token. Text hiển thị tiếng Việt.
