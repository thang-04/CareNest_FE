---
id: FE-BUG-261028-version-plan-dup-age-group
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-25]
status: fixed
date: 2026-10-28
keywords: [phiên bản điều chỉnh, version, trùng nhóm tuổi, Nhóm tuổi này đã có kế hoạch năm học, đang chờ quyền sửa, dupGoal, GoalFormPage]
similar_to: []
---

# FE-BUG-261028-version-plan-dup-age-group

- **Màn hình:** `/education/goals/:id/edit` khi kế hoạch là phiên bản điều chỉnh (BE:EDU-25, `CareNest_BE/specs/004-year-plan-versioning`).
- **Triệu chứng:** bấm "Tiếp theo" báo "Nhóm tuổi này đã có kế hoạch năm học. Mở kế hoạch đã có để chỉnh sửa."; nút Lưu mờ, trạng thái "Chọn năm học và nhóm tuổi; đang chờ quyền sửa" ⇒ bản V2 không lưu được trên web.
- **Root cause:** `GoalFormPage` coi mọi kế hoạch khác cùng (năm học, nhóm tuổi) là trùng (`dupGoal`, validate bước 1). Từ 004 các phiên bản cùng chuỗi dùng chung (năm học, nhóm tuổi) nên V1 làm V2 bị chặn. Test model/mock không bắt được vì chỉ mở form qua Playwright mới thấy.
- **Sửa:** chỉ kiểm trùng khi lập mới hoặc đổi năm học/nhóm tuổi (`sameScope` với kế hoạch đang sửa); một chỗ tính `dupGoal` dùng cho cả validate và `saveReady`.
- **Regression:** Playwright `tests/e2e/system/edu-plan-version-ministry.spec.mjs` ST-14 (sửa V2, lấy mục tiêu của Bộ, Lưu).
- **Status:** fixed (28/10/2026).
