---
id: FE-BUG-261114-xlsx-zip-central-directory-size
type: bug
screens: [export-preview, market-day, food-samples, forecast, dry-stock, inspection, meal-count, attendance-summary, growth-report]
be_modules: []
rules: []
status: fixed
date: 2026-11-14
keywords: [xuất excel, xlsx, exportXlsx, file hỏng, không mở được, central directory, EOCD, Bad magic number for central directory, bán trú]
similar_to: [FE-BUG-261110-xlsx-writer-merge-overwrite]
---

# FE-BUG-261114-xlsx-zip-central-directory-size — File Excel tải về không mở được

## Symptom
Trên dev.carenest.edu.vn, bấm "Tải file Excel" ở các màn bán trú (bảng đi chợ, sổ lưu mẫu, kiểm thực, kho…) tải được file `.xlsx` nhưng Excel báo file hỏng, không mở được. Ảnh hưởng mọi nút xuất Excel dùng `src/utils/exportXlsx.js`. Python đọc file:
```text
zipfile.BadZipFile: Bad magic number for central directory
```

## Điều kiện tái hiện
Mọi file do `buildXlsx` / `buildWorkbookXlsx` tạo, từ commit `9d299ad4` (writer báo cáo tăng trưởng, 2026-11-04), dùng chung cho mọi màn sau `32628806` (2026-11-06).

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Tải file mẫu `/templates/*.xlsx` từ dev, so với repo | Giống từng byte, ZIP hợp lệ | Không phải nginx trả `index.html` thay file mẫu |
| 2 | Grep BE tạo Excel | BE không sinh `.xlsx`; mọi file xuất do FE tạo | Lỗi nằm ở writer FE |
| 3 | Sinh file bằng writer `origin/dev`, đọc bằng Python `zipfile` | `cdSize` 396, central directory thật 384 byte (lệch 12) | Test cũ dùng `read-excel-file` đọc theo local header nên không phát hiện |

## Root cause
FE. `zipStored` ghi kích thước central directory bằng `pos - centralStart` **sau khi** đã ghi chữ ký EOCD và 4 trường u16 (12 byte), nên EOCD khai lớn hơn thật 12 byte. Excel/Python định vị central directory theo EOCD ⇒ lệch vị trí ⇒ coi file hỏng.

## Fix
`src/utils/exportXlsx.js`: ghi `centralSize` (đã tính trước) thay cho `pos - centralStart`.

## Regression test
`tests/hardening/export-xlsx.test.mjs` — "xlsx zip end record points exactly at the central directory": kiểm `cdOffset + cdSize === vị trí EOCD` và duyệt đủ các mục central directory, cho cả file một sheet và nhiều sheet. Đã kiểm thêm bằng Python `zipfile.testzip()` + `openpyxl.load_workbook`.

## Ảnh hưởng
Chỉ FE, chỉ đổi 4 byte trong EOCD; nội dung sheet không đổi. Không cần BE/APP đổi.

## Lesson
Test đọc lại file bằng thư viện dễ dãi không chứng minh Excel mở được; với ZIP tự viết phải kiểm cấu trúc EOCD/central directory (hoặc đọc bằng bộ đọc chặt như Python `zipfile`).
