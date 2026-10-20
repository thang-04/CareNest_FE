---
title: Sửa UI theo góp ý docx (đầu trang, thanh bước, bảng, nhãn lọc)
status: done
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: high
created: 2026-10-20
updated: 2026-10-20
---

# Sửa UI theo góp ý docx (đầu trang, thanh bước, bảng, nhãn lọc)

Làn L: đổi CSS dùng chung cho ≥2 nhóm màn hình, >8 file. Không đổi nghiệp vụ, route, quyền, contract BE. Plan kèm: `2026-10-20-style-sync-by-flow.md` (bắt đầu sau Phase 3 plan này).
## Context

File góp ý (đọc 2026-10-19) có 4 yêu cầu kèm ảnh:
1. "Chỉ giữ breadcrumb (Trang chủ > Bếp > Kho thực phẩm > Kho khô). Bỏ card to cho toàn bộ màn hình" — kết quả mẫu = trang Lập kế hoạch năm học: breadcrumb rồi tới nội dung.
2. "Thanh quy trình của toàn bộ phần thiết lập cần giống, nhỏ như trang tạo kế hoạch năm học".
3. "Dữ liệu dạng bảng đồng bộ: thông tin cố định, không sửa được highlight xám; dòng TH màu đen, in đậm" (mẫu: bảng STT | Tên lĩnh vực | Xóa ở Cấu hình kế hoạch).
4. "Format toàn bộ nhãn đầu ô lọc cùng 1 kiểu chữ, cùng cỡ để thẳng hàng" (ảnh: chip "Campus 1" + Ngày / Bữa ăn / Nhóm tuổi lệch nhau).

Hiện trạng:
- Card đầu trang không phải component: CSS `.page__head` + `.page > .page__title` (`src/styles/components.css:26-90`, tranh `::before` dùng `--scene-bg`). ~70 trang dùng `.page__head`, ~60 trang chỉ có `h1.page__title` sau Breadcrumb. Override riêng: `school-config.css:712-760`, `permissions.css:5-17`, `appearance.css:3`.
- Mẫu đích đã có: `PageHead` (`src/components/education-plan/eduUi.jsx:36-51`) — Breadcrumb, `h1.sr-only`, hàng `desc` nhỏ + `actions`. Tab title lấy từ crumb cuối (`Breadcrumb.jsx:11` → `usePageTitle`), không phụ thuộc h1.
- Thanh bước nhỏ = `Stepper` chung (`src/components/ui/Stepper.jsx`, CSS `components.css:1347-1420`) + override chỉ trong `.ga-sticky-head` (`education-plan.css:369-389`). Nơi khác còn cỡ lớn: `EnrollChildPage.jsx:275`, `HealthExamFormPage.jsx:600` (thiếu khung `stepper-card`), `TransferWizard.jsx:108`, `UiKitPage.jsx:646`. Wizard "Thiết lập quyền ngoại lệ" tự vẽ pill: `OverrideWizardModal.jsx:69-76`, `permissions.css:209-243`.
- Bảng: 97 bảng `table--grid` đã header đen đậm; ~40 bảng `.table` thường header xám 12px (`components.css:475-484`) ở facility, facility-transfer, inventory-inspection, dashboard, education-plan list, UiKit. Quy tắc `docs/architecture/CODING_GUIDE.md` §3 mục 8: bảng dùng `.table-wrap > .table.table--grid`. Ô xám cố định chỉ có `.ga-goal-table__fixed` (`education-plan.css:552-561`, `--color-secondary`).
- Nhãn lọc 4 kiểu: `.field__label` 13/500 (`components.css:269-278`), `.date-filter` 12/400 xám (`components.css:2059-2068`), `.form-row__label`, span `text-sm text-2`. Ảnh lỗi = `PublishedMenuPage.jsx:235-249`: `.kb-toolbar` `align-items:flex-end` (`kitchen.css:3-15`), chip campus không nhãn từ `KbCampusFilter` (`KitchenFilters.jsx:34-52`), "Nhóm tuổi" chép tay `.date-filter`.

## Quyết định đã chốt (user, 2026-10-20)
1. Dưới breadcrumb chỉ còn 1 hàng mỏng: mô tả chữ nhỏ (trái) + nút hành động (phải); tiêu đề h1 ẩn (sr-only) như trang Lập kế hoạch; không nền, không tranh.
2. Giữ dải chào Dashboard (`DashboardHeader`, `.db-hero`) — không thuộc phạm vi.
3. Ô xám chỉ áp cho cột cố định trong bảng có ô nhập; bảng chỉ xem giữ nền trắng.
4. Nhãn ô lọc/ô nhập: 13px, `--fw-medium` 500, `--color-text` (theo `.field__label`).
5. Thanh bước: kiểu nhỏ thành mặc định của `Stepper`; wizard quyền ngoại lệ đổi sang `Stepper`. Không đụng hub "Quy trình dinh dưỡng" (`/menu/flow`) và timeline trạng thái `ProgressSteps` trang chi tiết (đề xuất mặc định — nói rõ khi trình plan).
6. Bảng kiểu Word KHGD giữ ngoại lệ; 2 bảng danh sách KHGD chuyển `table--grid` (user, 2026-10-20).

## Acceptance criteria
- **AC-1**: Mọi trang chức năng (trừ dashboard) không còn card nền/tranh dưới breadcrumb; nút hành động (vd. Kho khô: Kiểm kê, Tạo phiếu nhập) vẫn hiện, căn phải, cùng hàng mô tả.
- **AC-2**: Mọi `Stepper` cao ~70px như trang Lập kế hoạch (chấm 26px, nhãn 12px); Phiếu khám có khung trắng; wizard quyền ngoại lệ dùng `Stepper`.
- **AC-3**: Mọi bảng dữ liệu dùng `table--grid`: header chữ `--color-text`, 700; ô cố định trong bảng có ô nhập nền `--color-secondary`.
- **AC-4**: Nhãn trên ô lọc cùng 13/500/`--color-text`; chip điểm trường có nhãn "Điểm trường" và thẳng hàng với ô nhập bên cạnh.
- **AC-5**: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; ảnh chụp Playwright 1440px khớp ảnh mẫu trong docx.

## Phases (mỗi phase: làm → verify → Progress log → dừng chờ review)

### Phase 1 — Bỏ card đầu trang (AC-1)
- M `src/styles/components.css`: `.page__head` thành hàng trơn (flex, `justify-content: space-between`, `align-items: flex-end`, bỏ min-height/viền/nền/shadow/blur/`::before`, margin-bottom `--space-4`); `.page__head .page__title` và `.page > .page__title` dùng cùng khai báo ẩn của `.sr-only` (`utilities.css:85`); `.page__desc` chữ `--fs-sm` muted như `PageHead`.
- M override: `school-config.css:712-760`, `permissions.css:5-17` (bỏ khai báo thừa); `appearance.css` + `AppearancePage.jsx:92`: chuyển xem trước tranh sang class riêng `ap-preview` (không dựa `.page__head`).
- Rà h1 chứa badge/chip (vd. `ChildProfilePage:64`, `HealthCheckDetailPage:162`, `HealthExamFormPage:199`, `PickupVerifyPage:103`…, grep `page__title` có `chip|badge`) ⇒ đưa badge ra cạnh mô tả để không bị ẩn.
- Rà trang chi tiết có h1 = tên đối tượng mà crumb cuối khác (vd. hồ sơ trẻ, phiếu) ⇒ crumb cuối mang tên đối tượng (giữ thông tin hiển thị).
- M `tests/integration/selective-merge/permission-center.test.mjs:204-205` nếu markup đổi.
- M `DESIGN.md` §4.2 (:344) và §7.1 (:467): đầu trang = breadcrumb + hàng mô tả/nút, không dải tranh.
- Kiểm: Kho khô, Danh sách trẻ, Hồ sơ trẻ, Danh sách năm học, Quyền ngoại lệ, Tùy chỉnh giao diện.

### Phase 2 — Thanh bước nhỏ đồng bộ (AC-2)
- M `components.css:1347-1420`: đưa giá trị nhỏ từ `education-plan.css:369-389` vào `.stepper-card`, `.stepper__btn`, `.stepper__dot`, connector, `.stepper__label`; xóa override `.ga-sticky-head .stepper*` trong `education-plan.css`.
- M `src/components/ui/Stepper.jsx`: icon Check 14px cho chấm 26px.
- M `HealthExamFormPage.jsx:600`: bọc `div.card.stepper-card`.
- M `OverrideWizardModal.jsx:69-76`: dùng `Stepper` (giữ logic bước hiện có); xóa CSS pill thừa `permissions.css:209-243`.
- Kiểm: Lập kế hoạch (không đổi), Tiếp nhận trẻ, Phiếu khám, Luân chuyển tài sản, modal quyền ngoại lệ.

### Phase 3 — Bảng đồng bộ (AC-3)
- M `components.css`: thêm class chung `.table .cell--fixed` (nền `--color-secondary`, `cursor: default`) chuyển từ `.ga-goal-table__fixed`; đổi các chỗ dùng `ga-goal-table__fixed` (EduConfigPage, GoalTables, ThemePlanBody, WeekPlanBody, BranchPlanPage, ClassPlanPage, PlanReviewQueuePage) sang `cell--fixed`, xóa khai báo cũ.
- Thêm `table--grid` cho ~40 bảng `.table` thường: `components/facility-transfer/*` (7), `pages/facility/*` (7), `pages/facility-transfer/*` (8), `pages/inventory-inspection/*` (8), `PendingApprovalsPage:179`, `PrincipalDashboard:180`, `DailyAssessmentPage:296`, `UiKitPage:435,531`; bọc `.table-wrap` cho `FoodImportPanel:107,130,155`, `AllergySubstitutes:190`, `AiTemplateComposer:142`, `AutoChecks:40`, `PlacementClassPanel:194`; bỏ inline style ghi đè viền `.table-wrap` (vd. `IssueListPage:145`, `RewardProposalListPage:135`, `GoodBehaviourTicketsPage:197`).
- Gắn `cell--fixed` cho cột cố định trong bảng có ô nhập: `StockReceiptFormPage`, `StockCountPage`, `FreshReceiptPage`, `ForecastBlocks`, `InspectionSheetPage`, `CreateInspectionPage`, `HandoverPage`, `ReceivePage`, `StepSelectAssets`, `ProposalFormPage`, `DishFormPage`, `MealEditor`, `AllergyMenuFormPage`, `NutritionSetupPage` (cột liệt kê trong báo cáo rà: STT, mã, tên, ĐVT, số sổ sách/hệ thống, số tính sẵn).
- Bảng kiểu Word KHGD (`ga-goal-table`, `ga-plan-table`) giữ ngoại lệ (user 2026-10-20): chỉ đổi ô xám sang `cell--fixed`, header đã đen đậm; riêng 2 bảng danh sách `GoalListPage:146`, `SchoolPlansPage:168` chuyển `table--grid`. Thêm ghi chú ngoại lệ vào `CODING_GUIDE.md` §3 mục 8.
- Không đụng bảng in `.ps-table` và file xuất `yearPlanDoc.js`/`classPlanDoc.js`.
- File nhiều (>30) nhưng thay đổi cơ học ⇒ có thể tách 3a (class chung + table--grid) / 3b (cell--fixed), mỗi phần dừng review.

### Phase 4 — Nhãn ô lọc thẳng hàng (AC-4)
- M `components.css:2059-2068`: `.date-filter` nhãn 13/500/`--color-text`, gap 4px như `.field`.
- M `KitchenFilters.jsx:34-52`: `KbCampusFilter` khi không có quyền chọn vẫn bọc `.date-filter` nhãn "Điểm trường", chip căn giữa trong khối cao bằng ô nhập (class chung mới trong `components.css`, vd. `.date-filter__static`).
- M `PublishedMenuPage.jsx:239-249`, `ConfirmedMealCountPage.jsx:44,55`, `StockCountPage.jsx:248`: thay nhãn chép tay bằng `.date-filter`/component có sẵn.
- M `ChildHealthRecordPage.jsx:254-260`, `TransferListPage.jsx:148,158`: thống nhất nhãn theo cùng kiểu.
- M `DESIGN.md` mục thanh lọc (:424): ghi kiểu nhãn chuẩn.
- Kiểm: Thực đơn đã công bố, Số suất đã chốt, Kiểm kê kho, Tổng hợp điểm danh, Luân chuyển.

## Rủi ro & rollback
| Rủi ro | Giảm thiểu | Rollback |
| --- | --- | --- |
| Plan `2026-10-19-css-cleanup` (in-progress) và `2026-10-19-children-health-ui-sync` cùng sửa `components.css`/bảng | Trước Phase 1 đọc Progress log 2 plan; nếu đang giữa phase ⇒ hỏi user thứ tự | Mỗi phase sửa CSS tách khối, revert theo phase |
| Plan tranh nền (`2026-10-09-giao-dien-tranh-nen`) có "dải đầu trang" | Tranh vẫn làm nền app; ghi "Khác plan" vào plan đó; xem trước chuyển sang `ap-preview` | Khôi phục `.page__head` cũ |
| h1 ẩn làm mất badge/tên đối tượng | Bước rà badge + crumb ở Phase 1 | — |
| Header bảng/viền đổi trên bảng có CSS module riêng | Ảnh chụp trước/sau từng nhóm | Revert class |

## Verification
- Mỗi phase: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; sửa `docs/`/`DESIGN.md` ⇒ `node scripts/check-ai-layer.mjs`.
- Playwright (skill `webapp-testing`) 1440px: chụp các trang liệt kê ở mỗi phase, so cạnh nhau với ảnh mẫu docx (Kho khô, Lập kế hoạch, bảng lĩnh vực, thanh lọc Thực đơn đã công bố); kiểm 0 lỗi console; kiểm tab title không đổi.
- Không commit; commit khi user cho phép và cho mã Jira.


## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi phase có Exit = `node scripts/verify.mjs` → `VERIFY PASS full`
- [x] >8 file, 4 phase ⇒ đã tách phần đồng bộ style sang plan riêng (user chọn 2026-10-20)
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-10-20 — Duyệt
- Nguồn: user duyệt plan (ExitPlanMode) sau khi chọn đáp án 4 câu hỏi + tách 2 plan.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa source).
- Tiếp: Phase 1.

### 2026-10-20 — Phase 1 (chờ review)
- Đã làm: `components.css` `.page__head` thành hàng trơn (bỏ nền, viền, tranh `::before`, cao 140); `h1.page__title` trong `.page__head`, `.page >` và `.page > .row >` ẩn kiểu `.sr-only`; đầu trang chỉ có tiêu đề + nút ⇒ nút đẩy sang phải; `.page__desc` chữ nhỏ muted; `.breadcrumb` thêm khoảng dưới (`layout.css`). Bỏ override thừa `.sc-plc-page .page__head*`/`.page__title` (`school-config.css`). Tùy chỉnh giao diện: xem trước tranh bằng ảnh nhỏ `ap-head__thumb` thay dải tranh. `DESIGN.md` §4.2, §7.1 cập nhật.
- **Khác plan:** không phải chuyển badge — badge là phần tử anh em của h1, không nằm trong h1 nên vẫn hiện. Trang chi tiết (hồ sơ trẻ) breadcrumb đã mang tên đối tượng, không phải sửa crumb.
- Kiểm (agent-browser, HT, 1440px, mock :5173): Kho khô khớp ảnh mẫu docx (mô tả trái, Kiểm kê phải, không thẻ); 33 route menu + 8 màn chụp: mọi h1 rộng 1px (ẩn), `.page__head` không nền/viền; crumb cuối trùng hoặc gần nghĩa h1 (vd. "Báo cáo sự cố" / "Báo cáo sự cố cơ sở vật chất"). Dashboard giữ dải chào. Chưa kiểm vai PHT/GV/bếp, 768px.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; check-ai-layer 0 lỗi.
- Commit: chưa commit.
- Tiếp: dừng chờ review → Phase 2 thanh bước.

### 2026-10-20 — Phase 1 bổ sung: đầu trang đỡ trống (chờ review)
- Nguồn: user thấy "UI hơi trống" sau khi bỏ card; chọn hướng A "breadcrumb làm tiêu đề" (không thêm khung).
- Đã làm: `.breadcrumb__current:last-child` 16px đậm (`layout.css`), breadcrumb cao bằng nút lớn; ≥1024px con cuối của `.page__head` (nhóm nút/badge, trừ mô tả `p`) đặt tuyệt đối lên cùng hàng breadcrumb bên phải (`components.css`); `.page__desc` rộng 120ch. `PageHead` của kế hoạch giáo dục chuyển sang markup `.page__head` chung; xóa `.ga-page-head`. `DESIGN.md` §7.1.
- Kiểm (HT, mock :5173): Kho khô, Năm học, Hồ sơ trẻ, Kế hoạch toàn trường ở 1440px; Phiếu theo dõi 1280px; Kho khô 1000px (nút về hàng mô tả). Mục giữa không link không bị phóng to.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.

### 2026-10-20 — Phase 2 (chờ review)
- Nguồn: user "ok" (duyệt đầu trang, làm tiếp).
- Đã làm: giá trị gọn (chấm 26px, nhãn 12px, padding `--space-2`) đưa vào `.stepper*` chung (`components.css`), xóa override `.ga-sticky-head .stepper*` (`education-plan.css`); icon Check 14px (`Stepper.jsx`); Phiếu khám bọc `card stepper-card`; modal Gán quyền ngoại lệ dùng `Stepper` (không bấm chấm, đổi bước bằng nút), xóa CSS pill `.perm-step*`.
- Kiểm (agent-browser 1440px): thanh bước cao 65px ở Lập kế hoạch (PHT), Tiếp nhận trẻ (PHT), Tạo phiếu luân chuyển (PHT), Phiếu khám (GV Lê Minh Anh, `/children/health-checks/hc_c1_open/exam/ch_009`); modal quyền ngoại lệ (HT) hiện 3 chấm.
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — 1 test fail `tests/menu/allergy-row-layout.test.mjs` ("ô món không còn chứa ghi chú dị ứng"): file mới chưa track của plan `2026-10-20-menu-week-layout.md` (phiên khác, đang làm, test viết trước). Không thuộc file Phase 2. Vì `npm run verify` dừng ở suite đầu, chạy riêng: menu 64/65 (chỉ test trên fail), `test:kitchen` 41/41, `test:merge` 38/38, `npm run check` (lint/format/build) exit 0. Chạy lại verify đầy đủ khi plan kia xong. Chạy lại sau đó: `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-10-20 — Duyệt Phase 2, chạy tới đích
- Nguồn: user "duyệt /goal" ⇒ làm liền Phase 3–4 rồi plan `2026-10-20-style-sync-by-flow.md`. **Khác plan:** không dừng review giữa phase; vẫn verify + ghi log từng phase.
- Commit: chưa commit.

### 2026-10-20 — Phase 3 (done)
- Shared: `.table th` mọi bảng chữ `--color-text` đậm; class chung `.cell--fixed` (nền `--color-secondary`) ở `components.css`, selector thua màu dòng cảnh báo của module; `ga-goal-table__fixed` đổi thành `cell--fixed` (7 file KHGD, giữ ngoại lệ bảng Word). `CODING_GUIDE.md` §3 mục 8 ghi quy tắc + ngoại lệ.
- 3 agent song song (file tách riêng): `table--grid` cho 21 bảng CSVC/luân chuyển, 14 bảng kiểm kê/dashboard/đánh giá/KHGD danh sách/UiKit; bọc `.table-wrap` 6 bảng thực đơn + `PlacementClassPanel`; `cell--fixed` ở bảng có ô nhập (Handover, Receive, StepSelectAssets, TransferDiscrepancy, ProposalForm, InspectionSheet, CreateInspection, DailyAssessment cột Trẻ, StockReceiptForm, StockCount, FreshReceipt, ForecastBlocks, DishForm, MealEditor, AllergyMenuForm, AllergySubstitutes). Gỡ 17 inline style ghi đè viền `.table-wrap`.
- **Khác plan:** NutritionSetupPage không có cột cố định (mọi ô đều nhập được) ⇒ không gắn. ProposalForm ĐVT chỉ xám ở dòng không nhập tay. Sửa thêm: màu dòng kiểm kê `.kk-row--*` nâng selector (bị `table--grid` ép trắng); khung `.dg-sheet-wrap` giữ viền khi bảng thành grid.
- Kiểm: grep 0 bảng `.table` thiếu `table--grid` (trừ `ga-plan-table`); Kiểm nhận hàng tươi (bếp) ô cố định xám, ô nhập trắng.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-10-20 — Phase 4 (done)
- `.date-filter` nhãn 13px/500/`--color-text`, gap `--space-1` (`components.css`); `.date-filter__static` cho giá trị chỉ xem cao bằng ô nhập. `KbCampusFilter` (không quyền chọn) có nhãn "Điểm trường" + chip. `ChildHealthRecordPage` khoảng ngày dùng `.date-filter`. Các nhãn "Nhóm tuổi", "Lớp", "Điểm trường" ở Published/ConfirmedMealCount/StockCount/TransferList đã dùng `.date-filter` nên tự đổi. `DESIGN.md` mục Bộ lọc.
- Kiểm (bếp, 1440px): Thực đơn đã công bố — 4 khối lọc cùng top 120/bottom 180, chip Campus 1 giữa ô; Số suất đã xác nhận cùng hàng.
- Verify: như Phase 3 (chạy sau cả 2 phase).
- Tiếp: plan `2026-10-20-style-sync-by-flow.md`.
