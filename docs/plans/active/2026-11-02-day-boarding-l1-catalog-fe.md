---
title: Bán trú L1 (FE) — dọn bố cục theo quy trình 01/11, nối danh mục với BE
status: in-progress
owner: thangnd
jira: G94-191 / FE-FEAT-48
branch: feature/G94-191-FE-FEAT-48-nutrition-management   # worktree CareNest_FE/.commit-worktrees/nutrition; đã merge origin/dev 02/11
modules: [menu-planning, kitchen]
rules: [NUT-05, NUT-08, NUT-11, NUT-12, NUT-13, NUT-14, NUT-15, NUT-17, NUT-18, NUT-19, AUTH-20, AUTH-21]
risk: high
created: 2026-11-02
updated: 2026-11-03
---
# Bán trú L1 (FE) — dọn bố cục theo quy trình 01/11, nối danh mục với BE

Phần client. Plan BE: `CareNest_BE:docs/plans/completed/2026-11-02-day-boarding-l1-catalog.md` (contract `/nutrition/*`); plan ô: `CareNest_BE:docs/plans/active/2026-11-02-day-boarding-redesign.md`. Thay phần danh mục của `2026-10-20-nutrition-ba-master-data.md` (dựng theo BA trước khảo sát 27/10).

## Context
- Nhóm menu bán trú dựng theo luồng cũ: 4 nhóm `catalog/nutrition/stock/foodReport` cho PHT, menu Web cho bếp (`src/layouts/menuConfig.js` khối `ROLES.KITCHEN_STAFF`), màn trái rule (xuất kho bếp chọn lô, trạng thái nấu).
- Danh mục chạy mock: module `menu-planning` `source: 'demo'` (`src/config/integrationModules.js:118`); form món đã là lưới gam/trẻ × nhóm tuổi có "Chép định lượng từ … sang" (ảnh chụp 02/11), nhưng seed sinh số bằng hệ số nhóm (`src/mocks/menuPlanningSeed.js:16`); Thiết lập dinh dưỡng đã có bữa + giá suất + chuẩn theo nhóm tuổi nhưng thiếu ngày hiệu lực, giá suất còn bảng riêng (`/menu/prices`), NCC dưới `/kitchen/suppliers` chỉ HT sửa (`src/routes/AppRoutes.jsx:461-464`).

## Quyết định đã chốt
1. Rule NUT-* chốt 2026-11-01 (BE `BUSINESS_RULES.md`); bếp chỉ dùng App (AUTH-21).
2. Bố cục nhóm "Bán trú" và hub theo ngày (plan ô BE) — agent chọn, chờ user soát.

## Làm rõ nghiệp vụ
- **Actor:** PHT có `NUTRITION_MANAGE` (sửa danh mục); HT; PHT khác chỉ xem.
- **Ảnh hưởng route:** `/menu/foods*`, `/menu/dishes*`, `/menu/setup`, `/menu/prices*` (gộp), `/kitchen/suppliers*` (chuyển), `/kitchen/stock-issues*`, `/kitchen/preparation*` (xóa), menu bếp Web (xóa).

### Câu hỏi mở
Không có câu hỏi nghiệp vụ. Mã Jira task FE: cần user cung cấp trước khi commit.

## Thiết kế
Menu PHT/HT — 6 nhóm theo `CareNest_BE:docs/business/flows/meal-management-permissions.md` mục 1 (user yêu cầu 02/11; mục lát sau chưa có thì giữ màn demo hiện tại):

```text
Bán trú hôm nay           (trang mới — lát L3; tạm trỏ trang quy trình hiện có)
Thực đơn & dinh dưỡng     Kế hoạch tuần & công bố (công bố cả tuần — NUT-08 chốt 02/11) · Bộ thực đơn mẫu · Món thay thế dị ứng
Vận hành bếp              Sổ suất ăn · Bếp hôm nay (xem) · Bản dự trù · Kiểm nhận hàng tươi
Kho thực phẩm             Tồn kho khô · Phiếu nhập · Lịch sử nhập/trừ
An toàn thực phẩm         Duyệt lưu/hủy mẫu · In nhãn, biểu mẫu · Ảnh bữa
Danh mục & thiết lập      Thực phẩm · Món · Cấu hình nhóm tuổi · Nhà cung cấp   ← L1 nối BE
```

Màn L1:
- **Thực phẩm:** thêm `nutrientSource`, `nutrientSourceVersion` (bắt buộc), `storage` Fresh/Stored, `wastePct`, đơn vị mua + quy đổi; bỏ `stockUnit`, `favorite`. Nhập hàng loạt: đọc file ở client, gửi `items[]`, hiện lỗi theo dòng.
- **Món:** giữ bố cục lưới gam/trẻ × nhóm tuổi đang có; seed lưu gam/trẻ thật thay hệ số; dinh dưỡng/giá theo nhóm tuổi lấy từ BE. Thêm: món tham khảo chỉ xem + "Sao chép thành món của trường".
- **Cấu hình nhóm tuổi:** giữ tổng quan `NutritionSetupPage`, bỏ `MealPriceListPage` (giá suất chỉ sửa trong cấu hình); thêm ngày hiệu lực, lịch sử phiên bản; bản đã hiệu lực chỉ đọc, "Tạo bản mới từ ngày…".
- **Nhà cung cấp:** chuyển về `/menu/suppliers`; CCCD hiện khi có quyền sửa, còn lại ẩn.
- Nút sửa hiện theo `permissions` chứa `NUTRITION_MANAGE` (`/accounts/me`), không theo role cứng. Các mã khác (`MENU_MANAGE`, `STOCK_MANAGE`, …) theo ma trận quyền BE, áp ở lát sau.

## Acceptance criteria
- **AC-1** (`AUTH-21`): đăng nhập role bếp trên Web không có mục menu bán trú nào; route `/kitchen/*` từ chối.
- **AC-2** (`NUT-11`, `NUT-14/15`): không còn route/màn `stock-issues`, `preparation`; test cũ liên quan xóa cùng.
- **AC-3** (`NUT-05`): form thực phẩm chặn lưu khi thiếu nguồn dinh dưỡng; lỗi 400 BE hiện đúng trường.
- **AC-4** (`NUT-18`): form món lưu gam/trẻ từng nhóm tuổi; sao chép cột từ nhóm khác.
- **AC-5** (`NUT-17`, `NUT-19`): cấu hình đã hiệu lực không sửa được trên UI.
- **AC-6** (`AUTH-20`): PHT không có `NUTRITION_MANAGE` xem được danh mục, không thấy nút sửa, không thấy CCCD.
- **AC-7**: build nối BE (`VITE_USE_MOCK=false`) các màn danh mục gọi `/nutrition/*`, không nhãn "Dữ liệu demo"; `node scripts/check-api-contract.mjs` pass.

## Phases
### Phase 1 — Dọn bố cục (không cần BE)
- Files: M `src/layouts/menuConfig.js` · M `src/routes/AppRoutes.jsx` · D `src/pages/kitchen/{StockIssuePage,StockIssueApprovalPage,MealPreparationStatusPage,MealPreparationUpdatePage}.jsx` · M `src/services/kitchen/{kitchenService.js,api/kitchenApi.js,mock/kitchenMockRepository.js}` (bỏ hàm xuất kho/chuẩn bị) · D/M `tests/kitchen/stock-issue.test.mjs`
- Tests: AC-1, AC-2 → `tests/kitchen/flow-removal.test.mjs`
- Exit: `node scripts/verify.mjs` pass, skip 0. **Dừng chờ review.**
### Phase 2 — Shape danh mục theo contract BE (vẫn mock)
- Files: M `src/mocks/menuPlanningSeed.js` · M `src/services/menu-planning/mock/menuPlanningMockRepository.js` · M `src/pages/menu-planning/{FoodFormPage,FoodDetailPage,FoodListPage,DishFormPage,DishDetailPage,NutritionSetupPage}.jsx` · D `src/pages/menu-planning/{MealPriceListPage,MealPriceFormPage}.jsx` · M/C trang NCC dưới `/menu/suppliers` · M `src/models/menu-planning/menuPlanningConstants.js`
- Tests: AC-3..AC-6 → `tests/menu/{food-units,dish-food,nutrition-setup,menu-be-permissions}.test.mjs`, `tests/kitchen/supplier.test.mjs` cập nhật
- Exit: như trên. **Dừng chờ review.**
### Phase 3 — Nối BE (sau BE L1 Phase 4)
- Files: M `src/services/menu-planning/api/menuPlanningApi.js` (`/nutrition/*`) · M `src/config/integrationModules.js` (module mới `nutrition-catalog`, `source: 'api'`, routes danh mục) · M `src/services/menu-planning/menuPlanningService.js`
- Tests: AC-7 → `node scripts/check-api-contract.mjs`; smoke tay với BE local
- Exit: `node scripts/verify.mjs` pass; `node scripts/check-ai-layer.mjs` 0 lỗi. **Dừng chờ review.**

## Test matrix
| AC | Rule | Test | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2 | AUTH-21, NUT-11 | `tests/kitchen/flow-removal.test.mjs` | 1 | — |
| AC-3 | NUT-05 | `tests/menu/food-units.test.mjs` | 2 | — |
| AC-4 | NUT-18 | `tests/menu/dish-food.test.mjs` | 2 | — |
| AC-5 | NUT-17 | `tests/menu/nutrition-setup.test.mjs` | 2 | — |
| AC-6 | AUTH-20 | `tests/menu/menu-be-permissions.test.mjs` | 2 | — |
| AC-7 | — | `check-api-contract.mjs` | 3 | — |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Màn thực đơn tuần (demo) đọc shape món cũ (hệ số) | Lưới tuần tính sai | Phase 2 giữ hàm tính định lượng trong mock repo theo shape mới, chạy `tests/menu/weekly-*` | Revert Phase 2 |
| Xóa màn đang có người sửa song song | Conflict | Làm trên nhánh mới từ `dev`, PR nhỏ theo phase | Revert PR |

## Validation log
- [x] Khẳng định có đường dẫn/`file:line`
- [x] Contract theo plan BE L1
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-11-03 khuya — Lưu Thiết lập một lần (/batch), kiểm tra thực đơn dùng định mức/giá BE, mã lỗi BE dời +2
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `node scripts/check-ai-layer.mjs` 0 lỗi (20 cảnh báo cũ). `be-api-routes.json` thêm `POST /nutrition/age-group-configs/batch` (có trong openapi BE day-boarding), không `--sync`
- Làm: (1) `saveNutritionSetups` gửi một `POST /nutrition/age-group-configs/batch {items}` chỉ gồm nhóm đổi (BE lưu tất cả hoặc không nhóm nào); lỗi `items[i].x` → `${ageGroupId}.price|norms.x`. (2) Danh mục dùng BE ⇒ `getMenuCatalog` (`loadMenuCatalog`) lấy `norms`, `nutritionSetups`, `mealPrices` từ `GET /nutrition/age-group-configs?date=<hôm nay>` (adapter `getEffectiveSetups`), thực phẩm/món/thực đơn vẫn từ module menu-planning; `pricePerDay: true` ⇒ kiểm tra tuần (`weekBudgetCheck` trong `menuChecks`, dùng ở `WeekChecks`) so chi phí từng ngày với giá/ngày (NUT-19); mock giữ cách cũ (tổng tuần so giá × số ngày). (3) Mã lỗi danh mục BE dời +2 sau merge dev (6008/6009 nay là mã báo ăn, không map): `beErrorFields` 6012 nguồn số liệu, 6013 dị ứng, 6018 định lượng, 6020–6022 ngày hiệu lực, 6024 nhóm tuổi, 6026 nguồn gốc; các số cũ trong log bên dưới là số trước khi dời. Test `nutrition-catalog-api` (batch, lỗi theo dòng, catalog BE/mock, tiền ăn theo ngày), `nutrition-six-indicators` (6026).
- Giả định (cần user soát): (a) Định mức/giá cho kiểm tra lấy bản hiệu lực hôm nay, không theo ngày của tuần đang xem: tuần sau có bản giá mới thì kiểm tra vẫn dùng giá hôm nay; ngày trước ngày hiệu lực của bản hiện tại ⇒ "chưa có giá". (b) Thay (b) của mục trước: lưu Thiết lập nay nguyên tử giữa các nhóm.
### 2026-11-03 tối — Thiết lập dinh dưỡng nối BE, gộp giá suất, NCC về /menu/suppliers
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `node scripts/check-ai-layer.mjs` 0 lỗi (20 cảnh báo cũ)
- Làm: (1) `/menu/setup` thuộc module `nutrition-catalog`; adapter `listNutritionSetups`/`saveNutritionSetups` gọi `GET /nutrition/age-group-configs/{id}/versions` (mỗi nhóm tuổi), `POST /nutrition/age-group-configs`, `PUT /nutrition/age-group-configs/{id}`; nhóm tuổi BE ↔ `ag-x` qua code `/age-groups`; form lấy bản mới nhất; giá chỉ theo ngày (NUT-19); bữa lấy từ `mealSessions` chỉ đọc + "Bữa ăn chỉnh ở Cấu hình trường"; lịch sử phiên bản, bản đã hiệu lực "Đã áp dụng — chỉ xem"; ngày bản mới tối thiểu ngày mai khi nhóm đã có bản; lỗi 6018–6020 → ô ngày, lỗi trường → ô của nhóm tuổi. Bản demo giữ hành vi cũ. (2) Khóa định mức `animalProteinShare/animalLipidShare` → `animalProteinPct/animalLipidPct` (bộ tính, màn, test); mock đổi khóa cũ trong localStorage một lần (`migrateNormKeys`). (3) Xóa `MealPriceListPage`/`MealPriceFormPage`, route `/menu/prices*`, mục menu, `priceCrumbs`, hook `useMealPrice(s)`; giữ dữ liệu `mealPrices` mock cho kiểm tra chi phí. (4) Menu HT nhóm Danh mục: Thực phẩm, Món ăn, Cấu hình nhóm tuổi, NCC; route xem danh mục mở cho HT cả bản demo (`CATALOG_READERS = LEADERS`), form demo giữ PHT. (5) NCC chuyển `/menu/suppliers*`; `/kitchen/suppliers*` `<Navigate replace>`; breadcrumb "Danh mục & thiết lập". (6) Danh sách món: một `GET /nutrition/dishes` (BE trả đủ chi tiết). (7) `saveFoodsBulk`: một `POST /nutrition/foods/import {items:[{id?, data}]}` → `{created, updated}`; dòng sửa ghép vào bản hiện tại (đọc `GET /nutrition/foods` một lần); lỗi `items[i].data.x` → ô dòng. (8) Bỏ hằng `REPORTERS` thừa. Test mới `tests/menu/catalog-routes.test.mjs`; cập nhật `nutrition-catalog-api`, `nutrition-flow`.
- Giả định (cần user soát): (a) Thiết lập trên BE không có bật/tắt nhóm tuổi ⇒ ẩn công tắc và tab "Nhóm độ tuổi" khi nối BE. (b) Một ngày áp dụng chung cho mọi nhóm khi lưu; nhóm không đổi so với bản mới nhất thì bỏ qua; lưu tuần tự từng nhóm (không nguyên tử giữa các nhóm). (c) Ngày mặc định khi lưu = ngày của bản chưa hiệu lực sớm nhất (sửa thẳng bản đó), không có thì ngày mai. (d) Số trẻ theo nhóm BE chưa trả ⇒ "—". (e) Kiểm tra thực đơn (module menu-planning còn demo) vẫn đọc định mức/giá mock. (f) `docs/integration/be-api-routes.json` đã có đủ route `/nutrition/age-group-configs*`, `/nutrition/foods/import`, `/age-groups` ⇒ không đổi.
### 2026-11-03 — Cân đối khẩu phần 6 chỉ số (PMS) + nguồn gốc thực phẩm (NUT-24, BE viết song song)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Làm: thực phẩm có `origin` ANIMAL/PLANT (form bắt buộc "Nguồn gốc", lọc + cột ở danh sách, chi tiết; seed, thư viện tham khảo, localStorage cũ gán theo nhóm thịt/thủy sản/trứng sữa = động vật; file mẫu nhập thêm cột "Nguồn gốc" không bắt buộc, trống ⇒ theo nhóm; adapter BE map 1:1, thiếu ⇒ ''; mã lỗi 6024 → ô `origin`). Bộ tính `menuCalculations`: totals có 6 chỉ số (`animalProtein, plantProtein, animalLipid, plantLipid, glucid, kcal`) + `protein`/`lipid` tổng; `structureShares` (% động vật), `compareToNorm` trả thêm `target`, `attainment` (% đạt = thực tế / giữa khoảng; đạm/béo/bột quy ra g từ kcal mục tiêu) và 2 dòng không bắt buộc `animalProteinShare`, `animalLipidShare`; trạng thái `NA` = "Chưa đặt định mức", mới `INCOMPLETE` = "Chưa đủ dữ liệu"; `overallNormStatus` bỏ qua dòng không bắt buộc chưa đặt. Thiếu số liệu hoặc nguồn gốc ⇒ vẫn cộng phần đã biết, liệt kê thực phẩm, không đánh giá; không chặn lưu thực đơn/suất/dự trù. Định mức áp cho phạm vi bữa trường phục vụ (`normScopeMeals`). Màn: `NutritionTable` tách 3 bảng (lượng thực tế · tỷ lệ cơ cấu % · % đạt định mức) dùng ở thực đơn mẫu, thay thế, AI, cân đối; bảng cân đối tuần, chi tiết ngày, thẻ ngày, `checkDayMenu` (AI soạn tuần/mẫu) cùng bộ tính; Thiết lập thêm 2 khoảng % động vật (không bắt buộc). Màn Cân đối: sửa thử định lượng g/trẻ của món đang xem, tính lại ngay; "Lưu định lượng vào món" gọi `saveDish`. Test `tests/menu/nutrition-six-indicators.test.mjs` (6 chỉ số, % cơ cấu, P:L:G, % đạt, NA, thiếu dữ liệu, backfill, adapter, regression dự trù chợ/phiếu tuần không đổi); cập nhật `template-checks`, `food-units`, `food-bulk-import` theo rule mới.
- Khác/giả định (cần user soát): (1) "Mục tiêu" để tính % đạt = giữa khoảng định mức; đạm/béo/bột mục tiêu (g) = kcal mục tiêu × giữa khoảng % năng lượng / 4 hoặc 9. (2) Khóa định mức mới `animalProteinShare`, `animalLipidShare` (Thiết lập vẫn demo, chưa khớp tên BE). (3) Seed chưa đặt định mức % động vật để demo "Chưa đặt định mức". (4) Thực phẩm có số liệu nhưng thiếu nguồn gốc: đạm/béo vẫn vào tổng, không vào phần động vật/thực vật. (5) Lưu định lượng từ màn Cân đối chỉ hiện khi món của thực đơn và nơi lưu món cùng nguồn (`menuDishesSavable`): build nối BE (danh mục BE, thực đơn demo) chỉ sửa thử. (6) Nhãn trạng thái ngày khi chưa có định mức đổi từ "Chưa đủ dữ liệu đánh giá" thành "Chưa đặt định mức" ở chip; nhãn kiểm tra tự động giữ nguyên.

### 2026-11-02 đêm — Phase 2+3 (nối danh mục với BE `/nutrition/*`)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify`
- Làm: module `nutrition-catalog` (`source: 'api'`, routes `/menu/foods`, `/menu/dishes`, `/kitchen/suppliers`) trong `src/config/integrationModules.js`; adapter `src/services/nutritionCatalogApi.js` giữ tên hàm/dạng dữ liệu của mock (thực phẩm: `group`↔`foodGroup`, `nutrition{}`↔trường phẳng, tên dị ứng↔`allergenIds` qua `GET /nutrition/allergens` nạp 1 lần; món: `portions{'ag-x'}`↔dòng theo `ageGroupId` qua `GET /age-groups`, bỏ ô trống/0; xóa = PATCH `INACTIVE`; nhập hàng loạt: dòng mới 1 lần `POST /import`, dòng có id `PUT` từng dòng; "Hay dùng" ở localStorage). `menuPlanningService`/`kitchenService` chỉ chuyển hàm danh mục qua `sourceOf('nutrition-catalog', …)`. Form thực phẩm thêm "Nguồn số liệu dinh dưỡng" (bắt buộc, NUT-05) + "Phiên bản nguồn"; mock/seed lưu và kiểm; file mẫu nhập khẩu thêm 2 cột (file cũ vẫn đọc được). Nút sửa theo `NUTRITION_MANAGE` khi danh mục dùng BE (HT, PHT được cấp); route thực phẩm/món mở cho HT, form NCC cho HT+PHT khi dùng BE (mock giữ phân quyền cũ). NCC: CCCD người giao hàng chỉ hiện khi BE trả. Test `tests/menu/nutrition-catalog-api.test.mjs`; cập nhật `food-units`, `food-bulk-import`.
- Khác plan: (1) Adapter đặt ở `src/services/nutritionCatalogApi.js` (phần chung) và `hasBePermission`/`PERMISSIONS` chuyển lên `src/utils/bePermissions.js`, `src/models/bePermissions.js` (file cũ re-export) vì lint cấm `kitchen`, `menu-planning` import code riêng của module khác. (2) `docs/integration/be-api-routes.json` chỉ thêm 22 route `/nutrition/*` từ openapi BE nhánh day-boarding (không `--sync` toàn bộ: openapi nhánh đó thiếu route assessment/leave-requests đã có trên dev). (3) Món: BE không có Nháp ⇒ khi dùng BE form món bỏ nút "Lưu nháp", món mới mặc định Đang sử dụng; DRAFT gửi thành `INACTIVE`. Danh sách món đọc chi tiết từng món (cần định lượng, dị ứng) và chỉ lấy món của trường (`reference=false`). (4) Màn danh mục dùng `useCatalogLookups` (thực phẩm từ BE, thiết lập nhóm tuổi vẫn mock) thay `useMenuCatalog`; phiếu nhập kho (demo) chọn NCC mẫu qua `useReceiptSuppliers`. (5) Chưa đổi Phase 2 phần bố cục: bỏ `stockUnit`/`favorite` trên form, chuyển NCC về `/menu/suppliers`, HT chưa có mục menu Thực phẩm/Món (vào bằng đường dẫn).
- Tiếp: smoke tay với BE local (`VITE_USE_MOCK=false`); BE bắt buộc `unitPrice`, `kcal…glucid` nên form để trống sẽ nhận lỗi 400 từ BE.

### 2026-11-02 khuya — Phase 1 done (user bảo "tiếp tục làm ở FE")
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify`
- Làm: menu 6 nhóm (Bán trú hôm nay · Thực đơn & dinh dưỡng · Vận hành bếp · Kho thực phẩm · An toàn thực phẩm · Danh mục & thiết lập); "Sổ báo ăn" chuyển sang Vận hành bếp (đổi tên "Sổ suất ăn"); bếp không còn mục/route bán trú trên Web (AUTH-21); xóa route + trang xuất kho, nhận nguyên liệu cũ, chế biến (NUT-11, NUT-14, NUT-15); gỡ nguồn "chờ duyệt phiếu xuất kho" ở dashboard; link "Dịch vụ bán trú" của dashboard PHT trỏ `/kitchen`; test `tests/kitchen/web-boarding-layout.test.mjs`, cập nhật `tests/menu/nutrition-flow.test.mjs`.
- Khác plan: (1) nhánh G94-191 có sẵn (user chỉ 02/11): merge `origin/dev` vào nhánh (không xung đột) rồi chép Phase 1 sang. (2) Giữ logic mock phiếu xuất kho trong `kitchenMockRepository` (trang Việc hôm nay, test kho còn dùng) — lát L2 thay bằng trừ tự động. (3) Route `/attendance/meal-handover` (NUT-15 REMOVED) chưa gỡ — ngoài danh sách Phase 1.
- Tiếp: Phase 2 (shape danh mục theo contract BE `/nutrition/*`), Phase 3 (nối BE).

### 2026-11-02 — Lập plan (chờ user duyệt)
- Commit: chưa commit (file tạo trong worktree `CareNest_FE`, nhánh hiện tại `fix/G94-272-FE-FIX-01-e2e-flow-fixes` — không thuộc task này, chuyển sang nhánh mới khi bắt đầu)
- Tiếp: user cấp mã Jira FE + duyệt → tạo nhánh từ `dev` → Phase 1.
