---
paths:
  - "src/pages/education-plan/GoalFormPage.jsx"
  - "src/components/education-plan/GoalTables.jsx"
  - "src/components/education-plan/ImportGoalsModal.jsx"
  - "src/hooks/education-plan/useManualSave.js"
  - "src/hooks/education-plan/useYearPlanAutosave.js"
  - "src/models/education-plan/planBackup.mjs"
  - "src/services/education-plan/planBackup.js"
  - "src/pages/education-plan/WeekPlanPage.jsx"
  - "src/hooks/useLeaveGuard.js"
  - "src/components/ui/LeaveConfirmModal.jsx"
  - "src/pages/education-plan/BranchPlanPage.jsx"
  - "src/pages/education-plan/ClassThemePlanPage.jsx"
  - "src/pages/education-plan/EduConfigPage.jsx"
---

# Kế hoạch giáo dục — lưu nội dung, cảnh báo rời màn, xác nhận khi xóa

> Phạm vi: màn lập/sửa kế hoạch năm học (`GoalFormPage`); Tiền 23/10/2026 mở rộng sang Chủ đề nhánh (`BranchPlanPage`), Kế hoạch chủ đề (`ClassThemePlanPage`) và Cấu hình kế hoạch giáo dục (`EduConfigPage`). Không áp sang module khác (bếp, sức khỏe, điểm danh…) khi chưa được yêu cầu.

- Xóa một mục (dòng, lĩnh vực, người ký, mục tiêu, chủ đề…) chỉ bằng nút thùng rác `icon-btn--danger` và luôn qua `ConfirmationModal` (danger) nêu tên mục và những gì mất kèm; bỏ nhiều thứ một lần (vd. "Bỏ tất cả" gợi ý AI) cũng hỏi. Backspace ở ô trống không xóa dòng; Enter ở ô tên thêm dòng dưới.

- **Mọi màn kế hoạch lưu tay** (Tiền 22/10, kế hoạch năm từ 27/10): chỉ ghi lên hệ thống khi bấm Lưu đầu trang/Ctrl+S (và gửi/ban hành — lưu trước). Không hẹn giờ tự lưu, không tự thử lại khi lỗi. Màn lớp dùng `useManualSave`, GoalFormPage dùng `useYearPlanAutosave` (giữ phiên sửa/heartbeat/revision); `unsaved` = bản đang sửa khác bản vừa nạp/vừa lưu. Trạng thái chỉ: Có thay đổi chưa lưu · Đang lưu… · Đã lưu lúc hh:mm · Chưa lưu được.
- **Bản giữ ẩn trên máy** (Tiền 27/10): còn khác bản đã lưu thì ghi localStorage mỗi 750ms + `pagehide`, riêng theo tài khoản + tài liệu (`useManualSave({ backup: { userId, key } })` → `services/education-plan/planBackup.js`; năm học: `yearPlanRecovery.js`). **Không hiện chữ nào về tự lưu/lưu tạm/lưu trên máy.** Lưu được hoặc chọn "Không lưu" ⇒ xóa bản giữ (`discardBackup`/`clearRecovery` trước `guard.modal.onDiscard`). Mở lại mà bản giữ khác bản trên hệ thống ⇒ `DraftRecoveryNotice` (Khôi phục · Bỏ); bản trên hệ thống đã đổi revision/trạng thái/lịch sử từ lúc giữ (đã gửi, bị trả lại…) ⇒ không mời khôi phục (năm học: hiện lý do + tải nội dung để đối chiếu). `EduConfigPage` là cấu hình, không có bản giữ.
- Còn thay đổi chưa lưu mà sang màn khác ⇒ **luôn hỏi** bằng `LeaveConfirmModal` (Hủy · Không lưu · Lưu) qua `useLeaveGuard({ when: canEdit && saver.unsaved, onSave: saver.save })`. Phải chặn đủ các đường rời màn:
  - link/menu sidebar (thẻ `<a>` nội bộ) và nút Back của trình duyệt — `useLeaveGuard` tự chặn;
  - nút trong màn (Hủy, Quay lại, mở chi tiết…) ⇒ `guard.leave(to)`, không gọi `navigate()` thẳng;
  - header (tìm kiếm, thông báo, menu user, đăng xuất) ⇒ `useGuardedNavigate()`;
  - đóng/tải lại tab ⇒ `beforeunload` trong `useManualSave`/`useLeaveGuard` (hộp của trình duyệt).
- GoalFormPage theo BE:EDU-10/22/23 và [đặc tả BE](../../../CareNest_BE/specs/001-year-plan-autosave/spec.md) (mục tự lưu 2s/15s đã bỏ 27/10): đổi tab giữ nội dung, không lưu. Bản giữ chỉ qua service, riêng từng tài khoản/kế hoạch/phiên. Khi gửi/ban hành khóa nhập và đợi lưu xong; không tự ghi đè khi mất quyền. Chuyển địa chỉ /new sang ID thật sau lần Lưu đầu là cùng bản đang soạn, giữ nguyên form/queue.
- Vừa lưu/gửi/ban hành xong rồi chuyển màn ⇒ `guard.leaveNow(to)` (không hỏi lại). Chỉ xem (không có quyền sửa, đã ban hành) ⇒ guard tắt.
- "Lưu" trong hộp hỏi lưu không được (lỗi validate/BE) ⇒ ở lại màn, giữ dữ liệu, báo lỗi; không rời màn.
- Thêm nút/đường điều hướng mới trên màn này ⇒ phải đi qua guard; kiểm tay: sửa 1 ô → bấm menu, Back, nút Hủy, header ⇒ đều hiện hộp hỏi; tải lại ⇒ hộp của trình duyệt; đóng tab không lưu rồi mở lại ⇒ mời khôi phục.
