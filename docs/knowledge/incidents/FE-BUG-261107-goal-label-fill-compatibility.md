---
id: FE-BUG-261107-goal-label-fill-compatibility
type: bug
modules: [education-plan]
rules: [EDU-58]
status: fixed
date: 2026-11-07
keywords: [displayLabel, pointer capture, touch, curriculumShape, property order, old client]
similar_to: []
---

# Nhãn mục tiêu — kéo cảm ứng và client cũ của mock

## Symptom
Review phát hiện: implicit pointer capture của touch/pen giữ con trỏ tại tay kéo, ô đích không nhận pointerenter. Mock TEAM có nhãn nhưng client cũ không gửi field có thể bị YEAR_PLAN_EDIT_FORBIDDEN dù cây không đổi.

## Attempts
| # | Cách kiểm tra | Kết quả |
| --- | --- | --- |
| 1 | Review độc lập pointer handlers | Cần release implicit capture trước khi dùng pointerenter chọn vùng |
| 2 | Thực thi callback pointer/keyboard với hooks có kiểm soát | Release capture, preview không ghi, pointerup commit, Escape/pointercancel hủy đạt |
| 3 | Tái hiện guard mock qua JSON.stringify curriculumShape | Khôi phục displayLabel ở cuối object làm thứ tự property khác baseline |
| 4 | Destructure displayLabel/contents trước spread để canonical thứ tự, test old TEAM client bỏ label | Save thành công, giữ nhãn; đổi nhãn trái phép vẫn bị chặn |

## Root cause và fix
`GoalTables.jsx`: releasePointerCapture nếu handle đang giữ capture. `planLevel.mjs`: canonical vị trí displayLabel/contents khi so cây. `educationPlanMockRepository.js`: null/omitted giữ nhãn, blank clear, max100 như BE. Không dùng nhãn làm key hoặc thay số nội bộ.

## Regression test
`branch-template-enter.test.mjs`: nhập nhãn, preview/commit pointer, capture release, bàn phím/Escape/pointercancel. `school-year-team-mock.test.mjs`: annual/TEAM client cũ giữ nhãn, TEAM đổi nhãn bị từ chối. Final native giáo dục248/248, fail/skip0; review độc lập chạy lại mock4/4. Chưa browser/cảm ứng thiết bị thật.

## Lesson
Không dựa vào pointerenter khi pointer bị capture. Guard dựa vào JSON phải chuẩn hóa thứ tự field tùy chọn, tránh nhầm khác thứ tự property với khác dữ liệu.
