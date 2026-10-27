---
title: Cảnh báo rời màn hình khi còn thay đổi chưa lưu (chỉ kế hoạch năm học)
status: in-progress
owner: Tiền
jira: G94-226 / BE-FEAT-09   # việc phát sinh trong luồng mục tiêu năm học; cần task FE riêng khi commit
branch: feature/G94-178-FE-FEAT-41-lesson-assessment-parent
modules: []
rules: [.claude/rules/year-plan-unsaved.md]
risk: medium
created: 2026-10-23
updated: 2026-10-23
---
# Cảnh báo rời màn hình khi còn thay đổi chưa lưu (chỉ kế hoạch năm học)

## Context
Tiền yêu cầu (23/10): "cứ một màn hình có thông tin mà sang màn khác mà chưa lưu thì cần cảnh báo" — ban đầu hiểu là quy tắc toàn app; cùng ngày Tiền thu hẹp: "chỉ là quy tắc của phần kế hoạch năm học thôi, không liên quan đến phần khác".
Hiện trạng: chỉ 5 màn kế hoạch giáo dục có `useLeaveGuard` (`src/hooks/education-plan/useLeaveGuard.js`) + `LeaveConfirmModal`; các màn form khác (thực đơn, món, nhà cung cấp, khám sức khỏe, kiểm kê, bàn giao CSVC, hồ sơ…) rời trang là mất dữ liệu. App dùng `BrowserRouter` (không có `useBlocker`), nên guard chặn click `<a>` + nút Back; `navigate()` trong header (tìm kiếm, thông báo, menu user) không bị chặn.

## Quyết định đã chốt
1. **SUPERSEDED (23/10):** ~~áp cho mọi màn có dữ liệu nhập~~ ⇒ chỉ màn lập/sửa kế hoạch năm học (`GoalFormPage`); quy tắc `.claude/rules/year-plan-unsaved.md`. Không mở sang module khác.
2. Modal dùng chung 3 nút **Hủy · Không lưu · Lưu** (Tiền, 23/10); màn không lưu được từ modal thì ẩn "Lưu".
3. Giả định (chế độ tự chạy): không áp cho màn đăng nhập/quên/đặt lại mật khẩu/OTP (luồng xác thực) và form trong modal (đóng modal không phải "sang màn khác"); màn tự lưu ngay khi thao tác (vd. điểm danh từng trẻ) không cần guard.

## Thiết kế
- Chuyển `useLeaveGuard` → `src/hooks/useLeaveGuard.js`, `LeaveConfirmModal` → `src/components/ui/LeaveConfirmModal.jsx` (dùng chung toàn app).
- Hook mới `useUnsavedGuard({ value, ready, onSave })`: chụp mốc khi dữ liệu nạp xong, `dirty` = khác mốc; gắn `useLeaveGuard` + `beforeunload`; trả `{ dirty, markClean, leave, leaveNow, modal }`.
- Guard đang bật đăng ký toàn cục; `useGuardedNavigate()` cho header/thông báo/menu user (kể cả đăng xuất) hỏi trước khi chuyển màn.
- Sau khi lưu xong rồi chuyển màn: `leaveNow(to)`; nút Hủy/Quay lại trong màn: `leave(to)` (nhận cả `-1`).

## Phases
- [x] P1 Hạ tầng (`useLeaveGuard`, `LeaveConfirmModal`, `useGuardedNavigate` ở header) + quy tắc `.claude/rules/year-plan-unsaved.md`.
- [x] ~~P2 Áp cho các màn form còn lại~~ — bỏ (thu hẹp phạm vi).
- [ ] P3 Verify.

## Progress log

### 2026-10-23 — Thu hẹp phạm vi về kế hoạch năm học
- Tiền: quy tắc chỉ cho kế hoạch năm học. Thêm `.claude/rules/year-plan-unsaved.md` (paths: `GoalFormPage`, `GoalTables`, `ImportGoalsModal`, `useManualSave`, `useLeaveGuard`, `LeaveConfirmModal`).
- Gỡ guard khỏi `pages/kitchen/SupplierFormPage.jsx` (trả về bản HEAD) và xóa `useUnsavedGuard` (không còn màn nào dùng).
- Giữ: hook/modal ở vị trí dùng chung (`hooks/useLeaveGuard.js`, `components/ui/LeaveConfirmModal.jsx`) và `useGuardedNavigate` ở header — chỉ hỏi khi màn đang bật guard nên không đổi hành vi màn khác. 4 màn giáo dục khác (chủ đề nhánh, kế hoạch chủ đề, hồ sơ chủ đề, giáo án tuần) giữ guard có từ 22/10, không thuộc quy tắc mới.
- `GoalFormPage` đã đúng quy tắc (nút Hủy dùng `guard.leave`, lưu xong `guard.leaveNow`), không sửa.
- Commit: chưa commit
