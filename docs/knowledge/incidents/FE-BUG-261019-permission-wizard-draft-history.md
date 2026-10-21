---
id: FE-BUG-261019-permission-wizard-draft-history
type: bug
screens: [permissions]
be_modules: [identity-access]
rules: [AUTH-07]
status: fixed
date: 2026-10-19
keywords: [wizard, draft, permission, history, userId, remount]
similar_to: []
---

# Wizard phân quyền mất lựa chọn khi quay lại; lịch sử bỏ qua tài khoản đích

## Symptom

Review tĩnh Phase 2 phát hiện bước 2 → 3 → 2 bỏ draft công tắc do bước 2 unmount; nhấn Tiếp tục có thể gửi mảng rỗng thay lựa chọn vừa nhập. Link người trong lịch sử có userId nhưng trang ngoại lệ không đọc query.

## Điều kiện tái hiện

UI G94-209 ghép demo độc lập theo lựa chọn người dùng ngày 2026-10-19. Không thay quyền thật hoặc catalog legacy.

## Attempts

| #   | Cách thử                                                                   | Kết quả                                            | Bài học                                                                            |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Nhập UI và review tĩnh độc lập                                             | Phát hiện mất draft khi remount và query bị bỏ qua | Test lưu đơn lẻ không đủ cho wizard nhiều bước                                     |
| 2   | Hydrate từ draft kể cả mảng rỗng; lọc userId và tra nhân sự kể cả đã reset | Đang chạy regression/browser                       | Tách không-có-draft với draft rỗng; lịch sử không phụ thuộc danh sách còn ngoại lệ |

## Root cause

State cục bộ của bước bị hủy khi unmount; payload có ở parent nhưng không dùng lại. Trang đích chỉ đọc danh sách ngoại lệ, không xử lý query tài khoản.

## Fix

`permissionDraftRows` ưu tiên draft nullish; trang ngoại lệ đọc userId, lọc và cung cấp nút cấu hình cho nhân sự đã reset về mặc định. Không map TEAM_LEADER thành TEACHER.

## Regression test

Đã chạy `node scripts/verify.mjs` → VERIFY PASS full, gồm 103 test (27 integration). Browser Principal demo: 2→3→2 công tắc vẫn bật, 3→lưu hiển thị ngoại lệ đúng. Review tĩnh vòng 2 PASS_WITH_RISK, không lỗi chặn; chưa xác nhận BE thật. Cổng được chạy lại sau cập nhật docs/CSS cuối.

`tests/integration/selective-merge/permission-center.test.mjs`; bằng chứng cuối ghi Progress log của plan ghép chọn lọc.

## Ảnh hưởng

Chỉ UI và mock demo độc lập, không sửa auth/BE/App.

## Lesson

Wizard phải kiểm tra vòng quay lại; liên kết lịch sử phải hoạt động cả khi bản ghi hiện tại không còn trong danh sách mặc định.
