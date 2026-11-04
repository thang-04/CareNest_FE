---
id: FE-BUG-261102-subdomain-delete-ordinal
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-48]
status: fixed
date: 2026-11-02
keywords: [subNo, closure, ordinal, xóa lĩnh vực con, số thứ tự]
similar_to: []
---

# Hộp xóa nhánh đầu ghi số thứ tự của nhánh cuối

## Symptom / Điều kiện tái hiện
GoalTable có2sub; bấm nút aria-label Xóa lĩnh vực con1 thì xác nhận ghi Xóa lĩnh vực con2, dù tên/ID/phạm vi xóa vẫn là nhánh1. Phát hiện khi kiểm ảnh cuối vòng spec006.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Inspect ảnh confirm sau convergence đầu | Có lệch số1→2, không lệch ID/tên/counts | Review chỉ counts không đủ |
| 2 | Append taskT023, thêm assertion ordinal vào local browser và real E2E | RED local nhận Xóa lĩnh vực con2 khi cần1 | Counter bị đọc lúc click, không phải lúc render |
| 3 | Capture const currentSubNo riêng mỗi block, dùng chung label/callback/aria-label | Local browser GREEN; E2E1/1passed20.3s, cleanup API0 | Giữ snapshot giá trị cho event callback |

## Root cause / Fix
GoalTables.jsx domainRows tăng let subNo trong forEach nhưng callback đóng trên cùng binding mutable. Thay bằng const currentSubNo = subNo bên trong nhánh b.sub; không đổi logic xóa hoặc thứ tự domain.

## Regression / Ảnh hưởng
tests/e2e/system/year-plan-subdomain-delete.spec.mjs kiểm Xóa lĩnh vực con1 trước Hủy/Xóa/lưu/mở lại. Local harness subdomain-delete-review.mjs kiểm ordinal/counts/read-only/4viewport. Review độc lập sau fix không thấy gap. Không API/DB/quyền mới; không sửa dữ liệu ngoài fixture ownedID.
