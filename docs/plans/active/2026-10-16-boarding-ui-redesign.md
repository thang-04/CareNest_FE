---
title: Redesign UI/UX luồng bán trú dựa trên 29 màn hiện có
status: draft
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition, kitchen]
rules: [NUT-01, NUT-02, NUT-03, NUT-05, NUT-06, NUT-07, NUT-08, NUT-09, NUT-10]
risk: high
created: 2026-10-16
updated: 2026-10-16
---
# Redesign UI/UX luồng bán trú

## Context

Audit từng ảnh, đối chiếu source và đề xuất trước/sau: [2026-10-16-boarding-ui-audit.md](../../quality/reports/2026-10-16-boarding-ui-audit.md). Người dùng yêu cầu sắp xếp lại thông tin và tương tác cho 29 ảnh chụp, ưu tiên mẫu, tuần, quy trình, suất, xuất và nhập; không đổi route/API/quyền/field/rule. Repo đang có thay đổi chưa commit. `MenuListPage.jsx:74-128` đã chia nhóm tuổi nhưng card dàn trải; `WeeklyMenuPage.jsx:62-124` giữ nháp/phiên bản; `KitchenFlowPage.jsx:167-277` là K2 vừa làm; `StockIssueApprovalPage.jsx:31-188` hiện một phiếu theo ngày; `StockReceiptListPage.jsx:178-203` mở modal bằng click hàng. Plan K3/K4 của `2026-10-16-kitchen-warehouse-flow.md` chưa triển khai, có thể thay cấu trúc các trang bếp/kho.

## Quyết định đã chốt

1. User 16/10/2026: redesign trên hệ thống hiện có; giữ route, API, quyền, field, validation và business logic. Không ảnh món ăn, thumbnail hoặc emoji.
2. User 16/10/2026: màu/chữ/token CareNest theo `DESIGN.md`; giữ sidebar/topbar chung; hỗ trợ 768–1440px.
3. Các quyết định nghiệp vụ K1/K2 đã được user duyệt và đang nằm trong working tree; plan UI này không đảo chúng. K3/K4 chỉ là plan đã duyệt, chưa là source hiện tại.

## Làm rõ nghiệp vụ

- **Actor/outcome:** PHT soạn mẫu/tuần, duyệt phiếu và nhập kho; HT xem theo route hiện có; Bếp theo dõi quy trình, suất, nhận và báo thiếu. Mục tiêu chỉ giảm tải nhận thức và thời gian tìm tác vụ.
- **Rule/flow:** NUT-01/02/03/05–10 (`BE:docs/business/BUSINESS_RULES.md`, dòng 41–50); `[S]` menu đã công bố → số suất đã chốt → định lượng/phiếu → bếp xử lý. NUT-11 là OPEN và P-05/06/07/10 còn PENDING: không quyết lại trong UI.
- **Ảnh hưởng:** `/menu/flow|setup|foods|dishes|menus|weekly`, `/kitchen|meal-count|required-quantity|ingredient-receipts|stock-issues|missing-food|stock-receipts|published-menu`; chỉ source presentation và CSS. Scope dữ liệu/route guard ở `AppRoutes.jsx:335-379` giữ nguyên.
- **Ảnh so với source:** 29 ảnh là các trạng thái của khoảng 17 route/template. Source K2 hiện tại là mốc để sửa, kể cả khi ảnh cũ khác; K3/K4 sẽ được tích hợp sau khi source tương ứng ổn định. Các mục “Sao chép mẫu”, “Trả lại phiếu”, sort nếu chưa có handler/API được ghi cần xác minh, không thêm nút giả.

### Câu hỏi mở

Không có câu hỏi chặn phạm vi **visual-only** này. Cần xác minh riêng trước khi làm thành chức năng: sao chép thực đơn mẫu; trả lại phiếu xuất; sắp xếp server-side; nguồn tên thực phẩm thay ID kỹ thuật trong chi tiết phiếu; người phụ trách/thời gian của từng bước nếu dữ liệu không trả. Các mục đó không thuộc plan hiện tại.

## Acceptance criteria

- **AC-1:** 29/29 ảnh có hàng audit, template/source, hướng sửa, mức ưu tiên; các trạng thái rỗng/có dữ liệu và PHT/Bếp dùng chung cấu trúc.
- **AC-2:** Danh mục, mẫu, tuần, quy trình, suất, xuất, nhập có hierarchy `tiêu đề → ngữ cảnh/lọc → hành động → dữ liệu chính → bổ sung`; không làm mất field hoặc action hiện có.
- **AC-3:** Không có ảnh món ăn hoặc ảnh suất ăn trong các trang scope; icon dùng `src/components/ui/icons.js`; màu/spacing/radius/font dùng semantic tokens.
- **AC-4:** Route, API payload, permission, validation và service/model không đổi do redesign; action nguy hiểm giữ `ConfirmationModal`.
- **AC-5:** 1440/1280/1024/768 không tràn ngang toàn trang, table chỉ cuộn trong `.table-wrap`; keyboard focus/Modal/SidePanel và loading/empty/error/submit được kiểm tra.
- **AC-6:** Có ảnh trước từ ZIP và ảnh sau/preview mỗi template ở cùng viewport; ghi rõ mock hay BE thật và các trạng thái chưa thể chụp.

## Key decisions

| Quyết định | Chọn đề xuất | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Danh mục | Một bảng chính + FilterBar, chi tiết sâu ở route hiện có | Sidebar loại + nhiều cột dinh dưỡng | Giữ thao tác/field, dễ scan tại 1280px |
| Mẫu | Nhóm tuổi thu gọn + card hàng gọn; mở detail/edit theo quyền hiện có | Lưới card 4 cột như ảnh #05 | Bớt lặp và cuộn dọc |
| Tuần | Giữ `WeekGrid`, chỉnh mật độ và tách cảnh báo/tổng hợp | Viết lại planner mới | Giữ handler và dữ liệu nháp/phiên bản đang chạy |
| Quy trình | Timeline và việc cần làm ở vùng đầu, thực đơn text gọn bên dưới/khối phụ ngắn | Giữ cột thực đơn rất dài | Tác vụ có thứ tự nhìn thấy ngay |
| Xuất kho | Từ một phiếu theo ngày: bảng lớn + panel thông tin/action trong cùng trang | Danh sách nhiều phiếu mới | Source hiện không có list API; không bịa master list |
| Phiếu nhập | Giữ tab và route form; cải thiện bảng, chi tiết bằng SidePanel khi đủ chỗ | Thêm route detail | Không đổi route và modal/handler dữ liệu |

## Phases

Tổng vượt 8 file và qua hai nhóm màn hình, nên sau khi duyệt tách thành plan con để triển khai/review. Mỗi phase chỉ sửa source presentation/CSS và test UI cần thiết, không sửa model/service/API/guard. Theo ưu tiên người dùng, thứ tự làm là **U2 → U3 → U4 → U1**; phase kế tiếp chỉ bắt đầu sau review phase trước theo `.ai/workflows/plan-change.md`. U3/U4 phải kiểm tra source sau K3/K4 trước khi sửa trang tương ứng.

### Phase U1 — Danh mục và form (ảnh 01–04, 07–08)
- Files dự kiến: `src/pages/menu-planning/{NutritionFlowPage,NutritionSetupPage,FoodListPage,DishListPage,FoodFormPage,DishFormPage}.jsx`, `src/styles/modules/menu-planning.css`; tái dùng `src/components/ui/{Pagination,RowMenu,SidePanel}.jsx` và component form hiện có.
- Steps: baseline ảnh → thu gọn flow/setup; làm FilterBar/table scan; chia nhóm form giữ field/validation.
- Tests: AC-2/3/4/5/6; `node scripts/verify.mjs`; visual 4 width.
- **Dừng chờ user review.**

### Phase U2 — Mẫu và tuần (ảnh 05–06, 09)
- Files dự kiến: `src/pages/menu-planning/{MenuListPage,MenuFormPage,WeeklyMenuPage}.jsx`, `src/components/menu-planning/{WeekGrid,WeekBalanceTable,WeekChecks}.jsx`, `src/styles/modules/menu-planning.css`.
- Steps: card mẫu gọn; planner dễ so sánh; tách cảnh báo/tổng hợp; giữ AI là DRAFT và confirm xuất bản.
- Tests: AC-2/3/4/5/6; test menu hiện có + `node scripts/verify.mjs`; visual 4 width.
- **Dừng chờ user review.**

### Phase U3 — Quy trình, suất, đi chợ, thực đơn công bố (ảnh 10–13, 18–19, 21–27)
- Files dự kiến: `src/pages/kitchen/{KitchenFlowPage,ConfirmedMealCountPage,RequiredFoodQuantityPage,IngredientReceiptPage,PublishedMenuPage,MissingFoodReportPage}.jsx`, `src/components/kitchen/{IssueBlocks,KitchenFilters}.jsx`, `src/styles/modules/kitchen.css`.
- Steps: timeline/việc chính lên trước, thực đơn text gọn, trạng thái rỗng ngắn, bảng đối chiếu lượng/đơn vị rõ. K3 có thể thay `IngredientReceiptPage`; khi đó cập nhật plan con theo source mới trước khi sửa.
- Tests: AC-2/3/4/5/6; test kitchen hiện có + `node scripts/verify.mjs`; visual PHT/Bếp, rỗng/có dữ liệu tại 4 width.
- **Dừng chờ user review.**

### Phase U4 — Duyệt xuất, nhập kho, phiếu nhập (ảnh 14–17, 20, 28–29)
- Files dự kiến: `src/pages/kitchen/{StockIssueApprovalPage,StockReceiptListPage,StockReceiptFormPage}.jsx`, `src/styles/modules/kitchen.css`; tái dùng `ProgressSteps`, `ConfirmationModal`, `Pagination`, `SidePanel`, `IssueBlocks`. K3/K4 có thể thay màn; cập nhật danh sách file ở plan con theo source mới.
- Steps: bảng xuất + panel thông tin; tab phiếu dễ tìm; form nhập nhóm rõ; detail phiếu đủ chỗ và keyboard; giữ điều kiện duyệt/nhập.
- Tests: AC-2/3/4/5/6; test kitchen hiện có + `node scripts/verify.mjs`; visual 4 width.
- **Dừng chờ user review.**

## Test matrix

| AC | Bằng chứng cần | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-1 | Bảng 29 hàng trong audit | Audit | Đã ghi, source tĩnh |
| AC-2/4 | Diff presentation, đối chiếu route/handler/permission và test menu/kitchen | U1–U4 | Chưa triển khai |
| AC-3 | `rg` ảnh/icon/màu mới trong file sửa, review `DESIGN.md:75-98` | U1–U4 | Chưa triển khai |
| AC-5 | Browser 1440/1280/1024/768, keyboard/overflow/state checklist | U1–U4 | Chưa chạy |
| AC-6 | ZIP trước + browser sau, cùng viewport; ảnh preview các template | U1–U4 | Chưa chụp |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Working tree đang dirty, K1/K2 chưa commit | Ghi đè việc đang làm | Chỉ chỉnh file/đoạn trong plan con; xem `git diff` trước mỗi sửa, không reset/stash | Hoàn tác chính xác từng hunk do phase UI tạo |
| K3/K4 thay page bếp/kho | Redesign file sắp bỏ | Chụp baseline, triển khai U3/U4 sau khi kiểm current source; cập nhật plan con | Giữ bản thiết kế audit, không áp code vào page cũ |
| Màn ảnh có ít data/mock | Khó kiểm mọi state | Dùng dữ liệu mock hiện có, không hardcode data production; ghi state chưa kiểm | Giữ layout cũ ở state chưa kiểm |
| BE nutrition/kho còn PENDING/OPEN | UI vô tình gán quyền hoặc công thức | Chỉ sửa hiển thị; so route/guard/service diff | Bỏ hunk UI gây lệch |

## Validation log

- [x] Các khẳng định source chính có `file:line` và audit 29 hàng.
- [x] Không đổi contract; consumer hiện tại giữ nguyên.
- [x] Mỗi AC có bằng chứng dự kiến; mỗi phase Exit = `node scripts/verify.mjs` + visual probe.
- [x] >8 file / >3 phase: tách U1–U4 thành plan con khi được duyệt.
- [x] NUT-11/P-05/06/07/10 không xem là rule đã chốt.
- [x] Không tự thêm hành động sao chép/trả lại/sort hoặc dữ liệu/ảnh món ăn.

## Progress log

### 2026-10-16 — Audit và plan chờ duyệt
- Commit: chưa commit.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` trên working tree hiện tại. `node scripts/check-ai-layer.mjs` → 0 lỗi, 4 cảnh báo có sẵn.
- Tiếp: user duyệt plan visual-only → viết U2 plan con, triển khai U2, verify và trình review theo cổng làn L.
