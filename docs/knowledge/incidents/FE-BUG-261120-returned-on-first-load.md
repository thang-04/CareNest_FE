---
id: FE-BUG-261120-returned-on-first-load
type: bug
screens: [education-plan]
rules: [EDU-73]
status: fixed
date: 2026-11-20
keywords: [trả lại, nháp, trạng thái, tải danh sách]
---

# Hồ sơ bị trả lại hiện Nháp ở danh sách ban đầu

Danh sách năm/tổ không trả lịch sử, còn danh sách hồ sơ lớp có thể lược lịch sử theo quyền xem. Badge suy từ lịch sử nên lần tải đầu không đủ dữ liệu để hiện Trả lại.

BE trả cờ `returned` từ lần chuyển trạng thái duyệt gần nhất. Hồ sơ lớp đọc lịch sử của gói học kỳ hoặc hồ sơ chủ đề chứa tài liệu. Phản hồi danh sách không bổ sung lý do trả lại. FE dùng cờ cho nhãn và dùng `DRAFT` cho thao tác nghiệp vụ.

Test liên quan: `returned-display-status.test.mjs`, ca `returnYearPlanRevertsToDraftWithReason` và `themeDossierFlow`.
