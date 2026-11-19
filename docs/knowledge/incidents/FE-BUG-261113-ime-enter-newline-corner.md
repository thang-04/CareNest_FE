---
id: FE-BUG-261113-ime-enter-newline-corner
type: bug
screens: [education-plan-week]
be_modules: [education-plan]
rules: [EDU-16, EDU-22]
status: fixed
date: 2026-11-13
keywords: [hoạt động góc, Enter, bộ gõ tiếng Việt, IME]
---

# FE-BUG-261113 — Enter qua bộ gõ tiếng Việt xuống dòng trong ô bảng góc

- **Màn**: Kế hoạch tuần › IV. Hoạt động góc (`components/education-plan/WeekPlanBody.jsx`).
- **Triệu chứng**: gõ tiếng Việt rồi Enter thì chữ xuống dòng ngay trong ô (ô cao lên), không tạo dòng mới của bảng (Tiền 13/11/2026).
- **Nguyên nhân**: `cornerKeys` bỏ qua Enter khi `isComposing` (để không phá bộ gõ). Bộ gõ đang ghép chữ (Telex của Windows…) chuyển
  tiếp Enter nên trình duyệt chèn `\n` vào textarea; dòng còn trống hết cũng không chặn Enter.
- **Sửa**: nhớ Enter thường (`plainEnter`) ở keydown; `cornerInput` ở onChange bỏ `\n` vừa thêm rồi chạy thao tác Enter của bảng
  (`cornerEnter`). Ô tên góc không bao giờ giữ `\n`; Shift+Enter vẫn xuống dòng trong ô nhiều dòng.
- **Test**: `tests/education-plan/week-corner-enter.test.mjs` (ca IME). Bảng khác có Enter-thêm-dòng mà cũng bỏ qua `isComposing` có thể
  gặp cùng lỗi — kiểm khi chạm tới.
