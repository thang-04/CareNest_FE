---
id: FE-BUG-261109-year-plan-save-scroll
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-10, EDU-22]
status: fixed
date: 2026-11-09
keywords: [lưu, cuộn, mục tiêu, kn1.10]
---

# Lưu kế hoạch làm thay đổi vị trí đang nhập trong bảng mục tiêu

## Symptom
User báo nhập ở kn1.10 rồi bấm Lưu bị cuộn lên kn1.1; yêu cầu giữ vị trí hiện tại.

## Root cause
Luồng nhận phản hồi `useYearPlanAutosave` gọi `reconcileYearPlanIds` rồi `setDoc`; ID tạm của dòng/nội dung được thay bằng ID server. `GoalTables` dùng ID nội dung làm key của tr nên các dòng này dựng lại. Trước sửa không bảo toàn vị trí cuộn khi áp dụng phản hồi. Đây là đường cập nhật có thể gây mất vị trí; chưa tái hiện trực tiếp scroll anchoring trên trình duyệt của user theo giới hạn AGENTS.md.

## Attempts
1. Đọc luồng lưu, key bảng và layout: saveGoal cập nhật provider không bật loading toàn màn; app dùng document làm vùng cuộn chính.
2. Giữ vị trí ngay trước setDoc và khôi phục trong layout effect sau commit: test mô phỏng thay ID/dựng lại DOM đạt, gồm cả cuộn thêm khi chờ server và lỗi lưu.

## Fix
`useYearPlanAutosave` chụp scrollTop/scrollLeft của document và các table-wrap trong kế hoạch ngay trước áp dụng phản hồi thành công. Layout effect khôi phục một lần trước khi vẽ; không chụp từ lúc bấm Lưu nên vẫn giữ được vị trí mới nếu user cuộn trong lúc chờ. Không đổi dữ liệu, ID, API hay cơ chế retry/lease.

## Regression test
`tests/education-plan/year-plan-save-scroll.test.mjs`: chạy hook với vòng render giả lập và DOM cuộn giả; kiểm tra vị trí tại lúc nhận phản hồi, cuộn ngang, không khôi phục lặp lại và không kéo trang khi lưu lỗi. Test này không thay thế kiểm thử trình duyệt.
