---
title: Bán trú — góp ý giao diện đợt 2 (sidebar, lưu ý tuần, thống kê, mẫu ngày, bếp, kho, thực phẩm)
status: in-progress
owner: thangnd
jira: G94-191 / FE-FEAT-48
branch: feature/G94-191-FE-FEAT-48-nutrition-management
modules: [menu-planning, kitchen, layouts]
rules: []
risk: medium
created: 2026-11-06
updated: 2026-11-06
---

# Bán trú — góp ý giao diện đợt 2

- Làn L (>8 file, ≥2 nhóm màn). Nguồn: góp ý user 06/11/2026 (10 điểm) trên bản chạy API thật `web.carenest.edu.vn`.
- Chế độ tự chạy: phương án do agent chọn, ghi ở "Quyết định" để user soát.
- User xác nhận 06/11/2026: đưa các thay đổi bán trú/dinh dưỡng của phiên này lên nhánh G94-191; phần phân quyền trường giữ ở nhánh G94-272.

## Nguyên nhân tìm được (từ source)

| # | Màn | Nguyên nhân |
| --- | --- | --- |
| 1 | Sidebar | `.nav-item__label` là `flex:1; white-space:nowrap` không có `min-width:0` ⇒ nhãn dài ("Điểm danh & suất ăn", "An toàn thực phẩm", "Danh mục & thiết lập") đẩy mũi tên ra xa hơn các mục khác |
| 3 | Thống kê | `/menu/statistics` cần ngữ cảnh `?week=&date=` hoặc `?template=`; chỉ mở từ link "Thống kê" ở đầu cột ngày. Không có ngữ cảnh ⇒ trang trống "Chưa chọn ngày" nên chưa đặt lên menu |
| 4 | Mẫu ngày: "Chưa có thành phần" | FE đọc `dishIngredients` của `POST /nutrition/menu-statistics`. Field này chỉ có ở BE nhánh `feature/G94-254-BE-FEAT-27-day-boarding` (worktree `CareNest_BE-day-boarding`), **chưa có trong BE `dev`** ⇒ bản BE đang chạy không trả ⇒ mọi món trống. Không sửa được ở FE |
| 7 | Kiểm nhận hàng tươi | BE định nghĩa 2 lần/ngày: lần 1 so bản dự trù, lần 2 so suất đã xác nhận. Cả hai chưa mở ⇒ hiện 2 thẻ cùng thông báo trống |
| 9 | Thực phẩm | Tim "hay dùng" và nút Sửa bị khóa theo `NUTRITION_MANAGE` (PHT mặc định tắt — BE AUTH-20). Cột Thao tác vẫn hiện tiêu đề nhưng ô trống với người không có quyền. Chế độ API: "hay dùng" chỉ lưu `localStorage` của trình duyệt (BE không có field) |

## Quyết định (user soát)

- D1 Sidebar: nhãn `min-width:0`, mũi tên `flex:none` căn phải cố định; nhãn quá dài cắt `…` và có `title`.
- D2 Lưu ý tuần: dải lưu ý xuống **dưới** bảng thực đơn/bảng kiểm, cách card trên bằng khoảng chuẩn.
- D3 Thống kê: thêm mục menu "Thống kê định lượng"; mở không ngữ cảnh ⇒ mặc định tuần này, hôm nay; thêm chọn tuần.
- D4 Mẫu ngày: danh sách là lưới thẻ giữa trang; bấm thẻ mở modal lớn xem đủ bữa/món/thành phần; sửa mở trang sửa một cột (bỏ cột danh sách trái). Thành phần trống do BE (xem trên) — hiện câu nói đúng nguyên nhân.
- D5 Bếp: nút đầu trang đưa vào thanh bộ lọc (cùng quy ước Kho khô). Bảng thực đơn bếp nhận dùng cùng kiểu lưới với thực đơn tuần.
- D6 Dự trù: bỏ trang "Lập bản dự trù"; nút "Lập bản dự trù" mở modal (kỳ, ghi chú, số trẻ, xem trước) ⇒ Lưu thì mở chi tiết.
- D7 Kiểm nhận: khi cả hai lần chưa mở ⇒ một thẻ thông báo + hai bước nhỏ; chip có khoảng cách.
- D8 Kho khô: dùng `CategoryNav` nhóm thực phẩm như danh sách thực phẩm.
- D9 Thực phẩm: ẩn cột Thao tác khi không có quyền; tim "hay dùng" ở chế độ API là đánh dấu cá nhân, ai cũng bấm được (nhãn nói rõ).
- D10 Chi tiết thực phẩm: thông tin chung gọn một thẻ; thành phần dinh dưỡng thẻ rộng, nhóm chất 2 cột, tiêu đề nhóm có màu.

## Progress log

### 2026-11-06 — khảo sát xong, bắt đầu làm

### 2026-11-06 — làm xong 10 mục, chờ user soát

- 1 Sidebar: `layout.css` (nhãn `min-width:0`, mũi tên `flex:none`) + `--sidebar-width` 256 → 284px. Đo trên trình duyệt: mọi mũi tên cùng một cột, không nhãn bị cắt (trước đó 3 nhãn dài đẩy mũi tên ra ngoài mép nút).
- 2 Lưu ý tuần: `WeekDaySummary` chuyển thành thẻ "Lưu ý của tuần" dưới bảng thực đơn / bảng kiểm.
- 3 Thống kê: mục menu "Thống kê định lượng" (ẩn ở build mock, như `mealPhotos`); trang mở không ngữ cảnh ⇒ tuần đang chạy + hôm nay; thêm `WeekPicker`.
- 4 Mẫu ngày: `TemplateCards` (lưới thẻ giữa) + `TemplatePreviewModal` (modal xl: bữa → món → thành phần, dinh dưỡng); trang sửa bỏ cột danh sách trái; `TemplateListPanel` xóa. Thành phần trống: câu thông báo phân biệt "máy chủ không trả `dishIngredients`" với "nhóm tuổi chưa có thành phần".
- 5 Bếp: nút đầu trang vào cuối thanh bộ lọc (Bếp hôm nay, Kiểm nhận, Ảnh bữa ăn, Lưu mẫu thức ăn, Bản dự trù); bảng thực đơn bếp nhận dùng lớp `td-week` + vạch màu loại món như thực đơn tuần. Không đổi `WeeklyForecastPage` (chỉ chạy mock).
- 6 Dự trù: `FreshForecastCreateModal` thay trang lập; `/kitchen/forecast/new` mở danh sách với hộp lập mở sẵn (giữ route cho test, link cũ).
- 7 Kiểm nhận: cả hai lần chưa mở ⇒ một thẻ trống kèm lý do từng lần; alert trong thẻ lần kiểm có lề (bọc `card__body`).
- 8 Kho khô: `CategoryNav` nhóm thực phẩm. Nâng chung: `CategoryNav` → `components/ui`, CSS `td-split-nav/td-cat-nav` → `components.css`, `FOOD_GROUP_LABELS` → `models/foodGroups.js` (re-export từ `menuPlanningConstants`), `dishTypeClass` → `utils/dishTypeClass.js`.
- 9 Thực phẩm: bỏ cột Thao tác khi không có quyền sửa; tim "hay dùng" ở chế độ API bấm được cho mọi người (lưu `localStorage`, tooltip nói rõ). Không tái hiện được lệch nút ở 1440px (mọi ô bộ lọc cao 36px, cùng top) — cần user nói màn hình/độ rộng nếu vẫn lệch.
- 10 Chi tiết thực phẩm: thông tin chung + thành phần dinh dưỡng xếp dọc, 3 nhóm chất (năng lượng · khoáng chất · vitamin) cạnh nhau, tiêu đề nhóm xanh dương / xanh lá / vàng (token `--color-info|success|warning-bg`).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`. Soát trình duyệt (mock, 1440): sidebar, Thực phẩm (người xem), chi tiết thực phẩm. **Chưa soát trình duyệt** các màn chỉ có ở chế độ API (Mẫu ngày, Dự trù, Kiểm nhận, Bếp hôm nay, Kho khô, Thống kê, Kế hoạch tuần) vì máy không chạy BE — chỉ qua lint/build/test.
- Việc ngoài FE: BE `dev` chưa có `dishIngredients` (chỉ nhánh `feature/G94-254-BE-FEAT-27-day-boarding`) ⇒ cần merge/triển khai BE thì cột thành phần ở Mẫu ngày mới có số.

### 2026-11-06 — nền `origin/main`, soát với BE `main` thật (gateway bật)

- Nhánh tua nhanh lên `origin/main` (`c9208c4`), thay đổi chưa commit nằm trên đó. Stack BE `main` + seed Thượng Hồng (Docker `carenest_main_seed`, API 8090) bật gateway auth để đăng nhập FE thật (Hiệu trưởng Demo, 212 trẻ).
- Tái hiện lỗi "Mẫu thực đơn ngày": BE `main` trả **bộ 4 tuần** (`items[].weekNo|weekday`, 120 món/bộ), FE gộp cả 4 tuần thành một ngày ⇒ mỗi bữa lặp món, cảnh báo trùng key, thành phần trống.
- Sửa FE (không đổi BE): chọn ngày trong bộ (`TemplateDayPicker`: Tuần 1–4 × Thứ 2–6, kèm số món) ở modal xem và trang sửa; thẻ chỉ tóm tắt ngày đầu + chip "Bộ 4 tuần · N món"; lưu gửi `weekNo/weekday` (món mới rơi vào ngày đang chọn, mặc định Tuần 1 · Thứ Hai). Thống kê dinh dưỡng tính theo ngày đang chọn. Mẫu không có `weekNo` (hợp đồng một ngày) vẫn hiện như cũ.
- Kế hoạch tuần điền theo mẫu: user chốt "ngày cùng thứ, tuần 1" (06/11) ⇒ `templateItemsForDate` lấy Tuần 1 cùng thứ với ngày kế hoạch; thứ chưa có món ⇒ báo lỗi, không xóa món đang có. Thành phần món (`dishIngredients`) vẫn chưa có ở BE `main`.

### 2026-11-06 — Hiệu trưởng không xem được Mẫu thực đơn ngày (bản demo/mock)

- Nguyên nhân: ở chế độ demo (không nối BE `menu-template`), `/menu/menus` và `/menu/menus/:id` chỉ cho Phó hiệu trưởng (`VP_ONLY`) dù menu Hiệu trưởng có mục "Mẫu thực đơn ngày" ⇒ "Bạn không có quyền truy cập chức năng này". Chế độ API (`/menu/templates`) đã cho `LEADERS`; BE `GET /nutrition/menu-templates` cũng cho PRINCIPAL.
- Sửa: hai route trên nới sang `LEADERS`; `MenuListPage`/`MenuDetailPage` đã tự ẩn nút tạo / sửa theo `canManage` (Hiệu trưởng không sửa). Tạo / sửa mẫu vẫn `VP_ONLY`.
- Còn hạn chế ở demo: `/kitchen/stock-receipts*` và `/menu/weekly/:id` vẫn `VP_ONLY` mà menu Hiệu trưởng có "Phiếu nhập" (test `nutrition-flow` quy định mục này) — các trang mock đó chưa có chế độ chỉ xem. Chưa kiểm trình duyệt lượt này (công cụ trình duyệt không còn trong phiên).

### 2026-11-06 — Hiệu trưởng vào và làm được toàn bộ bán trú (user chốt: "hiệu trưởng phải vào được hết")

- Đối chiếu nghiệp vụ: `BE:docs/business/flows/meal-management-permissions.md` §4 — HT có sẵn mọi mã bán trú (`NUTRITION_MANAGE`, `MENU_MANAGE`, `STOCK_MANAGE`, `FOOD_SAFETY_APPROVE`, `MEAL_COUNT_CONFIRM`), PHT mặc định tắt; ma trận §5 HT "T" (toàn trường) cho xem và sửa. Chế độ API đã đúng (`/accounts/me` của `principal` có đủ mã). Lớp demo cũ giữ luật trước đó "chỉ PHT sửa, HT chỉ xem" (GBR-GEN-10) nên Hiệu trưởng bị chặn và không có nút sửa.
- Sửa lớp demo: `canManageMenuData`, `canViewMenuData`, `canManageStock`, `canEditForecast`, `canWriteStock` cho phép HT; mock repo thực đơn (`requireManager`, `requireVp`, `visibleWeekly`) và bếp (`canReview`, đánh dấu đã báo NCC) cho HT; route bán trú `VP_ONLY` → `LEADERS` (bỏ `VP_ONLY`; `CATALOG_EDITORS`, `STOCK_RECEIPT_ROLES` = `LEADERS`).
- Test cập nhật theo luật mới (cũ khẳng định "HT chỉ xem, 403 khi lưu"): `dish-food`, `nutrition-setup`, `reference-library`, `weekly-page`, `dry-stock`, `weekly-forecast`; vẫn kiểm giáo viên / bếp bị 403.
- Kiểm bằng trình duyệt tự động (Playwright, demo, `hung.pham@…`): 56/56 mục menu Hiệu trưởng mở được; Thực phẩm, Món, Phiếu nhập, Thực đơn mẫu có nút thêm/sửa.
- Đề nghị cho BE (chưa ghi): các mã ngoài `MEAL_COUNT_CONFIRM` đang đánh dấu P trong §4 — user đã xác nhận 06/11 HT có toàn quyền, nên đổi sang C.

### 2026-11-06 — bảng dinh dưỡng trong ngày và bố cục Bán trú hôm nay

- `NutritionTable` (chi tiết thực đơn mẫu, thực đơn thay thế, cân đối khẩu phần, AI): 4 bảng cột khác nhau → **một bảng 5 cột** (Chỉ số · Thực tế · Định mức · % đạt · Đánh giá) chia 4 nhóm bằng dải tiêu đề có màu (năng lượng và chất sinh năng lượng · cơ cấu · khoáng chất, vitamin · chi phí). Phần tách động vật / thực vật vào dưới tên dòng đạm, béo. `IndicatorAmounts` giữ nguyên cho `DayNormDetail`.
- Bán trú hôm nay, bản nối BE (`BoardingTodayPage`): bảng 4 cột (cột Chi tiết ngắn, nút dồn phải) → mỗi điểm trường một thẻ, mỗi việc một hàng gọn (tên + trạng thái, chi tiết bên dưới, nút bên phải); hai điểm trường xếp cạnh nhau (`.bd-stack` auto-fit 480px), một điểm trường thì chiếm cả bề ngang.
- Bán trú hôm nay, bản demo (`KitchenFlowPage`): nguyên nhân trống bên phải là lưới `db-board` 2/3 – 1/3 mà cột phải chỉ có "Cần xử lý" cho PHT / bếp. Đổi sang `kb-flow-board`: các bước trong ngày thành thẻ nằm ngang (bỏ vạch dọc), việc cần xử lý và thực đơn trong ngày rộng đủ bề ngang bên dưới.
- Kiểm bằng Playwright (Chrome headless, 1440px) trên demo và trên stack BE `main` thật (gateway): ảnh trước/sau; `node scripts/verify.mjs` pass.
- Lưu ý vận hành: gateway auth của BE chỉ chấp nhận **một** origin web (`CARENEST_AUTH_WEB_ORIGIN`); stack `carenest_main_seed` đang đặt `http://localhost:5181`.

### 2026-11-06 — chi tiết thực đơn: các khối còn lại sang dạng bảng

- `MealsView` (mặc định, không `compact`): danh sách chip theo bữa → bảng 4 cột (Món ăn · Loại món · Khẩu phần · Dị ứng) với dải tên bữa; `compact` giữ danh sách gọn cho thẻ ngày trong tuần. Ảnh hưởng chi tiết thực đơn mẫu, thực đơn thay thế, AI soạn thực đơn.
- `HistoryCard` (thực đơn, thực đơn thay thế, món, thực phẩm): danh sách chấm → bảng (Thời gian · Người thực hiện · Hành động · Ghi chú).
- Chi tiết thực đơn mẫu: "Thực đơn thay thế" và "Dùng trong thực đơn tuần" thành bảng, xếp dọc thay vì hai thẻ nửa bề ngang.
- Kiểm bằng ảnh Playwright (demo, 1440px): `/menu/menus/mn_mgb_5`, `/menu/allergy-menus/am_1`.

### 2026-11-06 — thanh lọc Thực phẩm căn lại

- Nguyên nhân lệch: `.filter-bar` dùng `align-items: flex-end`; "Chỉ hay dùng" là checkbox chữ cao 20px nên thấp hơn các nút cao 36px.
- Sửa: modifier `.filter-bar--aligned` (căn giữa một hàng, ô tìm `flex: 1 1 320px`, mọi nút cao `--input-height`); "Chỉ hay dùng" thành nút bật / tắt `.btn--toggle` có icon tim, sáng màu khi đang lọc; "Đặt lại bộ lọc" kiểu `btn--ghost`. Đo ở 1440 / 1100 / 760px: mọi phần tử cùng hàng cao 36px.

### 2026-11-06 — chuyển lên nhánh G94-191 để mở PR vào dev

- User chọn mã Jira G94-191 cho phần bán trú/dinh dưỡng. Worktree tính năng được tua nhanh lên `origin/dev` (`6a0554c`), sau đó áp diff đã có từ phiên G94-272; các file school-config, công cụ cục bộ và báo cáo ngoài phần bán trú không được chuyển.
- Cổng kiểm chứng và giới hạn hiện tại ghi tại `docs/quality/VERIFICATION.md` mục G94-191; lỗi 2 test sức khỏe đã xuất hiện trên nền dev sạch trước khi chuyển diff.
