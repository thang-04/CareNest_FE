---
title: Làm mới UI/UX web + design system v2 (style Donezo, màu CareNest)
status: in-progress
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: high
created: 2026-10-08
updated: 2026-10-08
---

# Làm mới UI/UX web + design system v2

Làn L: đổi nền giao diện dùng chung (token, layout điều hướng, component CSS) cho ≥2 nhóm màn hình, >8 file. Không đổi nghiệp vụ, route, quyền hay contract BE.

## Context

- Token v1 phẳng 1 lớp `src/styles/tokens.css` (113 dòng); primary `#1565e0` lệch brand logo `#0269c5`.
- 453 inline `style={{}}` trong `src/` (phổ biến `{gap: N}` ×128, mẫu `borderTop` ×24 = thiếu variant card-section).
- CSS lệch thang: padding/margin px 10 ×46, 14 ×32, 6 ×27 (vd. `src/layouts/layout.css:29-46`); 87 `border-radius` cứng.
- `outline:none` không có focus thay thế: `src/styles/components.css:1216`, `:1600`, `src/styles/modules/children.css:153`, `src/styles/modules/inventory-inspection.css:120`.
- 43 `onClick` trên `tr/td/div` không dùng được bàn phím (vd. `src/pages/children/ChildrenListPage.jsx:255`).
- 7 trang thiếu loading/empty/error (6 trang `src/pages/assessment/*Evaluation*`, `ChildDevelopment*`; `src/pages/education-plan/GoalFormPage.jsx`).
- Chỉ desktop ≥1366px (`DESIGN.md:296-299`), không có drawer sidebar.

## Quyết định đã chốt

1. Làm mới visual theo style Tasko/Donezo (`D:\CAPSTONE_FALL26\design.md`), dịch sang CSS thuần — user, 2026-10-08.
2. Primary = brand blue `#0269c5`, accent mint `#94debd`; không dùng emerald của Donezo — user, 2026-10-08.
3. Font Geist (fallback Be Vietnam Pro); kiểm chứng dấu tiếng Việt ở Phase 1, lỗi ⇒ báo user — user, 2026-10-08.
4. Hỗ trợ desktop + tablet ≥768px (drawer sidebar <1024px) — user, 2026-10-08.
5. Không dark mode, không nguồn token chung với Flutter, không sửa `CareNest_APP` — user, 2026-10-08.
6. Giữ tên token v1 làm alias để không vỡ trang cũ.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** chỉ đổi trình bày; actor, flow, quyền, dữ liệu giữ nguyên.
- **Ảnh hưởng:** toàn bộ màn hình web (shell + component chung); in A4 (`src/styles/print.css`) giữ nguyên.

### Câu hỏi mở

(không còn)

## Acceptance criteria

- **AC-1:** Given token v2, When mở bất kỳ trang cũ, Then không vỡ layout (mọi `var(--…)` v1 vẫn resolve).
- **AC-2:** Given `/ui-kit`, When xem, Then thấy palette v2, thang type/spacing/radius, mọi state button/input/badge/card/table và mẫu chữ có dấu hiển thị đúng bằng Geist.
- **AC-3:** Given màn 820–1023px, When mở app, Then sidebar là drawer (mở bằng nút menu, đóng bằng Esc/click ngoài), nội dung không tràn ngang trừ bảng trong `.table-wrap`.
- **AC-4:** Given hàng bảng click được, When Tab tới và nhấn Enter, Then mở chi tiết như click; focus ring luôn hiển thị.
- **AC-5:** Given 7 trang thiếu state, When tải/rỗng/lỗi, Then hiện LoadingState/EmptyState/ErrorState.
- **AC-6:** inline `style={{` < 80 (chỉ giá trị động); hex ngoài `tokens.css`/`print.css` = 0.

## Key decisions

| Quyết định     | Chọn                 | Phương án khác             | Vì sao                                       |
| -------------- | -------------------- | -------------------------- | -------------------------------------------- |
| Cách đổi token | 3 lớp + alias tên v1 | Đổi tên toàn bộ 131 trang  | Rollout từng phase, không vỡ trang cũ        |
| Thư viện       | CSS thuần hiện có    | Tailwind/shadcn như Donezo | Không thêm dependency; repo chưa chốt UI kit |
| Thang radius   | 6/12/14/16/20/full   | 6/10/14/20                 | Khớp họ 16px của Donezo                      |

## Phases

### Phase 1 — Token v2 + font + ui-kit (cổng duyệt visual)

- Files: M `src/styles/tokens.css` · M `index.html` · M `src/styles/base.css` · M `src/pages/UiKitPage.jsx` · M `src/pages/ui-kit.css`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; ảnh chụp `/ui-kit`.
- **Dừng chờ user duyệt visual.**

### Phase 2 — Restyle component + shell

- Files: M `src/styles/components.css` · M `src/styles/utilities.css` · M `src/layouts/{layout.css,auth.css,Sidebar.jsx,Header.jsx,AuthLayout.jsx}` · M `src/components/ui/*`
- Exit: verify PASS; ảnh login/dashboard/list ở 1440 và 1366.

### Phase 3 — Tablet

- Files: M `src/layouts/{MainLayout.jsx,Header.jsx,layout.css}` · M CSS grid liên quan
- Exit: verify PASS; ảnh 1024 và 820; kiểm tra bàn phím drawer.

### Phase 4 — Quét module (inline style, a11y hàng bảng, state) — tách plan con nếu >1 lượt review

### Phase 5 — Cập nhật `DESIGN.md`

### Phase 6 — Bố cục theo wireframe đã chọn (status: approved 2026-10-08)

User chọn 2026-10-08: Tổng quan A "Việc trước", Danh sách A "Bảng + lọc dính", Chi tiết A "Hai cột + nút trên đầu", tông Phẳng, có màu; giữ tranh vẽ tay làm nền; **bố cục sidebar và nghiệp vụ giữ nguyên, không đổi nhiều**. Wireframe: `$TMPDIR/evon-design/wireframe.html` (scratchpad phiên).

- **6a · Tông Phẳng + card Kính trên tranh + khung app** — M `src/styles/tokens.css`, `src/styles/components.css`, `src/layouts/layout.css`, `src/layouts/Sidebar.jsx`
  - Nền vùng nội dung là tranh `login-scene` mờ dưới lớp phủ xanh nhạt; card kính (trắng 82%, blur, bo 20px, không viền xám); tiêu đề trang/card dùng Geist (bỏ Baloo 2); bỏ ngôi sao trang trí, đốm pastel nền.
  - Sidebar: giữ nguyên nhóm, thứ tự, mục theo role, MENU/CHUNG, thu gọn/drawer; chỉ đổi icon thành một màu theo chữ (bỏ ô icon pastel), mục đang chọn nền `--color-primary-soft` chữ `--color-primary`.
- **6b · Dashboard A (5 vai trò)** — M `src/components/dashboard/{DashboardHeader,DashboardWidgets}.jsx`, `src/styles/modules/dashboard.css`, `src/pages/dashboard/*Dashboard.jsx` (chỉ bọc lại thứ tự, không đổi query/logic)
  - Dải chào thấp ~148px, tranh `hero-scene` trọn ở góc phải; ô chọn điểm trường giữ trong dải.
  - Hàng lối tắt giữ (SRS #10/#11), thu gọn thành chip nhỏ dưới dải.
  - KPI: giữ đủ số ô hiện có, kiểu mới (icon 32px góc trái, nhãn, số, gợi ý).
  - Board 2/3 + 1/3: trái = widget cần xử lý (chờ duyệt, sự cố, việc của lớp…), phải = widget thông tin hôm nay (điểm trường, thực đơn, kế hoạch, dị ứng). Dòng trong widget theo kiểu wireframe (ô icon, tiêu đề, meta, nhãn "Chờ N ngày").
- **6c · Danh sách A** — mẫu dùng chung ở `components.css` (đầu trang dạng dải mỏng có tranh, khối lọc trong card, bảng, phân trang `‹ 1 2 3 ›`); áp thử `src/pages/children/ChildrenListPage.jsx`, các danh sách khác theo Phase 4.
- **6d · Chi tiết A** — đầu trang có trạng thái + nút Duyệt/Từ chối, thân 2 cột (thông tin | lịch sử duyệt); áp thử `src/pages/facility/ProposalDetailPage.jsx`.
- Mỗi bước 6a–6d: verify + ảnh 1440/1280/820 + **dừng chờ review**.
- Exit: `npm run verify` exit 0; quét 760–1440 không cuộn ngang; ảnh so với wireframe.

**Khác wireframe (do yêu cầu giữ nghiệp vụ):** không làm khối "Việc cần xử lý" gộp (cần gộp dữ liệu nhiều nguồn); không thêm số đếm cạnh mục sidebar (cần dữ liệu mới); ô chọn điểm trường không chuyển lên header (đổi phạm vi lọc).

**Câu hỏi mở Phase 6:**

- [x] Dashboard: giữ các widget riêng xếp 2/3 + 1/3, không làm khối gộp — user chọn, 2026-10-08.
- [x] **Bộ thiết kế chốt** (user chọn 2026-10-08; trang chọn `$TMPDIR/evon-design/bo-chon.html`, `bo-suu-tap.html`):
  - Giao diện **Z1 Kính trên tranh** + khung **sidebar nổi** (sidebar tách mép 12px, bo 22px, bóng nhẹ).
  - Font **Y2 Be Vietnam Pro** (thay Geist/Baloo 2); màu phụ **K1** xanh brand + mint; nút **B2** viên thuốc; icon **I3 Phosphor Bold**.
  - Header **E2** trắng đặc kẻ dưới; đầu trang **H1** dải mỏng có tranh; thẻ số liệu **N3** nền tông màu + icon lớn mờ; bảng **R3** sọc xen kẽ.
  - Loading **L2** vệt sáng lướt; banner **A3** đặc màu tông nhạt; toast **T1** trắng đặc góc trên phải; hộp xác nhận **C1** có icon; sidebar con **S1** đường dẫn trái; dropdown **D1**.
  - Form **F1** một cột + nút dính đáy; wizard **W1** bước ngang; điểm danh **G1** danh sách + nút 3 trạng thái; thực đơn tuần **M1** lưới ngày × bữa; hồ sơ trẻ **P1** đầu hồ sơ + tab.
- [x] Dependency: icon I3 thêm `@phosphor-icons/react` (thay dần `lucide-react`) — user cho phép 2026-10-08; cài khi bắt đầu 6a.
- [x] Vòng 3 (user chọn 2026-10-08): đăng nhập **O1** tranh toàn màn + form kính; màn trống **X2** tranh vẽ nhỏ; badge **V1** nền nhạt; tab **Q2** segmented; ô nhập **J1** viền xám; avatar **AV2** chữ cái màu pastel theo tên (không ảnh thật của trẻ); mục chọn sidebar **U1** nền nhạt; biểu đồ **CH3** vòng tỷ lệ; mở chi tiết **DR2** panel trượt phải; độ dày **DS2** vừa; chuyển động **MO2** vừa; tranh nền **TR2** vừa. Icon giữ **I3 Phosphor Bold**.
  - DR2 với nội dung nhiều (user: "hiển thị sao cho phù hợp"): panel phải rộng 480–560px cho chi tiết ngắn (sự cố, đề xuất, khen thưởng, món ăn, trẻ); panel có nút "Mở toàn trang". Phiếu dài/nhiều bước (kế hoạch giáo dục, kiểm kê, luân chuyển, thực đơn tuần, form sửa) mở trang riêng như hiện tại. Route chi tiết giữ nguyên để link, nút Back, thông báo vẫn dẫn đúng chỗ — chỉ đổi trình bày, không đổi nghiệp vụ.
- [x] User duyệt Phase 6 — 2026-10-08.
- [x] Kiểu card: **Kính trên tranh** — tranh vẽ tay (`login-scene`) trải mờ làm nền vùng nội dung, card trắng 82% + blur 14px, bo 20px, viền trắng mờ, bóng xanh nhạt; sidebar trắng đặc; áp toàn app — user chọn, 2026-10-08 (wireframe `?the=kinh`).

### Phase 7 — Đổi toàn bộ icon sang Tabler (status: approved 2026-10-09)

User chọn 2026-10-09 (xưởng style): bộ icon **Tabler**, đổi toàn bộ một lượt. Thay quyết định cũ I3 (Phosphor Bold, thay dần Lucide).

- Hiện trạng: 197 file import `lucide-react` (155 icon), 12 file import `@phosphor-icons/react` (38 icon); không CSS nào bám class `.lucide`. Đã ghép 182/182 tên sang Tabler outline (tự ghép 102, ghép tay 80; bảng ở scratchpad phiên `icon_final.json`).
- Dependency: thêm `@tabler/icons-react@^3.48.0` (bản ≥2 tuần); đổi xong thì gỡ `lucide-react` và `@phosphor-icons/react`.
- Files: A `src/components/ui/icons.js` (một chỗ ánh xạ: tên đang dùng trong app → icon Tabler, vd. `IconDeviceFloppy as Save`) · M ~209 file: chỉ đổi dòng import sang `@/components/ui/icons`, tên component giữ nguyên · M `src/main.jsx` (bỏ `IconContext` của Phosphor) · M `Stepper.jsx` (`strokeWidth` → `stroke`), `ConfirmationModal.jsx`, `AppearancePage.jsx` (bỏ prop `weight`) · M `src/pages/UiKitPage.jsx` (thêm mục "Icon" liệt kê đủ 182 icon kèm tên để soi nghĩa) · M `package.json`, lockfile.
- Không đổi: logic, route, quyền, dữ liệu, chữ hiển thị.
- Exit: `node scripts/verify.mjs` PASS; `grep lucide-react|phosphor-icons src` = 0; ảnh CDP dashboard 5 vai trò + 1 danh sách + 1 chi tiết + `/ui-kit` mục Icon ở 1440, 0 lỗi console; so dung lượng bundle trước/sau.
- Rủi ro: icon ghép tay lệch nghĩa (vd. `PackageCheck` → `package-import`) ⇒ soi ở mục Icon của `/ui-kit`, sửa tại `icons.js` (một chỗ). Rollback: hoàn file `icons.js` + import, cài lại 2 gói cũ.

## Test matrix

Repo chưa có framework test; kiểm chứng = `node scripts/verify.mjs` (lint + format + build) + ảnh chụp + kiểm tra bàn phím thủ công.

| AC   | Kiểm chứng                   | Phase | Kết quả |
| ---- | ---------------------------- | ----- | ------- |
| AC-1 | build + mở 5 trang đại diện  | 1     |         |
| AC-2 | ảnh `/ui-kit`                | 1     |         |
| AC-3 | ảnh 820/1024 + Esc           | 3     |         |
| AC-4 | Tab/Enter trên children list | 4     |         |
| AC-5 | mock lỗi/rỗng                | 4     |         |
| AC-6 | grep đếm                     | 4     |         |

## Rủi ro & rollback

| Rủi ro                                 | Tác động   | Giảm thiểu                             | Rollback                |
| -------------------------------------- | ---------- | -------------------------------------- | ----------------------- |
| Đổi radius/màu alias làm lệch trang cũ | Trung bình | Alias + duyệt `/ui-kit` trước          | `git checkout` file CSS |
| Geist thiếu dấu tiếng Việt             | Chữ xấu    | Fallback Be Vietnam Pro, kiểm Phase 1  | Đổi `--font-sans`       |
| Drawer làm hỏng điều hướng theo role   | Cao        | Chỉ đổi trình bày, giữ `menuConfig.js` | Revert `MainLayout.jsx` |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có cách kiểm chứng; mỗi phase có Exit
- [x] > 3 phase ⇒ Phase 4 có thể tách plan con
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review

## Progress log

### 2026-10-08 — Phase 1 (chờ review)

- Commit: chưa commit
- Verify: `npm run verify` → lint + format:check pass, `✓ built in 739ms`. `node scripts/verify.mjs` báo `VERIFY FAIL full` do môi trường (`Cannot find module ...CareNest_FE\node_modules\npm\bin\npm-cli.js` khi script spawn `npm.cmd`), không phải lỗi code.
- Geist có subset `vietnamese` trên Google Fonts; chưa chụp ảnh `/ui-kit` (máy không có agent-browser/Playwright, trang cần đăng nhập) ⇒ user tự xem.
- Khác plan: thang radius dùng 6/12/14/16/20/full (khớp mục Hướng visual), không dùng 6/10/14/20.
- Tiếp: user duyệt `/ui-kit` ⇒ Phase 2.

### 2026-10-08 — Phase 2 (chờ review)

- Commit: chưa commit
- Verify: `npm run verify` → exit 0, lint + format:check pass, `✓ built`. Script kiểm tra `var(--…)` chưa định nghĩa: 0.
- Đã làm: `layout.css` (sidebar trắng, active fill primary + shadow, hover dịch phải, nhãn "Menu", sub-menu có đường dẫn trái; header mờ nền, icon-btn tròn, chấm thông báo pulse, avatar viền primary); `components.css` lõi (btn/input/card/table/chip/alert/toast/modal/state/tabs/avatar/pagination) theo token v2, thêm `.card__section`, `.card--interactive`, `.eyebrow`, `.page__subtitle`, `.stat-card--primary`; 66 spacing + 18 radius px → token; `utilities.css` thêm `.gap-*`, `.w-*`, `.min-w-*`, `.anim-*`; `auth.css` panel brand bo xl + motion; `States.jsx`, `Pagination.jsx` bỏ inline style.
- Khác plan: không làm ô search ở header (app chưa có tìm kiếm toàn cục ⇒ sẽ là UI giả); `menuConfig.js` giữ nguyên (điều hướng theo role), chỉ thêm nhãn "Menu". `outline:none` ở `.search-box` và `.tr-quicklink` đã có focus thay thế (khảo sát cũ sai); thêm `:focus-within` cho `.search-select__search` và `.kk-qty`.
- Tiếp: user xem `/ui-kit`, login, dashboard, 1 trang danh sách ⇒ Phase 3 (tablet).

### 2026-10-08 — Phase 2 làm lại sau phản hồi "xấu" (chờ review)

- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh chụp thật (Chrome headless + CDP) ở `ui-review/redesign-v2/` (1440px: home, children, ui-kit).
- Sửa: canvas `--color-bg` → neutral-100 để card trắng nổi; sidebar thành panel nổi bo xl; header bỏ kẻ dưới; card header bỏ kẻ (trừ `card--soft-header`); KPI: nhãn trên + nút ↗ tròn + số đáy thẻ, thẻ đầu dashboard nền primary; lỗi chữ dính tiêu đề/mô tả trong `db-list` (span inline) → block; card dashboard không còn kéo cao (`align-items: start`); chevron sidebar nhạt hơn.

### 2026-10-08 — Bám sát `D:\CAPSTONE_FALL26\design.md`, màu xanh repo (chờ review)

- User chọn: làm theo style design.md (không theo bản Stitch), giữ màu xanh; nghiệp vụ giữ đúng như hiện tại. Bản Stitch (`ui-review/stitch/`) chỉ tham khảo.
- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh: `ui-review/redesign-v2/{login,home,children}-1440.png`.
- Đã làm: sidebar sát mép `w-64 p-4 border-r`, 2 section MENU / CHUNG (chỉ trình bày; mục theo role vẫn từ `getMenuForRole`); canvas `#f7f9fc`; tiêu đề trang 30px; card header `pt-6 px-6`, tiêu đề 18px; dashboard grid 3 cột, hàng 2 widget ⇒ widget đầu `span 2`; 5–6 KPI ⇒ 3 cột; gợi ý KPI 1 dòng; header widget hẹp cho xuống dòng; login: khối demo gọn, logo nhỏ lại.
- Không đổi: dữ liệu, service, route, quyền, câu chữ nghiệp vụ.

### 2026-10-08 — Phong cách mầm non vui nhộn (chờ review)

- User: giao diện cũ quá xấu ⇒ làm lại phong cách mầm non (nền vui nhộn, tranh vẽ màu), login bố cục mới; dùng `ck:stitch` + `ui-ux-pro-max:design`; màu xanh repo; nghiệp vụ giữ nguyên.
- `ui-ux-pro-max`: style Claymorphism, palette "Kids Learning", font tiêu đề Baloo 2 (có subset vietnamese). Stitch: 3 bản tham khảo `ui-review/stitch/kids-*.png`; user chọn Login A (cảnh sân chơi toàn màn) + áp kiểu kids-dashboard cho toàn app.
- Đã làm: `src/components/illustrations/KidsArt.jsx` + `kids-art.css` (SVG vẽ tay, màu từ token, chuyển động tắt khi reduced-motion); `AuthLayout` mới (dùng chung cho login/quên mật khẩu/OTP/đặt lại mật khẩu); banner chào có tranh ở `DashboardHeader`; KPI pastel có icon (prop `icon` mới của `KpiCard`); sidebar ô icon màu; tiêu đề trang/card dùng Baloo 2 + ngôi sao trang trí; canvas có đốm pastel; `stat-card` toàn app nền pastel theo tone.
- Không đổi: form/logic đăng nhập, service, route, quyền, câu chữ nghiệp vụ; bỏ các mục Stitch tự thêm (huy hiệu Pro, ô tìm kiếm, nút duyệt nhanh, checklist…).
- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh: `ui-review/kids-v3/{login,home,children,approvals}-1440.png`.
- Tiếp: chụp kiểm tra 4 dashboard vai trò còn lại + trang quên mật khẩu; Phase 3 (tablet); Phase 4 (module).

### 2026-10-08 — Bớt gradient, màu theo repo (chờ review)

- User: bớt gradient; tranh dùng style tranh tô màu (raster), không SVG; màu chủ đạo theo màu repo.
- Đã làm: bỏ gradient (thẻ thống kê, KPI, banner chào, canvas, login); giữ gradient skeleton (hiệu ứng tải) và 2 gradient có sẵn ở `facility-transfer.css`. Màu trang trí chỉ còn bộ màu logo (xanh/xanh trời/teal/mint); tone KPI/thẻ lọc dùng token trạng thái của repo (`--warning-25/700`, `--danger-25/700`, `--purple-25/700`, `--success-25/700`, `--primary-25`).
- Chặn: tạo tranh raster bằng Gemini thất bại — `[FREE TIER LIMITATION] Image/Video generation is NOT available on free tier`; không có `OPENROUTER_API_KEY`/`MINIMAX_API_KEY`. Tranh SVG tạm giữ ở login và banner tới khi có ảnh.
- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh: `ui-review/kids-v3/home-flat-1440.png`.

### 2026-10-08 — Màu gốc v1, tranh sáp màu, biểu đồ, toast (chờ review)

- User: màu chủ đạo phải là màu cũ (không xanh đen); tranh kiểu sáp màu, cảnh vui hơn; widget có biểu đồ; toast/alert đẹp hơn.
- Màu: semantic token trỏ về giá trị v1 (`--v1-*`: primary `#1565e0`, text `#1b2433`, border `#e3e9f2`, bg `#f5f8fc`…); tiêu đề bỏ `--blue-900`.
- Tranh: `mockups/illustrations/build_crayon_scenes.py` sinh SVG sáp màu (gạch chéo + filter hạt sáp) → `render.mjs` (Chrome headless) → `src/assets/illustrations/{login-scene,hero-scene}.webp`. Login render 1x (1600×900) vì Chrome headless treo khi filter phủ vùng lớn ở 1.5x/2x. Xoá `KidsArt.jsx`/`kids-art.css`.
- Biểu đồ: `src/components/charts/MiniCharts.jsx` (RingChart, SegmentRing, BarList, không thêm dependency). Dùng ở `ApprovalsWidget` (donut + thanh theo loại), widget bán trú PHT (donut điểm danh), KPI "Có mặt hôm nay" (prop `progress`). Chỉ dùng số liệu service sẵn có.
- Toast: nền theo loại, icon tròn, thanh đếm ngược, trượt + mờ dần khi đóng (thời gian giữ nguyên 3.5s / 6s lỗi). Alert: bo 16px, vạch màu trái, icon tròn.
- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh: `ui-review/crayon-v4/`.

### 2026-10-08 — Tông xanh trời, login dễ đọc, thẻ nền phẳng (chờ review)

- Màu chủ đạo xanh trời theo logo: nền thương hiệu `--color-brand` = sky-400 `#4fb0f5` + chữ `--color-on-brand` `#0e3f63` (4.6:1) cho nút chính, menu đang chọn, trang hiện tại; link/chữ màu `--color-primary` = `#0b72bc` (5.1:1). Chữ trắng trên `#4fb0f5` chỉ 2.4:1 nên không dùng.
- Login: khung tranh trái + thẻ trắng chứa slogan/tiêu đề/3 ý (không còn chữ đè lên tranh); cột form trắng bên phải; tài khoản demo lọc mỗi vai trò 1 tài khoản (5).
- KPI, thẻ thống kê điểm danh (`.dd-stat`) và alert: bỏ vạch màu trái, dùng nền một màu nhạt + viền cùng tông.
- Sửa theo review nghiệp vụ: đếm "N mục đang có việc" chỉ khi nguồn tải xong; KPI chờ duyệt không hiện "Không có việc" khi có nhóm lỗi; ô tóm tắt báo nhóm lỗi; bỏ nhãn "Cần xử lý" ở "Báo thiếu chờ PHT bổ sung" (Bếp) và "Sự cố CSVC chờ xử lý" (HT). Dọn RingChart/SegmentRing/CSS chết.
- Verify: `npm run verify` → exit 0, `✓ built`. Ảnh: `ui-review/sky-v5/`.
- Sửa theo review đối kháng (workflow, 15 phát hiện, các mục dưới đã xác nhận): HT/Tổ trưởng không gắn "Không có việc" khi nhóm duyệt lỗi (+ gợi ý lỗi cho Tổ trưởng); ô tóm tắt hiện "—" khi mọi nhóm lỗi; bỏ `aria-label` trên KPI để trình đọc màn hình đọc cả gợi ý/lỗi/%; toast có hiệu ứng ra riêng (`toast-out`), giảm chuyển động ⇒ chỉ mờ + ẩn thanh đếm ngược; KPI không icon bỏ cột icon; số dài (17/36) dùng `clamp` + cột nhãn tối thiểu 120px; chip sĩ số xanh khi `MEAL_COUNT_STATUS.CONFIRMED`; lỗi nhóm trong BarList 13px màu lỗi. Ảnh: `ui-review/sky-v5/{principal,teamleader}-1440.png`. Verify exit 0.

### 2026-10-08 — Bố cục gọn, màu dịu; login về bản gốc (chờ review)

- User: bố cục lung tung, màu khó nhìn; trả login như cũ.
- Login: `AuthLayout.jsx`, `auth.css`, `LoginPage.jsx` khôi phục từ HEAD; chỉ giữ lọc mỗi vai trò 1 tài khoản demo (yêu cầu trước của user). Xoá `src/assets/illustrations/login-scene.webp` (không dùng; nguồn tranh vẫn ở `mockups/illustrations/`).
- KPI: mọi thẻ chung nền trắng + viền xám; tone chỉ ở ô icon, số, nhãn trạng thái (trước đó mỗi thẻ một màu nền ⇒ rối).
- Widget: các hàng `.db-grid` gộp thành một `.db-board` masonry 2 cột (CSS columns) ⇒ hết khoảng trống giữa card ngắn/dài; xoá CSS `.db-grid`.
- Banner chào thấp hơn (132px, tiêu đề 28px). Sidebar: chỉ mở 1 nhóm; menu con 14px, màu chữ đậm hơn.
- Verify: `npm run verify` → exit 0. Ảnh: `ui-review/calm-v6/`.

### 2026-10-08 — Soi UI Phase 2 + sửa (chờ review)

- Soi bằng Playwright (Chrome hệ thống, tài khoản demo mock) 5 dashboard + login + `/ui-kit`, 375–1440px.
- Sửa: KPI `minmax(0,1fr)` + số `clamp(28px,2.4vw,40px)` (hết cuộn ngang 3px ở 1366); sidebar drawer <1024px (`useMediaQuery`, Esc/nền mờ/chuyển trang đóng) — làm sớm phần drawer của Phase 3; bo góc `.kpi-tile`/`.stat-card` về `--radius-xl`; số KPI màu chữ chính, chỉ tô màu khi >0 và cần xử lý, số 0 xám; thực đơn bếp gộp nhóm tuổi cùng món; thanh "Chờ bạn duyệt" theo tỷ lệ trên tổng; nhãn sidebar + badge-dot 12px; bỏ chữ "Lớp" lặp ở dashboard giáo viên.
- Giữ hàng lối tắt dashboard (SRS #10/#11 yêu cầu) — user chọn, 2026-10-08.
- Verify: `npm run verify` → exit 0, `✓ built`; `node scripts/verify.mjs` FAIL do FE-ENV-261008-verify-npm-cmd-quoted. Quét 760–1440px bước 20px, 5 vai trò: 0 cuộn ngang, 0 số KPI bị cắt.

### 2026-10-09 — Phase 6a (chờ review)

- Đã làm: nền app = tranh `login-scene` mờ dưới lớp phủ (`--scene-veil`); `.card` kính (`--glass-bg` 82%, blur 14px, viền trắng mờ, bóng xanh nhạt, bo 20px); sidebar nổi (cách mép 12px, bo 22px; drawer <1024px bo phải); mục đang chọn nền `--color-primary-soft` chữ primary, icon một màu (bỏ ô icon pastel); header trắng đặc kẻ dưới; font Be Vietnam Pro cho cả tiêu đề (bỏ Baloo 2, Geist khỏi `index.html`); nút viên thuốc (`--btn-radius: full`); tiêu đề trang bỏ ngôi sao, đậm 700; in A4 giữ nền trắng.
- Icon: thêm `@phosphor-icons/react@^2.1.7` (cài bằng `--legacy-peer-deps` vì xung đột có sẵn vite 8 ↔ `@vitejs/plugin-react` 4, không do gói mới); `IconContext` weight bold ở `main.jsx`; đổi icon sidebar, header, chuông, menu tài khoản. Các màn khác vẫn Lucide, đổi dần.
- Verify: `npm run verify` → `✓ built`; Playwright 1440/900 trang chủ, danh sách trẻ, ui-kit: 0 cuộn ngang, 0 lỗi console; drawer 900 mở đúng.

### 2026-10-09 — Phase 6b (chờ review)

- Đã làm: thẻ số liệu N3 (nền gradient theo tông, icon lớn mờ góc phải, nhãn trên – số dưới, số mang màu tông, số 0 xám); dải chào thấp 148px, kính; khu widget 2 cột (`db-board__main` 2/3 việc cần xử lý, `db-board__aside` 1/3 thông tin hôm nay), <1100px về 1 cột. Chỉ bọc lại thứ tự JSX ở 4 dashboard (HT, PHT, tổ trưởng, bếp); không đổi query, logic, câu chữ. Giữ hàng lối tắt (SRS).
- Khác wireframe: HT để "Tổng quan điểm trường" ở cột trái (bảng nhiều cột bị cắt ở cột hẹp).
- Ngoài phạm vi 6b nhưng đã làm (user cho phép): sửa `scripts/verify.mjs` (FE-ENV-261008-verify-npm-cmd-quoted, fixed) — cần đồng bộ sang `CareNest_BE`, `CareNest_APP`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; Playwright 5 vai trò ở 1440/900: 0 cuộn ngang, 0 lỗi console.

### 2026-10-09 — Phase 6c (chờ review)

- Đã làm: `.page__head` dùng chung thành dải mỏng kính có tranh nhỏ (H1) — áp cho ~58 trang có `page__head`; bảng sọc xen kẽ (R3, `--table-stripe`); avatar chữ cái pastel theo tên (AV2, `avatarTone` trong `utils/format.js`); component dùng chung `SidePanel` (trượt phải 500ms/350ms, Esc/nền mờ đóng, tiêu điểm vào panel và trả về khi đóng); `ChildQuickPanel` cho Danh sách trẻ: bấm dòng mở panel xem nhanh (chỉ dữ liệu sẵn có của dòng), nút "Mở hồ sơ đầy đủ" và "Sổ sức khỏe"; mục con sidebar tên dài xuống dòng.
- Khác trước: bấm dòng ở Danh sách trẻ mở panel thay vì chuyển trang; nút mắt (Xem hồ sơ) vẫn mở trang riêng, route giữ nguyên.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; Playwright Danh sách trẻ / Báo cáo sự cố / Chờ duyệt ở 1440/900: 0 cuộn ngang, 0 lỗi console; panel nhận tiêu điểm, Esc đóng.

### 2026-10-09 — Phase 6d (chờ review)

- Hồ sơ trẻ (P1, làm lại theo góp ý user: không chia nhỏ thông tin vào nhiều tab): đầu hồ sơ có avatar màu theo tên + dòng mã · lớp; chỉ 2 tab segmented **Tổng quan** · **Lịch sử xếp lớp**. Tổng quan hiện đủ bằng card trong `.detail-layout`: trái = Thông tin của trẻ, Phụ huynh, Sức khỏe khi tiếp nhận; phải = Lớp & năm học, card "Sức khỏe & theo dõi" (3 lối tắt dạng danh sách). Nội dung từng khối giữ nguyên.
- Trang chi tiết (pilot Đề xuất CSVC): `.detail-layout` 2/3 nội dung + 1/3 lịch sử xử lý; khối thông tin 2 cột tự về 1 cột khi cột chính hẹp (container query).
- Sửa theo góp ý 6c (user, đã chốt lại): bấm dòng Danh sách trẻ → mở panel phải xem đầy đủ; nút mắt → vào trang hồ sơ chi tiết. Panel (đọc `useChildDetail`: thông tin, lớp & năm học, phụ huynh + tài khoản, sức khỏe khi tiếp nhận, lịch sử xếp lớp).
- Sửa lỗi có sẵn: `Breadcrumb` trùng `key` khi hai mục cùng nhãn (lúc hồ sơ đang tải).
- Chưa làm: `.tabs` toàn app sang segmented (21 chỗ có padding viết cứng) ⇒ gom vào 6e.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; Playwright hồ sơ / đề xuất 1440/900: 0 cuộn ngang, 0 lỗi console.

### 2026-10-09 — Phase 6e: component dùng chung (chờ review)

- Đã làm (CSS dùng chung, áp toàn app): banner A3 (`.alert` nền đặc tông nhạt theo nghĩa, không viền, icon trơn); toast T1 (trắng đặc, viền mảnh, góc trên phải giữ nguyên vị trí cũ); khung chờ L2 (`.skeleton` vệt sáng lướt); màn trống X2 (`EmptyState` dùng tranh vẽ nhỏ, prop `icon` bỏ qua; `ErrorState` giữ icon); badge V1 (`--badge-radius` 6px); nút nguy hiểm C1 (`.btn--danger` nền đỏ nhạt chữ đỏ, spinner đỏ); tab Q2 segmented là mặc định của `.tabs` (1 dòng, cuộn ngang khi tràn) — bỏ padding viết cứng ở 13 file + `.dt-tabs`.
- Hộp xác nhận: `ConfirmationModal` đã có icon trái (C1) — giữ.
- Thêm `page__head` cho "Phiếu luân chuyển của tôi" (tiêu đề trơn trước đó).
- Tách phần còn lại sang **6f**: đăng nhập O1, wizard W1, điểm danh G1, thực đơn tuần M1, biểu đồ vòng CH3, thanh nút form dính đáy F1. Đổi icon Lucide → Phosphor trong các màn (204 file) ⇒ Phase 4 theo module.
- Verify: xem dòng VERIFY; Playwright ui-kit / khen thưởng / luân chuyển / duyệt KHGD 1440: 0 cuộn ngang, 0 lỗi console.

### 2026-10-09 — Phase 6f: các màn riêng (chờ review)

- Hiện trạng đã khớp nên giữ: đăng nhập O1 (tranh toàn màn + form phải), wizard W1 (bước ngang `ProgressSteps`), thực đơn tuần M1 (lưới ngày × bữa).
- Điểm danh G1: `.dd-seg` thành rãnh segmented, ô đang chọn tô màu theo trạng thái (có mặt xanh / có phép cam / không phép đỏ).
- Form F1: `.page-actions` có nút chính thành thanh kính dính đáy màn (61 trang dùng `.page-actions`; trang chỉ có nút Quay lại không bị ảnh hưởng).
- Tiêu đề trơn: `.page > .page__title` hiện như dải đầu trang có tranh (45 trang chưa bọc `page__head`).
- Biểu đồ vòng CH3: `DonutChart` (conic-gradient, không thêm thư viện) trong `MiniCharts.jsx`; dùng ở Tổng hợp điểm danh lớp, đặt cạnh các ô số liệu (`.dd-overview`). Chỉ vẽ tổng FE đã tính sẵn từ dữ liệu BE.
- Còn lại cho Phase 4: đổi icon Lucide → Phosphor trong màn (204 file); dòng bảng bấm được chưa dùng được bằng bàn phím; áp `detail-layout` + `SidePanel` cho các danh sách/chi tiết khác.
- Verify: xem dòng VERIFY; Playwright điểm danh / tổng hợp / tạo phiếu luân chuyển / tiếp nhận trẻ ở 1440/900: 0 cuộn ngang, 0 lỗi console.

### 2026-10-09 — Chỉnh dải đầu trang (góp ý user)

- User: tranh trong dải đầu trang hiện nhỏ/cắt. Đổi: dải cao 112px; tranh `login-scene` trải 62% bên phải dải (80% dưới 900px), mờ dần về phía tiêu đề; áp cho `.page__head` và `.page > .page__title` (tranh dưới chữ bằng `isolation` + `z-index: -1`).
- Verify: `VERIFY PASS full`; Playwright 4 trang × 1440/1280/1100/900: không phần tử nào tràn khỏi dải.
- Góp ý tiếp (user): dải cao hơn, nền nhạt hơn, toàn web tông trắng hơn. Đổi: dải đầu trang 140px, tranh cắt `center 78%` + opacity 0.8; nền dải `--band-bg` (xanh nhạt 35% pha trắng, dùng chung cho dải chào dashboard); `--scene-veil` trắng 97%→78%; `--glass-bg` 92%, `--glass-border` 85%. Verify `VERIFY PASS full`.
- Tranh T0 (user: làm tươi như bộ mới): vẽ lại `login-scene.webp` (1600×900) và `hero-scene.webp` (1165×880, cắt cùng khung cũ) bằng bảng màu tươi + nét sáp dày; thay ở `src/assets/illustrations/`. Script sinh tranh bản tươi đang ở scratchpad phiên (dùng lại hàm của `mockups/illustrations/build_crayon_scenes.py`), chưa đưa vào repo. Verify `VERIFY PASS full`.

### 2026-10-09 — Bố cục màn đăng nhập (phương án A)

- Commit: chưa commit
- Đã làm: wireframe 3 phương án, user chọn A (chia đôi gọn). `AuthLayout`: tranh nền theo tranh của ngày (khách chưa đăng nhập dùng cấu hình mặc định, không gọi API); giới thiệu đổi sang việc mầm non (hồ sơ trẻ, điểm danh–suất ăn, kế hoạch–đánh giá), bỏ card, có kính mờ cả khối; card form kính mờ; ≤900px ẩn giới thiệu, form lên đầu. `LoginPage`: tài khoản demo gập một dòng, mở ra chip theo vai trò; placeholder ô mật khẩu. Áp chung cho quên mật khẩu / OTP / đặt lại mật khẩu.
- Kiểm Playwright 1440/1024/390: không tràn ngang, không lỗi console; chọn chip Giáo viên ⇒ đăng nhập vào `/`.
- Lưu ý: BE dùng Keycloak (PKCE) ⇒ khi nối thật, form mật khẩu nằm ở theme Keycloak; màn FE chỉ còn nút chuyển sang Keycloak.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Tài khoản xuống đáy sidebar

- Commit: chưa commit
- Đã làm: `UserMenu` chuyển từ header xuống chân `Sidebar` (menu cuộn riêng `.sidebar__scroll`, khối tài khoản ghim đáy); menu tài khoản mở lên trên, sidebar thu gọn thì chỉ avatar và menu mở sang phải; thêm đóng bằng Esc; header còn nút menu, năm học, chuông.
- Kiểm Playwright: 1440 mở/thu gọn, 1366×640 (khối tài khoản vẫn thấy), 390 drawer; Esc đóng; "Hồ sơ cá nhân" điều hướng đúng; không lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Vòng 4: chọn lại nguyên tố + nền thiết kế (chờ user chọn)

- Commit: chưa commit; chưa sửa code.
- User chọn nguyên tố (trang so sánh `style-chon.html`, scratchpad phiên): **badge B** viên thuốc có icon, nền đậm hơn một bậc + viền cùng tông, trạng thái "đang" có chấm phát sáng (thay V1); **thanh tiến trình B** chuyển sắc cùng họ + sọc chạy khi đang làm, xong thì xanh lá + "Hoàn thành", không ghi "0/0"; **card A** kính sắc nét + ô icon + dòng phụ + link góc; **modal A** liền khối bo 24, ô icon, nền sau không blur, mở 180ms; **loading B** khung đúng hình nhịp thở + ba chấm màu logo + thanh mảnh tải lại; **chuyển động A** lớp nổi 150ms scale 95% + dịch 4px, toast trồi từ mép, tab nền trượt, nút lún 2%, không nảy.
- User muốn làm lại toàn bộ nền (màu, bo góc, căn lề, cách hiển thị…), mỗi nhóm ≥5 lựa chọn ⇒ trang cấu hình `he-thong-chon.html` (scratchpad phiên): 7 nhóm (Mau1–6, Bo1–5, Le1–5, Font1–6, Chat1–5, Khung1–5, Hien1–5) + 5 bộ phối sẵn. Chờ user chọn; đổi bảng màu/kính là lật quyết định đã chốt (K1, Z1) nên cần user xác nhận rõ.
- User chọn nền (2026-10-09): **Mau1** Trời xanh (giữ K1) · **Bo3** Mềm · **Le2** Vừa, tràn màn · **Font1** Be Vietnam Pro · **Chat1** Kính trên tranh (giữ Z1) · **Khung2** Sidebar nổi tách mép 12px, bo góc, bóng nhẹ · **Hien1** Bảng sọc.
- Vòng 5 (chờ user chọn, `chi-tiet-chon.html` scratchpad phiên): bộ icon Ic1–Ic6, hộp thoại Dl1–Dl5 (đủ 4 ca: đăng xuất, xoá, gửi duyệt, gửi xong), tiến trình gửi form Sb1–Sb5 (sẵn sàng/đang gửi/xong/lỗi), toast Ts1–Ts5, ô nhập In1–In5.
- User muốn chỉnh style "full và chi tiết hơn" ⇒ thay trang chọn A/B bằng xưởng chỉnh `style-studio.html` (scratchpad phiên): ~75 thông số (màu, chữ, bo góc, khoảng cách, bề mặt, khung, bảng, nút, badge, thanh tiến trình, icon, hộp thoại, toast, ô nhập, gửi form, loading, chuyển động), mặc định = các lựa chọn vòng 1–4; nút Xuất ra token CSS + JSON. Chờ user gửi bản xuất rồi mới sửa code.

### 2026-10-09 — Áp kết quả xưởng style (chờ review)

- Commit: chưa commit
- User chốt ở xưởng (`studio-result.json`, scratchpad phiên): màu Trời xanh, Be Vietnam Pro chuẩn, khoảng cách Vừa, sidebar nổi nền nhạt, bảng sọc, ô nhập viền xám (giữ); **bo góc viên thuốc toàn bộ** (card/hộp thoại/sidebar 32, ô nhập 22, ô icon 24, badge tròn); **kính trong, tranh rõ** (kính 72%, blur 20px, lớp phủ 82%→66%); **nút đặc, chữ 700, rê có quầng sáng, nhấn lún 2%**; badge B; thanh B (chuyển sắc + sọc chạy, xong thì xanh lá); loading B (ba chấm màu logo, khung chờ nhịp thở); **hộp xác nhận icon lớn giữa**; **toast nền màu theo loại**; **gửi form = lớp phủ**; **chuyển động chuẩn Material**; **icon Tabler (chưa cài — chờ user cho phép thêm dependency)**.
- Đã làm: token (`--radius-2xl/3xl`, `--modal-radius`, `--tile-radius`, `--sidebar-radius`, `--duration-overlay`, overlay xanh đậm không blur, `--ease-out` = Material); CSS nút/badge/toast/modal/spinner/skeleton/progress; `Spinner` ba chấm; `SubmitOverlay` mới (sending/done/error) dùng trong `ConfirmationModal` (bỏ spinner trong nút để chỉ một dấu hiệu); `StatusBadge` tone blue không icon có chấm phát sáng; `ProgressBar` xong ⇒ xanh lá, tổng 0 ⇒ "—"; thanh cuộn mảnh; sửa lỗi cũ `.stat-card--primary` bị selector thuộc tính đè nền.
- Chưa làm: gắn `SubmitOverlay` vào ~57 form tự đặt spinner trong nút (để Phase 4 quét module); đổi icon sang Tabler.
- Kiểm: ảnh CDP (đăng nhập demo HT) dashboard, `/ui-kit`, hộp xác nhận ở 1440: không lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Phase 7: icon Tabler (chờ review)

- Commit: chưa commit
- Đã làm: cài `@tabler/icons-react` (npm lấy `^3.49.0`, khớp dải `^3.48.0` của plan); gỡ `lucide-react`, `@phosphor-icons/react`. Tạo `src/components/ui/icons.js` (182 icon: tên đang dùng → icon Tabler); 208 file chỉ đổi dòng import sang `@/components/ui/icons`; bỏ `IconContext` ở `main.jsx`; `Stepper` `strokeWidth` → `stroke`; bỏ prop `weight` (2 chỗ). `/ui-kit` thêm mục "Icon" liệt kê đủ 182 icon kèm tên.
- Cài đặt phải dùng `--legacy-peer-deps`: xung đột peer có sẵn trong thay đổi chưa commit `vite@^8.3.3` với `@vitejs/plugin-react@4.7.0` (chỉ hỗ trợ tới vite 7) — không do Tabler; cần nâng plugin-react khi chốt vite 8.
- Kiểm: `grep lucide-react|phosphor-icons src` = 0; bundle JS gzip 939,7 kB → 910,4 kB; ảnh CDP dashboard 5 vai trò + danh sách trẻ + chi tiết trẻ + `/ui-kit#icons` ở 1440: 0 lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Nội dung giãn khi thu gọn sidebar + thẻ giãn hết hàng (chờ review)

- Commit: chưa commit
- User báo: thu gọn sidebar thì nội dung không giãn (thừa trống bên phải); ít thẻ thì không giãn hết hàng (Chờ duyệt, Vai trò & quyền…).
- Nguyên nhân: `.page` có `max-width: 1480px` căn trái; `.stat-grid` cứng `repeat(6, 1fr)`; `.sc-role-grid`, `.sc-group-grid` dùng `auto-fill` (giữ ô trống); `.kk-stats` cứng 4 cột.
- Sửa: bỏ `max-width` của `.page`; 4 lưới thẻ tóm tắt đổi sang `repeat(auto-fit, minmax(…, 1fr))`, bỏ media 1280px của `.stat-grid`. Lưới danh sách dữ liệu (thẻ lớp, người đón, chữ ký, thực đơn…) giữ `auto-fill` để 1–2 thẻ không phình hết chiều ngang.
- Kiểm: ảnh CDP 1920, sidebar thu gọn, `/approvals` và `/school/roles`: nội dung kín ngang, thẻ kín hàng, 0 lỗi console.
- Kiểu thẻ số liệu mới: trang chọn `the-chon.html` (scratchpad phiên) 5 phương án T1–T5, chờ user chọn.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Thẻ số liệu T2 + bảng thụt vào trong card (chờ review)

- Commit: chưa commit
- User chọn thẻ **T2** (icon lớn mờ ở góc, nền chuyển nhẹ theo tông, số to màu đậm, mũi tên ›) cho thẻ số liệu/lọc ở 14 trang danh sách.
- Đã làm: `StatCardIcon` mới (icon theo tông, vì tông đã có nghĩa thống nhất như `StatusBadge`; có prop `icon` để đổi riêng) chèn sau nhãn 17 thẻ; viết lại CSS `.stat-card` (thêm tông gray/teal); gỡ 9 style `gridTemplateColumns` inline còn đè lưới tự giãn.
- Bảng: user báo bảng sát viền card (vd. `/school/classes`). `.card > .table-wrap` giờ thụt vào (lề trên 16, hai bên/dưới 24, viền + bo 16), phân trang ngay sau bảng bỏ kẻ trên; ô đầu/cuối bảng đệm 20px.
- Kiểm: ảnh CDP 1440 `/school/classes`, `/approvals`, `/children`, `/facility/issues`: 0 lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Toast nền màu có thanh đếm ngược rõ (chờ review)

- Commit: chưa commit
- User muốn toast nền màu kèm thanh đếm ngược. Thanh đã có nhưng không thấy: máy user tắt "Hiệu ứng hoạt ảnh" của Windows ⇒ Chrome `prefers-reduced-motion: reduce` ⇒ `base.css` ép mọi animation 0,01ms và `components.css` ẩn thanh.
- Sửa: thanh 3px màu tông + rãnh nhạt (`.toast::after`); khối giảm chuyển động chừa `.toast__timer` (thanh mang thông tin thời gian, chỉ co ngang), bỏ rule ẩn thanh.
- Lưu ý: trên máy user mọi chuyển động trang trí khác (ba chấm, sọc chạy, mở hộp thoại…) vẫn tắt theo cài đặt Windows — đúng thiết kế.
- Kiểm: ảnh CDP toast "Đăng nhập thành công" thấy thanh đang chạy.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Topbar: tìm chức năng + Tạo nhanh (phương án A, chờ review)

- Commit: chưa commit
- User chọn A (trang chọn `topbar-chon.html`, scratchpad phiên): ô tìm ở giữa, nút "Tạo nhanh", năm học, chuông.
- Phạm vi tìm: chức năng/màn hình trong menu của vai trò (client, không gọi BE) — BE chưa có API tìm dữ liệu chung nên không tìm trẻ/phiếu. Muốn tìm dữ liệu ⇒ cần BE thêm endpoint (đề xuất riêng).
- Đã làm: `src/layouts/quickActions.js` (14 trang tạo mới, `roles` chép theo RoleGuard của `AppRoutes.jsx`, chỉ ẩn/hiện); `HeaderSearch.jsx` (combobox ARIA, tìm không dấu, Ctrl K, ↑↓/Enter/Esc, tô chữ khớp); `QuickCreateMenu.jsx` (ẩn khi vai trò không có mục nào); `Header.jsx` nhận `role` từ `MainLayout`; CSS topbar ≤1280 ẩn chữ "Năm học", ≤1024 nút Tạo nhanh chỉ còn icon; thêm icon `Target`, `ArrowLeftRight`.
- Kiểm: CDP Giáo viên + Phó hiệu trưởng ở 1440 (gõ "diem" ra mục có "điểm"; Tạo nhanh PHT 7 mục) và 1024: 0 lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Bộ màu tông trạng thái "Trời logo", chờ duyệt đổi tím → vàng (chờ review)

- Commit: chưa commit
- User chọn bộ 01 "Trời logo" (trang so sánh 10 bộ màu, artifact phiên) nhưng muốn "chờ duyệt" màu vàng kiểu warning vì là việc quan trọng.
- Đã làm: `tokens.css` thêm `--gold-*` (thay `--violet-*`) và nhóm `--tone-*` (blue, approval, orange, red, green, gray, teal + `-fg` đạt AA); alias `--purple*` trỏ sang vàng nên mọi chỗ cũ (widget Chờ bạn duyệt, KPI, alert/chip nháp AI, chênh lệch kiểm kê) đổi theo. `components.css`: chip, thẻ số liệu, thanh tiến trình dùng `--tone-*`; số thẻ vàng dùng màu chữ đậm; avatar tông 4 tím → ngọc.
- Cam (chờ người khác) đẩy sang cam rõ `#f5820b` để không trùng vàng chờ duyệt. Alert, nút, dấu chấm trạng thái vẫn dùng `--color-success/warning/danger` cũ (nút xanh lá chữ trắng cần nền đậm).
- Tên tông `purple` giữ nguyên trong JSX/CSS để không đổi ~30 file.
- Kiểm: chưa chụp ảnh trang thật (máy không có Playwright, trang cần đăng nhập).
- Verify: xem dòng VERIFY.

### 2026-10-09 — Nút thu gọn sidebar vào sidebar + logo về Trang chủ (chờ review)

- Commit: chưa commit
- User: nút 3 gạch ở topbar chuyển vào sidebar, đổi icon; bấm logo không về Trang chủ.
- Đã làm: hàng đầu sidebar = logo (`Link` về `/`) + nút thu gọn (icon Tabler `layout-sidebar-left-collapse`/`-expand`); sidebar thu gọn thì logo trên, nút dưới; ngăn kéo màn hẹp thì nút là ✕. Header chỉ còn nút mở menu khi màn hẹp (<1024px). Thêm icon `SidebarCollapse`, `SidebarExpand`.
- Kiểm: CDP 1440 (bấm logo từ `/children` ⇒ `/`; thu gọn/mở rộng đúng; header không còn nút) và 900 (nút topbar mở ngăn kéo, ✕ đóng): 0 lỗi console.
- Verify: xem dòng VERIFY.

### 2026-10-09 — Hồ sơ cá nhân bố cục B (cột hồ sơ trái), tranh đầu trang nhạt hơn (chờ review)

- Commit: chưa commit
- Tranh vẽ ở dải đầu trang: opacity 0.8 → 0.55 theo yêu cầu "mờ hơn".
- Hồ sơ cá nhân: user chọn B trong wireframe 3 phương án (artifact phiên). Cột trái: avatar 88px, tên, vai trò, lớp · điểm trường, email, SĐT, tên đăng nhập (khi có), nút Cập nhật hồ sơ / Đổi mật khẩu. Phải: Thông tin cá nhân và liên hệ (nhãn trên giá trị, 2 cột; sửa tại chỗ, giới tính dạng nút chọn), Công việc (vai trò, điểm trường, nhóm tuổi · lớp, phân công đang hiệu lực có ngày), Đăng nhập và bảo mật. Trường trống hiện "Chưa cập nhật".
- Mock `getProfile` trả thêm `assignments` (dạng `StaffAssignmentSummaryResponse`, chỉ năm học đang hoạt động). Lịch sử phân công trong wireframe bị bỏ vì BE chỉ trả phân công còn hiệu lực.
- Lệch contract: BE chưa có `/me/profile` ⇒ `FE-CASE-261009-profile-api-not-in-be`.
- Kiểm: chưa chụp ảnh trang thật (máy không có Playwright).
- Verify: xem dòng VERIFY.

### 2026-10-09 — Tranh nền nhạt hơn (chờ review)

- Commit: chưa commit
- User: tranh vẽ phía sau mờ hơn. `--scene-veil` 82%→66% đổi thành 93%→86% (lớp phủ trắng trên tranh nền của `.app-shell`); tranh ở dải đầu trang không đổi.
- Ghi nhận: `tokens.css` đã được sửa ngoài phiên (14:40) — `--purple*` trỏ sang vàng chờ duyệt (`--tone-approval`, `--gold-*`); có chủ đích, không đụng.
- Kiểm: ảnh CDP `/approvals` 1440. Verify: xem dòng VERIFY.
