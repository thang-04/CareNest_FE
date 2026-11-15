---
id: FE-BUG-261110-xlsx-writer-merge-overwrite
type: bug
screens: [growth-report, attendance-summary, assessment-themes, export-preview]
be_modules: [health]
rules: [HLT-03, HLT-18]
status: fixed
date: 2026-11-10
keywords: [xuất excel, xlsx, exportXlsx, rows.map is not a function, merge, both added, tổng hợp cân đo, mẫu 5.1]
similar_to: [FE-BUG-261018-merge-children-pickup-bindings, FE-BUG-261019-selective-kitchen-merge-compat]
---

# FE-BUG-261110-xlsx-writer-merge-overwrite — "Xuất Excel" của Tổng hợp cân đo báo `rows.map is not a function`

## Symptom
Hiệu trưởng (BE giả) mở **Tổng hợp cân đo** (`/children/growth-report`), bấm **Xuất Excel**: không tải file, console báo:
```text
rows.map is not a function
```
`npm run verify` dừng ở `test:health`: `tests/health/growth-report-sheet.test.mjs` hỏng 2 test (`rows.map is not a function`, `undefined is not a function` vì không có `columnName`, `crc32`). Trên nhánh remote trang còn không có mục menu và route.

## Điều kiện tái hiện
Nhánh `feature/G94-180-FE-FEAT-43-child-health-pickup` sau merge `e5a758e` (2026-11-06, gộp `dev`), trước bản sửa ngày 2026-11-10. Vai Hiệu trưởng, BE giả, tháng có kỳ cân đo.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `git log -- src/utils/exportXlsx.js` | Chỉ thấy `43fdd99` (G94-179) | Lịch sử rút gọn ẩn nhánh bị bỏ; phải dùng `--full-history` mới thấy `9d299ad` và merge `e5a758e` |
| 2 | So `git show 9d299ad:src/utils/exportXlsx.js` với HEAD | Hai writer khác API: `sheet` object (ô gộp, kiểu ô) trả `Uint8Array` / `rows[]` trả `Blob` | Hai nhánh cùng thêm một file util cùng tên |
| 3 | `git diff d61282e e5a758e` (cha thứ nhất → merge) | Merge bỏ writer của 9d299ad, mục menu `growthReport`, route `growth-report` | Xung đột "both added" giải bằng cách lấy hẳn bản `dev` |

## Root cause
FE. Commit `9d299ad` (G94-180, Tổng hợp cân đo mẫu 5.1) và `43fdd99` (G94-179, xuất Excel điểm danh, đánh giá) cùng tạo `src/utils/exportXlsx.js` với API khác nhau. Merge `e5a758e` giữ bản G94-179, nên `GrowthReportPage` gọi `downloadXlsx(sheet)` với object ⇒ `sheetXml(rows)` gọi `rows.map` trên object. Cùng merge làm mất mục menu, route của trang.

## Fix
`src/utils/exportXlsx.js` gộp hai bản thành một writer: `buildXlsx` / `downloadXlsx` nhận `rows[]` (bảng thường, giữ định dạng cũ: Calibri, dòng tiêu đề đậm, cột tự rộng, không đặt khổ in) hoặc `sheet` (báo cáo theo mẫu: ô gộp, kiểu ô `XLSX_STYLES`, in ngang A4); dùng chung ZIP/CRC32; trả `Blob` như bản đang dùng ở `dev`; export lại `columnName`, `crc32`. Thêm lại mục menu "Tổng hợp cân đo" (Hiệu trưởng, Phó hiệu trưởng) và route `/children/growth-report`.

## Regression test
`tests/health/growth-report-sheet.test.mjs` — "Writer chung: bảng thường giữ kiểu cũ…; báo cáo theo mẫu có ô gộp, in ngang" (cùng một writer nhận cả hai kiểu) và 2 test đọc lại file; `tests/hardening/export-xlsx.test.mjs` (bảng thường) giữ nguyên, vẫn đạt. Kiểm trên trình duyệt: tải và đọc lại file của Tổng hợp cân đo, Tổng hợp điểm danh.

## Ảnh hưởng
Chỉ FE. Xuất Excel bảng thường (qua `ExportPreview`, Đánh giá cuối chủ đề) không đổi kết quả. Không cần BE/APP đổi.

## Lesson
Giải xung đột "both added" của file dùng chung: so API của cả hai bản và gộp, không lấy hẳn một bên; sau merge chạy `npm run verify` đủ chuỗi (test của nhánh bị bỏ sẽ fail).
