---
id: FE-BUG-261120-branch-null-arrays
type: bug
screens: [education-plan-branches]
rules: [EDU-73, EDU-98]
status: fixed
date: 2026-11-20
keywords: [chủ đề nhánh, nhóm tuổi, lịch v2, branchPayload]
---

# Trang dự kiến chủ đề nhánh lỗi khi lịch v2 trả mảng null

E2E `ST-BRANCH-LIVE` tái hiện trên BE dev khi Phó hiệu trưởng đổi nhóm tuổi. Trace ghi `TypeError: Cannot read properties of null (reading 'map')` tại `branchPayload`. Riêng ca không có kế hoạch tổ `ST-BRANCH-EMPTY` đã qua.

Chuẩn hóa `branches`, `themeSchedules`, `names` và `notes` lúc nạp hoặc khôi phục lịch v2. Áp dụng cả khi cấu hình thời lượng chưa khả dụng. Danh sách và ghi chú đang có vẫn được giữ.

Kiểm tra sau sửa: hai ca trong `tests/e2e/system/branch-empty.spec.mjs` đạt với trace bật. Test đơn vị liên quan 22/22 đạt.
