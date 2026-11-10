---
title: Bán trú đợt 1 — học từ PMS/MISA cho 5 màn P1
status: approved
owner: thangnd
jira: G94-292 / FE-FEAT-48
branch: feature/G94-191-FE-FEAT-48-nutrition-management
modules: [nutrition, attendance]
rules: [NUT-02, NUT-08, NUT-09, NUT-13, NUT-18, NUT-19, NUT-23, ATT-02, ATT-06, ATT-08]
risk: medium
created: 2026-11-09
updated: 2026-11-09
---
# Bán trú đợt 1 — học từ PMS/MISA cho 5 màn P1

## Context

User cho so UI bán trú với hai hệ thống trường đang dùng (PMS, MISA EMIS). Báo cáo `ui-review/boarding-benchmark-pms-misa-2026-11-09/index.html` chọn phương án B ("bàn làm việc theo việc") và xếp 5 màn vào đợt 1. User chốt thêm ngày 09/11:
- Món đã chọn trong Kế hoạch tuần có nút **Thay thế, Thông tin, Xóa** như PMS 17.
- Màn cần sửa nhiều thì mở **modal to**.

Hiện trạng:

| Màn | Đang có | Chỗ thiếu |
| --- | --- | --- |
| Kế hoạch tuần | Mỗi món là một chip, chỉ có nút × để bỏ (`src/components/menu-planning/MealPlanGrid.jsx:65-79`). Mỗi ô (ngày × loại món) có một `SearchSelect` riêng (`:92-116`). | Đầu cột chỉ ghi "N lưu ý" (`src/utils/menu-planning/mealPlanGrid.js:70-75`). Bảng kiểm nằm ở tab khác (`src/pages/menu-planning/WeeklyPlanPage.jsx:241-277`) và chỉ tính theo bản đã lưu (`:224-228`). |
| Cân đối khẩu phần | `src/pages/menu-planning/NutritionBalancePage.jsx` | Chạy dữ liệu demo (`:14`, service `menu-planning` là `demo`), trùng việc với bảng kiểm tuần. Route ở `src/routes/AppRoutes.jsx:403`; mục menu của PHT ở `src/layouts/menuConfig.js:466`. |
| Thống kê định lượng | `src/pages/menu-planning/MenuStatisticsPage.jsx` | Không in, không xuất. BE `MenuStatisticsResponse.Ingredient` chưa có cờ Tươi/Khô và chưa có tổng theo nhóm (`BE:src/main/java/com/carenest/dto/meals/MenuStatisticsResponse.java`). |
| Bán trú hôm nay | Ma trận việc × điểm trường (`src/pages/boarding/BoardingTodayPage.jsx:64-104`) | Không nói việc tiếp theo là gì. Bản demo cũ có dải "Bây giờ · Cần làm" (`src/pages/kitchen/KitchenFlowPage.jsx:310-326`). |
| Điểm danh & báo ăn | `src/pages/attendance/AttendancePage.jsx` (682 dòng) | Hai nút lưu (`:602`, `:605`). Tên gọi lệch: menu ghi "Sổ suất ăn" (`menuConfig.js:196`), trang ghi "Sổ báo ăn". |

Có lối xem dinh dưỡng tức thì mà không cần BE đổi: `POST /nutrition/menu-statistics` nhận `items[{session, dishId}]` chưa lưu, trả `evaluation` cùng dạng bảng kiểm tuần và không ghi gì (`BE:docs/modules/nutrition.md:37`). FE đã gọi API này qua `mealPlanApi.getMenuStatistics` (`src/services/mealPlanApi.js:41`) và hook `useMenuStatistics` (`src/hooks/menu-planning/useMealPlan.js:27`).

## Quyết định đã chốt
1. Chọn phương án B của báo cáo đối chiếu; đợt 1 gồm 5 màn P1 — user, 09/11/2026.
2. Món đã chọn trong Kế hoạch tuần có 3 nút: Thay thế (⇄), Thông tin (ⓘ), Xóa (🗑), như PMS 17 — user, 09/11/2026.
3. Màn cần sửa nhiều mở modal to — user, 09/11/2026.
4. Nút Lưu của khu bán trú đặt ở đầu màn hoặc chân modal; không dùng thanh dính đáy — user, 05/11/2026 (DESIGN.md §6.3 :430).
5. Căn bảng: chữ dài căn trái, giá trị ngắn căn giữa — user, 08/11/2026.
6. Giữ mục menu và route **Cân đối khẩu phần** (`/menu/nutrition`); không gộp, không chuyển hướng về Kế hoạch tuần — user, 09/11/2026.
7. Task Jira **G94-292** "[FE-FEAT-48] Design UI cấu hình và cân đối thực đơn v2" (bản v2 của G94-191, epic G94-85), có 5 file docx lý do đính kèm. Code làm trên nhánh `feature/G94-191-FE-FEAT-48-nutrition-management` (worktree `.commit-worktrees/nutrition`); commit mang mã G94-292 — user, 09/11/2026.
8. "Thay thế" chỉ gợi ý món **cùng loại** — user, 09/11/2026.
9. Tên màn: **Định lượng & đi chợ** (thay "Thống kê định lượng"); sổ xác nhận suất thống nhất là **Sổ suất ăn** — user, 09/11/2026.
10. Được sửa BE khi cần: thêm cờ Tươi/Khô và tổng tiền nhóm vào `menu-statistics`; thêm API sổ suất theo lớp cho giáo viên. Plan BE: `BE:docs/plans/active/2026-11-09-boarding-ui-v2-be-support.md` — user, 09/11/2026.
11. Giáo viên **được xem** số suất lớp mình trên Web, làm trong đợt 1 (đổi mức P thành chốt cho `BE:docs/business/flows/meal-management-permissions.md:86,157`) — user, 09/11/2026.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: PHT phụ trách dinh dưỡng và HT lập/công bố thực đơn tuần, xác nhận suất. Giáo viên điểm danh, điểm danh chính là báo ăn.
  - Outcome: lập tuần nhanh hơn, thấy lý do chưa đạt ngay khi sửa, in được phiếu định lượng, biết việc tiếp theo trong ngày.
  - Rule (CONFIRMED): NUT-08 (BE kiểm, chặn công bố), NUT-13 (mẫu), NUT-18 (món theo nhóm tuổi), NUT-19 (giá suất chỉ cảnh báo), NUT-09/NUT-23 (dị ứng), NUT-02 (xác nhận suất), ATT-02/ATT-06/ATT-08 (báo ăn, giờ chốt, mở lại).
  - Flow `BE:docs/business/flows/meal-management.md` ("Lập và công bố", "Hằng ngày"): [S] kế hoạch tuần DRAFT → [S] kiểm tra từng ngày → [S] công bố cả tuần.
- **Đối chiếu thiết kế ban đầu:**
  - DESIGN §6.3 :434 ghi "sửa mở trang sửa một cột" cho mẫu thực đơn. Đợt này không đụng tới mẫu; quyết định 3 áp cho Kế hoạch tuần và cân đối ngày.
  - DESIGN §8.1 còn ghi "thanh dính đáy", mâu thuẫn §6.3 :430; sửa trong phase 1.
- **Ảnh hưởng:**
  - FE: `/menu/weekly`, `/menu/nutrition`, `/menu/statistics`, `/boarding/today`, `/attendance`, `/attendance/meal-count` (chỉ đổi nhãn).
  - Quyền: nút vẫn theo `canEdit`/`canPublish` BE trả. Mới: giáo viên/tổ trưởng đọc sổ suất của lớp được phân công (BE B2 kiểm phân công).
  - Dữ liệu dẫn xuất: không tính ở FE; dinh dưỡng của bản nháp lấy từ `menu-statistics`; tổng Tươi/Khô và suất theo lớp do BE trả.
  - BE: thêm field cho `menu-statistics`, thêm `GET /meal-counts/class` (plan BE).
  - APP: không đụng (APP GV có thể dùng chung API B2 sau này).

### Câu hỏi mở
- [x] Mã Jira → G94-292 (quyết định 7).
- [x] "Thay thế" gợi ý món nào? → Chỉ món cùng loại (quyết định 8).
- [x] Bỏ màn Cân đối khẩu phần? → Không, giữ menu (quyết định 6).
- [x] Tên màn → "Định lượng & đi chợ", "Sổ suất ăn" (quyết định 9).
- [x] BE thêm cờ Tươi/Khô và tổng nhóm? → Có, sửa BE khi cần (quyết định 10).
- [x] Giáo viên xem số suất lớp mình? → Có, làm trong đợt 1 (quyết định 11).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Bỏ màn Cân đối khẩu phần? | Không, vẫn để menu Cân đối khẩu phần | user | 09/11/2026 | Quyết định 6 của plan này |
| Mã Jira? | Clone G94-191 thành task v2, kèm docx lý do; code ở nhánh nutrition | user | 09/11/2026 | G94-292 đã tạo, 5 docx đính kèm |
| "Thay thế" gợi ý món nào? | Chỉ món cùng loại | user | 09/11/2026 | Quyết định 8 |
| Tên màn? | Định lượng & đi chợ · Sổ suất ăn | user | 09/11/2026 | Quyết định 9 |
| BE thêm cờ Tươi/Khô? | Làm luôn ở BE nếu cần | user | 09/11/2026 | Plan BE (quyết định 10) |
| Giáo viên xem suất lớp? | Có, làm trong đợt 1 | user | 09/11/2026 | Plan BE B2 cập nhật `meal-management-permissions.md` |

## Acceptance criteria
- **AC-1** (NUT-18): Given tuần đang ở DRAFT và người dùng có quyền sửa, When rê hoặc focus vào một món trong lưới, Then món có 3 nút có nhãn: **Thay thế**, **Thông tin**, **Xóa**. Khi chỉ xem: chỉ còn Thông tin.
- **AC-2** (NUT-18): When bấm Thay thế, Then mở bộ chọn món cùng loại (trừ món đang có trong ô); chọn xong thì món mới thay đúng vị trí, bản nháp đánh dấu "có thay đổi chưa lưu".
- **AC-3** (NUT-18, NUT-09): When bấm Thông tin, Then modal hiện tên món, loại, chất gây dị ứng, thành phần gam/1 trẻ theo nhóm tuổi và năng lượng một suất **do BE trả**, kèm link "Mở trang món".
- **AC-4** (NUT-08): Given ngày có lưu ý, Then đầu cột ngày hiện tối đa 2 lý do ngắn theo `issue.code` (vd. "Chưa cân đối", "Vượt giá suất") và "+n"; tooltip là `issue.message` của BE.
- **AC-5** (NUT-08, NUT-13): When bấm **Sửa ngày** (menu ⋯ đầu cột), Then mở modal `full`:
  - trái: các bữa → món (cùng 3 nút) + **Thêm món** (chọn nhiều, `AddDishesModal`);
  - phải: dinh dưỡng 1 trẻ theo nhóm tuổi lấy từ `POST /nutrition/menu-statistics` với món đang sửa, cập nhật sau mỗi thay đổi;
  - chân: Hủy / **Áp dụng vào tuần** (chỉ đổi bản nháp, chưa lưu).
- **AC-6** (NUT-13): Menu ⋯ đầu cột có **Chép sang ngày…**. Chọn ngày đích; nếu ngày đích đã có món thì hỏi trước khi thay, giống luồng "Dùng mẫu" hiện có.
- **AC-7** (NUT-19, NUT-10): Màn đổi tên **Định lượng & đi chợ** (menu, breadcrumb, tiêu đề). Có **Xem trước bản in** và **Xuất Excel**. Bảng thực phẩm chia "Cần mua (hàng tươi)" / "Lấy từ kho khô" theo `ingredient.storage` (FRESH/DRY) BE trả; tổng tiền mỗi nhóm lấy từ BE (`freshCost`, `dryCost`).
- **AC-8** (NUT-08): Mục menu và route `/menu/nutrition` giữ nguyên. Khi `meal-plan` là api, màn dùng dữ liệu BE thay cho dữ liệu demo:
  - đầu màn chọn tuần, khối, ngày;
  - thân màn dùng lại phần nội dung của modal Sửa ngày (món + dinh dưỡng 1 trẻ);
  - nút **Lưu nháp** lưu kế hoạch tuần qua `mealPlanApi.savePlan`;
  - tuần đã công bố hoặc không có `canEdit` thì chỉ xem.
  Ở Kế hoạch tuần, menu ⋯ đầu cột có thêm link "Mở ở Cân đối khẩu phần".
- **AC-9**: Bán trú hôm nay có dòng **Việc tiếp theo**: việc đầu tiên theo thứ tự cố định (Thực đơn tuần → Số suất → Kho khô → Hàng tươi → Lưu mẫu) có tông BE trả là đỏ/cam/tím, kèm nút tới màn xử lý. Mọi việc xanh hoặc xám thì ghi "Đã xong các việc cần làm".
- **AC-10** (ATT-02, ATT-06): Màn điểm danh của giáo viên chỉ còn **một** nút lưu chính, kèm dòng "Còn N trẻ chưa điểm danh" (N từ chip đang có). Tên "Sổ suất ăn" thống nhất ở menu, breadcrumb, tiêu đề.
- **AC-11** (ATT-02, NUT-02, NUT-23): Given giáo viên mở Điểm danh & báo ăn của lớp mình, Then thấy thẻ **Suất ăn lớp hôm nay**: số suất từng bữa, số suất thay thế từng bữa (không tên trẻ; chia theo chất dị ứng khi BE có dữ liệu món thay thế NUT-23), trạng thái "Đã xác nhận lúc HH:mm" kèm ổ khóa / "Chờ xác nhận" / "Cần xác nhận lại" — mọi số và trạng thái do BE trả. Lớp không được phân công ⇒ BE trả 403, thẻ hiện lỗi đúng chuẩn.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Dinh dưỡng của bản nháp | Gọi `menu-statistics` cho ngày đang sửa | Lưu nháp rồi đọc bảng kiểm; BE thêm API preview | API sẵn có, không ghi dữ liệu, cùng dạng `evaluation`; FE không tự tính |
| Kích thước modal to | Thêm `size="full"`: rộng `min(1440px, 100vw - 48px)`, cao gần đủ màn, thân cuộn trong modal | Dùng `xl` (1100 px) | Sửa ngày cần hai cột (món + dinh dưỡng); `xl` hẹp ở 1440 |
| Nút trên chip món | 3 icon nhỏ có `aria-label` + tooltip, hiện khi rê/focus và luôn hiện trên màn cảm ứng | Menu ⋯ trên chip | User chọn giống PMS; bấm 1 lần, không lồng menu |
| Thay thế | `SearchSelect` một lựa chọn, lọc cùng loại món | Mở `AddDishesModal` | Thay 1 món nên chỉ cần chọn 1; không đổi số món |
| Nhãn lý do | Bảng `MEAL_PLAN_ISSUE_SHORT` theo `code` trong `menuPlanningConstants.js`; mã lạ dùng `message` | Tự đọc `message` | Ngắn, đồng nhất; `message` vẫn ở tooltip |
| Cân đối khẩu phần | Giữ menu; màn dùng lại thân `DayEditorModal` (tách thành `DayBalanceView`) với dữ liệu BE | Gộp vào Kế hoạch tuần và chuyển route (đã bị user bỏ); giữ dữ liệu demo | User chốt giữ menu ngày 09/11. Dùng chung một view để hai nơi luôn ra cùng kết quả, không có hai cách tính |

## Phases

### Phase 1 — Kế hoạch tuần: nút trên món, lý do ngắn, modal to
- Files:
  - C `src/components/menu-planning/DishInfoModal.jsx`
  - M `src/components/menu-planning/MealPlanGrid.jsx`
  - M `src/utils/menu-planning/mealPlanGrid.js` (`replaceDish`, `dayReasons`)
  - M `src/models/menu-planning/menuPlanningConstants.js` (`MEAL_PLAN_ISSUE_SHORT`)
  - M `src/styles/components.css` (`.modal--full`)
  - M `src/styles/modules/menu-planning.css`
  - M `DESIGN.md` (§6.3 modal `full`, chip món; sửa §8.1 thanh dính đáy)
  - M `src/pages/UiKitPage.jsx`
  - C `tests/menu/meal-plan-grid-actions.test.mjs`
- Steps:
  1. `replaceDish(draft, date, block, session, oldId, dish)` giữ vị trí. `dayReasons(plan, date)` trả `{tone, reasons[≤2], more}` từ `plan.issues`; `dayResult` dùng lại hàm này.
  2. Chip món: thêm `.td-dish__actions` gồm ⇄ (mở `SearchSelect` một lựa chọn, lọc theo `item.dishType`), ⓘ, 🗑 (thay × hiện tại). Icon lấy qua `icons.js`.
  3. `DishInfoModal` (`size="md"`): `useDish(id)` (`src/hooks/menu-planning/useMenuPlanning.js:49`, nguồn `nutrition-catalog` api). Đủ loading/error.
  4. Thêm `.modal--full` vào `components.css`, cập nhật DESIGN §6.3 và `/ui-kit`.
- Tests: AC-1, AC-2 → `replaceDish` giữ thứ tự; AC-4 → `dayReasons` cắt 2 lý do, đếm `more`, mã lạ dùng `message`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; chụp `/menu/weekly` ở 1440/390 khi DRAFT và PUBLISHED.
- **Dừng chờ user review.**

### Phase 2 — Modal sửa ngày, chép ngày, Cân đối khẩu phần dùng dữ liệu BE
- Files:
  - C `src/components/menu-planning/DayBalanceView.jsx` (thân dùng chung: món theo bữa + dinh dưỡng)
  - C `src/components/menu-planning/DayEditorModal.jsx` (bọc `DayBalanceView` trong modal `full`)
  - M `src/components/menu-planning/MealPlanGrid.jsx` (menu ⋯ đầu cột: Sửa ngày, Chép sang ngày…, Mở ở Cân đối khẩu phần, Nghỉ)
  - M `src/pages/menu-planning/WeeklyPlanPage.jsx`
  - M `src/pages/menu-planning/NutritionBalancePage.jsx` (nhánh api: chọn tuần/khối/ngày + `DayBalanceView`; nhánh demo giữ nguyên cho chế độ mock)
  - M `src/utils/menu-planning/mealPlanGrid.js` (`copyDay`, `dayStatisticsQuery`)
  - C `tests/menu/day-editor.test.mjs`
- Steps:
  1. `DayBalanceView` + `DayEditorModal` (`size="full"`): cột trái là bữa → món (dùng lại chip của phase 1) + nút "Thêm món" mở `AddDishesModal`. Cột phải là tab nhóm tuổi của khối, mỗi tab gọi `useMenuStatistics({ageGroupId, date, items})` và hiển thị `evaluation` bằng bảng của `MealPlanEvaluations` (tách phần bảng một ngày để dùng lại; không nhân bản). Chân modal: Hủy / Áp dụng vào tuần.
  2. Gọi lại thống kê sau khi danh sách món đổi (debounce 400 ms, hủy kết quả cũ); lỗi API hiện `ErrorState` trong cột phải, không chặn sửa món.
  3. `copyDay(draft, from, to, block)`; ngày đích có món ⇒ `ConfirmationModal` như `pickTemplate` (`WeeklyPlanPage.jsx:74-84`).
  4. Tuần PUBLISHED hoặc không có `canEdit`: modal chỉ xem, không có nút sửa.
  5. Cân đối khẩu phần (giữ menu, quyết định 6): khi `MEAL_PLAN_API`, `NutritionBalancePage` dùng `useMealPlan(week)` + `DayBalanceView`. Đầu màn gồm WeekPicker, tab khối, tab ngày; tuần, khối, ngày giữ trên URL (`?week=&block=&date=`) để link từ Kế hoạch tuần mở đúng chỗ. Nút **Lưu nháp** ở đầu màn gọi `mealPlanApi.savePlan(week, draft)`, kèm `useLeaveGuard` khi có thay đổi. Nhánh demo cũ chỉ chạy khi `meal-plan` là demo. Không đổi `AppRoutes.jsx` và `menuConfig.js`.
- Tests: AC-5 → `dayStatisticsQuery` dựng `items` đúng bữa/món của khối; AC-6 → `copyDay` thay đúng khối, giữ khối khác; AC-8 → route `/menu/nutrition` và mục menu "Cân đối khẩu phần" vẫn còn (theo mẫu `tests/menu/catalog-routes.test.mjs`); tham số URL dựng đúng.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; thử tay với BE thật (`carenest-fe-mainstack`): sửa ngày → panel đổi số → Áp dụng → Lưu nháp → bảng kiểm khớp.
- **Dừng chờ user review.**

### Phase 3 — Định lượng & đi chợ: đổi tên, in, Excel, tách Tươi/Khô
- Phụ thuộc: BE phase B1 (`storage` + `freshCost`/`dryCost`). Phần in/Excel/đổi tên làm được trước khi BE xong.
- Files:
  - M `src/pages/menu-planning/MenuStatisticsPage.jsx`
  - M `src/utils/menu-planning/menuStatistics.js` (cột xuất, nhóm theo `storage`)
  - M `src/layouts/menuConfig.js:308` (nhãn "Định lượng & đi chợ")
  - M `src/utils/menu-planning/breadcrumbs.js` (nhãn breadcrumb)
  - M `src/services/mealPlanApi.js:41` (giữ `storage`, `freshCost`, `dryCost` từ response)
  - C `src/components/menu-planning/MenuStatisticsPrint.jsx`
  - C `tests/menu/menu-statistics-export.test.mjs`
- Steps:
  1. Đổi nhãn menu, breadcrumb, tiêu đề thành "Định lượng & đi chợ"; route giữ `/menu/statistics`.
  2. Nút "Xem trước bản in" (modal in + `PrintToolbar`, `src/components/print/PrintToolbar.jsx`) và "Xuất Excel" (`exportWithPreview`, `src/components/ui/ExportPreview.jsx`) đặt ở đầu màn.
  3. Bản in gồm: tiêu đề ngày, nhóm tuổi, số trẻ; hai bảng Cần mua / Lấy từ kho khô; ô "Người lập" / "Người duyệt" sửa được trên bản xem trước (không lưu).
  4. Nhóm theo `ingredient.storage`; tổng nhóm hiển thị `freshCost`/`dryCost` BE trả. Response cũ chưa có `storage` ⇒ giữ một bảng, không tự cộng.
- Tests: AC-7 → nhóm đúng theo `storage`, tổng lấy nguyên từ response, cột Excel đúng thứ tự; thiếu `storage` ⇒ một bảng.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; mở bản in, xuất file mẫu.
- **Dừng chờ user review.**

### Phase 4 — Bán trú hôm nay: việc tiếp theo
- Files:
  - M `src/utils/boarding/dayBoardRows.js` (`nextBoardTask`)
  - M `src/pages/boarding/BoardingTodayPage.jsx`
  - M `src/styles/modules/boarding.css` (`BoardingTodayPage.jsx:14`)
  - M `tests/kitchen/day-board.test.mjs`
- Steps:
  1. `nextBoardTask(rowsPerCampus, campuses)`: duyệt theo thứ tự hàng (đã cố định trong `buildDayBoardRows`), lấy ô đầu tiên có tông `red` → `orange`/`purple`; trả việc, điểm trường, nút đầu tiên của ô. Chỉ chọn để hiển thị, không đánh giá lại trạng thái.
  2. Dải `kb-now` (dùng lại class đang có ở `KitchenFlowPage`, promote nếu cần) đặt trên `BoardSummary`: "Việc tiếp theo: <b>Xác nhận suất · Cơ sở 2</b> → [nút]".
- Tests: AC-9 → ưu tiên đỏ trước cam; mọi ô xanh/xám ⇒ null.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 5 — Điểm danh giáo viên: một nút lưu, tên thống nhất
- Files:
  - M `src/pages/attendance/AttendancePage.jsx` (`:595-606`)
  - M `src/pages/attendance/MealCountPage.jsx:149,154,156` (tên file Excel, breadcrumb, tiêu đề)
  - M `src/components/attendance/MealRegisterCard.jsx:152` (tiêu đề thẻ)
  - M `src/pages/attendance/AttendanceSummaryPage.jsx:311,334` (tooltip nhắc tên sổ)
  - C `tests/kitchen/meal-count-label.test.mjs` (nhãn trang khớp `menuConfig`)
- Steps:
  1. Đọc lại vai trò của "Lưu trẻ đang chọn" (lưu sức khỏe trẻ đang mở?) trước khi gộp. Nếu là việc khác thì đổi nhãn cho rõ thay vì xóa; ghi "Khác plan".
  2. Một nút chính "Lưu điểm danh", bên cạnh là dòng "Còn N trẻ chưa điểm danh" lấy từ chip hiện có.
  3. Tiêu đề, breadcrumb, tên file Excel dùng "Sổ suất ăn" (quyết định 9).
- Tests: AC-10 → `tests/kitchen/meal-count-label.test.mjs`: tiêu đề, breadcrumb của Sổ suất ăn khớp nhãn `menuConfig`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; chụp màn giáo viên 1440/390.
- **Dừng chờ user review.**

### Phase 6 — Thẻ "Suất ăn lớp hôm nay" cho giáo viên
- Phụ thuộc: BE phase B2 (`GET /meal-counts/class`).
- Files:
  - M `src/services/attendance/api/attendanceApi.js` (`getClassMealCount({ classId, date })`)
  - M facade + mock của attendance (`src/services/attendance/*Service.js`, `mock/`; mock là BE giả, dẫn rule ATT-02/NUT-02)
  - M `src/hooks/attendance/useAttendance.js` (hook `useClassMealCount`)
  - C `src/components/attendance/ClassMealCard.jsx`
  - M `src/pages/attendance/AttendancePage.jsx` (đặt thẻ dưới các chip tóm tắt)
  - M `src/styles/modules/attendance.css`
  - C `tests/attendance/class-meal-count.test.mjs` (hoặc `tests/kitchen/` nếu thư mục attendance chưa có)
- Steps:
  1. Thẻ hiển thị: mỗi bữa một ô số; dòng "Suất thay thế" theo chất dị ứng, không tên trẻ; trạng thái xác nhận + giờ, ổ khóa khi đã xác nhận.
  2. Đủ loading/empty ("Chưa có số suất, sẽ có sau khi điểm danh")/error; 403 hiện `ErrorState`.
  3. Sau khi giáo viên lưu điểm danh: `reload({ silent: true })` thẻ để số suất mới hiện ngay.
- Tests: AC-11 → map response sang ô hiển thị không tính lại số; 403 ⇒ trạng thái lỗi.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; thử với BE thật bằng tài khoản giáo viên.
- **Dừng chờ user review.**

### Phần BE (plan riêng)
`BE:docs/plans/active/2026-11-09-boarding-ui-v2-be-support.md`:
- **B1:** `MenuStatisticsResponse.Ingredient` thêm `storage` (FRESH/DRY), response thêm `freshCost`, `dryCost`.
- **B2:** `GET /meal-counts/class?classId=&date=` cho giáo viên và tổ trưởng của lớp; cập nhật quyền GV từ P thành chốt.

Làm trên worktree BE riêng tạo từ `dev`; tên nhánh và mã công việc BE (`BE-FEAT-xx`) hỏi user trước khi tạo.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2 | NUT-18 | `tests/menu/meal-plan-grid-actions.test.mjs` (util) + chụp màn | 1 | |
| AC-3 | NUT-18, NUT-09 | Thử tay với BE thật | 1 | |
| AC-4 | NUT-08 | `tests/menu/meal-plan-grid-actions.test.mjs` | 1 | |
| AC-5, AC-6 | NUT-08, NUT-13 | `tests/menu/day-editor.test.mjs` + thử tay | 2 | |
| AC-8 | NUT-08 | test route/menu | 2 | |
| AC-7 | NUT-19 | `tests/menu/menu-statistics-export.test.mjs` | 3 | |
| AC-9 | — | `tests/kitchen/day-board.test.mjs` | 4 | |
| AC-10 | ATT-02 | `tests/kitchen/meal-count-label.test.mjs` | 5 | |
| AC-11 | ATT-02, NUT-02, NUT-23 | `tests/attendance/class-meal-count.test.mjs` + thử tay tài khoản GV | 6 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Gọi `menu-statistics` mỗi lần sửa món | Nhiều request, số nhảy | Debounce 400 ms, hủy kết quả cũ, chỉ gọi nhóm tuổi đang mở | Bỏ panel, quay về "Lưu nháp để cập nhật" |
| Nút trên chip làm ô chật | Tên món bị cắt ở 1280 px | Icon 24 px, chỉ hiện khi rê/focus; màn cảm ứng hiện thường trực | Đưa 3 thao tác vào menu ⋯ của chip |
| `.modal--full` ảnh hưởng modal khác | Không, vì là size mới | Chỉ dùng ở `DayEditorModal` | Đổi về `xl` |
| Cân đối khẩu phần và Kế hoạch tuần cùng sửa một tuần | Hai tab cùng mở có thể ghi đè nhau | Cùng `savePlan`; BE trả 409 khi tuần đã công bố, màn nạp lại như `WeeklyPlanPage.jsx:93-95` | Đưa nhánh api về chế độ chỉ xem |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: B1 thêm field vào `MenuStatisticsResponse` (consumer `MenuStatisticsPage.jsx`, `DayBalanceView.jsx` chỉ đọc `evaluation`, không bị ảnh hưởng); B2 thêm endpoint mới (consumer `ClassMealCard.jsx`). Không đổi field cũ.
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đề xuất tách: 6 phase FE độc lập, mỗi phase review riêng; phần BE đã tách sang plan BE. Có thể tách FE thành (a) phase 1–2 Kế hoạch tuần, (b) phase 3–6. Giữ chung theo yêu cầu "plan đợt 1".
- [x] Không dùng rule PENDING/OPEN như đã chốt: quyền GV xem suất lớp đã được user chốt 09/11 (quyết định 11); plan BE cập nhật doc quyền.
- [x] Tự review: không placeholder · không mâu thuẫn quyết định 4 (modal có nút ở chân, không có thanh dính đáy) · scope 5 màn + phần BE.

## Progress log
### 2026-11-09 — Lập plan (chờ user duyệt)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Khác plan: —
- Tiếp: user trả lời câu hỏi mở và duyệt ⇒ `approved`, bắt đầu phase 1.

### 2026-11-09 — Sửa plan theo user
- User chốt giữ menu Cân đối khẩu phần (quyết định 6). Đã sửa AC-8, Key decisions, phase 2 và bảng rủi ro.
- Giả định của agent, chờ user soát: màn này chuyển sang dữ liệu BE bằng `DayBalanceView` dùng chung với modal Sửa ngày, và lưu vào kế hoạch tuần qua `savePlan`. Phương án khác: giữ nguyên màn demo.

### 2026-11-09 — User trả lời hết câu hỏi mở
- Tạo Jira G94-292 (clone G94-191 thành v2, epic G94-85, iter-03), đính kèm 5 docx lý do (`ui-review/boarding-benchmark-pms-misa-2026-11-09/docx/`).
- Chuyển plan sang nhánh nutrition (`.commit-worktrees/nutrition`). Thêm AC-11, phase 6 và phần BE (B1, B2).
- Tiếp: user duyệt ⇒ `approved`; hỏi mã công việc/nhánh BE trước khi làm B1, B2.

### 2026-11-09 — Phase 1 (chờ review)
- User duyệt plan FE ⇒ `approved`. Plan BE còn câu hỏi mã công việc nên vẫn draft.
- Đã làm: `replaceDish`, `dayReasons` + `MEAL_PLAN_ISSUE_SHORT`; chip món có 3 nút Thay thế (`SearchSelect variant="icon"`, chỉ món cùng loại) · Thông tin (`DishInfoModal`) · Xóa; đầu cột hiện ≤2 lý do + "+n"; `.modal--full`, `.icon-action`; DESIGN §6.3 (modal full, SearchSelect icon, món trong lưới tuần) và §8.1 (khu bán trú không dính đáy); `/ui-kit` có demo.
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (lint còn 2 cảnh báo có sẵn từ trước ở `ImportGoalFileModal.jsx`, `AppRoutes.jsx`, không do phase này).
- Khác plan:
  - `dayResult` giữ nguyên (còn dùng ở `WeekDaySummary` và test cũ); thêm hàm riêng `dayReasons` cho đầu cột lưới.
  - Mã lưu ý lạ hiện nhãn "Lưu ý khác" (câu `message` đầy đủ ở tooltip), không hiện nguyên `message` vì quá dài cho đầu cột.
  - Cụm 3 nút luôn hiện (không chỉ khi rê chuột) để người dùng không rành vẫn thấy; thiếu chỗ thì xuống dòng trong khối món.
  - `DishInfoModal` dùng cỡ `lg`; dinh dưỡng lấy `nutritionByAgeGroup` BE trả; thêm `foodName` (BE đã trả) vào map món ở `nutritionCatalogApi.js`, sửa 2 kỳ vọng trong `tests/menu/nutrition-catalog-api.test.mjs`.
- Kiểm với BE thật (user đăng nhập HT ở `http://localhost:5181`, server `nutrition-mainstack`):
  - Tuần 09/11 đã công bố: đầu cột hiện "Chưa cân đối", "Lệch kcal bữa"; chỉ có nút Thông tin; modal Cơm tẻ hiện gạo tẻ 36/48/54/60 g và 124,6–207,6 kcal theo nhóm tuổi.
  - Tuần 16/11 chưa lập: thêm Cơm tẻ vào bản nháp, Thay thế chỉ liệt kê món loại "Cơm, cháo" (kèm ghi chú dị ứng), chọn Cơm trắng thay đúng chỗ, Xóa đưa bản nháp về trạng thái chưa đổi. Không bấm Lưu nháp.
  - 1440 và 375 px: không cuộn ngang trang. Lần đầu chip món bị tên co còn 16 px, kcal đè chữ ⇒ đổi bố cục: tên một dòng, dòng dưới kcal + cụm nút (DESIGN §6.3 đã ghi).
- Góp ý của user trong lúc làm (màn `/menu/dishes`, tài khoản PHT): cột Thao tác trống khi chỉ xem và bảng sát mép card.
  - Ẩn cột Thao tác khi không có quyền sửa ở Món ăn và Nhà cung cấp (Thực phẩm đã làm vậy từ trước); bấm dòng vẫn mở chi tiết.
  - `.td-split-nav__main > .table-wrap` thêm lề trái/phải 16 px (áp cho Món ăn, Thực phẩm, Tồn kho khô); đã đo: bảng cách viền danh mục 16 px, cách mép phải card 17 px.
  - Chưa kiểm bằng tài khoản PHT chỉ xem (phiên đăng nhập là HT).
- Verify cuối: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Tiếp: user review phase 1 ⇒ phase 2.

### 2026-11-09 — Phase 2 (chờ review)
- Đã làm:
  - `DayBalanceView` dùng lại `TemplateMealSection` + `MealNutritionCard` + `AddDishesModal` của màn mẫu thực đơn (số dinh dưỡng, thành phần do `POST /nutrition/menu-statistics` tính trên món đang chọn, kể cả chưa lưu).
  - `DayEditorModal` (cỡ `full`, Hủy / Áp dụng vào tuần), `CopyDayModal`; menu "…" đầu cột ngày: Sửa ngày · Chép sang ngày… · Mở ở Cân đối khẩu phần (tuần chỉ xem: Xem cân đối ngày).
  - Tiện ích `dayBlockItems`, `setDayBlockItems`, `copyDay`, `dayStatisticsQuery`, `balanceHref` + `tests/menu/day-editor.test.mjs`.
  - `/menu/nutrition`: khi `meal-plan` là api dùng `DayBalancePage` (tuần, khối, ngày trên URL; Lưu nháp đầu màn; chỉ xem khi đã công bố); chế độ mock giữ màn demo cũ. Thêm `/menu/nutrition` vào module `meal-plan` ⇒ hết banner "Dữ liệu demo"; sửa test khóa danh sách route.
  - DESIGN §6.3 thêm dòng "Cân đối một ngày".
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Kiểm với BE thật (HT, tuần 16/11 chưa lập, không lưu): menu "…" đủ 3 mục; Sửa ngày mở modal 1382×852; thêm 4 món Bữa trưa ⇒ dinh dưỡng BE trả ngay (250,8 kcal/600–800 "Thiếu"; đạm, béo, bột đường "Đạt"); Áp dụng ⇒ lưới nhận 4 món đúng hàng, hiện "Có thay đổi chưa lưu"; Chép sang Thứ Ba đúng 4 món. `/menu/nutrition` tuần 09/11: chỉ xem, đủ tab khối/ngày/nhóm tuổi.
- Khác plan:
  - Không debounce truy vấn thống kê: món đổi theo lần bấm (thêm/bớt), không theo gõ phím; `useAsync` giữ số cũ (`stale`) tới khi có số mới.
  - Bố cục hai cột (dinh dưỡng rộng tối đa 820px) chỉ từ 1600px cho cả modal và trang: ảnh chụp 1440px cho thấy modal chia hai cột thì thẻ dinh dưỡng đè lên bảng món. Hẹp hơn xếp dọc, bảng dinh dưỡng lên trước.
  - `MealNutritionCard` thêm prop `emptyText` (câu cũ "cho mẫu" sai ngữ cảnh ngày).
- Tồn tại ngoài phase này: BE đang chạy ở cổng 8090 chưa trả `dishIngredients`, nên phần thành phần món ghi "Máy chủ chưa trả thành phần" (lỗi có sẵn trên màn mẫu thực đơn).
- Tiếp: user review phase 2 ⇒ phase 3 (cần BE B1 cho phần tách Tươi/Khô).
- Kiểm lại sau khi sửa bố cục (ảnh 1440/1920 bằng `ui-review/boarding-benchmark-pms-misa-2026-11-09/capture-phase2.mjs`, tự đăng nhập tài khoản demo local qua biến môi trường, không ghi mật khẩu vào file): modal xếp dọc, bảng dinh dưỡng ở trên không cuộn ngang; trang 1920px hai cột. Verify sau lần sửa cuối: `VERIFY PASS full | npm run verify | log verify.log`.
- Góp ý user 09/11: "Chép sang ngày" phải chọn được nhiều ngày / cả tuần ⇒ `CopyDayModal` dùng ô tích + "Chọn cả tuần", `copyDay` nhận một hoặc nhiều ngày đích (thêm test). Màn Cân đối: chỉ khóa khi tuần đã công bố; đã chụp thêm tuần đang soạn (thêm món, Lưu nháp) để thấy chế độ sửa.
- Góp ý user 09/11 (thiết kế lại hộp chép, theo skill ui-ux-pro-max + token CareNest): `CopyDayModal` cỡ `lg`, khối "Chép từ" liệt kê món theo bữa; chọn ngày bằng thẻ (cả thẻ bấm được, ô tích ẩn cho trình đọc màn hình, viền focus khi dùng phím); trạng thái bằng chữ (Đang trống / Có N món · sẽ bị thay / Ngày nghỉ / Ngày nguồn); chọn nhanh Cả tuần · Chỉ ngày trống · Bỏ chọn; cảnh báo cam liệt kê ngày bị thay; nút chính "Chép sang N ngày", tắt khi ngày nguồn chưa có món. 2 cột ở ≤640px.
- Góp ý user 09/11 ("màn nào xấu thì sửa luôn"), sửa `TemplateMealSection` dùng chung (modal Sửa ngày, Cân đối khẩu phần, trang sửa Mẫu thực đơn): bữa trống là một dòng gọn (icon · câu hướng dẫn · "Thêm món ăn") thay cho khối tranh lớn; khi máy chủ chưa trả `dishIngredients` thì ẩn đầu bảng và nút mở thành phần, báo một lần dưới mỗi bữa thay vì lặp dưới từng món.

### 2026-11-09 — Phase 3 (chờ review)
- Đã làm:
  - Đổi tên màn "Thống kê định lượng" ⇒ "Định lượng & đi chợ" (tiêu đề, breadcrumb, menu `menuConfig.js`).
  - Nút "Xuất Excel" (`statisticsExportRows` ⇒ `exportWithPreview`) và "Xem trước bản in" đầu màn; modal in `MenuStatisticsPrint` (A4 `.print-sheet`: thực đơn theo bữa, bảng thực phẩm, tổng tiền, ô Người lập / Người duyệt gõ tên ngay trên bản in, không lưu).
  - `storageGroups(stats)` chia "Cần mua (hàng tươi)" / "Lấy từ kho khô" kèm tổng nhóm; chỉ bật khi BE trả `storage` mỗi dòng và `freshCost`/`dryCost` (chờ BE B1), chưa có thì giữ một bảng như cũ.
  - Promote `.print-modal` và `.ps-sign--spaced` / `.ps-sign__input` lên `src/styles/print.css`; bỏ bản riêng trong `kitchen.css` (đổi tên class ở 5 màn bếp, mỗi màn 1 dòng).
  - Test `tests/menu/menu-statistics-export.test.mjs` (3 test).
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Kiểm với BE thật (HT, tuần 09/11, Thứ Ba): ảnh `ui-review/boarding-benchmark-pms-misa-2026-11-09/phase3/01–05` (đầu màn, bảng thực phẩm, bản in, ô ký đã gõ tên, xem trước Excel).
- Tồn tại: tách Tươi/Khô chưa hiện vì BE B1 chưa làm (cần mã công việc BE).
- Tiếp: phase 4 (Bán trú hôm nay "Việc tiếp theo").

### 2026-11-09 — Phase 4 (chờ review)
- Đã làm: `nextBoardTask(rowsPerCampus, campuses)` trong `dayBoardRows.js` (đỏ trước, rồi cam/tím; theo thứ tự hàng, rồi điểm trường; xanh dương không tính vì đang chờ bước khác); `NextTask` trên `BoardSummary` của `BoardingTodayPage` (nút đầu tiên của ô, kể cả "Đồng bộ kho"); 2 test AC-9 trong `tests/kitchen/day-board.test.mjs`.
- Khác plan: không promote `.kb-now` (nền theo giờ của bếp); dùng `.alert` chung theo tông (`danger`/`warning`/`success`) + `.bd-next` cho bố cục.
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Kiểm với BE thật (HT, 09/11): "Việc tiếp theo: Số suất · Cơ sở 1 — Chờ xác nhận" + nút "Sổ suất ăn"; 390px xuống dòng, không cuộn ngang. Ảnh `ui-review/boarding-benchmark-pms-misa-2026-11-09/phase4/`.
- Tiếp: phase 5 (điểm danh giáo viên một nút lưu, tên "Sổ suất ăn").

### 2026-11-09 — Phase 5 (chờ review)
- Đã làm:
  - `AttendancePage`: bỏ "Lưu trẻ đang chọn" (chỉ lưu điểm danh một trẻ; khung Sức khỏe bên phải đã lưu điểm danh + sức khỏe trẻ đang chọn qua `saveSelectedReception`) ⇒ một nút "Lưu điểm danh", cạnh đó "Còn N trẻ chưa điểm danh" (`receptionStats.missing` BE trả); `save()` bỏ tham số một trẻ.
  - `MEAL_COUNT_TITLE = 'Sổ suất ăn'` trong `attendanceConstants.js`, dùng ở `menuConfig` và `MealCountPage` (breadcrumb, tiêu đề, file `so-suat-an-<ngày>.xlsx`).
  - Đổi "Sổ báo ăn"/"sổ báo ăn" còn hiện trên giao diện: `MealRegisterCard`, `DayLockAlert`, `AttendanceSummaryPage` (tooltip), `ConfirmedMealCountPage`, `VicePrincipalDashboard`, `utils/kitchen/breadcrumbs.js`, `beErrorMessages.js`, câu lỗi mock repo. Comment code giữ nguyên.
  - Test `tests/kitchen/meal-count-label.test.mjs` (3 test).
- Khác plan: đổi tên rộng hơn 4 file đã liệt kê (thêm 6 file có chữ cũ trên giao diện).
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Kiểm với BE thật: Sổ suất ăn (HT) đúng tên; màn giáo viên ngày 09/11 đã khóa (quá 09:00), 10/11 chỉ xem ⇒ chưa chụp được chân bảng có nút lưu. Không mở khóa điểm danh trên BE để chụp (thao tác ghi). Cần user thử tay trước 09:00 hoặc sau khi PHT mở lại lớp.
- Tiếp: phase 6 cần BE B2 (`GET /meal-counts/class`) ⇒ chờ mã công việc BE.

### 2026-11-09 — Phase 6 (FE xong, chờ BE B2)
- Đã làm (FE):
  - `getClassMealCount({ classId, date })` ở `attendanceApi.js` (`GET /meal-counts/class`) + facade, mock repo (BE giả, dẫn ATT-02/NUT-02), hook `useClassMealCount`.
  - `ClassMealCard` + `utils/attendance/classMealCount.js`: mỗi bữa một ô (suất thường · suất thay thế · trạng thái xác nhận/ổ khóa/giờ), số lấy nguyên BE; đặt dưới chip tóm tắt ở `AttendancePage`, tải lại sau khi lưu điểm danh; 403 hiện `ErrorState`.
  - Test `tests/kitchen/class-meal-count.test.mjs` (3 test AC-11).
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (chạy lại 18:20 sau khi nạp lại phiên).
- Kiểm: ảnh ở chế độ mock `ui-review/boarding-benchmark-pms-misa-2026-11-09/phase6/` (1440, 375). Chưa thử với BE thật vì API mới chưa có trên server cổng 8090.
- BE: code B2 (`ClassMealCountResponse`, `GET /meal-counts/class`, service + integration test) đang nằm **chưa commit** ở worktree `CareNest_BE-day-boarding` (nhánh `feature/G94-254-BE-FEAT-27-day-boarding`, task khác). Chưa chạy test BE, chưa ghi vào plan BE. B1 (Tươi/Khô) chưa làm. Cần user chốt nhánh + mã công việc BE trước khi đi tiếp.
- Tiếp: user chốt nhánh BE ⇒ chuyển B2 sang nhánh đúng, làm B1, chạy `./mvnw test`, chạy BE mới để thử phase 3 (tách Tươi/Khô) và phase 6 với dữ liệu thật.

### 2026-11-09 — BE B1 + B2 xong (nhánh BE do user chốt)
- User chốt giữ nhánh BE `feature/G94-254-BE-FEAT-27-day-boarding` (worktree `CareNest_BE-day-boarding`); plan BE `approved`, đã chuyển sang worktree đó.
- B1 (`storage`, `freshCost`, `dryCost` trong `menu-statistics`) xong, khớp tên field FE (`STORAGE_GROUPS` trong `menuStatistics.js`). B2 (`GET /meal-counts/class`) soát lại, giữ nguyên. Docs BE + `openapi.yaml` cập nhật.
- Verify BE: `VERIFY PASS full | tests 1217 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 633s`. Verify FE: `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit (cả hai repo).
- Còn lại: chạy BE mới để thử phase 3 (hai bảng Tươi/Khô) và phase 6 (thẻ suất lớp) với dữ liệu thật; cổng 8090 đang chạy bản BE khác nên cần user đồng ý trước khi thay.

### 2026-11-09 — Chạy BE mới ở cổng 8090 (user đồng ý)
- Stack Docker `carenest_main_seed` (cổng 8090/8190/5440). Trước khi đổi: dump DB (đang V79) ra `main_seed_before_v80.dump` và lưu `.jar` cũ `app-main-seed-old.jar` trong thư mục tạm của phiên này.
- Build image `carenest_be:g94-254` từ `CareNest_BE-day-boarding` (không ghi đè `latest`); chép `/app/app.jar` mới vào `carenest_main_seed-api-1` rồi restart (không dựng lại bằng compose vì stack chạy bằng biến môi trường chứa secret, không có `.env`). Flyway áp V80, V81; BE khởi động 16,7 s.
- Quay lại bản cũ: khôi phục DB từ dump và chép lại `.jar` cũ (chỉ chép `.jar` thì Flyway có thể báo lỗi vì DB đã có V80, V81).
- Chụp thật phase 3 (Tươi/Khô) và phase 6: script `ui-review/boarding-benchmark-pms-misa-2026-11-09/capture-real-be.mjs` chờ user đăng nhập (HT rồi Giáo viên); lần chạy 19:15 hết 10 phút chờ, chưa có ảnh.
- Chụp lại 19:40 với BE thật (tự đăng nhập tài khoản demo local user cấp trong chat; mật khẩu chỉ truyền qua biến môi trường lúc chạy, không ghi file): phase 3 bảng thực phẩm chia "Cần mua (hàng tươi) · 8 thực phẩm" và "Lấy từ kho khô" (`phase3/06-storage-groups-real.jpg`); phase 6 giáo viên lớp A1 thấy thẻ Suất ăn lớp hôm nay, Bữa trưa/Bữa chiều 0 suất, Chờ xác nhận (22 trẻ chưa điểm danh) (`phase6/03-class-meal-card-real.jpg`). Báo cáo HTML đã thêm hai ảnh.
