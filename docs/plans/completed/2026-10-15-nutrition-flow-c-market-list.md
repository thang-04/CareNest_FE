---
title: Luồng dinh dưỡng (C) — Khẩu phần & đi chợ
status: done
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition, kitchen]
rules: [NUT-07, NUT-10, NUT-11]
risk: high
created: 2026-10-15
updated: 2026-10-15
---
# Luồng dinh dưỡng (C) — Khẩu phần & đi chợ

## Context
- Plan con (C) của plan tổng `docs/plans/completed/2026-10-14-nutrition-flow-redesign.md` (Phase 6, AC-7, AC-8). Plan (A) và (B) xong phần code: `docs/plans/completed/2026-10-15-nutrition-flow-a-frame-setup-dish-food.md`, `docs/plans/completed/2026-10-15-nutrition-flow-b-templates-weekly.md`.
- Bố cục chốt: **Đi chợ 7 — "Bảng + cột phải tóm tắt"** (wireframe scratchpad `nutrition-misa8.html?man=di-cho&v=7`): đầu trang chọn ngày + nút in; trái là bảng gộp theo thực phẩm (Thực phẩm · Lượng ăn (g) · Thải bỏ % · Lượng mua (g) · Mua theo ĐVT · Đơn giá · Thành tiền, dòng thiếu đơn giá có chip "Chưa có"); phải là 3 thẻ Tổng thu (kèm công thức "45 × 25.000 + 140 × 30.000") / Tổng chi / Chênh lệch và khối "Kiểm tra tự động". Mô tả trang: "Lượng mua = số suất đã chốt × lượng ăn 1 trẻ ÷ (1 − thải bỏ), làm tròn theo đơn vị mua. Không dùng AI."
- Hiện trạng code (rà 15/10/2026):
  - Trang `src/pages/kitchen/RequiredFoodQuantityPage.jsx` (223 dòng): lọc ngày + bữa (`:45-46`), bảng Thực phẩm / Đơn vị / suất thường / suất thay thế / tổng (`:100-141`), bảng suất thay thế theo lớp (`:145-173`), thẻ "Phiếu xuất kho ngày" (`:175-218`), nút "Báo thiếu thực phẩm" cho bếp (`:38-42`). Quyền xem: PHT + bếp (`src/utils/kitchen/kitchenPermissions.js:23`).
  - **Bếp không đọc được thực đơn đã xuất bản của luồng mới**: `menusFromWeeklyMenus` tìm `dishIds`/`dishes` (`src/services/kitchen/mock/kitchenMockRepository.js:135-138`, `:144-174`), còn thực đơn tuần lưu `days[].meals[].items[].dishId` ⇒ không ra món nào. Bếp chỉ biết `LUNCH`/`AFTERNOON` (`src/models/kitchen/kitchenConstants.js:40`), không biết Bữa phụ sáng và bữa thêm.
  - Tính lượng (`computeSession`, `:219-295`): dùng `quantity` một mức × hệ số tuổi chung (`PORTION_FACTOR_BY_AGE_GROUP`, `kitchenConstants.js:85`) thay vì định lượng theo nhóm tuổi; không có thải bỏ; đơn vị lấy `purchaseUnit` (kg) nhưng số là gam (`normalizeFood`, `:100-105`); suất thay thế tìm thực đơn loại ALLERGY (`:263-265`) thay vì `allergyMenus` của thực đơn mẫu.
  - Số suất đã chốt: `getMealCount` theo điểm trường + ngày + bữa, mỗi lớp `normal`/`substitute` (`:183-209`). Phiếu xuất kho và nhận thực phẩm dùng `computeDay(...).foods[].requiredQty` (`:298-317`, `:465`, `:617-740`).
  - Dữ liệu menu-planning đã có: `wastePct`, `storage` (tươi/khô), `purchaseUnit`, `purchaseUnitSize`, `unitPrice` theo ĐVT (`src/models/menu-planning/menuPlanningConstants.js:17-19`); định lượng theo nhóm tuổi `ingredientQty` (`src/utils/menu-planning/menuCalculations.js`); giá ngày `priceOn`; bữa + `countAs` ở Thiết lập; suất thay thế `allergyMenus { baseMenuId, replacements[{ session, originalDishId, replacementDishId }] }`.
  - Mẫu in A4 có sẵn: `src/styles/print.css` (`.print-sheet`, `.ps-*`), `src/components/print/PrintHeader.jsx`.

## Quyết định đã chốt
1. Theo plan tổng, quyết định 1–24 (nhất là 9: không kho/NCC mới; 13: làm lại `/kitchen/required-quantity`; 17: thải bỏ → lượng mua, Tổng thu/chi/chênh lệch chỉ để xem) — user, 14–15/10/2026.
2. **Tổng thu = số suất Bữa trưa đã chốt của từng nhóm tuổi × giá ngày của nhóm đó**; thẻ ghi công thức — user, 15/10/2026.
3. **Bữa phụ sáng và bữa thêm lấy số suất theo "Tính suất theo"** ở Thiết lập; bữa không có số chốt riêng (Bữa phụ sáng) tính theo Bữa trưa; phiếu ghi rõ "tính theo Bữa trưa" — user, 15/10/2026.
4. **Suất thay thế: mọi suất thay thế của lớp áp tất cả suất thay thế đã có của thực đơn mẫu ngày đó** (bỏ món có chất dị ứng, dùng món thay); lớp có suất thay thế mà mẫu chưa có suất thay thế ⇒ tính như suất thường + cảnh báo — user, 15/10/2026.
5. **Giữ nút "Báo thiếu thực phẩm" (bếp) và thẻ "Phiếu xuất kho"**, đặt cuối trang, không thêm tính năng kho — user, 15/10/2026.
6. Nút **"In phiếu đi chợ"** mở modal xem trước phiếu A4 (đầu trường, bảng, chữ ký Người lập / Bếp trưởng / Hiệu trưởng) với **Xuất PDF** và **In** của `PrintToolbar` có sẵn (html2canvas + jspdf đã có trong `package.json`), không thêm thư viện — mình chọn khi làm C2 (trước đó định chỉ có nút In).
7. Làm tròn lượng mua **lên** theo ĐVT: kg, lít bước 0,1; ĐVT đếm được (quả, hộp, chai…) bước 1 — mình đề xuất (công thức chi tiết phụ thuộc P-10 PENDING; ghi ở Contract).
8. Phiếu xuất kho dùng **lượng mua theo ĐVT** (đã tính thải bỏ) để thống nhất số trên trang — mình đề xuất.
9. Trang tính cho **cả ngày** (bỏ lọc bữa như wireframe); điểm trường theo người dùng như hiện tại — mình đề xuất.

## Làm rõ nghiệp vụ
- Actor: PHT và bếp xem, in (quyền như hiện tại); HT không có màn này. Rule: NUT-07 (số suất CONFIRMED × định lượng thực đơn đã xuất bản — CONFIRMED luồng, công thức P-10 PENDING), NUT-10 (tươi/khô — CONFIRMED, hiện nhãn Tươi/Khô ở tên thực phẩm), NUT-11 (kho — OPEN, không làm mới).
- Câu hỏi mở: không có (4/4 đã trả lời ngày 15/10/2026).

## Acceptance criteria
- **AC-7** (plan tổng, bố cục 7): Given số suất CONFIRMED và thực đơn tuần đã xuất bản, When PHT hoặc bếp mở `/kitchen/required-quantity` và chọn ngày, Then:
  - bảng gộp theo thực phẩm (cả trường điểm đó, mọi bữa và nhóm tuổi): lượng ăn (g) theo định lượng từng nhóm tuổi × số suất, thải bỏ %, lượng mua (g) = lượng ăn ÷ (1 − thải bỏ), mua theo ĐVT làm tròn lên, đơn giá, thành tiền; dòng thiếu đơn giá có chip "Chưa có" và không cộng vào Tổng chi;
  - cột phải: Tổng thu (công thức theo nhóm tuổi), Tổng chi (ghi chú thực phẩm chưa có giá), Chênh lệch = thu − chi;
  - "Kiểm tra tự động": số suất đã chốt (giờ), thực đơn đã xuất bản theo nhóm tuổi, suất thay thế "Tôm rim thịt → Thịt rim · 2 suất", thực phẩm chưa có đơn giá, bữa tính suất theo bữa khác;
  - "In phiếu đi chợ" ra phiếu A4; "Báo thiếu thực phẩm" (bếp, ngày hôm nay trở đi) và "Phiếu xuất kho" vẫn dùng được.
- **AC-C1** (sửa đọc thực đơn): thực đơn tuần đã xuất bản của luồng mới (kể cả Bữa phụ sáng, bữa thêm) được bếp đọc đúng; ngày nghỉ, bản nháp, bản đã thay thế không tính.
- **AC-C2** (trạng thái): chưa chốt số suất ⇒ trạng thái rỗng "Chưa chốt số suất ngày dd/mm" + nút mở Số suất đã xác nhận; chưa có thực đơn đã xuất bản ⇒ trạng thái rỗng có lối sang Thực đơn tuần (PHT); chốt một phần ⇒ tính phần đã chốt + cảnh báo.
- **AC-8**: đủ đang tải / rỗng / lỗi; không tràn trang 768–1440; trang in không có thanh bên.

## Phases

### Phase C1 — Tính khẩu phần & đi chợ (mock bếp, chưa đổi giao diện)
- Files: M `src/services/kitchen/mock/kitchenMockRepository.js` (đọc thực đơn đã xuất bản theo nhóm tuổi; bữa theo Thiết lập + `countAs`; định lượng theo nhóm tuổi; thải bỏ; quy đổi ĐVT; giá; thu/chi; suất thay thế; kiểm tra; phiếu xuất kho dùng lượng mua) · M `src/models/kitchen/kitchenConstants.js` (bước làm tròn theo ĐVT nếu cần) · M `src/services/kitchen/kitchenService.js` (chữ ký `getRequiredQuantity({ campusId, date })`) · M `src/hooks/kitchen/useKitchen.js` · M `package.json` (script `test:kitchen`, thêm vào chuỗi verify) · C `tests/kitchen/market-list.test.mjs`.
- Steps:
  1. Thực đơn ngày của từng nhóm tuổi: `weeklyMenus` PUBLISHED có `weekStart` chứa ngày, ngày không nghỉ ⇒ `day.meals`, `day.menuId`.
  2. Mỗi bữa: số suất = số chốt của bữa `countAs` (LUNCH/AFTERNOON), bữa không có số chốt ⇒ LUNCH; chỉ lớp thuộc nhóm tuổi đó.
  3. Lượng ăn = Σ suất × `ingredientQty(dish, food, portion, ageGroupId)`; suất thay thế dùng món thay theo `allergyMenus` của `menuId`.
  4. Gộp theo thực phẩm; lượng mua g = ăn ÷ (1 − wastePct/100); ĐVT = g ÷ `purchaseUnitSize`, làm tròn lên (quyết định 7); thành tiền = ĐVT × `unitPrice`.
  5. Thu = Σ nhóm tuổi (suất trưa × `priceOn`), chi, chênh lệch; danh sách kiểm tra; giữ `issue`, `issueState`.
  6. `computeDay` dùng cùng kết quả để phiếu xuất kho / nhận thực phẩm không lệch số.
- Tests (unit, mock): AC-C1 (đọc thực đơn mới, bỏ bản nháp/ngày nghỉ, Bữa phụ sáng tính theo trưa); AC-7 phần số (định lượng theo nhóm tuổi, thải bỏ, làm tròn, thiếu giá không cộng chi, thu theo công thức); suất thay thế áp món thay; phiếu xuất kho cùng số; chưa chốt ⇒ không tính.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`. **Dừng chờ user review.**

### Phase C2 — Trang bố cục 7 + phiếu in
- Files: M `src/pages/kitchen/RequiredFoodQuantityPage.jsx` · C phiếu in A4 MarketSheetPrint (file mới, thư mục `src/components/kitchen/`, dùng `.print-sheet`) · M `src/styles/modules/kitchen.css` · M `src/utils/kitchen/breadcrumbs.js` (nhãn "Khẩu phần & đi chợ") · M `src/utils/menu-planning/nutritionFlow.js` (trạng thái bước 5 nếu cần) · M `docs/architecture/ROUTE_MAP.md` (tên màn).
- Steps: đầu trang (tiêu đề, mô tả công thức, chọn ngày, In phiếu đi chợ, Báo thiếu cho bếp); bảng trái; cột phải 3 thẻ + Kiểm tra tự động; thẻ Phiếu xuất kho cuối trang; trạng thái rỗng/lỗi/đang tải; in A4.
- Tests: AC-7, AC-C2, AC-8 — probe PHT + bếp, so ảnh với wireframe bố cục 7 (memory `ui-must-match-chosen-wireframe`), 768/1024/1440, xem trước bản in.
- Exit: như C1. **Dừng chờ user review.**

## Contract BE cần thống nhất (chưa sửa repo BE)
- `GET /kitchen/required-quantity?campusId&date` (bỏ `session`) trả `{ date, servings: [{ ageGroupId, lunch, price }], revenue: { total, parts }, cost: { total, missingPrice: [foodId] }, balance, foods: [{ foodId, name, storage, eatG, wastePct, buyG, purchaseUnit, buyUnits, unitPrice, amount }], substitutes: [{ session, originalDish, replacementDish, servings }], meals: [{ ageGroupId, code, name, countAs, servings }], checks: [{ tone, text }], issue, issueState }`.
- Công thức lượng mua (thải bỏ, bước làm tròn theo ĐVT) phụ thuộc P-10 (PENDING) — đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` cùng `countAs` (cần user cho phép sửa BE).
- Phiếu xuất kho dùng lượng mua theo ĐVT (quyết định 8) — BE xác nhận khi làm NUT-11.

## Test matrix
| AC | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-C1 | đọc thực đơn đã xuất bản mới, bữa thêm (unit) | C1 | pass (7/7 `test:kitchen`) |
| AC-7 (số) | định lượng, thải bỏ, làm tròn, thu/chi, suất thay thế, phiếu xuất kho (unit) | C1 | pass |
| AC-7 (giao diện), AC-C2 | probe PHT + bếp, so wireframe | C2 | pass (probe 15/10) |
| AC-8 | probe 768/1024/1440, bản in | C2 | pass |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi đơn vị/lượng làm lệch phiếu xuất kho, nhận thực phẩm, tồn kho mock đã seed | Màn bếp khác sai số | Một hàm tính chung cho trang và phiếu; test phiếu xuất kho; seed lịch sử tính lại theo cách mới | Trả `computeSession` cũ |
| Bếp seed riêng (không có dữ liệu menu-planning) | Bếp trống | Giữ nhánh seed cũ khi `usesMenuPlanningCatalog` sai | — |
| Công thức P-10 BE chốt khác | Số đi chợ khác | Ghi Contract, tính ở một chỗ | Sửa một hàm |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Contract BE cần đổi liệt kê cụ thể
- [x] 2 phase, mỗi phase dừng review
- [x] Không dùng rule PENDING/OPEN như đã chốt (P-10 ghi là đề xuất)
- [x] Câu hỏi mở đã trả lời hết

## Progress log
### 2026-10-15 — Lập plan (C) (chờ duyệt)
- User chọn: thu = suất trưa × giá ngày; bữa khác theo "Tính suất theo"; suất thay thế áp mọi suất thay thế của mẫu; giữ Báo thiếu + Phiếu xuất kho cuối trang. Mặc định: chỉ nút In (không thêm thư viện PDF).
- Xác nhận lỗi nghi ở plan (B): bếp đọc `dishIds`/`dishes`, không đọc `meals[].items[].dishId` ⇒ sửa ở C1.

### 2026-10-15 — C1 + C2 xong (chờ user review)
- User duyệt plan ("ok"), rồi "tiếp đi" khi đang làm C1 ⇒ làm liền C1 và C2.
- C1: tính phiếu đi chợ trong file mới `src/services/kitchen/mock/marketList.js` (`computeMarket`, `countedSession`, `publishedDay`, `purchaseStep`). Mock bếp: đọc thực đơn tuần khuôn mới `days[].meals[].items[]` (`menusFromDays`, gộp bữa theo "Tính suất theo", suất thay thế từ `allergyMenus`); `computeDay` của danh mục thực đơn lấy lượng mua theo ĐVT ⇒ phiếu xuất kho cùng số; mock bếp tự dựng dữ liệu mẫu của module thực đơn nếu chưa có. API `getRequiredQuantity({ campusId, date })` bỏ `session`, trả thêm `sessions` (trạng thái chốt từng bữa). Script `test:kitchen` vào chuỗi verify.
- C2: trang bố cục 7 (bảng gộp theo thực phẩm có nhãn Tươi/Khô, dòng thiếu đơn giá tô cam; cột phải 3 thẻ Tổng thu kèm công thức / Tổng chi / Chênh lệch + "Kiểm tra tự động"); trạng thái rỗng "Chưa có thực đơn đã xuất bản" (PHT có lối sang Thực đơn tuần) và "Chưa chốt số suất" (lối sang Số suất đã xác nhận); Phiếu xuất kho cuối trang; nút Báo thiếu cho bếp (ngày hôm nay trở đi). Phiếu in `MarketSheetPrint` trong modal xem trước. `AutoChecks` thêm prop `note`. Nhãn menu và breadcrumb "Khẩu phần & đi chợ"; icon `Receipt` thêm vào `icons.js`.
- Lỗi tìm ra khi probe: thiếu export icon `Receipt` (ESLint không bắt) làm trang lỗi; khối Kiểm tra tự động mất CSS ở trang bếp (nạp thêm `menu-planning.css`); in từ modal bị lệch xuống giữa trang và co hẹp (CSS in riêng cho `.kb-print-modal`).
- Probe 06/10/2026 điểm trường 1: 19 thực phẩm, Tổng thu 660.000 đ (5 × 30.000 + 12 × 30.000 + 5 × 30.000 = 22 suất trưa), Tổng chi 455.900 đ, Chênh lệch 204.100 đ; suất thay thế "Sữa chua → Dưa hấu · 4 suất"; 2 nhóm có suất thay thế nhưng mẫu chưa có suất thay thế được cảnh báo. 15/10 và 20/10 ra trạng thái chưa có thực đơn đã xuất bản (dữ liệu mẫu chỉ có tuần 28/09, 05/10). Bếp xem được, không lỗi console; 768/1024 không tràn; xem trước bản in đúng trang.
- Lúc verify giữa chừng FAIL do `src/pages/school-config/RolePermissionListPage.jsx` (ngoài phạm vi, file đổi lúc 15:17 không do phiên này); lần chạy sau PASS.
- Còn lại ngoài phạm vi: trang Thực đơn đã công bố của bếp gộp Bữa phụ sáng vào Bữa trưa (bếp chỉ có 2 bữa); nhãn quyền "Định lượng thực phẩm cần dùng" trong `src/models/school-config/permissionCatalog.js` giữ nguyên.
- Verify: `VERIFY PASS full` (test:auth 43, test:menu 40, test:kitchen 7). Commit: chưa commit.

### 2026-10-15 — User: "tôi thấy dữ liệu ko có"
- Nguyên nhân: dữ liệu mẫu thực đơn tuần đã xuất bản cố định tuần 28/09, 05/10 (tuần 12/10 chỉ có bản nháp Mẫu giáo nhỡ, Nhà trẻ không có tuần nào), còn số suất của module điểm danh chỉ có cho các ngày học gần hôm nay ⇒ không ngày nào có đủ cả hai.
- Sửa: `buildRecentWeeklyMenus(today)` trong `src/mocks/menuPlanningSeed.js` tạo tuần trước + tuần này đã xuất bản cho 4 nhóm tuổi và bản nháp tuần sau (thay bản nháp cố định `wm_8`); `topUpRecentWeeklyMenus` bổ sung cho dữ liệu đã lưu trong trình duyệt (chỉ thêm tuần còn thiếu bản đã xuất bản, bỏ `wm_8` chưa ai sửa), gọi ở mock thực đơn và mock bếp.
- Trang: khi hôm nay chưa chốt số suất hoặc chưa có thực đơn, trạng thái rỗng có thêm nút "Xem ngày dd/mm" (ngày thứ Hai–Sáu liền trước).
- Probe sau khi mở điểm danh (giống dữ liệu thật của user): 09/10, 12/10, 13/10, 14/10 có bảng; 15/10 "Chưa chốt số suất" (PHT chưa xác nhận) + nút sang 14/10 chạy đúng. Bếp chưa mở điểm danh: hôm nay có bảng.
- Test: `test:kitchen` 9/9 (thêm: bổ sung tuần cho dữ liệu cũ, ngày học gần nhất có phiếu). Verify: `VERIFY PASS full`.

### 2026-10-15 — User chấp nhận kết quả, đóng plan
- User trả lời "ok" sau báo cáo cuối của plan (C) ⇒ đóng plan (A), (B), (C): `status: done`, chuyển sang `docs/plans/completed/`.
