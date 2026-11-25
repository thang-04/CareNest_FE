---
id: FE-BUG-261123-review-turn-status-label
type: bug
screens: [education-review, education-plan-detail]
be_modules: [education-plan]
rules: [EDU-93, EDU-97]
status: fixed
date: 2026-11-23
keywords: [chờ duyệt, đúng lượt, nhãn trạng thái, hạn duyệt]
similar_to: []
---

# Nhãn Chờ duyệt của người đúng lượt thiếu nhất quán

## Tái hiện

Ở hồ sơ REVIEW nhiều bước, cờ duyệt và trả lại có thể cùng là false khi hết hạn. Khi đó nhãn cũ hiện tên vai trò đang chờ ngay cả với người mà API đánh dấu là đúng lượt.

## Nguyên nhân và cách sửa

Hai nhãn trạng thái dùng chung `waitingLabel`. Hàm này từng dùng quyền thao tác để suy ra lượt duyệt. Nay ưu tiên `isCurrentReviewer` do API trả trong thông tin hạn duyệt và chỉ hiện tên vai trò cho người khác khi chuỗi có từ hai bước. Hàng chờ vẫn dùng quyền thao tác để chọn nút Mở duyệt hoặc Xem.

## Kiểm tra

`review-turn.test.mjs` bao phủ đúng lượt, khác lượt, hết hạn, chuỗi một bước và hai dạng payload. `returned-display-status.test.mjs` kiểm tra hai nhãn khi render badge kế hoạch và badge hồ sơ lớp.
