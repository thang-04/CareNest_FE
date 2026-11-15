---
id: FE-BUG-261104-exam-sheet-row-header-nowrap
type: bug
screens: [health-exam-form, health-exam-view, health-record]
be_modules: []
rules: []
status: fixed
date: 2026-11-04
keywords: [phiếu khám, tr-exam-sheet, th scope=row, nowrap, 375px, chữ chồng, table--wrap-head]
similar_to: [FE-BUG-261028-header-mobile-overflow]
---

# Phiếu khám: nhãn đầu dòng không xuống dòng, chữ chồng sang ô kết quả ở 375px

## Symptom

Chromium 375 × 812, mock giáo viên (Lớp Chồi 1), phiếu khám bước 1: nhãn cột giữa ("Số CC/CCCD/Hộ chiếu/Mã định danh", "Ngày kiểm tra sức khỏe", "Cơ sở kiểm tra sức khỏe", "Có người đi cùng trẻ khi khám") nằm một dòng, tràn và chồng lên chữ ở ô kết quả. Đo: `th` có `white-space: nowrap`, `scrollWidth` 159–251px trong khi `clientWidth` 109px. Trang không tràn ngang (document 365px).

## Điều kiện tái hiện

`/children/health-checks/hc_c1_open/exam/<mã trẻ>` ở viewport ≤ 640px, mọi bước có nhãn dài; cũng gặp ở trang xem phiếu và hộp xem phiếu ở Sổ sức khỏe (cùng `ExamSheetTable`). Dữ liệu giả của seed.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | So ảnh 375px của lượt trước (`exam-table-step1-375.png`, trước khi bỏ dòng tiêu đề cột) | Ảnh cũ nhãn vẫn xuống dòng | Lỗi xuất hiện từ khi bỏ `<thead>` và class `table--wrap-head` (commit `39456d2`) |
| 2 | Đo `getComputedStyle(th).whiteSpace` ở 375px | `nowrap` cho mọi `th scope=row` | `.table th` chung đặt `nowrap` cho cả `th` trong `tbody` |

## Root cause

FE. `.table th { white-space: nowrap }` (`src/styles/components.css`) áp cho cả nhãn đầu dòng `th scope=row` của `tr-exam-sheet`. Trước đây class `table--wrap-head` (`white-space: normal` cho mọi `th`) che lỗi này; bỏ class cùng dòng tiêu đề cột thì nhãn dài không xuống dòng được trong cột 36% ở điện thoại.

## Fix

`src/styles/modules/children.css`: rule `.table.table--grid.tr-exam-sheet tbody th` thêm `white-space: normal`. Máy tính không đổi (nhãn vừa cột).

## Regression test

Thử trên trình duyệt 375px (bước 1 phiếu khám): mọi `th` của `table.tr-exam-sheet` có `scrollWidth ≤ clientWidth`, document 365px; ảnh `../.playwright-mcp/round-date-exam-step1-new-375.png` (ngoài repo). Chưa có test tự động cho CSS.

## Ảnh hưởng

Form 5 bước, trang xem phiếu, hộp xem phiếu ở Sổ sức khỏe (Web). Không ảnh hưởng BE/APP.

## Lesson

Bảng dùng `th scope=row` trong `tbody` phải tự đặt `white-space: normal` (hoặc giữ `table--wrap-head`) vì `.table th` mặc định không xuống dòng.
