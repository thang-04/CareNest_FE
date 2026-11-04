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
# Attendance Excel button downloads CSV

## Reproduction and root cause
Chrome mock mode, teacher /attendance/summary, click “Xuất Excel”: suggestedFilename is diem-danh-Lớp-Mầm-1-2026-10-21-2026-11-03.csv. Script .git/export-route-audit.cjs records the download event. AttendanceSummaryPage.jsx:67–83 calls downloadCsv and appends .csv, not a two-sheet workbook. Current dependency includes read-excel-file, not the earlier approved ExcelJS writer.

## Proposed fix
The user requested XLSX with daily/child sheets over the complete filtered range. Restore that export with an agreed writer; do not export only the current page. Name CSV explicitly if kept as another format. Pagination and removal of the 31-day limit already exist; no need to redo them. No product fix applied in this review.

## Fix 2026-11-03
Export buttons in attendance, meal count, leave list, quality report, behaviour tickets, rewards and staff accounts now call downloadXlsx (src/utils/exportXlsx.js): a dependency-free single-sheet OOXML writer (stored zip, inline strings, numeric cells, bold header). Test tests/hardening/export-xlsx.test.mjs reads the file back with read-excel-file. Still one sheet per file; a two-sheet attendance workbook would need a writer library approved by the team.
