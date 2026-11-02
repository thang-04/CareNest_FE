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
updated: 2026-11-02
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
### 2026-11-02 khuya — Phase 1 done (user bảo "tiếp tục làm ở FE")
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify`
- Làm: menu 6 nhóm (Bán trú hôm nay · Thực đơn & dinh dưỡng · Vận hành bếp · Kho thực phẩm · An toàn thực phẩm · Danh mục & thiết lập); "Sổ báo ăn" chuyển sang Vận hành bếp (đổi tên "Sổ suất ăn"); bếp không còn mục/route bán trú trên Web (AUTH-21); xóa route + trang xuất kho, nhận nguyên liệu cũ, chế biến (NUT-11, NUT-14, NUT-15); gỡ nguồn "chờ duyệt phiếu xuất kho" ở dashboard; link "Dịch vụ bán trú" của dashboard PHT trỏ `/kitchen`; test `tests/kitchen/web-boarding-layout.test.mjs`, cập nhật `tests/menu/nutrition-flow.test.mjs`.
- Khác plan: (1) nhánh G94-191 có sẵn (user chỉ 02/11): merge `origin/dev` vào nhánh (không xung đột) rồi chép Phase 1 sang. (2) Giữ logic mock phiếu xuất kho trong `kitchenMockRepository` (trang Việc hôm nay, test kho còn dùng) — lát L2 thay bằng trừ tự động. (3) Route `/attendance/meal-handover` (NUT-15 REMOVED) chưa gỡ — ngoài danh sách Phase 1.
- Tiếp: Phase 2 (shape danh mục theo contract BE `/nutrition/*`), Phase 3 (nối BE).

### 2026-11-02 — Lập plan (chờ user duyệt)
- Commit: chưa commit (file tạo trong worktree `CareNest_FE`, nhánh hiện tại `fix/G94-272-FE-FIX-01-e2e-flow-fixes` — không thuộc task này, chuyển sang nhánh mới khi bắt đầu)
- Tiếp: user cấp mã Jira FE + duyệt → tạo nhánh từ `dev` → Phase 1.
