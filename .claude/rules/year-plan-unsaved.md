---
paths:
  - "src/pages/education-plan/GoalFormPage.jsx"
  - "src/components/education-plan/GoalTables.jsx"
  - "src/components/education-plan/ImportGoalsModal.jsx"
  - "src/hooks/education-plan/useManualSave.js"
  - "src/hooks/useLeaveGuard.js"
  - "src/components/ui/LeaveConfirmModal.jsx"
  - "src/pages/education-plan/BranchPlanPage.jsx"
  - "src/pages/education-plan/ClassThemePlanPage.jsx"
  - "src/pages/education-plan/EduConfigPage.jsx"
---

# Kế hoạch giáo dục — lưu tay, cảnh báo rời màn, xác nhận khi xóa

> Phạm vi: màn lập/sửa kế hoạch năm học (`GoalFormPage`); Tiền 23/10/2026 mở rộng sang Chủ đề nhánh (`BranchPlanPage`), Kế hoạch chủ đề (`ClassThemePlanPage`) và Cấu hình kế hoạch giáo dục (`EduConfigPage`). Không áp sang module khác (bếp, sức khỏe, điểm danh…) khi chưa được yêu cầu.

- Xóa một mục (dòng, lĩnh vực, người ký, mục tiêu, chủ đề…) chỉ bằng nút thùng rác `icon-btn--danger` và luôn qua `ConfirmationModal` (danger) nêu tên mục và những gì mất kèm; bỏ nhiều thứ một lần (vd. "Bỏ tất cả" gợi ý AI) cũng hỏi. Backspace ở ô trống không xóa dòng; Enter ở ô tên thêm dòng dưới.

- Lưu tay (bỏ tự lưu, Tiền 22/10): nút Lưu đầu trang hoặc Ctrl+S qua `useManualSave`; `unsaved` = bản đang sửa khác bản vừa nạp/vừa lưu.
- Còn thay đổi chưa lưu mà sang màn khác ⇒ **luôn hỏi** bằng `LeaveConfirmModal` (Hủy · Không lưu · Lưu) qua `useLeaveGuard({ when: canEdit && saver.unsaved, onSave: saver.save })`. Phải chặn đủ các đường rời màn:
  - link/menu sidebar (thẻ `<a>` nội bộ) và nút Back của trình duyệt — `useLeaveGuard` tự chặn;
  - nút trong màn (Hủy, Quay lại, mở chi tiết…) ⇒ `guard.leave(to)`, không gọi `navigate()` thẳng;
  - header (tìm kiếm, thông báo, menu user, đăng xuất) ⇒ `useGuardedNavigate()`;
  - đóng/tải lại tab ⇒ `beforeunload` trong `useManualSave` (hộp của trình duyệt).
- Chuyển tab Mục tiêu ↔ Chủ đề khi tab đang rời có thay đổi chưa lưu ⇒ cũng hỏi (`switchTab` trong `GoalFormPage`); "Không lưu" chỉ bỏ thay đổi của tab đó, về bản đã lưu (`saver.cleanDoc()`).
- Vừa lưu/gửi/ban hành xong rồi chuyển màn ⇒ `guard.leaveNow(to)` (không hỏi lại). Chỉ xem (không có quyền sửa, đã ban hành) ⇒ guard tắt.
- "Lưu" trong hộp hỏi lưu không được (lỗi validate/BE) ⇒ ở lại màn, giữ dữ liệu, báo lỗi; không rời màn.
- Thêm nút/đường điều hướng mới trên màn này ⇒ phải đi qua guard; kiểm tay: sửa 1 ô → bấm menu, Back, nút Hủy, header ⇒ đều hiện hộp hỏi.
