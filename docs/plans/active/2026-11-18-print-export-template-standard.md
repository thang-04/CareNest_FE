---
title: Chuẩn chung mẫu in / xuất PDF, Word ("Văn bản trường")
status: in-progress
owner: Thắng
jira: chưa có / FE-FEAT-59   # hỏi mã Jira trước khi commit
branch: feature/G94-415-FE-FEAT-59-meal-plan-amend
modules: [kitchen, menu-planning]
rules: []
risk: medium
created: 2026-11-18
updated: 2026-11-18
---
# Chuẩn chung mẫu in / xuất PDF, Word ("Văn bản trường")

## Context
Hai hệ mẫu in chạy song song, lệch nhau về đầu trang, vị trí chữ ký, nút hộp thoại:
- **Hệ A — tờ in HTML → Xuất PDF / In:** `PrintHeader` (`src/components/print/PrintHeader.jsx:8`, logo CareNest + slogan | tên trường, địa chỉ) + `PrintToolbar` (`src/components/print/PrintToolbar.jsx:13`). Ô ký cuối tờ, không có dòng nơi/ngày ký (`src/components/kitchen/WeeklyOrderPrint.jsx:85`, `src/components/menu-planning/MenuStatisticsPrint.jsx:8`). Nhãn nút In khác nhau mỗi chỗ: "In danh sách" (`src/components/kitchen/FreshForecastDetail.jsx:119`), "In bảng" (`src/pages/kitchen/DayMarketPage.jsx:165`), "In phiếu" (`src/pages/kitchen/WeeklyForecastPage.jsx:382`), "In".
- **Hệ B — văn bản Word → Xuất Word / In-Lưu PDF:** `docFile.js` chỉ có tải/in; mỗi module tự viết khung HTML, đầu trang, ô ký. Thực đơn tuần chỉ có dòng tên trường (`src/utils/menu-planning/weeklyMenuDoc.js:85`), ô "Họ tên người lập" nằm trên bản xem trước (`src/components/menu-planning/WeeklyMenuExportModal.jsx:45`). Mẫu edu dùng quốc hiệu 2 cột (`src/utils/education-plan/yearPlanDoc.js:46`); mẫu đánh giá không có đầu trang, người ký chính đặt ngay dưới bảng (`src/utils/assessment/themeEvaluationDoc.js:86`).

## Quyết định đã chốt
1. Đầu trang chung = quốc hiệu 2 cột (UBND xã + tên trường | CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc), cho cả PDF và Word, bỏ logo CareNest khỏi văn bản — Thắng, 18/11/2026.
2. Phạm vi: phần dùng chung `components/print` + mẫu của Thắng (kitchen, menu-planning). Mẫu edu (Tiến) và assessment (Cần) không sửa; tạo task Jira để chủ module tự chuyển — Thắng, 18/11/2026.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor = BGH, nhân viên bếp in phiếu/bảng; outcome = mọi văn bản in ra cùng một khuôn trường. Chỉ đổi trình bày, không đổi dữ liệu, không đổi contract BE.
- **Ảnh hưởng:** FE `/kitchen/market-day`, `/kitchen/weekly-forecast`, `/kitchen/food-samples`, biên bản kiểm tra mẫu, `/menu/statistics`, `/menu/weekly` (xuất thực đơn tuần). Không ảnh hưởng APP, BE.

### Câu hỏi mở
(không còn)

## Chuẩn "Văn bản trường"
1. **Đầu trang:** quốc hiệu 2 cột, chữ đậm, căn giữa từng cột; gạch ngắn dưới mỗi cột.
2. **Tiêu đề:** IN HOA, đậm, căn giữa; dòng phụ (kỳ, ngày, điểm trường) căn giữa ngay dưới.
3. **Chữ ký: luôn ở cuối văn bản.** Một hàng ô ký chia đều; dòng *"Thượng Hồng, ngày … tháng … năm …"* nằm trên cột người ký chính (cột phải). Mỗi ô: CHỨC DANH (in hoa, đậm) · *(Ký, ghi rõ họ tên)* · khoảng trống ký · họ tên (trống thì để trống ký tay). Ngày lấy từ dữ liệu văn bản nếu có (ngày công bố, ngày xác nhận), không có thì để chấm.
4. **Hộp thoại xem trước:** trên cùng là dải tùy chọn (Tên file nếu có, Người ký) — luôn ở trên bản xem trước; giữa là tờ giấy; chân hộp: `Đóng` · `Xuất Excel` (nếu có) · `Xuất PDF` hoặc `Xuất Word` · **`In`** (nút chính). Nhãn nút In thống nhất "In".
5. **Biểu mẫu pháp quy (QĐ 1246/QĐ-BYT: sổ/nhãn lưu mẫu, biên bản kiểm thực 3 bước):** giữ nguyên thân và ô ký theo mẫu Bộ Y tế; chỉ đổi đầu trang.

## Acceptance criteria
- **AC-1:** Given mọi tờ in hệ A (bảng đi chợ, danh sách đặt hàng, phiếu đặt hàng tuần, sổ/nhãn lưu mẫu, biên bản kiểm tra, định lượng & đi chợ) When mở xem trước / xuất PDF Then đầu trang là quốc hiệu 2 cột, không còn logo CareNest.
- **AC-2:** Given tờ in có ô ký (không thuộc biểu mẫu QĐ 1246) When xem trước Then ô ký ở cuối, có dòng nơi/ngày ký trên cột người ký chính, chức danh in hoa.
- **AC-3:** Given xuất thực đơn tuần (Word / In-Lưu PDF) Then đầu trang, tiêu đề, khối ký giống AC-1/AC-2, dùng chung hàm với hệ A.
- **AC-4:** Given mọi hộp thoại in của kitchen/menu Then chân hộp theo thứ tự `Đóng · Xuất Excel? · Xuất PDF/Word · In(chính)`, ô người ký (nếu có) nằm ở dải trên bản xem trước.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nguồn đầu trang + khối ký | 1 module `src/components/print/docTemplate.js` (chuỗi HTML: `docHeader`, `signRow`, `signDateLine`) dùng cho Word; `PrintHeader`/`PrintSignRow` (JSX) dùng cùng nội dung cho hệ A | Mỗi hệ tự viết | Một chỗ sửa, chủ module khác chuyển sau chỉ cần import |
| Nơi sửa họ tên người ký ở Định lượng & đi chợ | Chuyển ô gõ tên trong ô ký (`ps-sign__input`) lên dải "Người ký" trên bản xem trước | Giữ gõ trực tiếp trong ô ký | Đồng bộ với hộp xuất Word (không gõ được trong khung xem trước HTML) |
| Nút đóng | `PrintToolbar` nhận `onClose` để vẽ `Đóng` | Mỗi modal tự thêm | Một khuôn chân hộp |

## Phases
### Phase 1 — Phần dùng chung + đầu trang hệ A
- Files: C `src/components/print/docTemplate.js` · M `src/components/print/PrintHeader.jsx` · C `src/components/print/PrintSignRow.jsx` · M `src/components/print/PrintToolbar.jsx` · M `src/styles/print.css` · M `src/components/index.js` · M `src/pages/UiKitPage.jsx` (mục mẫu in)
- Steps: 1. `docTemplate.js` (quốc hiệu, khối ký, dòng ngày; lấy xã từ `config/printTemplate.js`). 2. `PrintHeader` vẽ quốc hiệu, bỏ logo. 3. `PrintSignRow` (JSX) cùng bố cục. 4. `PrintToolbar`: `onClose`, nhãn mặc định "In".
- Tests: thêm `tests/print/docTemplate.test.js` (ngày có/không có, 1–3 người ký, escape HTML).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`
- **Dừng chờ user review.**

### Phase 2 — Áp chuẩn vào tờ in kitchen + menu, thực đơn tuần Word
- Files: M `src/components/kitchen/DayMarketPrint.jsx` · M `src/components/kitchen/FreshForecastPrint.jsx` · M `src/components/kitchen/WeeklyOrderPrint.jsx` · M `src/components/menu-planning/MenuStatisticsPrint.jsx` · M `src/utils/menu-planning/weeklyMenuDoc.js` · M `src/components/menu-planning/WeeklyMenuExportModal.jsx` · M 6 nơi gọi `PrintToolbar` (bỏ `printLabel` riêng, thêm `onClose`)
- Steps: 1. Thay khối ký tự viết bằng `PrintSignRow`. 2. `MenuStatisticsPrint`: chuyển ô gõ tên lên dải trên. 3. `weeklyMenuDoc` dùng `docHeader` + `signRow`. 4. Chân hộp theo AC-4.
- Tests: test hiện có của menu/kitchen + cập nhật test `weeklyMenuDoc` nếu có.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; mở từng hộp in trên trình duyệt, chụp đối chiếu.
- **Dừng chờ user review.**

### Phase 3 — Bàn giao cho chủ module
- Soạn nội dung task Jira cho Tiến (edu: `yearPlanDoc`, `classPlanDoc`, `DocPreviewModal`; giữ nhập lại file Word EDU-46) và Cần (assessment: `themeEvaluationDoc`, `semesterAssessmentDoc`, `yearEndSheetDoc`, `classRatingDoc`, `ThemeEvaluationPreviewModal`) — chỉ chuyển sang `docTemplate.js`. Tạo Jira khi Thắng đồng ý.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Word hiển thị bảng quốc hiệu lệch | File .doc xấu | Bảng không viền, không lồng bảng (như `yearPlanDoc.js:46`), mở thử bằng Word | Revert commit phase |
| PDF (html2canvas) cắt khối ký giữa trang | Ô ký tách trang | `page-break-inside: avoid` cho hàng ký | Revert commit phase |
| Biểu mẫu QĐ 1246 bị đổi thân | Sai mẫu Bộ Y tế | Chỉ đổi đầu trang ở các file này | Revert file |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã tách 3 phase, dừng review sau mỗi phase
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-11-18 — Plan (chờ duyệt)
- Commit: chưa commit

### 2026-11-18 — Phase 1 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Đã làm: `docTemplate.js` (+ `tests/kitchen/print-doc-template.test.mjs`, 4 test pass), `PrintHeader` quốc hiệu 2 cột, `PrintSignRow`, `PrintToolbar` (`onClose`, dùng `Button`, `toast.error(err, …)`), CSS `.ps-header`, `.ps-sign-row`, mục "Mẫu in · Văn bản trường" ở `/ui-kit#print`.
- Khác plan: `PrintSignRow` dựng bằng lưới div thay `<table>` (check-design chặn bảng viết tay, chặn style inline).
- Tiếp: Phase 2 — thay khối ký tự viết ở các tờ in bếp/thực đơn bằng `PrintSignRow`, thực đơn tuần Word dùng `docHeaderHtml`/`signRowHtml`, chuẩn chân hộp.

### 2026-11-18 — Phase 2 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Đã làm: `PrintSignRow` thay khối ký tự viết ở Bảng đi chợ, Phiếu đặt hàng tuần, Phiếu định lượng & đi chợ; `PrintSignerFields` (dải họ tên người ký trên bản xem trước) cho Định lượng & đi chợ và Xuất thực đơn tuần; `weeklyMenuDoc` dùng `docHeaderHtml` + `signRowHtml` (1 người ký thì ô ký nửa phải); 7 hộp in có nút Đóng, nhãn In thống nhất; xóa CSS `.ps-sign--spaced`, `.ps-sign__input` không còn dùng; cập nhật `tests/menu/weekly-menu-doc.test.mjs`.
- Khác plan: hộp Xuất thực đơn tuần giữ nhãn "In / Lưu PDF" (không có nút Xuất PDF riêng), thứ tự `Đóng · Xuất Word · In / Lưu PDF (chính)`. Biểu mẫu QĐ 1246 (sổ/nhãn lưu mẫu, biên bản kiểm thực) chỉ đổi đầu trang + chân hộp, giữ ô ký theo mẫu Bộ Y tế.
- Chưa làm: Danh sách đặt hàng (`FreshForecastPrint`) chưa có ô ký — chờ Thắng chốt người ký. Chưa xem lại trên trình duyệt (công cụ trình duyệt mất kết nối sau khi phiên khởi động lại).
