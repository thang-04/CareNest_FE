---
title: Bán trú L2 + L3 (FE) — kho khô, kế hoạch tuần + công bố, Bán trú hôm nay nối BE
status: in-progress
owner: thangnd
jira: G94-191 / FE-FEAT-48
branch: feature/G94-191-FE-FEAT-48-nutrition-management   # worktree CareNest_FE/.commit-worktrees/nutrition; fast-forward origin/dev 03/11
modules: [menu-planning, kitchen]
rules: [NUT-08, NUT-10, NUT-11, NUT-13, NUT-19, NUT-20, NUT-24, P-38, AUTH-20, AUTH-21]
risk: high
created: 2026-11-03
updated: 2026-11-03
---
# Bán trú L2 + L3 (FE) — kho khô, kế hoạch tuần + công bố, Bán trú hôm nay nối BE

Phần client. Plan BE: `CareNest_BE:docs/plans/active/2026-11-03-day-boarding-l2-dry-stock.md`, `…/2026-11-03-day-boarding-l3-weekly-menu.md` (contract `/nutrition/stock/*`, `/nutrition/meal-plans/*`, `/nutrition/day-board`). Plan ô: `CareNest_BE:docs/plans/active/2026-11-02-day-boarding-redesign.md`.

## Context
- "Bán trú hôm nay" đang trỏ trang tạm: HT `kitchenDay` → `/kitchen` (`KitchenFlowPage`), PHT thêm `menuFlow` → `/menu/flow` (`NutritionFlowPage`) (`src/layouts/menuConfig.js:394`, `:438`); cả hai chạy demo (`src/config/integrationModules.js:156` module `kitchen`).
- Kế hoạch tuần `/menu/weekly` (`WeeklyMenuPage.jsx`, 629 dòng) chạy mock, lưu theo nhóm tuổi, công bố từng nhóm, có "phiên bản thay thế" — trái NUT-08 (công bố cả tuần, không sửa) và NUT-13 (theo khối).
- Kho: `DryStockPage`, `StockReceiptListPage/FormPage` demo; chưa có Lịch sử nhập/trừ, Phần thiếu.
- L1 nối BE qua `beClient` + `sourceOf()` (`src/services/nutritionCatalogApi.js`, `src/services/demoSource.js`); `scripts/check-api-contract` đòi mọi call trong `docs/integration/be-api-routes.json`.

## Quyết định đã chốt
1. Theo plan BE L2, L3 (công bố cả tuần, trừ kho khi xác nhận suất, hub 5 dòng). L2 + L3 một đợt; nhánh L1; mã Jira G94-191 — user 03/11.
2. Bếp không có Web (AUTH-21) — giữ.

## Thiết kế
**Nối BE:** `src/services/{dryStockApi,mealPlanApi,dayBoardApi}.js` dùng `beClient`; module mới `dry-stock`, `meal-plan`, `day-board` `source: 'api'` (route dài thắng `/menu`, `/kitchen`). Build mock (`VITE_USE_MOCK` mặc định) giữ màn demo cũ: route chọn trang qua `isDemoModule(key)` — không viết mock cho contract mới.

**Bán trú hôm nay** — `/boarding/today` (`src/pages/boarding/BoardingTodayPage.jsx`): chọn ngày + điểm trường (`KbDateFilter`, `CampusFilter`); mỗi điểm trường một khối 5 dòng, mỗi dòng: tên · trạng thái (`StatusBadge`) · chi tiết · nút tới việc:

| Dòng | Trạng thái (từ `GET /nutrition/day-board`) | Nút |
| --- | --- | --- |
| Thực đơn tuần | Tuần này / tuần sau: chưa lập · nháp · đã công bố; ngày nghỉ | Kế hoạch tuần (`/menu/weekly?week=`) |
| Số suất | Chưa tổng hợp · chờ xác nhận · cần xác nhận lại · đã xác nhận (số theo bữa) | Sổ suất ăn |
| Kho khô | Chờ suất · đã trừ n thực phẩm · thiếu n thực phẩm · không có thực đơn | Lịch sử nhập/trừ hoặc Phần thiếu |
| Hàng tươi lần 1/2 | Chưa triển khai (L4) | Kiểm nhận (màn demo, có nhãn) |
| Lưu mẫu chờ duyệt | Chưa triển khai (L5) | Lưu mẫu (màn demo, có nhãn) |

Chuyển dữ liệu → dòng bằng hàm thuần `src/utils/boarding/dayBoardRows.js` (test được).

**Kế hoạch tuần & công bố** — `/menu/weekly` (`WeeklyPlanPage.jsx`, build BE): chọn tuần (`WeekPicker`), tab khối Nhà trẻ / Mẫu giáo, lưới ngày × bữa (bữa theo khối), chọn món từ `GET /nutrition/dishes`, đánh dấu ngày nghỉ, Lưu nháp (`PUT`), bảng kiểm ngày × nhóm tuổi (6 chỉ số, % đạt, giá) lấy từ BE sau lưu; nút **Công bố tuần** mở hộp thoại: lỗi chặn (ngày, nhóm tuổi, lý do) / cảnh báo (vượt giá, lặp món); 409 ⇒ hiện `issues` BE trả. Đã công bố ⇒ chỉ đọc. Nút sửa theo `canEdit/canPublish` BE trả. Hàm thuần lưới ↔ payload: `src/utils/menu-planning/mealPlanGrid.js`.

**Kho khô** — 4 route một trang tab (`src/pages/kitchen/DryStockLedgerPage.jsx`): `/kitchen/dry-stock` (tồn theo lô, gom theo thực phẩm, cảnh báo sắp hết hạn), `/kitchen/stock-receipts` (phiếu nhập: danh sách, lập/sửa nháp, xác nhận, hủy có lý do — `StockReceiptEditorPage.jsx`), `/kitchen/stock-history` (lịch sử nhập/trừ, lọc loại), `/kitchen/stock-shortfalls` (phần thiếu chờ bổ sung). Số lượng nhập/hiện theo đơn vị mua, gửi BE đơn vị gốc (`src/utils/kitchen/stockUnits.js`).

**Menu** (`menuConfig.js`, HT + PHT): `today: ['boardingToday']` (bỏ `kitchenDay`, `menuFlow`); `stock: ['dryStock', 'stockReceipts', 'stockHistory', 'stockShortfalls']`. `/kitchen` (index) và `/menu/flow` ở build BE chuyển hướng `/boarding/today`. `src/models/bePermissions.js` thêm `MENU_MANAGE`, `STOCK_MANAGE`.

## Acceptance criteria
- **AC-1** (`NUT-08`): Given BE trả 409 kèm `issues`, When bấm Công bố, Then hộp thoại liệt kê ngày + nhóm tuổi + lý do, tuần vẫn nháp; công bố được ⇒ lưới khóa, nhãn "Đã công bố".
- **AC-2** (`NUT-13`): Lưới lưu theo khối; payload `PUT` đúng `{days[{date, off, note, items[{session, block, dishId}]}]}` (test hàm thuần).
- **AC-3** (`NUT-11`, `P-38`): Hub hiện đúng trạng thái kho khô: chờ suất / đã trừ / thiếu n (test `dayBoardRows`).
- **AC-4** (`NUT-11`): Phiếu nhập gửi số lượng đơn vị gốc = số nhập × `purchaseUnitSize`; tồn hiện quy đổi ngược (test `stockUnits`).
- **AC-5** (`AUTH-21`): Bếp vẫn không có mục Web bán trú; HT, PHT có "Bán trú hôm nay" → `/boarding/today` (test menu layout).

## Phases
### Phase 1 — Kho khô
- Files: C `src/services/dryStockApi.js`, `src/utils/kitchen/stockUnits.js`, `src/pages/kitchen/{DryStockLedgerPage,StockReceiptEditorPage}.jsx` · M `src/routes/AppRoutes.jsx`, `src/config/integrationModules.js`, `docs/integration/be-api-routes.json`, `src/layouts/menuConfig.js`
- Tests: AC-4 → `tests/kitchen/dry-stock-api.test.mjs`
### Phase 2 — Kế hoạch tuần + công bố
- Files: C `src/services/mealPlanApi.js`, `src/utils/menu-planning/mealPlanGrid.js`, `src/pages/menu-planning/WeeklyPlanPage.jsx`, `src/components/menu-planning/PublishWeekDialog.jsx` · M routes, modules, routes json
- Tests: AC-1, AC-2 → `tests/menu/meal-plan-api.test.mjs`
### Phase 3 — Bán trú hôm nay, menu
- Files: C `src/services/dayBoardApi.js`, `src/utils/boarding/dayBoardRows.js`, `src/pages/boarding/BoardingTodayPage.jsx` · M `menuConfig.js`, `src/models/bePermissions.js`, routes, `tests/kitchen/web-boarding-layout.test.mjs`, `docs/integration/*`
- Tests: AC-3, AC-5 → `tests/kitchen/day-board.test.mjs`, layout test
- Exit mỗi phase: `node scripts/verify.mjs` → `VERIFY PASS`; Phase 3 thêm build `VITE_USE_MOCK=false`, chạy với BE docker local, ảnh chụp hub + kế hoạch tuần.

## L5 (Web) — bếp hôm nay, lưu mẫu, ảnh bữa, khung giờ ảnh
BE spec: `CareNest_BE-day-boarding:docs/plans/active/2026-11-03-day-boarding-l5-l6-kitchen-parent.md` (Phase 1). Bếp dùng App (AUTH-21), màn App để đợt sau; Web chỉ xem + duyệt.
- Module `kitchen-records` (`source: api`) thắng `/kitchen` demo cho 4 route: `/kitchen/published-menu` (`KitchenTodayPage`, thay trang demo khi nối BE), `/kitchen/food-samples` (`FoodSampleQueuePage`: hàng chờ duyệt + in biểu mẫu chung qua `PrintToolbar`), `/kitchen/meal-photos` (`MealPhotosPage`), `/kitchen/photo-windows` (`MealPhotoWindowsPage`, HT sửa, PHT xem). Build mock giữ `PublishedMenuPage`/`FoodSampleLogPage` qua `isDemoModule`.
- Files: C `src/services/kitchenRecordsApi.js`, `src/hooks/kitchen/useKitchenRecords.js`, `src/utils/kitchen/kitchenRecords.js`, `src/models/kitchen/kitchenRecordConstants.js`, `src/components/kitchen/{SampleRecordBadges,FoodSampleFormPrint}.jsx`, 4 trang trên, `src/styles/modules/kitchen-records.css` · M `beClient.js` (+`getBlob`), `dayBoardRows.js` (hàng lưu mẫu), `integrationModules.js`, `be-api-routes.json`, `AppRoutes.jsx`, `day-board.test.mjs`
- Tests: `tests/kitchen/kitchen-records-api.test.mjs`, `day-board.test.mjs`.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Phiên khác sửa `menuConfig.js`/`AppRoutes.jsx` trên worktree `CareNest_FE-dev-e2e` (chưa commit) | Conflict khi merge | Sửa nhỏ, theo khối; báo khi bàn giao | Gộp tay |
| Hai trang cùng route (mock/BE) | Khó bảo trì | Trang demo xóa khi bỏ build mock cho module | — |

## Progress log
### 2026-11-03 — Plan duyệt (user thangnd, chạy một mạch; chặn công bố khi chưa đặt định mức hoặc thiếu số liệu — user chọn)
- Commit: chưa commit. Nhánh đã fast-forward lên `origin/dev` `07c592d`.

### 2026-11-03 — Phase 1–3 code xong, chưa chạy với BE thật
- **Đã làm:** `dryStockApi`, `mealPlanApi`, `dayBoardApi` (factory nhận `client`) + module `dry-stock`, `meal-plan`, `day-board` (`source: 'api'`) + 15 route trong `be-api-routes.json` (thêm tay, `syncedAt` giữ nguyên; chạy `--sync` khi BE openapi có các route này). Trang mới: `/boarding/today`, `/menu/weekly` (`WeeklyPlanPage` + `PublishWeekDialog`), `/kitchen/{dry-stock,stock-receipts,stock-history,stock-shortfalls}` (`DryStockLedgerPage`, 4 tab), `/kitchen/stock-receipts/{new,:id}` (`StockReceiptEditorPage`). Build mock giữ trang cũ qua `isDemoModule`: hub = `KitchenFlowPage`, `stock-history`/`stock-shortfalls` = `DryStockPage` cũ. Build BE: `/kitchen`, `/menu/flow`, `/menu/weekly/new`, `/menu/weekly/:id/edit`, `/menu/plans` chuyển hướng.
- **Menu:** HT, PHT có `today: ['boardingToday']`, `stock` 4 mục; bỏ `kitchenDay`, `menuFlow`; bếp không đổi. `bePermissions.js` thêm `MENU_MANAGE`, `STOCK_MANAGE` (UI theo cờ BE `canEdit`/`canPublish`/`canManage`, `STOCK_MANAGE` chỉ ẩn/hiện nút khi chưa có phiếu). Link VP dashboard `/kitchen` → `/boarding/today`.
- **Chuyển lên phần dùng chung** (ESLint cấm import chéo module): `MEAL_SESSION_LABELS` → `src/models/mealSessions.js`, `formatMoney` + `formatQty` → `src/utils/format.js`; `menuPlanningConstants.js` re-export lại nên import cũ vẫn chạy. Nhãn bữa dùng sẵn "Bữa phụ sáng" (không đổi thành "Bữa sáng").
- **Giả định cần BE/user soát:** (1) dòng đánh giá `rows[]`: hiện `value` + đơn vị (g/kcal/%) và `attainment` % đạt, tooltip `min–max`; chưa rõ `percent`, `target` nên không hiện. (2) `createdBy`/`confirmedBy`/`cancelledBy` hiện khi là tên; BE trả mã số thì ẩn. (3) Gom lô theo thực phẩm: tổng còn lại = cộng `remaining` các lô (chỉ hiển thị); nhãn "Còn N ngày" khi hạn ≤ 14 ngày chỉ là gợi ý tô màu, không chặn. (4) `note` ngày rỗng gửi `''` (beClient đổi thành `null`). (5) Món chọn cho lưới: `listDishes({status:'ACTIVE'})`; thực phẩm khô: lọc `storage === 'DRY'` phía FE vì danh sách BE không có tham số này.
- **Test:** `tests/kitchen/dry-stock-api.test.mjs` (8), `tests/menu/meal-plan-api.test.mjs` (9), `tests/kitchen/day-board.test.mjs` (9), `web-boarding-layout` +3, sửa `nutrition-flow`, `weekly-page`, `nutrition-catalog-api` theo menu và module mới.
- **Kiểm chứng:** `VERIFY PASS full | npm run verify | log verify.log`; `VITE_USE_MOCK=false npx vite build` qua. Duyệt tay bằng trình duyệt thật (Edge) với BE giả bằng `page.route`: hub, lưu nháp + công bố (409 rồi thành công), phiếu nhập tạo/xác nhận/hủy 409/xóa nháp, tồn kho, lịch sử, phần thiếu; không có lỗi console. **Chưa** chạy với BE docker thật, chưa chụp ảnh nộp.
- Commit: chưa commit.

### 2026-11-03 — Chỉnh sau kiểm dữ liệu thật; bố cục kế hoạch tuần theo yêu cầu user
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; build `VITE_USE_MOCK=false` qua.
- User 03/11: lưới kế hoạch tuần giữ bố cục sổ thực đơn cũ (`WeekGrid`): cột là thứ + nhãn "N lưu ý"/"Đạt" theo kết quả BE, dải tiêu đề mỗi bữa, bữa trưa tách Cơm/Món mặn/Canh/Món rau/Tráng miệng, hàng "Suất dị ứng" cuối bảng. `MealPlanGrid` viết lại theo cấu trúc/class đó; helper thuần `gridSections`, `rowItems`, `dayResult`, `dayAllergenNotes` (`mealPlanGrid.js`), test thêm 2 ca. Hàng dị ứng chỉ nêu chất của món theo danh mục + "chưa có suất thay thế" — số trẻ dị ứng theo chất chưa có ở BE.
- Sửa: dòng đạm/béo/bột hiện thêm % năng lượng BE trả, tooltip định mức theo % (trước ghi "g"); bỏ tiền tố khối FE ghép trước câu lỗi (câu BE đã có ngày + khối); bỏ `issueScope` không còn dùng; chữ "Chưa có món món rau".
- Giả định agent cũ đã xử lý: (1) `percent` = % năng lượng (đạm/béo/bột), `target` không hiện; (5) BE `GET /nutrition/foods` có tham số `storage` nhưng lọc phía FE vẫn đúng — giữ.
- Kiểm E2E dữ liệu thật (user yêu cầu 03/11 "test dữ liệu thật, không mock"): stack docker riêng `carenest_l3` (Postgres :5433, Keycloak :8181 import user dev, API :8081 build từ nhánh) + FE build `VITE_USE_MOCK=false VITE_SCHOOL_CONFIG_API=true`, đăng nhập HT dev. Luồng đã chạy: phiếu nhập 2 điểm trường (API) → lập lưới tuần 02/11 → công bố trên UI → sổ suất tổng hợp từ điểm danh thật, HT xác nhận trên UI → event trừ kho: CS-A gạo 166 g lấy lô hạn 30/11 trước, dầu 10 g, sữa thiếu 360 ml; CS-B trừ đủ 3 thực phẩm (khớp tính tay) → phiếu nhập bổ sung sữa trên UI ⇒ `SHORTFALL_DEDUCT` −2 hộp, hub CS-A "Đã trừ"; hủy phiếu có lô đã trừ ⇒ 409 6032; tuần 09/11 lập trên UI, thứ Ba trống ⇒ hộp thoại 2 lỗi chặn, `POST /publish` ⇒ 409 6039.
- Ảnh: `docs/plans/active/day-boarding-screens/l3-*.jpg` (hub 3 trạng thái, kế hoạch tuần đã công bố/nháp, bảng kiểm, hộp thoại công bố), `l2-*.jpg` (tồn theo lô, lịch sử, phần thiếu, hủy bị chặn).

### 2026-11-03 — Hub: trạng thái "chưa trừ kho" + nút "Đồng bộ kho" (theo sửa lỗi review BE)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- BE thêm `dryStock.status = NOT_SYNCED` và `POST /nutrition/stock/days/{date}/sync?campusId`. FE: `dayBoardApi.syncStockDay`, `dayBoardRows` (đỏ "Chưa trừ n thực phẩm", nút đồng bộ + link lịch sử), nút trên `BoardingTodayPage` (toast, nạp lại). `be-api-routes.json` thêm route. Test `tests/kitchen/day-board.test.mjs` +2.
- Kiểm stack `carenest_l3`: hub CS-A 05/11 "Chưa trừ 3 thực phẩm" → "Đồng bộ kho" → "Đã trừ 3 thực phẩm".

### 2026-11-03 — L4: hàng tươi (bản dự trù + kiểm nhận hai lần) nối BE
- Commit: chưa commit
- **Đã làm:** `src/services/freshGoodsApi.js` (factory nhận `client`; `toForecastRequest`, `toCheckRequest` đổi số thực nhận đơn vị mua → đơn vị gốc, thêm `purchase*` khi đọc) + module `fresh-goods` (`source: 'api'`, route `/kitchen/forecast`, `/kitchen/fresh-receipts`) + 7 route trong `be-api-routes.json` (thêm tay). Trang: `FreshForecastPage` (`/kitchen/forecast` danh sách, `/new` lập: chọn kỳ → xem trước BE → sửa số trẻ dự kiến → "Tính lại" → lưu, `/:id` xem, in danh sách đặt hàng qua `PrintToolbar`, xóa có xác nhận) và `FreshCheckPage` (`/kitchen/fresh-receipts`: ngày + điểm trường, hai thẻ lần 1/lần 2, Đủ/Thiếu/Thừa, chỉ xem khi `canManage` sai, lần chưa mở hiện `unavailableReason`). Build mock giữ `WeeklyForecastPage`/`FreshReceiptPage` qua `isDemoModule`. Hub `dayBoardRows`: 6 trạng thái hàng tươi (bỏ nhãn demo), NO_FORECAST trỏ `/kitchen/forecast?campusId=`. Thêm `BE_ERROR_FIELDS[6041] = 'periodTo'`; nhãn breadcrumb `forecast` đổi thành "Bản dự trù hàng tươi".
- **Giả định cần BE/user soát:** (1) lần kiểm đã ghi nhận vẫn sửa lại được bằng PUT khi `canManage` (nút "Cập nhật kiểm nhận"); BE từ chối thì hiện lỗi BE. (2) Kỳ mặc định = hôm nay → hôm nay; thứ tự ngày và ≤ 31 ngày do BE kiểm (6041). (3) Lưu bản dự trù chỉ bấm được khi bảng khớp kỳ + số trẻ đang nhập (so khóa nhập, không tính lại số); đổi ghi chú không cần tính lại. (4) Nút "Lập bản dự trù" ẩn theo `STOCK_MANAGE` (chỉ ẩn/hiện), BE vẫn kiểm; chi tiết dùng `canManage` BE trả. (5) "Đánh dấu tất cả Đủ" chỉ điền ô kết quả hộ người dùng, không gửi tự động. (6) Tông kết quả: Đủ xanh lá, Thiếu đỏ, Thừa cam (DESIGN §3.2). (7) Hub: ROUND1_DONE tông xanh dương "Đã kiểm lần 1" kèm chi tiết chờ suất; DAY_OFF vẫn có nút "Kiểm nhận".
- **Test:** `tests/kitchen/fresh-goods-api.test.mjs` (10 ca: path/body, đổi đơn vị, form, route), `day-board.test.mjs` sửa theo trạng thái hàng tươi mới.
- **Chưa làm:** chạy với BE thật (BE L4 đang làm song song); chưa chụp ảnh.

### 2026-11-03 — L5 (Web): bếp hôm nay, lưu mẫu, ảnh bữa, khung giờ ảnh, hub
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `VITE_USE_MOCK=false npx vite build --outDir <temp>` qua. Chưa chạy với BE thật, chưa chụp ảnh.
- **Đã làm:** xem mục "L5 (Web)" ở trên. `beClient.getBlob` tải ảnh qua client có token (đọc lại JSON lỗi trong blob); `useMealPhotoUrl` đổi sang object URL và thu hồi khi đổi ảnh/rời màn. Hub `dayBoardRows`: lưu mẫu `PENDING_APPROVAL` (tông tím, "n chờ duyệt", link `/kitchen/food-samples?campusId=&status=pending`), `UP_TO_DATE`, `NONE`; bỏ nhãn "Chưa triển khai / demo". Sửa `tests/menu/nutrition-catalog-api.test.mjs`: `/kitchen/published-menu`, `/food-samples`, `/meal-photos`, `/photo-windows` nay thuộc module api (đổi có chủ đích); demo còn lại kiểm bằng `/kitchen/missing-food`.
- **Giả định (chờ soát):** (1) Nút duyệt theo cờ `canApprove` của từng bản ghi BE; 403/409 hiện thông điệp BE, 409 nạp lại. (2) Khoảng ngày mặc định 30 ngày gần nhất; hub trỏ `status=pending` (lọc chờ duyệt phía FE = `status RECORDED` hoặc `disposalStatus RECORDED`, cùng nghĩa số chờ ở hub, mọi ngày trong khoảng chọn — hub đếm mọi ngày nên bản cũ hơn 30 ngày không hiện, chỉnh "Từ ngày" để xem). (3) Biểu mẫu in = bản chung (P-26 mở), chỉ bản `APPROVED`, ô ký để trống. (4) Khung giờ: chỉ HT sửa (`isPrincipal`), bữa để trống cả hai ô = giữ nguyên (không gửi), BE là nơi kiểm quyền (6072). (5) Không tính tổng suất ở FE; chỉ hiện từng lớp × bữa BE trả. (6) Không thêm mục menu Web cho Ảnh bữa/Khung giờ ảnh (`menuConfig.js` thuộc phiên khác): vào qua nút trên Bếp hôm nay và Ảnh bữa; PHT chưa có mục menu "Bếp hôm nay" (vào qua hub).

### 2026-11-03 — Thống kê định lượng thực đơn, bộ mẫu 4 tuần, bảng dinh dưỡng món (yêu cầu user 03/11)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full` sau khi thêm trang thống kê; sau đó worktree có thay đổi L5 đang làm của phiên khác làm `tests/menu/nutrition-catalog-api.test.mjs:328` (`/kitchen/stock-issues`) fail — không thuộc phần này. Sửa cuối (dialog, bảng) qua eslint, prettier, `check-design`, 21 test menu. Chạy thật: API riêng :8083 trên DB bản sao `carenest_stats`, FE preview :5192, ảnh ở `plans/reports/day-boarding-e2e-261103` mục 5.
- **Đã làm:** `/menu/statistics` (`MenuStatisticsPage`, `components/menu-planning/MenuStatistics.jsx`) gọi `POST /nutrition/menu-statistics`; nguồn `?week=&date=` (kế hoạch tuần) hoặc `?template=&weekNo=&weekday=` (bộ mẫu); link "Thống kê" đầu cột ngày (`MealPlanGrid` prop `dayLink`). `utils/menu-planning/menuStatistics.js` chỉ chọn món của khối/ngày gửi BE; mọi số do BE tính. Hộp thoại sao bộ mẫu rộng `lg`.
- **Giả định (chờ soát):** (1) Thống kê đọc bản đã lưu trên BE (đang sửa nháp thì leave guard hỏi lưu). (2) Số trẻ nhập tay chỉ để tính, không lưu. (3) "Chênh" ở bảng dinh dưỡng = mức tiền ăn − tiền 1 trẻ, chỉ hiển thị. (4) % calo từng bữa theo NUT-25 hiện tính trên tổng kcal các bữa trường phục vụ (không phải nhu cầu cả ngày) — cần user xác nhận vì phần mềm mẫu thường so nhu cầu cả ngày.

### 2026-11-03 — Menu Web cho màn L5
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- `menuConfig`: PHT thêm "Thực đơn bếp nhận" (`/kitchen/published-menu`, BE `GET /nutrition/kitchen/day` cho HT, PHT); nhóm an toàn thực phẩm HT, PHT thêm "Ảnh bữa ăn", "Khung giờ ảnh bữa" — chỉ khi `kitchen-records` nối BE (build mock không có route). Không import `demoSource` trong menu (kéo `mockDatabase` cần `window`, vỡ test node) ⇒ đọc `USE_MOCK` + `INTEGRATION_MODULES`.
- Test: `tests/kitchen/web-boarding-layout.test.mjs` +1; `tests/menu/nutrition-flow.test.mjs` cập nhật kỳ vọng nhóm việc bếp của PHT.

### 2026-11-03 — % calo từng bữa so nhu cầu năng lượng cả ngày (user chốt)
- Commit: chưa commit
- **User chốt:** % calo mỗi bữa = kcal bữa ÷ nhu cầu năng lượng cả ngày (không phải tổng các bữa trường phục vụ). BE V62 `daily_kcal_need`, NUT-25 sửa theo.
- **Đã làm (FE):** Thiết lập dinh dưỡng có ô "Nhu cầu năng lượng cả ngày (kcal/trẻ)" trên bảng % bữa, tổng quan hiện "Cả ngày"; `nutritionCatalogApi` map `dailyKcalNeed` (đọc/ghi, lỗi field); nhãn cột "% nhu cầu cả ngày" ở bảng kiểm tuần và thống kê.
- **Giả định (chờ soát):** nhu cầu là một số (không khoảng), không có số mặc định — chưa nhập thì bữa "Chưa đặt"; dev seed dùng số minh họa 1000 (nhà trẻ) / 1300 (mẫu giáo) và % bữa 5–15 / 30–40 / 15–25.
