---
id: FE-BUG-261029-version-assessment-merge
type: bug
screens: [daily-assessment]
be_modules: [education-plan, learning-observation]
rules: [EDU-26]
status: fixed
date: 2026-10-29
keywords: [merge, lineage, phiên bản, tổng quan]
---
# Contract đánh giá mới bỏ bước map mục tiêu qua phiên bản

Incoming có toPlanCriteria ở legacy readers; WIP thay bằng contract mới nên helper mất caller. Test assessment-version-merge.test.mjs fail với g1/removed thay vì g11; thêm assertion tổng quan tái hiện dat=2 thay vì1. projectedAssessment dùng chung daily và classPeriodStats, giữ ba mức/participation, bỏ MT không còn trong hoạt động, không ghi DB khi xem. Test qua đọc→tổng quan→lưu đạt; dashboard/hardening65/65. BE sửa tương ứng qua service boundary; không đổi DTO/endpoint.
