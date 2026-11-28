---
title: Bỏ màn "Định lượng & đi chợ", đưa "Đi chợ theo ngày" lên menu bếp
status: in-progress        # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: thangnd
jira: G94-513 / FE-FEAT-191
branch: feature/G94-513-FE-FEAT-191-market-nav
modules: [menu-planning, kitchen]
rules: [NUT-07, NUT-12, P-24]
risk: medium
created: 2026-11-28
updated: 2026-11-28
---
# Bỏ màn "Định lượng & đi chợ", đưa "Đi chợ theo ngày" lên menu bếp

## Context
User thấy luồng khó hiểu: chữ "đi chợ" nằm ở hai màn khác nghĩa, và "Đi chợ theo ngày" lại bị giấu dưới "Bản dự trù".

Hiện trạng:
- `/menu/statistics` "Định lượng & đi chợ" (`src/pages/menu-planning/MenuStatisticsPage.jsx:40`): xem 1 ngày × 1 nhóm tuổi; nhập tay được số trẻ; hiện món, thực phẩm × số trẻ, tiền, dinh dưỡng 1 trẻ, calo từng bữa; có in và xuất Excel. Không lưu gì.
- `/menu/nutrition` "Cân đối khẩu phần" (`src/components/menu-planning/DayBalanceView.jsx:22`) gọi cùng `useMenuStatistics` (`POST /nutrition/menu-statistics`) và đã có dinh dưỡng 1 trẻ, tiền 1 trẻ so với ngân sách, calo từng bữa, tab nhóm tuổi.
- `/kitchen/market-day` "Đi chợ theo ngày" (`src/pages/kitchen/DayMarketPage.jsx`): gộp mọi nhóm tuổi của một điểm trường; tính theo suất đã chốt (chưa chốt thì theo sĩ số); có nhóm theo NCC, thu – chi, in, Excel. Không có trên menu; chỉ mở được qua nút ở danh sách dự trù (`src/components/kitchen/FreshForecastList.jsx:82`), bản demo (`src/pages/kitchen/WeeklyForecastPage.jsx:174`), và breadcrumb dưới "Bản dự trù" (`DayMarketPage.jsx:123`).
- `/kitchen/forecast` "Bản dự trù": đặt hàng theo kỳ với sĩ số dự kiến, được lưu, dùng để kiểm nhận lần 1 (NUT-07, NUT-12, P-24).
- Menu HT có `menuStatistics` nhưng không có `nutrition` (`src/layouts/menuConfig.js:478`); route `/menu/nutrition` vẫn cho HT vào (`src/routes/AppRoutes.jsx:492`, `LEADERS` ở `:199`).
- Kế hoạch tuần có link "Đi chợ" dưới mỗi cột ngày (`src/components/menu-planning/MealPlanGrid.jsx:248-251`), trỏ `statisticsHref` (`src/pages/menu-planning/WeeklyPlanPage.jsx:361`).

## Quyết định đã chốt
1. Bỏ màn "Định lượng & đi chợ" (phương án A) — user, 28/11/2026.
2. Thêm "Cân đối khẩu phần" vào menu Hiệu trưởng — user, 28/11/2026.
3. Link "Đi chợ" dưới mỗi ngày ở Kế hoạch tuần giữ chữ, đổi đích sang "Đi chợ theo ngày" của ngày đó — user, 28/11/2026.
4. Mỗi khái niệm chỉ một màn: định lượng/dinh dưỡng ở Cân đối khẩu phần · đặt hàng theo kỳ ở Bản dự trù · mua hằng ngày ở Đi chợ theo ngày.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: HT, PHT dinh dưỡng.
  - Outcome: tìm đúng màn cho đúng việc.
  - Rule: NUT-07, NUT-12, P-24 (CONFIRMED); không đổi rule.
- **Đối chiếu thiết kế ban đầu:** P-24 (08/11) chốt "một nơi để dự trù và đặt hàng". Đi chợ theo ngày là bảng ngày, chỉ đọc, không lưu (`BE:docs/modules/nutrition.md:44`), nên tách khỏi dự trù không trái P-24.
- **Ảnh hưởng:**
  - Chỉ FE: `FE: /menu/statistics` (chuyển hướng), `/menu/weekly` (link ngày), `/kitchen/forecast` (bỏ nút), `/kitchen/market-day` (lên menu, breadcrumb riêng), menu HT/PHT.
  - BE: không đổi; `POST /nutrition/menu-statistics` vẫn dùng cho Cân đối và mẫu thực đơn.
  - APP: không ảnh hưởng.
- Chức năng bị mất (user chấp nhận): nhập tay số trẻ cho một nhóm tuổi; xem tính toán theo mẫu qua `?template=` (hiện không còn link trỏ tới); bản in "Người lập/Người duyệt" của bảng định lượng.

### Câu hỏi mở
- [x] Menu HT thiếu Cân đối khẩu phần ⇒ thêm (user 28/11).
- [x] Link "Đi chợ" ở Kế hoạch tuần ⇒ trỏ Đi chợ theo ngày (user 28/11).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Màn Định lượng & đi chợ xử lý sao | Bỏ (A) | user | 2026-11-28 | plan này |
| HT có Cân đối khẩu phần không | Thêm | user | 2026-11-28 | plan này |
| Link ngày ở Kế hoạch tuần | Mở Đi chợ theo ngày | user | 2026-11-28 | plan này |

## Acceptance criteria
- **AC-1:** Given HT hoặc PHT đăng nhập · When mở sidebar · Then nhóm Thực đơn & dinh dưỡng không còn "Định lượng & đi chợ" và có "Cân đối khẩu phần"; nhóm Vận hành bếp có "Đi chợ theo ngày" ngay sau "Bản dự trù".
- **AC-2:** Given link cũ `/menu/statistics?week=W&date=D` · When mở · Then chuyển sang `/menu/nutrition?week=W&date=D`. Given `?template=T` · Then chuyển sang `/menu/templates/T`. Không có tham số · Then sang `/menu/nutrition`.
- **AC-3:** Given Kế hoạch tuần có ngày học · When bấm "Đi chợ" dưới ngày D · Then mở `/kitchen/market-day?date=D`.
- **AC-4:** Given danh sách Bản dự trù · Then không còn nút "Đi chợ theo ngày". Màn Đi chợ theo ngày có breadcrumb `Trang chủ > Bếp & kho thực phẩm > Đi chợ theo ngày`.
- **AC-5:** Cân đối khẩu phần và xem trước mẫu thực đơn vẫn hiện dinh dưỡng như trước (không vỡ `StatisticsNutrition`, `useMenuStatistics`).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Màn Định lượng & đi chợ | Bỏ, chuyển hướng | B thu hẹp thành bảng định lượng; C gộp tab vào Cân đối | Dinh dưỡng/tiền trùng Cân đối; lượng mua trùng Đi chợ theo ngày (user chọn A) |
| Route cũ | `Navigate` giữ `week`/`date` | 404 | Link đã lưu, bookmark vẫn dùng được |
| Code cũ | Xóa phần không còn ai import | Giữ lại | YAGNI; grep lại trước khi xóa |

## Phases
### Phase 1 — Điều hướng (menu, route, link)
- Files:
  - M `src/layouts/menuConfig.js` (vùng dùng chung ⇒ in bản tác động trước khi sửa)
  - M `src/routes/AppRoutes.jsx`
  - M `src/utils/kitchen/breadcrumbs.js` (nếu cần)
  - M `src/pages/kitchen/DayMarketPage.jsx`
  - M `src/components/kitchen/FreshForecastList.jsx`
  - M `src/pages/kitchen/WeeklyForecastPage.jsx`
  - M `src/pages/menu-planning/WeeklyPlanPage.jsx`
  - M `src/components/menu-planning/MealPlanGrid.jsx` (aria-label)
- Steps:
  1. menuConfig:
     - Thêm item `dayMarket` (`Đi chợ theo ngày`, `/kitchen/market-day`).
     - HT: `nutrition: ['weeklyMenus', 'nutrition', 'menus']`. PHT: `['weeklyMenus', 'nutrition', 'menus']`.
     - `kitchenOps` của hai role chèn `dayMarket` sau `forecast`.
     - Gỡ item `menuStatistics` và nhánh `MEAL_PLAN_API` trong `API_ONLY_ITEMS`.
  2. AppRoutes: route `statistics` thành component chuyển hướng đọc `week`, `date`, `template`; bỏ lazy import `MenuStatisticsPage`.
  3. DayMarketPage: breadcrumb `kitchenCrumbs(KITCHEN_PAGES.dayMarket)`.
  4. Bỏ nút "Đi chợ theo ngày" ở `FreshForecastList.jsx:82` và `WeeklyForecastPage.jsx:174`.
  5. WeeklyPlanPage: `dayLink = (day) => '/kitchen/market-day?date=' + day.date`. MealPlanGrid: aria-label `Đi chợ ${thứ}`.
- Tests: AC-1 → test menu theo role (`tests/` hiện có cho menuConfig, grep khi làm). AC-2 → test hàm dựng URL chuyển hướng. AC-3 → kiểm tay trên trình duyệt.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0; mở `/menu/weekly`, `/kitchen/forecast`, `/kitchen/market-day` trên trình duyệt cho user xem.
- **Dừng chờ user review.**

### Phase 2 — Dọn code không còn dùng
- Files:
  - D `src/pages/menu-planning/MenuStatisticsPage.jsx`
  - D `src/components/menu-planning/MenuStatisticsPrint.jsx`
  - M `src/components/menu-planning/MenuStatistics.jsx` (xóa `StatisticsDishes`, `StatisticsIngredients`, `StatisticsSessions`; giữ `StatisticsNutrition`)
  - M `src/utils/menu-planning/menuStatistics.js` (xóa `statisticsHref`, `statisticsExportRows`, `planDayItems`, `templateDayItems`, `storageGroups`, `supplierGroups` nếu grep không còn ai dùng)
  - M `tests/menu/menu-statistics.test.mjs`, `tests/menu/menu-statistics-export.test.mjs`
  - M `src/config/integrationModules.js` + `tests/menu/meal-plan-api.test.mjs:306` (bỏ `/menu/statistics` khỏi routes)
  - M CSS `td-stat-*` trong `src/styles/modules/menu-planning.css` nếu không còn dùng
  - M `docs/architecture/ROUTE_MAP.md`, `docs/features/nutrition-inventory.md` (chỗ nhắc `/menu/statistics`)
- Steps: grep từng symbol trước khi xóa; giữ mọi export còn importer.
- Tests: AC-5 → `tests/menu/week-options.test.mjs` (`dishNutrition`) vẫn pass; cả bộ test pass.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0; `node scripts/check-ai-layer.mjs` pass (vì sửa `docs/`).
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | test menu theo role (node:test) | 1 | pass |
| AC-2 | — | test URL chuyển hướng (node:test) | 1 | pass |
| AC-3 | — | test đọc nguồn + trình duyệt `/menu/weekly` | 1 | test pass; trình duyệt chưa xem (cần BE) |
| AC-4 | — | trình duyệt `/kitchen/forecast`, `/kitchen/market-day` | 1 | dự trù pass; market-day chưa xem |
| AC-5 | NUT-07 | `week-options.test.mjs` + trình duyệt `/menu/nutrition` | 2 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Xóa nhầm export còn dùng | Cân đối/mẫu thực đơn vỡ | Grep từng symbol; Phase 2 tách riêng | Revert commit Phase 2 |
| Người dùng quen màn cũ | Không tìm thấy | Route cũ chuyển hướng | Khôi phục item menu |
| Đi chợ theo ngày mở sai điểm trường từ Kế hoạch tuần | Xem nhầm điểm trường | Màn đã có ô chọn điểm trường; mặc định theo tài khoản | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ không đổi contract BE
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã tách 2 phase (điều hướng / dọn code), có thể tách 2 commit
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan

## Progress log
### 2026-11-28 — Phase 1 (chờ review)
- Commit: chưa commit (worktree `CareNest_FE-market-nav`, nhánh tạo từ origin/dev 18b166b6)
- Verify: `npm ci --legacy-peer-deps` (như CI) rồi `npm run verify` → 10 bộ test, 1791 pass, 0 fail; lint, prettier, check-design, check-api, build đạt
- Trình duyệt (mock, PHT): sidebar có Cân đối khẩu phần, Đi chợ theo ngày sau Bản dự trù, không còn Định lượng & đi chợ; `/menu/statistics?week=&date=` chuyển sang `/menu/nutrition`; màn dự trù không còn nút Đi chợ theo ngày. Chưa xem được `/kitchen/market-day` và link ngày ở Kế hoạch tuần: bản mock đẩy về đăng nhập, link ngày chỉ có khi nối BE.
- Khác plan: không cần sửa `src/utils/kitchen/breadcrumbs.js`; thêm test `tests/menu/legacy-statistics-redirect.test.mjs`; hàm `legacyStatisticsTarget` đặt ở `src/utils/menu-planning/menuStatistics.js`.
- Tiếp: Phase 2 dọn code; cân nhắc tiêu đề bản demo `WeeklyForecastPage` "Dự trù & đi chợ".
