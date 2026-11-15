---
id: FE-BUG-261106-xlsx-writer-merge
type: bug
screens: [health-growth-report, export-preview]
be_modules: [health]
rules: []
status: fixed
date: 2026-11-06
keywords: [xlsx, exportXlsx, growth-report-sheet, rows.map]
similar_to: []
---

# FE-BUG-261106-xlsx-writer-merge — XLSX writer không nhận báo cáo tăng trưởng

## Symptom

`node scripts/verify.mjs` dừng ở hai test của `growth-report-sheet.test.mjs`:

```text
TypeError: rows.map is not a function
TypeError: undefined is not a function
```

## Điều kiện tái hiện

Trên `dev` tại `8e15f89`, chạy `node --import ./scripts/register-auth-test-loader.mjs --test tests/health/growth-report-sheet.test.mjs tests/hardening/export-xlsx.test.mjs`.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chạy verify trên `dev` sau khi pull | Hai test tăng trưởng lỗi; test XLSX cũ đạt | Writer hiện tại chỉ nhận mảng dòng |
| 2 | Dùng writer từ commit `9d299ad` | Test tăng trưởng đạt; test XLSX cũ lỗi `blob.arrayBuffer is not a function` | Hai cách gọi cần cùng được hỗ trợ |
| 3 | Thêm nhánh tương thích cho mảng dòng | Cả 7 test liên quan đạt | Giữ kiểu trả về cũ cho màn xuất hiện có |

## Root cause

Commit `9d299ad` đã thêm writer nhận sheet object và trả `Uint8Array`. Sau merge, `src/utils/exportXlsx.js` trở về writer nhận mảng dòng và trả `Blob`, trong khi `src/utils/children/growthReportSheet.js` vẫn tạo sheet object. Hai API không khớp.

## Fix

Khôi phục writer hỗ trợ sheet object, ô gộp và style; thêm nhánh tương thích cho mảng dòng để các màn xuất XLSX trước đó tiếp tục nhận `Blob` và tùy chọn `sheetName`/`headerRow`.

## Regression test

`tests/health/growth-report-sheet.test.mjs` và `tests/hardening/export-xlsx.test.mjs`: RED 2/7 → GREEN 7/7. `node scripts/verify.mjs` sau sửa: `VERIFY PASS full`.

## Ảnh hưởng

Xuất báo cáo tăng trưởng và các màn xuất XLSX hiện có. Chưa kiểm bằng trình duyệt hoặc BE thật.

## Lesson

Khi merge hai nhánh cùng thay đổi API tiện ích dùng chung, chạy cả test của consumer mới và consumer cũ trước khi gộp.
