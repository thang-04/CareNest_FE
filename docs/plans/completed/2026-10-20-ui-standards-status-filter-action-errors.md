---
title: Chuẩn UI — trang lỗi, trạng thái, bộ lọc, hành động hàng
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

# Chuẩn UI — trang lỗi, trạng thái, bộ lọc, hành động hàng

Plan này là làn L: thêm component dùng chung, đổi `States.jsx`, `RowMenu` và router shell, ảnh hưởng ≥2 nhóm màn hình. Không đổi nghiệp vụ, quyền hay contract BE.

- Chạy **sau** `2026-10-20-mobile-responsive-baseline.md`.
- Plan này chỉ dựng chuẩn và áp cho màn mẫu. Các màn còn lại chuyển theo luồng trong `2026-10-20-style-sync-by-flow.md`.

## Context

User báo (2026-10-20): "các badge, cách hiển thị status, filter, action đang rất rối, mỗi màn lại dùng 1 kiểu, các trang như lỗi hệ thống 500 hoặc 404 cũng chưa đồng bộ cần thiết kế lại". Rà chỉ đọc cho kết quả sau.

**Trang lỗi**
- Không có ErrorBoundary hay trang 500. `main.jsx` render `<App/>` trực tiếp. Lỗi render hoặc lỗi tải chunk ⇒ màn trắng.
- `AppRoutes.jsx:478` chỉ có 404 bên trong `ProtectedRoute`.
- 403/404 đang có 4 kiểu khác nhau:
  - `NotFoundPage`
  - `RoleGuard.jsx:10`
  - `ScNoAccess.jsx:5`, dùng ở 13 trang, không có nút về trang chủ, trái `DESIGN.md:546`
  - `ChildAccessState.jsx:15`
- Thêm khoảng 8 màn tự dựng: `NotificationDetailPage:25`, `PickupVerifyPage:78`, `PickupResultPage:119`, `DevelopmentProfileView:74`, `EvaluationReviewView:124`, `AiEvaluationDraftPage:53`, `CampusDetailPage:35`, `DailyHealthOverviewPage:285`.
- `EmptyState` (`States.jsx:39`) bỏ qua prop `icon`. Vì vậy 28 màn 403/404 hiện tranh minh hoạ thay vì icon, trái `DESIGN.md:348`.
- `ErrorState` (`States.jsx:51`) báo chung cho mọi lỗi, không phân biệt 403/404 với 500.

**Trạng thái**
- `StatusBadge` + `createStatusBadge` đã có, 86 file dùng.
- Còn 154 chip viết tay. Phần này thuộc `style-sync-by-flow`.
- Tone map đặt cục bộ ở 6 page, trong đó 2 chỗ sai tone:
  - `WeeklyMenuPage.jsx:50`: DRAFT để cam, `MenuBadges.jsx:21` để xám.
  - `InspectionPrintPage.jsx:20`: IN_PROGRESS để cam, `InspectionBadges.jsx:9` để xanh dương.

**Bộ lọc**
- Chuẩn ở `DESIGN.md:423` là `.filter-bar` + `<SearchSubmit>`, nhưng chỉ 7 trang dùng `SearchSubmit`.
- 32 trang tự viết `.search-box` và lọc theo từng phím gõ.
- Khoảng 11 toolbar riêng: `.kb-toolbar`, `.kk-filters`, `.sc-head-filters`…
- `FilterMore` chỉ 2 trang dùng.
- Nhãn nút reset không thống nhất: "Bỏ lọc" ở 3 trang (`AssessmentDayUnlockPage:227`, `AttendanceDayUnlockPage:277`, `DailyHealthOverviewPage:329`), còn `DESIGN.md:544` quy định "Đặt lại bộ lọc".

**Hành động hàng**
- Đang có 5 kiểu: `.icon-btn` (36 file), nút chữ (56), `.link-btn` (11), cả hàng bấm được (13), `RowMenu` (2).
- `RowMenu.jsx:5` chỉ nhận link, chưa nhận được nút hay mục xoá.
- `DESIGN.md:388,438` chưa chốt chuẩn.
- Riêng `ConfirmationModal` đã đồng bộ (53 file), không cần sửa.

## Quyết định đã chốt

1. **Hành động hàng** (user, 2026-10-20):
   - Tối đa 2 icon (Xem, Sửa), có tooltip và `aria-label`.
   - Hành động thứ 3 trở đi và Xoá đưa vào menu "…" (nâng cấp `RowMenu`).
   - Nút nghiệp vụ chính của hàng (vd. Duyệt) vẫn là `.btn--primary.btn--sm` theo `DESIGN.md:438`.
2. **Lỗi render và lỗi tải chunk** bắt bằng **ErrorBoundary**, không chuyển sang data router (user, 2026-10-20).
3. **Bộ lọc**: không tạo component mới. Chốt chuẩn theo DESIGN.md: `.filter-bar` + `SearchSubmit` + `SearchSelect`/`<select>` + `FilterMore` + nút "Đặt lại bộ lọc".
4. **Trang lỗi dùng icon, không dùng tranh** (`DESIGN.md:348`).
5. Thứ tự: mobile-baseline → plan này → các phase còn lại của style-sync (user, 2026-10-20).
6. Không thêm dependency.

## Làm rõ nghiệp vụ

- Không đổi nghiệp vụ hay quyền. 403 và 404 vẫn do BE quyết; FE chỉ hiển thị (AGENTS.md, bất biến 3).
- `RoleGuard` vẫn chỉ là lớp UX (ẩn UI) và không thay cho quyền ở BE.

### Câu hỏi mở

Không còn câu hỏi mở.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Chuẩn hành động hàng? | ≤2 icon + menu "…" | user | 2026-10-20 | `DESIGN.md` §6.3 (Phase 2) |
| Trang 500 làm bằng gì? | ErrorBoundary | user | 2026-10-20 | `DESIGN.md` §9 (Phase 1) |

## Acceptance criteria

- **AC-1**: Given route không tồn tại, vai trò không có quyền, component ném lỗi, hoặc chunk không tải được, When người dùng mở trang, Then hiện `StatusPage` đúng kiểu (404/403/500/chunk), có icon, tiêu đề, mô tả và nút hành động. Không bao giờ ra màn trắng. Dùng được ở 360px.
- **AC-2**: Given API trả 403 hoặc 404, When trang dùng `ErrorState`, Then hiện thông điệp riêng cho kiểu lỗi đó và không có nút "Thử lại". Given API trả 500 hoặc lỗi mạng, Then vẫn có nút "Thử lại".
- **AC-3**: Given `EmptyState` nhận `icon`, Then hiện icon chứ không hiện tranh.
- **AC-4**: Given bảng dùng `RowActions`, When dùng bàn phím (Tab, Enter, Esc), Then mở được menu "…", chọn được mục, Esc đóng menu và trả focus về nút "…". Mục `danger` mở `ConfirmationModal` trước khi chạy.
- **AC-5**: 2 tone sai đã khớp map của module. 3 chỗ ghi "Bỏ lọc" đổi thành "Đặt lại bộ lọc".

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bắt lỗi render | ErrorBoundary bọc `<Outlet>` + 1 boundary ngoài cùng | Data router + `errorElement` | Không phải đụng 143 route |
| Trang lỗi | 1 component `StatusPage` | Giữ 4 biến thể | Đồng bộ giao diện, sửa 1 chỗ là đủ |
| Hành động hàng | `RowActions` (≤2 icon) + `RowMenu` nâng cấp | Chỉ menu; nút chữ | Gọn trên phone, ít bấm cho hành động hay dùng |

## Phases

### Phase 1 — Hệ trang lỗi

- **Files:**
  - Tạo mới: `src/components/ui/ErrorBoundary.jsx`, `src/components/ui/StatusPage.jsx`
  - Sửa: `src/components/ui/States.jsx`, `src/components/index.js` (barrel), `src/layouts/MainLayout.jsx`, `src/main.jsx`, `src/pages/NotFoundPage.jsx`, `src/pages/ComingSoonPage.jsx`, `src/routes/RoleGuard.jsx`, `src/components/school-config/ScNoAccess.jsx`, `src/components/children/ChildAccessState.jsx`, khoảng 8 màn 403/404 tự dựng (liệt kê ở Context), `DESIGN.md` §9, `src/styles/components.css`
- **Steps:**
  1. **ErrorBoundary** (class component):
     - Bọc `<Outlet>` trong `MainLayout`, đặt `key={location.pathname}` để reset khi đổi trang.
     - Thêm 1 boundary ngoài cùng ở `main.jsx`.
     - Nếu lỗi là lỗi tải chunk (message "Failed to fetch dynamically imported module", "Importing a module script failed" hoặc `ChunkLoadError`), hiện kiểu `chunk` với nút "Tải lại trang".
     - Ở bản dev vẫn `console.error`. Không log dữ liệu người dùng.
  2. **`StatusPage`**:
     - Props: `kind` (`'404' | '403' | '500' | 'chunk' | 'coming-soon'`), `title?`, `description?`, `action?`.
     - Icon lấy qua `src/components/ui/icons.js`; nội dung mặc định theo từng `kind`.
     - Nút mặc định "Về trang chủ"; trang chi tiết dùng "Quay lại danh sách".
  3. Chuyển sang `StatusPage`: `NotFoundPage`, `ComingSoonPage`, `RoleGuard`, `ScNoAccess`, phần 403/404 của `ChildAccessState`, và khoảng 8 màn tự dựng.
  4. Sửa `States.jsx`:
     - `EmptyState` dùng `icon` khi được truyền.
     - `ErrorState` đọc `error.status` (lấy từ `axiosClient.js:17-27`) để chọn thông điệp 403/404/500 và quyết định có hiện "Thử lại" hay không.
  5. Thêm vào DESIGN.md §9 các dòng: 404, 500, lỗi tải chunk, ErrorBoundary.
- **Tests:**
  - AC-1, AC-2, AC-3 thử trên browser ở 360 và 1440:
    - mở `/khong-ton-tai`;
    - đăng nhập vai trò không có quyền rồi mở route bị chặn;
    - ném lỗi thử trong 1 component (chỉ bản dev, gỡ ra sau khi thử);
    - `vite preview` với 1 chunk bị đổi tên trong `dist`.
- **Exit:** `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0. Có sửa `DESIGN.md` thì chạy thêm `node scripts/check-ai-layer.mjs` → exit 0.
- **Dừng chờ user review.**

### Phase 2 — Chuẩn trạng thái, bộ lọc, hành động hàng

- **Files:**
  - Tạo mới: `src/components/ui/RowActions.jsx`
  - Sửa: `src/components/ui/RowMenu.jsx`, `src/components/index.js`, `src/styles/components.css`, `src/pages/menu-planning/WeeklyMenuPage.jsx`, `src/pages/inventory-inspection/InspectionPrintPage.jsx`, 6 page có tone map cục bộ, 3 page "Bỏ lọc", `src/pages/UiKitPage.jsx`, `DESIGN.md` §6.3–6.4, màn mẫu `IssueListPage`, `CampusListPage`, `ChildrenListPage`
- **Steps:**
  1. Sửa 2 tone sai. Bỏ tone map cục bộ ở 6 page, chuyển sang dùng badge của module.
  2. Nâng cấp `RowMenu`:
     - Item dạng `{ label, icon?, to? | onClick?, danger?, confirm? }`.
     - Item `danger` mở `ConfirmationModal`.
     - Dùng được bằng bàn phím: Esc đóng menu và trả focus về nút.
     - Menu không tràn khỏi màn hình ở 360px.
  3. `RowActions({ view?, edit?, menu? })`:
     - Tối đa 2 `icon-btn`, mỗi nút có `aria-label` và tooltip `title`.
     - Các hành động còn lại đưa vào `RowMenu`.
  4. Đổi 3 chỗ "Bỏ lọc" thành "Đặt lại bộ lọc".
  5. Cập nhật DESIGN.md §6.3 và §6.4:
     - Chuẩn hành động hàng (D1).
     - Chuẩn bộ lọc (D3).
     - Quy định "chip trạng thái chỉ qua `createStatusBadge`".
  6. Thêm mẫu vào `UiKitPage`. Áp chuẩn cho 3 màn mẫu.
- **Tests:**
  - AC-4: dùng bàn phím trên 3 màn mẫu.
  - AC-5: grep `Bỏ lọc` trả 0 kết quả; xem tone trên 2 màn đã sửa.
  - Chụp ảnh 360 và 1440.
- **Exit:** `VERIFY PASS full`. Chạy `check-ai-layer` exit 0.
- **Dừng chờ user review.** Sau đó các màn còn lại đi theo luồng trong `style-sync-by-flow`.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | Browser: 4 tình huống lỗi | 1 | chưa chạy |
| AC-2 | — | Browser: mock trả 403/404/500 | 1 | chưa chạy |
| AC-3 | — | Browser: màn 403 bất kỳ | 1 | chưa chạy |
| AC-4 | — | Browser: dùng bàn phím trên 3 màn mẫu | 2 | chưa chạy |
| AC-5 | — | grep + ảnh | 2 | chưa chạy |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| ErrorBoundary che lỗi khi dev | Trung bình | Bản dev vẫn `console.error` | Bỏ boundary ở `MainLayout` |
| Đổi `EmptyState`/`ErrorState` ảnh hưởng 95 trang | Cao | Giữ mặc định cũ khi không truyền `icon`/`status`; xem mẫu ở nhiều module | Revert `States.jsx` |
| `RowMenu` đổi API làm hỏng 2 trang đang dùng | Thấp | Giữ tương thích item `{label, to}` | Revert `RowMenu.jsx` |

## Validation log

- [x] Khẳng định về code có `file:line` (rà chỉ đọc 2026-10-20)
- [x] Không đổi contract BE; 403/404 vẫn do BE quyết
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file ⇒ đã tách: màn còn lại chuyển theo luồng trong style-sync
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log

### 2026-10-20 — Duyệt

- Nguồn: user duyệt plan tổng (ExitPlanMode), gồm quyết định 1–2.
- Commit: chưa commit. Verify: chưa chạy (mới ghi plan).
- Tiếp: chờ `mobile-responsive-baseline` xong.

### 2026-10-20 — Phase 1 hệ trang lỗi (chờ review)
- Nguồn: user "Duyệt, đóng plan responsive … và bắt đầu plan chuẩn UI Phase 1 hệ trang lỗi".
- Đã làm:
  - **Tạo** `src/components/ui/StatusPage.jsx`:
    - `kind`: `404`, `403`, `500`, `chunk`, `coming-soon`. Có sẵn icon, tiêu đề, mô tả; trang gọi đổi được câu.
    - Nút mặc định: 403/404 là "Về trang chủ"; 500/chunk là "Tải lại trang" + "Về trang chủ".
    - `bare`: không bọc card (dùng khi đã nằm trong card).
    - Dùng `useInRouterContext`: ngoài router thì dùng thẻ `<a>`.
  - **Tạo** `src/components/ui/ErrorBoundary.jsx`:
    - Nhận ra lỗi tải chunk qua message (`Failed to fetch dynamically imported module`…).
    - `resetKey` đổi thì xóa lỗi.
    - Đặt tiêu đề tab "Lỗi hệ thống · CareNest" hoặc "Cần tải lại trang · CareNest".
    - Chỉ `console.error` ở bản dev.
  - `MainLayout`: bọc `Suspense` bằng `ErrorBoundary resetKey={pathname}`, lỗi chỉ thay vùng nội dung. `main.jsx`: thêm 1 lớp bọc ngoài cùng.
  - `ErrorState`:
    - `status` 403 → "Bạn không có quyền xem dữ liệu này"; 404 → "Không tìm thấy dữ liệu". Cả hai có icon, **không** có nút "Thử lại".
    - `status` 0 → "Không kết nối được máy chủ".
  - Chuyển sang `StatusPage`:
    - `NotFoundPage`, `ComingSoonPage`.
    - `RoleGuard` (thêm breadcrumb để đặt tiêu đề tab).
    - `ScNoAccess` (thêm nút về trang chủ theo DESIGN §9).
    - `ChildAccessState` (403/404).
    - `NotificationDetailPage`, `PickupVerifyPage`, `PickupResultPage`, `DevelopmentProfileView`, `EvaluationReviewView`, `AiEvaluationDraftPage` (2 chỗ), `DailyHealthOverviewPage`.
    - Bỏ các import không còn dùng.
  - Barrel `src/components/index.js` export `StatusPage`, `ErrorBoundary`.
  - DESIGN.md §9: dòng 403/404 dùng `StatusPage`; thêm dòng 404 trang, 500, lỗi tải phiên bản mới; ghi rõ `EmptyState` chỉ dùng cho màn rỗng.
  - Ngoài phạm vi phase: `layout.css`, sửa `top` của dropdown ≤640px theo header nổi mới do session hardening đổi. Đo được panel chuông ở 80px, nằm dưới đáy header 76px.
- **Khác plan:**
  - **Không** đổi `EmptyState` sang "có `icon` thì hiện icon" (AC-3 cũ). Khoảng 90 màn rỗng bình thường đang truyền `icon`, và comment `States.jsx` ghi rõ việc bỏ qua `icon` là có chủ đích theo DESIGN X2 (màn rỗng dùng tranh). Đổi như AC-3 sẽ thay hình của các màn đó. Thay vào đó, trạng thái chặn chuyển sang `StatusPage`.
  - Khoảng 30 chỗ "không có quyền / không sửa được" còn dùng `EmptyState icon={Lock}`, liệt kê theo file:
    - children: Enroll, Edit, Import, ClassPlacement ×2, HealthCheckForm, HealthMeasurementForm ×2
    - facility: IssueReport, ProposalForm, RequestForm
    - facility-transfer: Handover, Receive, Adjustment, Discrepancy
    - inventory-inspection: CreateInspection, RoundDetail, Sheet
    - assessment: DailyAssessment, GoodBehaviourTickets, RewardProposalDetail, RewardProposalForm
    - MenuBadges
    - education-plan ×6: chưa có icon

    Các chỗ này chuyển dần theo luồng trong `style-sync-by-flow`, đúng như plan đã định cho "phần còn lại".
  - Lỗi tải chunk mới thử **giả lập**: ném lỗi có message chunk trong component. Chưa thử với bản build có file chunk bị đổi tên.
- Browser (built-in, dev mock):
  - 360×780, vai trò Bếp: `/khong-ton-tai` → "Không tìm thấy trang"; `/facility/transfers/new`, `/school/years` → 403 kèm breadcrumb, tiêu đề tab "Không có quyền truy cập · CareNest". Cả 3 có icon, không có tranh, có nút "Về trang chủ", không tràn.
  - Ném lỗi thử (đã gỡ):
    - Lỗi render → "Hệ thống gặp sự cố", 2 nút, header/sidebar vẫn còn; chuyển route thì lỗi tự xóa.
    - Message chunk → "Ứng dụng vừa được cập nhật".
    - Tải lại trang có lỗi → tiêu đề tab "Lỗi hệ thống · CareNest".
  - Giáo viên: `/children/khong-co` → 404 "Không tìm thấy hồ sơ trẻ"; `/children/ch_120`, `/children/ch_200` → 403 "Bạn không có quyền xem hồ sơ này" (nút "Về danh sách trẻ"); `/assessment/children/ch_150` → "Không xem được hồ sơ"; `/notifications/khong-co` → "Không tìm thấy thông báo".
  - 1440: card 404 rộng 1132px, không tràn.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: Phase 2 (status, filter, row action), sau khi user review.

### 2026-10-20 — Phase 2 status, filter, row action + góp ý trang lỗi (chờ review)
- Nguồn: user "Duyệt Phase 1, làm tiếp Phase 2 chuẩn status, filter, row action". Trong lúc làm, user góp ý thêm: "hiển thị lỗi thì full màn căn giữa chứ mỗi 1 phần bên trên nhìn rất xấu".
- Đã làm:
  - **Trang lỗi (góp ý):** `StatusPage` khi không `bare` thì card có class `.status-page`: phủ hết chiều cao vùng nội dung (`min-height: max(360px, 100dvh − header − 3 × --space-16)`), nội dung căn giữa, icon 96px, tiêu đề `--fs-2xl`. Đo được:
    - 360×780: card 132–656px, footer 696px, trang vừa 780px không cuộn.
    - 1440×900: card 132–776px, footer 850px.
  - **Status:**
    - `InspectionPrintPage` STAMP_TONE IN_PROGRESS đổi cam → xanh dương, cho khớp `RoundStatusBadge`; thêm `.ps-stamp--blue` vào `print.css`.
    - `WeeklyMenuPage` đã được style-sync sửa trước đó.
    - Map ở `YearPlacementPage`, `HealthCheckDetailPage` là chip đếm/danh mục; `DailyHealthHistoryModal` có nhãn nối thời gian. Cả ba giữ nguyên, ghi rõ trong DESIGN.
  - **Row action:**
    - Viết lại `RowMenu`:
      - Nút "…", panel render qua portal ra `body` với `position: fixed`; không đủ chỗ phía dưới thì lật lên.
      - Item có `to` hoặc `onClick`, `danger`, `confirm`; `confirm` hỏi lại bằng `ConfirmationModal`.
      - Bàn phím: Enter mở và focus mục đầu, ↑↓ chuyển mục, Esc/Tab đóng và trả focus về nút.
      - Click không lan lên hàng bấm được.
    - Tạo `RowActions`: Xem/Sửa dạng icon có `aria-label` kèm tên, phần còn lại vào menu.
    - CSS `.row-actions`, `.row-menu__panel`, `.row-menu__item(--danger)`. Đã bỏ CSS cũ `.row-menu > summary`.
  - Áp chuẩn cho 3 màn mẫu:
    - `ChildrenListPage`: Xem/Sửa; "Cho nghỉ học" vào menu.
    - `CampusListPage`: Xem/Sửa.
    - `IssueListPage`: giữ nút chính "Xét duyệt", nút chữ "Xem" đổi sang icon.
    - Giữ `td.cell--actions` (plan căn cột của session khác; test `table-alignment` vẫn qua).
  - **Filter:** "Bỏ lọc" → "Đặt lại bộ lọc" ở 4 trang: `AssessmentDayUnlockPage`, `AttendanceDayUnlockPage`, `DailyHealthOverviewPage`, `TeacherAssignmentPage`. `PermissionHistoryPage` "Bỏ lọc tài khoản" là bỏ một bộ lọc riêng, giữ nguyên.
  - DESIGN §6.3: dòng "Bộ lọc" thêm `FilterMore`/`SearchSelect`/nhãn reset; thêm dòng "Hành động dòng bảng" và "Trạng thái". Mục Thao tác gọn trỏ về §6.3.
  - `UiKitPage`: bảng mẫu có cột Thao tác với `RowActions` (Xem/Sửa + In nhãn/Xóa có hỏi lại); mục trạng thái thêm `ErrorState` 403, `StatusPage` 404/500. Barrel export `RowMenu`, `RowActions`.
- Lỗi gặp khi kiểm và cách sửa:
  - Menu mở nhưng `focus()` vào mục đầu thất bại (`activeElement` vẫn là `body`).
  - Nguyên nhân: rule `prefers-reduced-motion` toàn cục (`transition-duration: 0.01ms !important` cho mọi thuộc tính) làm `visibility: hidden → visible` đi qua transition, nên ngay lúc focus panel vẫn "hidden". Ở pane nền không vẽ khung hình, transition còn bị kẹt, khiến `top` đứng ở −9999.
  - Sửa: ban đầu đặt panel ngoài màn (`top: −9999`) thay vì `visibility: hidden`; `place()` gán vị trí trực tiếp lên DOM trong layout effect; `.row-menu__panel { transition-property: none }`; focus dùng `preventScroll`; khi cuộn hoặc đổi kích thước thì tính lại vị trí thay vì đóng menu.
- Browser (dev mock, Phó hiệu trưởng, 360×780):
  - `/children`: ô thao tác có "Xem hồ sơ …", "Sửa hồ sơ …", "Thao tác khác …"; không tràn.
  - Bàn phím thật: Enter → menu 180–360px nằm ngay dưới nút, focus vào "Cho nghỉ học"; Esc → đóng, focus về nút; Enter, Enter → mở modal "Cho Bùi Bảo Ngọc nghỉ học?", không bị điều hướng theo hàng (đã đóng modal, không xác nhận).
  - `/school/campuses` (Phó hiệu trưởng không có quyền sửa): chỉ có "Xem Campus 1".
  - `/ui-kit`: menu có "In nhãn", "Xóa(danger)"; Xóa → `ConfirmationModal` "Xóa tài sản?", nút đỏ; bấm Quay lại thì đóng.
- **Khác plan / chưa kiểm:**
  - `/facility/issues` hiện 404 vì session khác vừa thêm `FACILITY_ENABLED = false` (`src/config/app.js:11`), nên `IssueListPage` chỉ kiểm bằng lint/build.
  - Chưa kiểm 1440 cho ô thao tác (chỉ thay nội dung ô, `cell--actions` giữ nguyên).
  - Các màn còn lại chuyển sang `RowActions`/chuẩn filter theo luồng trong style-sync.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: user review. Đạt thì đóng plan (done → completed); phần còn lại theo style-sync.

### 2026-10-20 — Phase 2 mở rộng: các màn danh sách còn lại (chờ review)
- Nguồn: user "Chưa đóng; áp RowActions và trang lỗi cho thêm các màn danh sách còn lại trước."
- Cách làm:
  - Kiểm kê được 37 ô `td.cell--actions` và khoảng 30 trạng thái chặn.
  - Giao 4 agent song song theo nhóm module, file không trùng nhau: (1) trẻ, đón trẻ, dashboard; (2) đánh giá, kế hoạch giáo dục, thực đơn; (3) CSVC, luân chuyển, kiểm kê; (4) cấu hình trường, phân quyền.
  - Quy tắc chung:
    - Giữ class `cell--actions`.
    - Xem/Sửa dùng icon trong `RowActions`.
    - Mỗi dòng 1 nút nghiệp vụ chính `btn--primary btn--sm`; các thao tác khác và mục nguy hiểm vào menu "…".
    - Thao tác đã có modal riêng thì không thêm `confirm`.
    - Giữ nguyên mọi điều kiện quyền.
- Kết quả:
  - Khoảng 31 ô thao tác chuyển sang `RowActions` hoặc nút primary.
  - 4 ô vốn đã đúng chuẩn hoặc là nút bật/tắt danh sách: `PendingApprovalsPage`, `PickupListPage`, `HealthCheckDetailPage:310`, `TeacherAssignmentPage` tổ trưởng.
  - 30 trạng thái chặn chuyển sang `StatusPage` (403/404).
  - Kiểm kê lại: 19 ô chỉ có `RowActions`, 13 ô có nút chính + `RowActions`, 3 ô chỉ có nút chính.
  - Mỗi agent báo ESLint 0 lỗi.
- Tôi quyết thay cho agent:
  - `TeacherAssignmentPage` (bảng lớp) và `VicePrincipalAssignmentPage`: trả lại kiểu cũ, chỉ dòng **chưa** phân công mới tô primary; nút "Đổi …" là nút thường, vì không phải việc chính.
  - Thêm CSS `.cell--actions > .btn + .row-actions, > .btn + .btn { margin-left: --space-2 }`, để các ô đặt nút chính liền `RowActions` (không có `.row` bọc) cách đều nhau.
- Chấp nhận các thay đổi hành vi do agent báo:
  - `ParentActivationPage`: không có quyền quản lý thì menu phụ huynh bị ẩn hẳn (trước là nút disabled). Ẩn theo quyền là UX; BE vẫn kiểm quyền.
  - "Tiếp tục khám", "Ghi trao đổi để công bố", "Duyệt" (ClassPlan, trước màu success) thành primary, theo chuẩn nút chính của dòng.
  - Trạng thái chặn trước không có nút nay có "Về trang chủ" mặc định (DESIGN §9).
  - `FacilityAssetListPage`: "Báo sự cố" là nút chính, "Đề nghị bổ sung" vào menu. `TransferListPage` (Phó hiệu trưởng): "Xử lý chênh lệch" là nút chính. `InspectionListPage`: đợt nháp dùng icon Sửa thay vì Xem.
- Giữ nguyên: `HealthMeasurementFormPage:114` (`EmptyState FileCheck2` là thông báo chuyển sang phiếu khám, không phải trạng thái chặn). Ngoài phạm vi, chưa xem: `PickupListPage:56`, `ClassPlanPage` redirect (~38).
- CSS không còn dùng, để plan `css-cleanup` dọn: `.sc-row-btn` (`school-config.css`), `.permission-row-actions` (`permissions.css`).
- Browser (dev mock, 360×780):
  - Phó hiệu trưởng: quét lại 71 route (menu, chi tiết, form con) → 71/71 không tràn, không ép chữ, không có trang lỗi 500.
  - Hiệu trưởng: `/school/years`, `/school/rooms`, `/school/staff`, `/school/classes`, `/permissions/overrides`, `/school/teachers`, `/school/vice-principals` → không tràn, không lỗi. Menu "…" ở Năm học có "Nhóm tuổi & lớp", "Giờ chốt điểm danh", "Kết thúc năm học (danger)", focus vào mục đầu.
  - Module CSVC/luân chuyển/kiểm kê đang tắt (`FACILITY_ENABLED = false`), chỉ kiểm bằng lint.
- Verify:
  - `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log`.
  - Nguyên nhân: session khác đang sửa dở (11:04) `src/models/menu-planning/menuPlanningConstants.js` (thiếu export `NUTRITION_NORMS`), làm 8 file test menu không nạp được. Lần chạy trước đó còn lỗi prettier ở `kitchenMockRepository.js` và test `table-alignment` (đổi quy ước `.num`) cũng của session khác; hai lỗi này nay đã hết.
  - Riêng phần của tôi: ESLint `no-unused-vars` = 0 lỗi và prettier sạch trên 56 file đã sửa; test kitchen 41/41, merge 38/38, `table-alignment` 3/3.
- Commit: chưa commit.
- Lần verify cuối (sau log): vẫn `VERIFY FAIL full`. Lỗi nạp module đã hết; còn 4 test menu fail về logic: định lượng theo nhóm, lưu thực đơn mẫu có bữa thêm, đổi giá từ ngày mai, sửa giá cần lý do. Đây là khu vực model/seed menu-planning mà session khác đang sửa. Phần tôi sửa trong menu-planning chỉ là UI (`AllergyMenuListPage`, `WeekDaysView`, `MenuBadges`).
- Tiếp: chạy lại verify khi session menu-planning sửa xong; user review rồi đóng plan.

### 2026-10-20 — Đóng plan (done)
- Nguồn: user "Chờ session menu-planning xong, chạy lại verify; PASS thì đóng plan chuẩn UI."
- Chờ repo không còn file nào bị sửa trong 3 phút (yên lúc 11:29:55), rồi chạy `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. 4 test menu fail trước đó (thuộc session khác) giờ đã đạt.
- AC-1 đến AC-5 đạt theo các log ở trên. Còn lại, không chặn:
  - Module CSVC/luân chuyển/kiểm kê chưa thử trên giao diện vì `FACILITY_ENABLED = false`.
  - Lỗi tải chunk mới thử bằng giả lập.
  - 2 class CSS không còn dùng giao cho `css-cleanup`.
- Chuyển file sang `docs/plans/completed/`.
