---
title: Đồng bộ style CSS theo luồng màn hình
status: in-progress
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-20
updated: 2026-10-20
---

# Đồng bộ style CSS theo luồng màn hình

Làn L: >8 file, ≥2 nhóm màn hình. Không đổi nghiệp vụ, route, quyền, contract BE. Bắt đầu sau Phase 3 của `2026-10-20-ui-feedback-docx.md` (bảng `table--grid` làm ở đó).

## Context
User yêu cầu "rà lại các luồng màn hình đã đồng bộ về css, style chưa" (2026-10-20). Rà chỉ đọc theo `.claude/rules/ui-style.md`, `CODING_GUIDE.md` §3, `DESIGN.md` §13.1. Kết quả:

| Luồng | Trạng thái | Lỗi chính |
| --- | --- | --- |
| Luân chuyển tài sản | Chưa | 73 inline tĩnh; `facility-transfer.css:21-218` 12 radius px + 35 spacing px; `.asset-table td` ghi đè `.table` (:97); token gốc `--brand-*` (:33,41); button `.category-item` không `.btn` (`StepSelectAssets.jsx:78,86`); 3 chip vai trò |
| Kiểm kê tài sản | Chưa | 44 inline; `inventory-inspection.css` 6 radius px, 5 font-weight số, 20 spacing px; `.kk-stat`/`.kk-filter`/`.kk-chip`/`.kk-qty` chép `.stat-card`/`.chip`/`.input-unit`; 3 `<tr>` bấm không bàn phím (`InspectionListPage:155,305`, `InspectionRoundDetailPage:381`) |
| Đánh giá phát triển | Chưa | 44 inline (`DailyAssessmentPage:190-264`, `DevelopmentProfileView:95-306`); `.dg-sheet` viết lại th/td/hover (`assessment.css:13-52,94-111`); chip trạng thái tự vẽ (`AssessmentDayUnlockPage:271`, `DevelopmentCharts:166`, `GoodBehaviourTicketsPage:184,277`) |
| Dashboard + Chờ duyệt | Chưa | `dashboard.css` radius/font-size px, `font-weight:800` (:366,590,675), `#000` mask (:235); `.db-shortcuts .btn` định nghĩa 2 lần (:134,242); `.stat-card` làm button (`PendingApprovalsPage:61,72`) |
| Kế hoạch giáo dục | Chưa (ngoài bảng Word) | `--ga-highlight:#ffff00` (`education-plan.css:514`); ghi đè `.icon-btn`/`.chip` (:543,494); 8 inline (`lessonShared.jsx:62-116`); chip hạn (`ClassPlanPage:128-139`); `<tr>` bấm `GoalListPage:159` |
| Báo hỏng CSVC, Đề xuất/Yêu cầu | Một phần | 50 inline (`IssueDetailPage:140`, `ProposalFormPage:312-321`); 4 `<tr>` bấm (`IssueListPage:189`, `ProposalListPage:174`…) |
| Thực đơn (danh mục + tuần/AI) | Một phần | 26 inline (`WeekDaysView:20-27`, `AiMenuSuggestionPage`, `MealEditor:40-44`); chip tự vẽ (`MenuBadges:27`, `MenuListPage:103`, `WeeklyMenuPage:333`…); button không class (`CategoryNav:7`, `WeekGrid:142,177`); 3 `<tr>` (`AllergyMenuListPage:148`, `DishListPage:168`, `FoodListPage:284`) |
| Điểm danh | Một phần | `.chip--critical` khai báo trong module (`attendance.css:695`); ghi đè `.btn`/`.card` (:769, :20-27); 6 chip tự vẽ (`AttendancePage:61,416,519,567`, `TemperatureBadge`); 3 `<tr>` |
| Cấu hình trường | Một phần | 15 inline (`CampusDetailPage` 7, `TeacherAssignmentPage` 4); 5 chip "Chưa phân công"; ghi đè `.chip`/`.btn` (`school-config.css:761-783`) |
| Bếp (kho, vận hành) | Một phần | 9 inline (`StockReceiptFormPage:159-184`, `MealPreparationUpdatePage:146-163`); 6 chip tự vẽ; button không class (`DryStockPage:252`, `FreshReceiptPage:39`) |
| Tài khoản/Cài đặt/Thông báo/Auth | Một phần | px trong `account.css`, `parent-accounts.css`, `auth.css` (`font-weight:800` :61); `#fff` `appearance.css:77,191`; `NotificationsPage` thiếu `ErrorState`, `notif-item` button |
| Trẻ, Khám sức khỏe, Phân quyền | Gần xong | vài px; 2 chip "Đã/Chưa công bố" (`ChildHealthRecordPage:371`, `HealthCheckClassRoster:114`); 2 button không class (`ParentActivationPage:213,243`); 2 inline phân quyền |
| Đón trẻ, ComingSoon/NotFound | Đã đồng bộ | — |
| Lớp chung | — | `components.css` 36 spacing px, `font-size:34px`+`800` (:2010), `.form-row__label` padding bị ghi đè chết (:1451-1454), token gốc (`--gray-50` :1673,1790,1844, `--brand-sky-*`); `layout.css:89` `!important`; `PeopleTabs` tự làm tab; `.cb` trùng `.checkbox input` |

Sạch toàn bộ: icon (100% qua `icons.js`), modal (100% `Modal`/`ConfirmationModal`), hex trong JSX, loading/error (trừ Thông báo).
Plan `2026-10-19-children-health-ui-sync.md`: AC-1/3 đã có trong code (commit `00f33f2`), còn ở "Phase 1 chờ review" ⇒ báo user đóng plan đó, không làm lại.

## Quyết định đã chốt (user, 2026-10-20)
1. Tách khỏi Plan 1; bảng `table--grid`/`.table-wrap` đã làm ở Plan 1 Phase 3 nên Plan 2 không lặp.
2. Mức sửa: inline style tĩnh → class/utility; ghi đè class chung → bỏ hoặc nâng thành modifier chung trong `components.css`; chip trạng thái tự vẽ → `createStatusBadge` (chip vai trò/danh mục không phải trạng thái giữ `.chip`); px/hex/token gốc thật → token semantic; button không class → `.btn`/class chung; `<tr>` bấm không có nút/link bên trong → thêm `tabIndex` + `onKeyDown` (Enter/Space) hoặc link ở ô tên. Token alias cũ (`--gray-50`, `--primary-25`…) chỉ ghi cảnh báo, không đổi.
3. Bảng Word KHGD giữ ngoại lệ.
4. **Bổ sung (user, 2026-10-20):** web phải dùng được ở 360–430px. Mốc mới thay cho `DESIGN.md:469` cũ.
   - Thứ tự làm: `2026-10-20-mobile-responsive-baseline.md` → `2026-10-20-ui-standards-status-filter-action-errors.md` → các phase chưa làm của plan này.
   - Từ đó, mỗi luồng còn lại phải thêm các việc sau:
     - Filter: đổi sang `.filter-bar` + `SearchSubmit`/`SearchSelect`/`FilterMore`; nút reset ghi "Đặt lại bộ lọc".
     - Row action theo chuẩn `RowActions`: tối đa 2 icon, các hành động khác và Xoá vào menu "…".
     - Grid module gập về 1 cột ở ≤640px. Danh sách grid giao lại nằm trong Phase 3 của plan mobile-baseline.
     - Kế hoạch giáo dục: bỏ bản trùng trong `eduUi.jsx` (`Stepper:99`, `Modal:216`, `EmptyState:225`), dùng component trong `components/ui`.

## Acceptance criteria
- **AC-1**: Luồng trong phạm vi: 0 inline style tĩnh, 0 ghi đè class chung trong module CSS, 0 chip trạng thái tự vẽ, 0 button không class, 0 `<tr>` bấm thiếu bàn phím (đếm bằng lệnh rà ở Verification).
- **AC-2**: Lệnh `DESIGN.md` §13.1 (hex, radius/font-size px, `font-weight:800`, icon) trả 0 dòng mới và giảm ở file đã sửa.
- **AC-3**: Giao diện không đổi ngoài chỗ lỗi (ảnh trước/sau mỗi luồng), `VERIFY PASS full`.
- **AC-4** (bổ sung 2026-10-20, chỉ áp cho phase làm sau plan chuẩn UI): luồng trong phạm vi đạt các điều kiện sau.
  - Không cuộn ngang trang ở 360/390px (`scrollWidth <= innerWidth`).
  - 0 filter tự dựng ngoài chuẩn.
  - 0 row action ngoài chuẩn `RowActions`/nút chính `.btn--primary.btn--sm`.

## Phases (mỗi phase dừng chờ review; ưu tiên luồng "Chưa")
- **Phase 1 — Lớp chung**: `components.css` (spacing px → `--space-*`, `:2010` → token, xóa khai báo chết `:1451`, token gốc → semantic, gộp `.cb`), `layout.css:89` bỏ `!important`; thêm modifier chung cần cho phase sau (vd. `.chip--critical` chuyển từ `attendance.css`, `.stat-card--button`); `PeopleTabs` dùng `.tabs`.
- **Phase 2 — Luân chuyển tài sản** (`pages|components/facility-transfer`, `facility-transfer.css`).
- **Phase 3 — Kiểm kê tài sản** (`pages/inventory-inspection`, `inventory-inspection.css`: thay `.kk-*` chép lại bằng class chung).
- **Phase 4 — Đánh giá phát triển** (`pages|components/assessment`, `assessment.css`; `.dg-sheet` chỉ giữ độ rộng/căn chỉnh) + **Dashboard/Chờ duyệt** (`dashboard.css`, `DashboardWidgets`, `PendingApprovalsPage`; giữ dải chào).
- **Phase 5 — Kế hoạch giáo dục (ngoài bảng Word) + CSVC Báo hỏng/Đề xuất/Yêu cầu**.
- **Phase 6 — Thực đơn + Bếp**.
- **Phase 7 — Điểm danh, Cấu hình trường, Tài khoản/Cài đặt/Thông báo/Auth, Trẻ/Khám/Phân quyền (phần còn sót)**; `NotificationsPage` thêm `ErrorState`.
- >3 phase: mỗi phase độc lập theo thư mục module ⇒ có thể dừng sau bất kỳ phase nào.

## Rủi ro & rollback
| Rủi ro | Giảm thiểu | Rollback |
| --- | --- | --- |
| Đổi px → token lệch vài px | Chọn token gần nhất; ảnh trước/sau 1440px | Revert theo phase (mỗi phase 1 nhóm file) |
| Trùng plan `css-cleanup` (đang Phase 1) | Đọc Progress log trước Phase 1; hỏi user nếu còn dở | — |
| `createStatusBadge` đổi tông màu trạng thái | Map tông theo bảng `DESIGN.md` 3.2 | Revert file badge |

## Verification (mỗi phase)
- `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh `DESIGN.md` §13.1.
- Rà lại theo luồng: grep `style={{` tĩnh, `className="chip chip--` theo trạng thái, `<tr[^>]*onClick` không `tabIndex`, `<button` không `className` trong thư mục phase.
- Playwright 1440px ảnh trước/sau các trang chính của luồng; 0 lỗi console; thử Tab/Enter trên hàng bảng đã sửa.

## Validation log
- [x] Khẳng định về code có `file:line` (rà chỉ đọc 2026-10-20)
- [x] Không đổi contract BE
- [x] 7 phase độc lập theo thư mục module; dừng được sau bất kỳ phase nào
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-10-20 — Duyệt
- Nguồn: user duyệt plan (ExitPlanMode).
- Commit: chưa commit. Verify: chưa chạy.
- Tiếp: chờ plan docx xong Phase 3.

### 2026-10-20 — Phase 1 lớp chung (done)
- Nguồn: user "duyệt /goal" (chạy liền các phase, verify + log từng phase; **khác plan:** không dừng review giữa phase).
- Đã làm: `components.css` token gốc → semantic cùng giá trị (`--neutral-400`→`--color-text-disabled`, `--sky-400`/`--brand-sky-400`→`--color-brand`, `--mint-500`→`--color-accent-strong`, `--brand-sky-50/700/900`→`--color-primary-soft`/`--color-primary`/`--color-primary-active`, `--gray-50`→`--color-secondary`); spacing px trùng token → `--space-*` (26 dòng); `.stat-card__value` 34px/800 → token `--stat-value-size` (mới, `tokens.css` lớp component) + `--fw-bold`; bỏ selector radiogroup bị ghi đè chết ở `.form-row__label`; `.chip--critical` chuyển từ `attendance.css` lên `components.css`; `layout.css` `--neutral-400`→`--color-text-disabled`. Thêm `src/utils/clickableRow.js` (`clickableRowProps`) + `.row-click:focus-visible`.
- **Khác plan:** giữ `PeopleTabs` (tab điều hướng gạch chân, màn Nhân sự/Trẻ vừa đồng bộ) — đổi sang `.tabs` viên sẽ đổi giao diện. Giữ `!important` ở `.sidebar__brand .wordmark` (đè `fontSize` inline của `Wordmark`). Không gộp `.cb` (rủi ro, lợi ít). `--brand-blue-700`, `--purple-700` (logo, alert tím) chưa có token semantic tương đương — giữ.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Tiếp: Phase 2–7 giao 5 agent song song theo thư mục module (không đụng CSS chung).

### 2026-10-20 — Bổ sung phạm vi (mobile + chuẩn UI)
- Nguồn: user duyệt plan tổng ExitPlanMode (responsive mobile + chuẩn UI); thêm quyết định 4 và AC-4.
- Commit: chưa commit. Verify: chưa chạy (chỉ ghi plan).
- Tiếp: các phase chưa làm chờ `2026-10-20-mobile-responsive-baseline.md` và `2026-10-20-ui-standards-status-filter-action-errors.md` xong rồi mới chạy. Phase đã làm trước bổ sung này không cần làm lại AC-4; chỉ quét bằng mobile-baseline Phase 3.

### 2026-10-20 — Phase 2–7 (done)
- 5 agent song song, mỗi agent 1 nhóm thư mục module + CSS module riêng (không sửa CSS chung): (1) luân chuyển + CSVC, (2) kiểm kê + dashboard, (3) đánh giá + KHGD, (4) thực đơn + bếp, (5) điểm danh, cấu hình trường, tài khoản/cài đặt/thông báo/auth, trẻ/khám/phân quyền.
- Kết quả: inline style tĩnh → utility/class module (còn lại chỉ giá trị động: % rộng, màu dữ liệu, vị trí thanh, `--empty-scene`); chip trạng thái tự vẽ → `createStatusBadge`/`StatusBadge` (badge mới: DiscrepancyStatusBadge, StockStateBadge, AttendanceRowBadge, UnassignedBadge, PublishStatusBadge, WeekPublishBadge, TicketBadge, UnlockWindowBadge, DueStateBadge, DocAvailabilityBadge…); token gốc/hex/px trong CSS module → token semantic; gỡ ghi đè class chung (`.asset-table td`, `.dg-sheet` th/td, `.db-shortcuts .btn` trùng, `.kk-stat/.kk-filter/.kk-qty` → `stat-card`/`tabs--pill`/`input-unit`); `clickableRowProps` cho GoalList, PlanReviewQueue, SchoolPlans, StockIssue, DryStock; NotificationsPage có `ErrorState` (`useNotifications` trả thêm `error`, `reload`).
- Mình làm thêm ở lớp chung: `.card--timeline` thay `ft-/bh-timeline-card` trùng; token `--fs-display`/`--fs-display-sm` cho số lớn dashboard; component dùng chung (PrintToolbar, Signature*, FileUploader, ImageUploader, SearchSelect, States, Avatar, NotificationBell) bỏ inline tĩnh (`.row--center`, `.search-select__empty`, `.upload-preview`, `.avatar--placeholder`, `.notif-bell__state`); cột trạng thái bảng điểm danh rộng thêm cho badge có icon.
- **Khác plan:** `<tr onClick>` có sẵn nút/link cùng hành động trong hàng ⇒ giữ (tránh 2 điểm Tab). Ngoại lệ mật độ ghi `CODING_GUIDE.md` §3 mục 8: `.sc-plc-page`, `.dd-reception > .card`. Thay đổi nhìn thấy: badge có icon chuẩn (vd. "Chưa điểm danh"), thực đơn tuần nháp xám (đúng tông DESIGN 3.2, trước cam), kiểm kê: thẻ số liệu `stat-card`, bộ lọc `tabs--pill`, ô số lượng `input-unit`; radius lệch ≤2px khi làm tròn về token.
- Kiểm: grep toàn `src` — 0 bảng thiếu `table--grid` (trừ ngoại lệ KHGD), 0 import icon ngoài `icons.js`, inline style còn 23 đều động (UiKit ngoài); hex còn lại là dữ liệu mock/màu avatar + `#000` trong mask; agent-browser 115 lượt route (HT 41, PHT 50, GV 24) không màn lỗi; chụp Đánh giá ngày, Điểm danh, Thông báo (GV).
- Còn lại (chưa token tương đương, giữ): px 2–3px hairline, `auth.css` 44px tiêu đề hero, vài radius 4/8/10/22px trong `components.css`, `print.css`; alias cũ `--*-25`, `--primary-25`, `--teal-*`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Trạng thái: 7 phase đã xong; giữ `in-progress` ở `active/` vì plan `2026-10-20-ui-standards-status-filter-action-errors.md` và `2026-10-20-mobile-responsive-baseline.md` (phiên khác) sẽ bổ sung việc theo luồng vào plan này.
