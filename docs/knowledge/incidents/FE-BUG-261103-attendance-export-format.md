---
id: FE-BUG-261103-attendance-export-format
type: bug
screens: [attendance-summary]
be_modules: [attendance]
rules: [ATT-11]
status: fixed
date: 2026-11-03
keywords: [Excel, xlsx, CSV, two sheets, export]
similar_to: []
---
# Attendance export still lacks daily and child sheets

## Runtime retest 2026-11-05
Chrome local gateway, real BE, principal demo: select one class and 05/09/2026–05/11/2026, then export. The downloaded file is a valid XLSX, but parsing it shows only `Sheet1`, containing daily rows. The requested child sheet is absent. `AttendanceSummaryPage.jsx` passes only daily rows to `downloadXlsx`; its optional extra section is by class, not by child. Reopened for the remaining two-sheet requirement; CSV-to-XLSX conversion itself works. No product fix in this test task.

## Reproduction and root cause
Chrome mock mode, teacher /attendance/summary, click “Xuất Excel”: suggestedFilename is diem-danh-Lớp-Mầm-1-2026-10-21-2026-11-03.csv. Script .git/export-route-audit.cjs records the download event. AttendanceSummaryPage.jsx:67–83 calls downloadCsv and appends .csv, not a two-sheet workbook. Current dependency includes read-excel-file, not the earlier approved ExcelJS writer.

## Proposed fix
The user requested XLSX with daily/child sheets over the complete filtered range. Restore that export with an agreed writer; do not export only the current page. Name CSV explicitly if kept as another format. Pagination and removal of the 31-day limit already exist; no need to redo them. No product fix applied in this review.

## Fix 2026-11-03
Export buttons in attendance, meal count, leave list, quality report, behaviour tickets, rewards and staff accounts now call downloadXlsx (src/utils/exportXlsx.js): a dependency-free single-sheet OOXML writer (stored zip, inline strings, numeric cells, bold header). Test tests/hardening/export-xlsx.test.mjs reads the file back with read-excel-file. Still one sheet per file; a two-sheet attendance workbook would need a writer library approved by the team.


## Fix phần còn thiếu — 05/11/2026
Mở rộng writer hiện có thành `buildWorkbookXlsx`/`downloadWorkbookXlsx`, giữ `buildXlsx`/`downloadXlsx` một sheet tương thích, không thêm thư viện. AttendanceSummaryPage xuất hai bảng vào hai sheet theo phạm vi.

Regression: `tests/hardening/export-xlsx.test.mjs`: RED thiếu hàm multi-sheet → GREEN 2/2. Reader v9 trả mọi sheet; chọn theo thuộc tính `sheet`, không dùng option cũ để suy ra sheet thứ hai. Browser tải thật khoảng 05/09–05/11: openpyxl đọc “Theo ngày” 44 dòng, “Theo trẻ” 15 dòng; tổng có mặt cả hai sheet đều 600, khớp màn hình; trang UI chỉ hiển thị 20 dòng. Không ghi dữ liệu trẻ vào fixture/repo.
