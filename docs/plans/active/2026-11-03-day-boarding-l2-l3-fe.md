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
