---
id: FE-BUG-YYMMDD-slug    # FE-BUG- | FE-CASE- | FE-ENV- ; tên file = <id>.md
type: bug              # bug | edge-case | env
screens: [attendance-entry]   # screen group / route
be_modules: [attendance]      # module BE liên quan (nếu có)
rules: [ATT-01]               # rule ID BE liên quan (nếu có)
status: open           # open (đang điều tra, root cause có thể chưa rõ) | workaround | fixed
date: YYYY-MM-DD
keywords: [điểm danh, stale cache, 403]
similar_to: []         # ID incident FE/BE liên quan
---

# <ID> — <tiêu đề ngắn mô tả triệu chứng>

## Symptom
Hiện tượng quan sát được (màn hình, role, thao tác). Chuỗi lỗi **nguyên văn** (dòng quyết định, không dán cả stack):
```text
<console error / network status + desc / build output>
```

## Điều kiện tái hiện
Route, role/scope, dữ liệu tối thiểu, trình duyệt, bước. Không dùng dữ liệu trẻ thật.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | | | |

## Root cause
Nguyên nhân + **bằng chứng** (file:line, network log, test chứng minh). Ghi rõ FE hay BE. Chưa chứng minh ⇒ ghi `Chưa rõ` + giả thuyết hiện tại.

## Fix
Thay đổi gì, ở đâu (file/PR/commit). Vì sao cách này đúng.

## Regression test
Tên test + vị trí. Test fail trước fix, pass sau fix.

## Ảnh hưởng
Màn hình/role khác bị ảnh hưởng; cần BE/APP thay đổi không (nếu có ⇒ đã đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`).

## Lesson
1–2 câu tổng quát. Nếu lặp ở chỗ khác ⇒ thêm vào `docs/knowledge/PATTERNS.md`.
