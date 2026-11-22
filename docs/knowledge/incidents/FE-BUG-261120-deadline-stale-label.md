---
id: FE-BUG-261120-deadline-stale-label
type: bug
screens: [education-plan]
rules: [EDU-74, EDU-76, EDU-94, EDU-97]
status: fixed
date: 2026-11-20
keywords: [hạn duyệt, gần đến hạn, quá hạn, timeLock]
---

# Nhãn hạn có thể giữ Gần đến hạn sau khi qua ngày

Bộ ghép danh sách giữ chi tiết đã tải khi phiên bản và nội dung không đổi, bao gồm cả hạn cũ. Badge cũng chưa đổi nhãn khi tab mở qua nửa đêm. API năm/tổ đã tính thời gian gửi lại trong trạng thái hạn nhưng thiếu `graceTo` và `daysLeft` trong `timeLock`.

FE dùng thông tin hạn mới từ danh sách và cập nhật nhãn đang gần đến hạn theo ngày Việt Nam. BE trả ngày khóa gửi lại và số ngày còn lại cho kế hoạch năm/tổ, cùng dữ liệu các hồ sơ lớp đã có. Quyền gửi, mở hạn và hạn xử lý duyệt tiếp tục do BE quyết định.

Kiểm thử liên quan: `deadline-badge.test.mjs`, `lazy-goal-details.test.mjs`, `EduDeadlineTest`, `EduPlanTimeLockTest` và `EduYearPlanUnlockIntegrationTest`.
