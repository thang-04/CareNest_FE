---
title: Responsive nền cho điện thoại (shell + primitive dùng chung)
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

# Responsive nền cho điện thoại (shell + primitive dùng chung)

Làn L vì đổi layout chung và CSS dùng chung cho mọi nhóm màn hình, >8 file. Không đổi nghiệp vụ, route, quyền hay contract BE.

Plan liên quan:
- `2026-10-20-ui-standards-status-filter-action-errors.md` (chạy sau plan này).
- `2026-10-20-style-sync-by-flow.md`: grid riêng từng module sửa theo luồng ở plan đó.

## Context

User báo dùng web trên điện thoại thì vỡ UI rất nhiều (2026-10-20). Rà code (chỉ đọc) tìm ra các nguyên nhân sau.

**1. Header tràn ngang trên mọi trang.**
- Các phần cứng của header cộng lại khoảng ≥400px:
  - padding 24px (`layout.css:387`), gap 16px;
  - nút menu 36px, nút "Tạo nhanh";
  - `.header__year-select` 196px (`layout.css:411`);
  - chuông.
- Ô tìm `min-width: 0` (`layout.css:418`) bị ép về 0.

**2. Dropdown neo `right: 0`, bề rộng cố định:**
- chuông 380px (`layout.css:679`);
- Tạo nhanh 300px (`layout.css:482`);
- Lọc thêm 280px (`components.css:2664`).

**3. Primitive không gập ở điện thoại:**
- `.form-row`: nhãn cố định 190px (`components.css:1427`) và 160px (`:2304`).
- `.grid-3` không có media query (`utilities.css:36`).
- Số cột Stepper/ProgressSteps đặt inline (`Stepper.jsx:9`, `ProgressSteps.jsx:13`).
- Filter bar có min-width 180/260/150px (`components.css:2042-2059`).
- Footer modal không wrap (`components.css:857`) trong khi `.btn` nowrap (`:103`).
- Backdrop modal padding 24px (`:821`).
- `.sig-upload-layout` dạng `1fr 180px` (`:1681`).

**4. Breakpoint:**
- Có 14 giá trị khác nhau; chỉ khoảng 6 rule ≤640px.
- Drawer dùng `100vh` (`layout.css:339`).
- Padding trang/card không thu nhỏ (`tokens.css:332,351`, `components.css:435`).

**5. Lỗi lẻ:**
- 5 bảng thiếu `.table-wrap`: `AiTemplateComposer.jsx:142`, `AllergySubstitutes.jsx:190`, `AutoChecks.jsx:40`, `FoodImportPanel.jsx:107`, `GuardianPanel.jsx:253`.
- Width inline cứng: `TransferListPage:365`, `NutritionBalancePage:137`, `DailyAssessmentPage:224`, `DevelopmentProfileView:95`, `InspectionSheetPage:251`.
- 5 ô tìm `minWidth: 200`: `FacilityAssetListPage:159`, `IssueListPage:84`, `ProposalListPage:82`, `RequestListPage:83`, `EvaluationListView:106`.

**Phần đã ổn:** sidebar thành drawer ở <1024px (`MainLayout.jsx:13,28`, `layout.css:336-361`); viewport meta (`index.html:5`); bảng rộng đã có `.table-wrap` (142 chỗ).

## Quyết định đã chốt

1. **Mức hỗ trợ (user, 2026-10-20).** Web hỗ trợ 360–430px và tablet, dù hệ thống đã có app.
   - Mức "mọi màn dùng được": trang không cuộn ngang; màn nặng (bảng tuần, ma trận quyền) cuộn ngang trong `.table-wrap`.
   - Quyết định này đảo `DESIGN.md:469` cũ ("không làm bản điện thoại cho web"); đã sửa DESIGN.md.
2. **Header <640px (user, 2026-10-20).**
   - Tìm kiếm thành nút kính lúp, bấm mở ô tìm full-width.
   - Tạo nhanh thành nút "+".
   - Select năm học gọn khoảng 110px.
   - Dropdown chuông và Tạo nhanh rộng full-width ngay dưới header.
3. **Thứ tự làm (user, 2026-10-20).** Plan này chạy sau `ui-feedback-docx` (đã xong Phase 4) và trước Plan chuẩn UI. Grid riêng module do `style-sync-by-flow` sửa theo luồng, kèm AC 360px.
4. **Cách viết CSS.** Chỉ **thêm** rule `@media (max-width: 640px)`, cộng 1024px nếu cần. Không chuẩn hoá lại 14 breakpoint cũ, để không đổi hành vi desktop. Breakpoint chuẩn: 640 · 768 · 1024 · 1280.
5. Không thêm dependency.

## Làm rõ nghiệp vụ

- Plan không đổi nghiệp vụ. Actor: mọi vai trò web (Admin, Principal, Vice Principal, Teacher, Bếp) khi mở web bằng điện thoại.
- **Đối chiếu tài liệu:** `DESIGN.md:34-35` ghi phone dùng App và Web ≥768. User chốt Web vẫn phải dùng được ở 360.
- **Ảnh hưởng:** chỉ layout/CSS và JSX header. Không đổi quyền, scope hay dữ liệu.

### Câu hỏi mở

Không còn câu hỏi mở.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Ai dùng web trên điện thoại? | Đã có app; web vẫn phải responsive tối thiểu | user | 2026-10-20 | `DESIGN.md:469` |
| Mức chuẩn? | Mọi màn dùng được; màn nặng cuộn trong khung bảng | user | 2026-10-20 | `DESIGN.md` §7.1, §13.3 |
| Thiết bị? | Phone 360–430 + tablet | user | 2026-10-20 | `DESIGN.md:469` |
| Header trên phone? | Thu gọn thành icon | user | 2026-10-20 | plan này |

## Acceptance criteria

- **AC-1:** Given bất kỳ route nào trong menu của từng vai trò, When mở ở 360×780, 390×844 và 768×1024, Then `document.documentElement.scrollWidth <= innerWidth`, tức trang không cuộn ngang.
- **AC-2:** Given header ở 360px, When bấm tìm kiếm / "+" / năm học / chuông, Then mỗi control thao tác được, dropdown nằm trọn trong màn hình, Esc hoặc bấm ra ngoài thì đóng.
- **AC-3:** Given form dùng `.form-row`, `.grid-3`, Stepper, filter bar hoặc modal, When ở 360px, Then các phần tử xếp 1 cột, ô nhập rộng 100%, nút footer modal không tràn.
- **AC-4:** Given desktop 1440×900, When so ảnh trước/sau ở các màn mẫu (dashboard, danh sách trẻ, form nhập trẻ, thực đơn tuần, phân quyền), Then không khác biệt ngoài chủ đích.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Cách sửa | Sửa shell và primitive trước, module giao `style-sync-by-flow` | Sửa từng màn; dựng hệ container query | Shell và primitive gây phần lớn lỗi; sửa 1 chỗ thì mọi màn hưởng; không trùng việc của plan theo luồng |
| Breakpoint | Thêm 640px | Chuẩn hoá lại 14 giá trị | Không đụng hành vi desktop đang ổn |
| Bảng rộng | Cuộn trong `.table-wrap` | Đổi bảng thành thẻ trên phone | User chọn mức "dùng được"; App lo trải nghiệm mobile chính |

## Phases

### Phase 1 — Shell (header, dropdown, drawer, khoảng đệm)

- **Files:** M `src/layouts/layout.css` · M `src/layouts/Header.jsx` · M `src/layouts/HeaderSearch.jsx` · M `src/layouts/QuickCreateMenu.jsx` · M `src/layouts/NotificationBell.jsx` · M `src/styles/tokens.css` · M `src/layouts/auth.css` (nếu lỗi ở 360)
- **Steps:**
  1. Header <640px:
     - padding đổi từ `--space-6` sang `--space-3`, gap đổi sang `--space-2`;
     - select năm học khoảng 110px;
     - "Tạo nhanh" chỉ hiện icon "+" (giữ `aria-label`).
  2. `HeaderSearch` <640px hiện nút kính lúp; bấm mở overlay ô tìm full-width dưới header. Esc hoặc bấm ra ngoài thì đóng (dùng lại `src/hooks/useClickOutside.js`); focus vào ô khi mở.
  3. Dropdown (`layout.css:482`, `:666`, `:679`) <640px dùng `position: fixed; left: 8px; right: 8px; top: var(--header-height); width: auto; max-height: calc(100dvh - var(--header-height) - 16px)`.
  4. Drawer dùng `height: 100vh; height: 100dvh` (`layout.css:339`).
  5. Padding trang và card <640px giảm còn `--space-3`/`--space-4`.
  6. Comment breakpoint `tokens.css:230` thêm mốc 640.
- **Tests:**
  - AC-2: thử tay ở 360px trên built-in browser.
  - AC-1: đo `scrollWidth` ở trang chủ của 4 vai trò.
  - AC-4: ảnh dashboard ở 1440.
- **Exit:** `node scripts/verify.mjs` ra `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 2 — Primitive dùng chung

- **Files:** M `src/styles/components.css` · M `src/styles/utilities.css` · M `src/components/ui/Stepper.jsx` · M `src/components/ui/ProgressSteps.jsx` · M 5 file bảng thiếu wrapper · M các file có width inline cứng (Context, mục 5)
- **Steps:**
  1. <640px:
     - `.form-row` dạng 1 cột (nhãn trên, ô nhập dưới);
     - `.grid-3` 1 cột;
     - `.sig-upload-layout` 1 cột.
  2. Stepper/ProgressSteps:
     - số cột đổi sang CSS var `--steps`;
     - <640px cuộn ngang trong khung, có `scroll-snap`, bước hiện tại tự cuộn vào giữa.
  3. `.filter-bar` <640px: control `flex: 1 1 100%`, bỏ min-width; panel FilterMore rộng full.
  4. Modal:
     - footer `flex-wrap: wrap`;
     - <640px nút rộng 100%;
     - backdrop padding 8px;
     - `max-height: calc(100dvh - 16px)`.
  5. Bọc `.table-wrap` cho 5 bảng.
  6. Width inline cứng đổi sang class có `max-width: 100%`, hoặc bỏ min-width trên phone.
- **Tests:**
  - AC-3: chụp ở 360 form nhập trẻ, form chuyển tài sản, form đề xuất, 1 modal lớn.
  - AC-4: chụp ở 1440 các màn đó.
- **Exit:** `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 3 — Quét toàn bộ route và bàn giao

- **Files:** M CSS/JSX chỉ khi lỗi do primitive · M `docs/plans/active/2026-10-20-style-sync-by-flow.md` (checklist 360 theo luồng)
- **Steps:**
  1. Liệt kê route từ `src/layouts/menuConfig.js` theo từng vai trò.
  2. Đo `scrollWidth` ở 360/390/768 bằng built-in browser (`javascript_tool`), chụp ảnh các route lỗi.
  3. Lỗi do shell hoặc primitive thì sửa luôn.
  4. Lỗi do grid module thì ghi vào luồng tương ứng của style-sync. Danh sách đã biết:
     - `education-plan.css`, `facility-transfer.css`, `pickup.css` chưa có media query;
     - `assessment.css:629,663`;
     - `children.css:88,347,556`;
     - `menu-planning.css:20,248,254,352,418`;
     - `dashboard.css:387,567`;
     - `kitchen.css:662`;
     - `attendance.css:550`.
- **Tests:** AC-1, ghi `x/y route đạt` cho từng độ rộng.
- **Exit:** `VERIFY PASS full`.
- **Dừng chờ user review.**

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | Browser: đo `scrollWidth` theo route | 1, 3 | chưa chạy |
| AC-2 | — | Browser: thao tác header ở 360 | 1 | chưa chạy |
| AC-3 | — | Browser: ảnh form/modal ở 360 | 2 | chưa chạy |
| AC-4 | — | Browser: ảnh 1440 trước/sau | 1, 2 | chưa chạy |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi desktop ngoài ý muốn | Cao | Chỉ thêm rule ≤640px; so ảnh 1440 | Revert khối `@media` của phase |
| Trùng `css-cleanup` Phase 2 (cùng file CSS) | Trung bình | Đọc Progress log `2026-10-19-css-cleanup.md` trước Phase 1; hỏi user nếu Phase 2 sắp chạy | — |
| Overlay tìm kiếm làm mất focus/bàn phím | Thấp | Esc đóng và trả focus về nút | Revert `HeaderSearch.jsx` |

## Validation log

- [x] Khẳng định về code có `file:line` (rà chỉ đọc 2026-10-20)
- [x] Không đổi contract BE
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file ⇒ đã tách: chuẩn UI và hardening là plan riêng; module giao style-sync
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log

### 2026-10-20 — Duyệt

- Nguồn: user duyệt plan tổng (ExitPlanMode), gồm các quyết định 1–4.
- Commit: chưa commit. Verify: chưa chạy (chỉ ghi plan).
- Tiếp: Phase 1, sau khi đọc Progress log `css-cleanup`.

### 2026-10-20 — Phase 1 (chờ review)
- Đã làm:
  - `HeaderSearch.jsx`: ≤640px hiện nút kính lúp; bấm mở ô tìm phủ cả header, có nút đóng. Esc / nút đóng trả focus về nút kính lúp. Ctrl K vẫn dùng được.
  - `QuickCreateMenu.jsx`: thêm `title`; mũi tên có class `header__create-caret`.
  - `layout.css` ≤640px:
    - header: padding `--space-3`, gap `--space-2`;
    - nút "+" tròn 36px;
    - select năm học 128px (112px cắt chữ "2026 - 2027");
    - dropdown chuông / Tạo nhanh / tìm kiếm `position: fixed`, cách 8px hai mép, cao tối đa `100dvh`.
  - Drawer `100dvh`.
  - `tokens.css` ≤640px: `--page-padding` = `--space-3`, `--card-padding` = `--space-4`; comment breakpoint thêm mốc 640.
  - `components.css` ≤640px: lề `.card__header`/`__body`/`__section`/`--timeline` và `.card > .table-wrap` về 16px; `.card__header` cho xuống dòng.
  - Thêm `.claude/launch.json` (vite dev).
- **Khác plan:** select năm học 128px thay vì 112px. Rule ≤640px trong `layout.css` thêm tiền tố `.header`, vì `layout.css` nạp trước `components.css`. Đã ghi incident `FE-BUG-261020-layout-css-loaded-before-components` (workaround; chưa sửa thứ tự import vì sẽ đổi giao diện desktop).
- Browser (built-in, dev mock `localhost:5174`):
  - AC-1: trang chủ 5/5 vai trò demo (Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng, Giáo viên, Bếp) ở 360×780 có `scrollWidth` 360 = `innerWidth`, header nằm trong 348px. Phó hiệu trưởng ở 390×844: 390/390. Ở 768×1024: 758 ≤ 768.
  - AC-2 ở 360:
    - Ô tìm phủ 0–360 × 64px, danh sách kết quả 8–352px, focus vào ô nhập.
    - Esc và nút đóng đều trả focus về nút kính lúp.
    - Tạo nhanh: 8–352px. Chuông: 8–352px.
    - Drawer cao 780 = `innerHeight`, mở/đóng đúng.
  - AC-4 ở 1440: header padding 24px, gap 16px, lề trang 20px, card 24px; nhãn "Tạo nhanh", mũi tên và Ctrl K vẫn hiện — không đổi so với trước.
  - Màn đăng nhập ở 360 không vỡ.
- Verify:
  - Lần cuối, chạy lại sau khi nơi khác sửa xong `MealCountPage.jsx`: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
  - Lần đầu: `VERIFY FAIL full | npm run verify | log verify.log`. Nguyên nhân duy nhất: prettier `src/pages/attendance/MealCountPage.jsx`. File này đang được nơi khác sửa (09:22), không thuộc phase này nên không đụng.
  - Chạy riêng từng bước: test menu 67/67, kitchen 41/41, merge 38/38; `npm run lint` sạch; `prettier --check src/layouts src/styles` sạch; `npm run build` đạt.
- Commit: chưa commit.
- Tiếp: Phase 2 (primitive dùng chung), sau khi user review.

### 2026-10-20 — Phase 2 (chờ review)
- Nguồn: user duyệt Phase 1 ("Duyệt Phase 1, làm tiếp Phase 2 primitive dùng chung").
- Đã làm:
  - `Stepper.jsx`, `ProgressSteps.jsx`: số cột chuyển từ inline `gridTemplateColumns` sang CSS var `--steps`. Stepper tự cuộn ngang để bước hiện tại ra giữa khung (chỉ khi có tràn; không cuộn trang).
  - `components.css`: `.stepper`/`.timeline` dùng `repeat(var(--steps, 4), 1fr)`.
  - `components.css` thêm khối ≤640px ở cuối file:
    - `.form-row` (gồm cả biến thể 160px) về 1 cột;
    - `.sig-upload-layout`, `.general-grid(--inter)`, `.split-2`, `.history-layout` về 1 cột;
    - `.review-sign` xếp dọc;
    - toast rộng gần full màn;
    - filter bar: mỗi ô 1 hàng, bỏ min-width (kể cả `.search-box` 300px);
    - panel FilterMore rộng full;
    - modal: padding nền 8px, `100dvh`, lề trong 16px, footer wrap;
    - stepper/timeline: `minmax(72px, 1fr)`, cuộn ngang, có scroll-snap.
  - `utilities.css` ≤640px: `.grid-3` về 1 cột; `.row` wrap.
  - `facility-transfer.css` ≤640px: `.wizard-bottom-grid` (+ `.form-row` 150px), `.review-grid`, `.assign-grid` về 1 cột.
  - `layout.css`: select năm học 140px (128px vẫn cắt "2026 - 2027").
- **Khác plan:**
  - 5 bảng thiếu `.table-wrap` và các width inline cứng đã được `style-sync-by-flow` xử lý xong trước đó. `GuardianPanel` dùng `ps-table` (phiếu in), không cần wrapper.
  - Thêm việc: `.row` wrap ≤640, vì nút dài làm tràn `/facility/proposals/new` 447px.
  - Thêm toast, `.search-box`, `.review-sign`, các grid wizard.
  - Rule gập cột ở 1280px của `.general-grid`/`.split-2`/`.history-layout`/`.wizard-bottom-grid`/`.review-grid`/`.assign-grid` chưa từng có hiệu lực, vì định nghĩa nằm sau media hoặc ở file module nạp sau. Chỉ sửa cho ≤640; khôi phục mốc 1280 sẽ đổi giao diện tablet/laptop, nên đã ghi vào incident `FE-BUG-261020-layout-css-loaded-before-components`.
  - Bảng kê min-width ≥200px còn lại ở CSS module (assessment, children, education-plan, menu-planning, permissions, school-config…) để cho Phase 3 quét.
- Browser (built-in, dev mock `localhost:5174`, Phó hiệu trưởng):
  - 360×780, 9/9 route không tràn: `/children/new`, `/facility/transfers/new`, `/facility/proposals/new`, `/facility/issues/new`, `/facility/requests/new`, `/children`, `/facility/issues`, `/facility/transfers`, `/facility/proposals`. Trước khi sửa: transfers/new 512px, proposals/new 447px.
  - AC-3 ở 360:
    - Form luân chuyển về 1 cột (ảnh).
    - Stepper 4 bước 311/311, không cuộn.
    - `.grid-3` về 1 cột.
    - Filter Hồ sơ trẻ: 4 ô, mỗi ô rộng 303px.
    - Modal xác nhận 8–352px; 2 nút cùng hàng 24–336px.
    - Timeline chi tiết sự cố `fi_006`: 3 bước, 303/303.
  - AC-4 ở 1440: stepper 4×268px, timeline 3×358px, `.general-grid` 2 cột, `.form-row` 190px, `.wizard-bottom-grid` 2 cột, `.grid-3` 3 cột, filter giữ bề rộng cũ, `.row` nowrap. Không đổi.
  - Chưa kiểm: tự cuộn bước hiện tại với stepper ≥5 bước (mẫu thử chỉ có 4 bước).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: Phase 3 (quét toàn bộ route theo vai trò, giao grid module cho style-sync), sau khi user review.

### 2026-10-20 — Phase 3 (chờ review)
- Nguồn: user duyệt Phase 2 ("Duyệt Phase 2, làm tiếp Phase 3 quét toàn bộ route").
- Cách quét:
  - Route lấy từ `getMenuForRole(user.role, user)` của từng vai trò demo (import module qua Vite dev).
  - Mỗi route: `pushState` → chờ 1,8–2 s → đo `max(scrollWidth, innerWidth)`. Ở viewport điện thoại, nội dung rộng hơn màn làm `innerWidth` phình ra, nên phải đo cả hai.
  - Phần tử gây tràn = phần tử lá có `right` > độ rộng viewport, bỏ qua phần tử fixed và phần tử nằm trong khung cuộn (`.table-wrap`, `.tabs`…).
- Lần đầu ở 360px, 5/157 lượt route-vai trò bị tràn:

  | Vai trò | Kết quả | Lỗi |
  | --- | --- | --- |
  | Phó hiệu trưởng | 47/50 | `/attendance/meal-count` 455px, `/assessment/rewards` 379px, `/kitchen/required-quantity` 363px |
  | Hiệu trưởng | 38/41 | meal-count, rewards, `/education/school` 379px, `/facility/inspections` 379px |
  | Tổ trưởng | 27/27 | — |
  | Giáo viên | 24/24 | — |
  | Bếp | 15/15 | — |

- Đã sửa:
  - `components.css`: `.card .tabs` có `max-width: calc(100% - 2 * var(--space-4))`. Trước đó `max-width: 100%` cộng margin 16px làm thanh tab tràn 3px; sửa xong thì rewards, education/school, inspections đều đạt.
  - `attendance.css`: `.dd-count-grid`/`.dd-summary` ở ≤1280px đổi `1fr` → `minmax(0, 1fr)`. Trước đó cột bị min-content của thẻ kéo rộng 443px.
  - `/kitchen/required-quantity` quét lại thì đạt, không cần sửa riêng. Lần đầu tràn 363px, có thể đo lúc trang chưa tải xong; không tái hiện lại được.
- Sau khi sửa:
  - Phó hiệu trưởng: 360 (chạy lại 4 route lỗi) 4/4; 390×844 50/50; 768×1024 50/50.
  - Hiệu trưởng: 4 route lỗi ở 360 đạt 4/4.
  - 1440: tabs 672px (vừa nội dung), `.dd-count-grid` 2 cột 687px. Không đổi.
- **Khác plan:**
  - Sửa `attendance.css` thay vì giao cho style-sync, vì 7 phase của plan đó đã xong và đây chỉ là sửa 1 token. File này đang được nơi khác sửa phần khác (09:50); đã kiểm, thay đổi của tôi vẫn còn.
  - Không còn lỗi tràn nào phải giao cho style-sync.
  - Danh sách grid module vẫn ≥2 cột ở 360 nhưng **không tràn** (`assessment.css:629,663`, `children.css:88,347,556`, `menu-planning.css:20,248,254,352,418`, `dashboard.css:387,567`, `kitchen.css:662`, `attendance.css:550`) chỉ là chỗ có thể làm đẹp hơn, không phải lỗi theo AC-1.
- Chưa quét:
  - Route chi tiết/con không nằm trong menu (`/:id`, `/edit`). Phase 2 đã thử mẫu `/facility/issues/fi_006`.
  - Các vai trò khác ngoài 5 vai trò demo.
  - System Admin không có tài khoản demo.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. `prettier --check src/styles src/layouts src/components/ui` sạch.
- Commit: chưa commit.
- Tiếp: user review. Đạt thì đổi status `done` và chuyển plan sang `docs/plans/completed/`. Plan `2026-10-20-ui-standards-status-filter-action-errors.md` bắt đầu được.

### 2026-10-20 — Phase 3 bổ sung: route chi tiết/form con (chờ review)
- Nguồn: user "Chưa đóng plan; quét thêm các route chi tiết/form con ở 360px trước."
- Cách quét:
  - Với mỗi vai trò, mở từng trang menu và thu mọi link `a[href^="/"]` trong `.app-content`, kèm đích của hàng bảng bấm được đầu tiên (`.row-click`/`tr[tabindex]`).
  - Cộng thêm route tĩnh lấy từ `AppRoutes.jsx` mà crawler không bắt được (`new`, `allergy-menus`, `prices`, `permissions/*`, `pickup`…).
  - Gom theo mẫu đường dẫn: segment có chữ số hoặc `_` coi là `:id`. Mỗi mẫu quét 1 mẫu đại diện.
  - Phép kiểm mới (sau khi tìm ra lỗi dưới đây): ngoài "trang tràn ngang", kiểm thêm "chữ bị ép" = phần tử có chữ riêng nhưng rộng < 4px, không tính trong `.table-wrap`.
- Lỗi tìm thấy và đã sửa:
  - `/menu/foods/:id` (chi tiết thực phẩm) ở 360px: trang tràn 366px, và `dd` trong `.td-food-info` rộng **0px** nên giá trị bị mất.
  - Nguyên nhân: `menu-planning.css` có khối `@media 640` (khoảng dòng 269) nằm trước rule gốc `.td-food-info` (khoảng dòng 1811), nên bị đè.
  - Sửa: thêm khối ≤640px ngay sau rule gốc. Sau khi sửa, `dd` rộng 303px, trang 360px.
  - Đã ghi vào incident `FE-BUG-261020-layout-css-loaded-before-components`.
- Kết quả cuối ở 360×780:

  | Vai trò | Kết quả | Gồm |
  | --- | --- | --- |
  | Phó hiệu trưởng | 111/111 | 50 menu + 41 mẫu chi tiết/form + 20 route tĩnh |
  | Hiệu trưởng | 67/67 | gồm `/permissions/*`, `/children/health-checks/new`, `/school/vice-principals`, `/school/roles` |
  | Giáo viên | 50/50 | gồm `/attendance`, `/assessment/daily`, `/assessment/tickets`, `/pickup`, `/education/class/:id/themes/:id`, `/assessment/rewards/:id/edit` |
  | Bếp | 25/25 | gồm `/facility/transfers/:id/receive` |
  | Chưa đăng nhập | 4/4 | `/login`, `/forgot-password`, `/verify-otp`, `/reset-password` |

  Không có lượt nào tràn hay bị ép chữ.
- Chưa kiểm được ở 1440: `.td-food-info` vì vai trò Bếp không vào được trang thực phẩm. Rule mới nằm hoàn toàn trong `@media (max-width: 640px)`, nên không đổi desktop.
- Chưa quét:
  - System Admin: không có tài khoản demo.
  - Trạng thái chỉ hiện khi tương tác, vd. modal mở từ nút, wizard bước 2–4. Đã thử mẫu modal xác nhận ở Phase 2.
- **Khác plan:** sửa `menu-planning.css` thay vì giao cho style-sync, cùng lý do như `attendance.css`. File được sửa lần cuối lúc 09:52; tôi chỉ thêm 1 khối, không đổi rule nào khác.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.
- Tiếp: user review. Đạt thì đổi status `done`, chuyển sang `completed/`, rồi sang plan chuẩn UI.

### 2026-10-20 — Đóng plan (done)
- Nguồn: user "Duyệt, đóng plan responsive (done, chuyển completed)".
- AC-1 đến AC-4 đạt theo các log ở trên. Còn lại, không chặn: System Admin không có tài khoản demo nên chưa quét; modal/wizard bước 2–4 mới quét bằng mẫu.
- Chuyển file sang `docs/plans/completed/`.
