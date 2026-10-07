# CareNest – Design & Coding Guide

Tài liệu chung cho **mọi người code giao diện CareNest**. Trước khi làm màn hình / module mới: đọc file này, mở trang **`/ui-kit`** (khi chạy `npm run dev`: menu tài khoản → _Thư viện giao diện_) để xem trực tiếp component và mã màu.

> Nguyên tắc vàng: **không tự chế** màu, nút, bảng, modal, badge. Dùng lại cái đã có. Thiếu thì thêm vào phần dùng chung (component: mục 7, CSS: mục 9) để cả nhóm cùng dùng.

---

## Mục lục

1. [Chạy dự án & lệnh](#1-chạy-dự-án--lệnh)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Thương hiệu & logo](#3-thương-hiệu--logo)
4. [Màu sắc (design tokens)](#4-màu-sắc-design-tokens)
5. [Chữ, khoảng cách, bo góc, đổ bóng](#5-chữ-khoảng-cách-bo-góc-đổ-bóng)
6. [Màu trạng thái (StatusBadge)](#6-màu-trạng-thái-statusbadge)
7. [Component dùng chung](#7-component-dùng-chung)
8. [Khung ứng dụng & mẫu bố cục màn hình](#8-khung-ứng-dụng--mẫu-bố-cục-màn-hình)
9. [CSS: viết ở đâu, đặt tên thế nào](#9-css-viết-ở-đâu-đặt-tên-thế-nào)
10. [Kiến trúc code & luồng dữ liệu](#10-kiến-trúc-code--luồng-dữ-liệu)
11. [Quy trình thêm module mới (từng bước)](#11-quy-trình-thêm-module-mới-từng-bước)
12. [Quy tắc nghiệp vụ chung: phân quyền, trạng thái, chữ ký, in ấn](#12-quy-tắc-nghiệp-vụ-chung)
    - [12.0 Đăng nhập & phiên làm việc](#120-đăng-nhập--phiên-làm-việc)
13. [Viết chữ trên giao diện (UX copy)](#13-viết-chữ-trên-giao-diện-ux-copy)
14. [Trạng thái tải, lỗi, rỗng, xác nhận](#14-trạng-thái-tải-lỗi-rỗng-xác-nhận)
15. [Code style, đặt tên, lint](#15-code-style-đặt-tên-lint)
16. [Nối Spring Boot (bỏ mock)](#16-nối-spring-boot-bỏ-mock)
17. [Checklist trước khi tạo PR](#17-checklist-trước-khi-tạo-pr)

---

## 1. Chạy dự án & lệnh

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint         # ESLint (bắt buộc 0 lỗi)
npm run format       # Prettier tự format
npm run check        # lint + format:check + build  → chạy trước khi push
npm run build
```

`.env` (copy từ `.env.example`):

| Biến                | Ý nghĩa                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `VITE_API_BASE_URL` | URL backend Spring Boot, ví dụ `http://localhost:8080/api`       |
| `VITE_USE_MOCK`     | `true` = dùng dữ liệu giả (localStorage), `false` = gọi API thật |

Đăng nhập: mở app sẽ tự chuyển tới `/login`. Khi `VITE_USE_MOCK=true`, dưới form có danh sách **tài khoản demo** (mật khẩu `123456`) – bấm một tài khoản để điền sẵn; khi nối backend thật (`VITE_USE_MOCK=false`) danh sách này tự ẩn.
Muốn thử vai trò khác: menu tài khoản → _Đăng xuất_ → đăng nhập tài khoản khác. Reset dữ liệu demo: menu tài khoản → _Khôi phục dữ liệu demo_ (chỉ có ở chế độ mock).

---

## 2. Cấu trúc thư mục

```
(gốc dự án)
  DESIGN.md            tài liệu này
  README.md            cách chạy, tài khoản demo, routes
  mockups/             ảnh thiết kế gốc theo module (chuẩn để code giao diện, không import vào code)
    brand/             logo gốc
    <ten-module>/      ví dụ facility-transfer/LuanChuyen1.png …
  public/              favicon
  src/                 mã nguồn (bên dưới)
```

Mã nguồn tổ chức theo **layer-first + module grouping**: các layer lớn nằm trực tiếp trong `src/`. Bên trong mỗi layer, phần riêng của từng nghiệp vụ được nhóm theo module (`education-plan/`, `facility-transfer/`, `inventory-inspection/`…). Phần dùng chung nhiều module nằm ở gốc của layer.

| Nhóm layer           | Thư mục                                                                   | Vai trò                                                                                     |
| -------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1. Presentation      | `src/pages/`, `src/components/`, `src/hooks/`                             | Trang, component, hook đọc dữ liệu cho UI                                                   |
| 2. Business / Domain | `src/services/`, `src/models/`, `src/utils/`                              | Service facade cung cấp nghiệp vụ cho UI; hằng số trạng thái, nhãn; validation, permissions |
| 3. Data access       | `src/services/<module>/mock/`, `src/services/<module>/api/`, `src/mocks/` | Repository giả (localStorage) hoặc gọi axios tới Spring Boot – UI không phụ thuộc trực tiếp |

```
src/
  assets/brand/          logo-mark.png, logo-full.png
  components/            UI – import phần dùng chung từ '@/components'
    ui/                  Modal, ConfirmationModal, States, Breadcrumb, SearchSelect, Avatar, StatusBadge,
                         ProgressBar, ProgressSteps, Stepper, Pagination
    brand/               Logo, LogoMark, LogoFull, Wordmark
    signature/           SignaturePicker, SignatureUploader
    upload/              FileUploader, ImageUploader
    asset/               AssetThumb, ConditionBadge, ConditionSelect
    print/               PrintHeader, PrintToolbar
    form/                FormField, PasswordInput
    education-plan/      component riêng Kế hoạch giáo dục (eduUi, PlanWidgets, modal, layout route…)
    facility-transfer/   component riêng Luân chuyển (wizard/, card, modal, picker…)
    inventory-inspection/ component riêng Kiểm kê
    index.js             barrel export phần dùng chung
  pages/                 các trang (export default)
    auth/                LoginPage
    education-plan/      GoalListPage, ThemeFormPage, LessonFormPage, PlanReviewPage…
    facility-transfer/   TransferListPage, CreateTransferPage, HandoverPage…
    inventory-inspection/ InspectionListPage, InspectionSheetPage…
    HomePage.jsx, NotificationsPage.jsx, UiKitPage.jsx (+ ui-kit.css), ComingSoonPage.jsx, NotFoundPage.jsx
  hooks/                 dùng chung: useAsync, useMasterData, useSignatures, useNotifications, useLockedLocations,
                         usePageTitle, useClickOutside, index.js
    education-plan/      useEducationPlan (provider dữ liệu của module)
    facility-transfer/   useTransfers, useTransferWizard, useAvailableAssets
    inventory-inspection/ useInspections
  services/
    http/                axiosClient, tokenStorage
    authService.js, masterDataService.js, signatureService.js, notificationService.js, facilityLockService.js
    education-plan/      educationPlanService.js (facade) + mock/ + api/
    facility-transfer/   transferService.js (facade) + mock/ + api/
    inventory-inspection/ inspectionService.js (facade) + mock/ + api/
  models/                dùng chung: User/ROLES, Campus, Location, Asset, Signature, Notification, index.js
    education-plan/      educationPlanConstants (trạng thái, nhãn, lĩnh vực, khung giờ…)
    facility-transfer/   FacilityTransfer, FacilityTransferItem, transferConstants…
    inventory-inspection/ InspectionRound, inspectionConstants
  utils/                 dùng chung: format.js (ngày, tìm kiếm bỏ dấu), file.js (nén ảnh, tải file), id.js,
                         exportPdf.js, exportCsv.js
    education-plan/      breadcrumbs
    facility-transfer/   transferValidation, transferPermissions, breadcrumbs, printModel, exportTransfer
    inventory-inspection/ inspectionValidation, inspectionPermissions, inspectionScope, breadcrumbs
  config/                env.js, app.js (tên app, tên trường, phiên bản, năm học), printTemplate.js (thông tin in trên phiếu)
  contexts/              AuthContext (useAuth), ToastContext (useToast), SchoolYearContext (useSchoolYear)
  layouts/               MainLayout (app sau đăng nhập), AuthLayout (trang đăng nhập…), Sidebar, Header, Footer,
                         NotificationBell, UserMenu, menuConfig.js (menu duy nhất cho mọi vai trò)
  mocks/                 "backend giả": mockDatabase, seed, *Seed, các *MockRepository dùng chung
  routes/                AppRoutes, ProtectedRoute / GuestRoute (bắt đăng nhập), RoleGuard (bắt vai trò)
  styles/                tokens.css, base.css, components.css, utilities.css, print.css, index.css
    modules/             education-plan.css, facility-transfer.css, inventory-inspection.css (style riêng module)
  App.jsx, main.jsx
```

Luồng phụ thuộc giữa các layer:

```
Page / Component
       ↓
Service facade (src/services/<module>/<x>Service.js)
       ↓
 ┌───────────────┐
 │               │
Mock            API
 │               │
localStorage   Axios
                 ↓
             Spring Boot
```

Module hiện có: `auth` (Đăng nhập), `education-plan` (Kế hoạch giáo dục – tiền tố CSS `ga-`), `facility-transfer` (Luân chuyển tài sản), `inventory-inspection` (Kiểm kê tài sản).

**Import:**

- Luôn dùng alias `@/` (= `src/`), kể cả giữa các file cùng module.
  ```js
  import { Modal, StatusBadge } from '@/components';
  import { useMasterData } from '@/hooks';
  import { formatDate } from '@/utils/format';
  import { createTransferItem } from '@/models/facility-transfer/FacilityTransferItem';
  import TransferAssetTable from '@/components/facility-transfer/TransferAssetTable';
  ```
- Code của module A (`*/education-plan/`) **không import** code riêng của module B (`*/facility-transfer/`). Cần dùng chung → chuyển lên gốc layer: `src/components`, `src/hooks`, `src/services`, `src/models`, `src/utils`.
  (Ngoại lệ duy nhất: trang tổng hợp ở gốc `src/pages`, ví dụ Trang chủ, được đọc hook/quyền của nhiều module.)

---

## 3. Thương hiệu & logo

| File                             | Dùng ở đâu                                                             | Component                                                                |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/assets/brand/logo-mark.png` | Biểu tượng (mẹ bế bé), sidebar, đầu bản in                             | `<LogoMark size={40} />`                                                 |
| `src/assets/brand/logo-full.png` | Logo gốc biểu tượng + chữ (trang đăng nhập, splash)                    | `<LogoFull width={160} />`                                               |
| Chữ "CareNest" hai màu           | Cạnh biểu tượng                                                        | `<Wordmark />` → **Care** `--brand-blue-700`, **Nest** `--brand-sky-400` |
| `public/favicon.png`             | Tab trình duyệt                                                        | –                                                                        |
| `mockups/brand/logo.jpg`         | Logo gốc – nguồn để cắt các file trên, không dùng trực tiếp trong code | –                                                                        |

Quy tắc:

- Sidebar: `<Logo />` (biểu tượng + chữ ngang), thu gọn: `<Logo collapsed />`. **Không** thêm dòng phụ "Trường Mầm Non".
- Không kéo méo, đổi màu, thêm bóng cho logo. Nền logo luôn sáng.
- Tên trường, địa chỉ, SĐT trên bản in lấy từ `src/config/printTemplate.js` (không gõ cứng trong trang).

---

## 4. Màu sắc (design tokens)

**Chỉ định nghĩa màu trong `src/styles/tokens.css`.** Mọi nơi khác dùng `var(--token)`. Không viết `#xxxxxx` trong CSS/JSX. Ngoại lệ duy nhất: `print.css` + nền trắng khi xuất PDF (màu giấy in), và màu avatar riêng của từng user (`user.avatarColor` từ dữ liệu).

### 4.1 Thương hiệu (lấy từ logo)

| Token              | Mã        | Dùng cho                          |
| ------------------ | --------- | --------------------------------- |
| `--brand-blue-700` | `#0269c5` | Chữ "Care", điểm nhấn thương hiệu |
| `--brand-blue-600` | `#1675cf` | Thân hình mẹ trong logo           |
| `--brand-sky-400`  | `#4fb0f5` | Chữ "Nest"                        |
| `--brand-sky-300`  | `#71c6fd` | Nền minh họa, sóng                |
| `--brand-mint-300` | `#94debd` | Điểm nhấn phụ (minh họa, biểu đồ) |

### 4.2 Hành động chính

| Token                                        | Mã                    | Dùng cho                                             |
| -------------------------------------------- | --------------------- | ---------------------------------------------------- |
| `--primary`                                  | `#1565e0`             | Nút chính, link, tab đang chọn, focus, bước hiện tại |
| `--primary-600`                              | `#0f55c4`             | Hover nút chính                                      |
| `--primary-100`                              | `#d6e6fd`             | Viền focus (box-shadow 3px)                          |
| `--primary-50`                               | `#eaf2fe`             | Nền chip xanh, mục đang chọn                         |
| `--primary-25`                               | `#f3f8ff`             | Nền nhẹ khối thông tin                               |
| `--primary-hover-bg` / `--primary-active-bg` | `#e6eefb` / `#e2ecfc` | Hover / active menu                                  |

> Màu `--primary` giữ theo mockup đã duyệt; màu brand dùng cho logo và điểm nhấn.

### 4.3 Ngữ nghĩa

| Ý nghĩa         | Màu chính                                                  | Nền                             | Viền               | Dùng cho                      |
| --------------- | ---------------------------------------------------------- | ------------------------------- | ------------------ | ----------------------------- |
| Thành công      | `--success #12a150`                                        | `--success-50` / `--success-25` | `--success-border` | Hoàn thành, đã ký, đã duyệt   |
| Cảnh báo        | `--warning #e8890c`                                        | `--warning-50` / `--warning-25` | `--warning-border` | Đang chờ, cần chú ý, lệch số  |
| Lỗi / nguy hiểm | `--danger #e03131`                                         | `--danger-50` / `--danger-25`   | `--danger-border`  | Lỗi, xóa, hủy, hư hỏng, thiếu |
| Chờ duyệt       | `--purple #7048e8`                                         | `--purple-50` / `--purple-25`   | `--purple-border`  | Chờ PHT duyệt, chênh lệch     |
| Thông tin       | `--teal #0c8599` (chữ trên nền nhạt: `--teal-700 #0a6e7f`) | `--teal-50`                     | –                  | Nhãn vai trò                  |
| Hướng dẫn       | `--primary`                                                | `--info-bg #eef5ff`             | `--info-border`    | Alert info                    |

### 4.4 Chữ, viền, nền

| Token             | Mã                   | Dùng cho                                                                              |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------- |
| `--text`          | `#1b2433`            | Chữ chính                                                                             |
| `--text-2`        | `#4a5568`            | Chữ phụ, nhãn                                                                         |
| `--text-3`        | `#66728a`            | Placeholder, chú thích, chữ mờ (`.muted`) – tương phản 4.8:1 trên nền trắng (WCAG AA) |
| `--text-inverse`  | `#ffffff`            | Chữ trên nền màu                                                                      |
| `--border`        | `#e3e9f2`            | Viền card, bảng                                                                       |
| `--border-strong` | `#cdd6e3`            | Viền input, nút thường                                                                |
| `--border-dashed` | `#b9c6d8`            | Viền vùng kéo-thả                                                                     |
| `--line-muted`    | `#d5dde8`            | Đường nối timeline/stepper                                                            |
| `--bg`            | `#f5f8fc`            | Nền trang                                                                             |
| `--surface`       | `#ffffff`            | Nền card, modal, input                                                                |
| `--surface-soft`  | `#f8fafc`            | Nền khối phụ, header bảng                                                             |
| `--surface-hover` | `#f7faff`            | Hover dòng bảng                                                                       |
| `--sidebar-bg`    | `#f3f7fd`            | Nền sidebar                                                                           |
| `--gray-50`       | `#f1f3f6`            | Nền chip xám, input disabled                                                          |
| `--overlay`       | `rgba(15,23,42,.45)` | Nền mờ sau modal                                                                      |

### 4.5 Chữ đậm trên nền màu nhạt, màu phụ

| Token                                              | Mã                    | Dùng cho                                        |
| -------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `--success-700` / `--success-800`                  | `#0b7a3b` / `#0b5e2f` | Chữ trong chip xanh lá / alert success          |
| `--warning-700` / `--warning-800`                  | `#9a5100` / `#8a4b00` | Chữ trong chip cam, nút warning / alert warning |
| `--danger-700` / `--danger-800`                    | `#c92a2a` / `#9b1c1c` | Chữ trong chip đỏ / alert danger                |
| `--info-700`, `--purple-700`                       | `#1d3f7a`, `#4d2db7`  | Chữ trong alert info / purple                   |
| `--disabled`                                       | `#adb5bd`             | Bước bị hủy, phần tử vô hiệu                    |
| `--skeleton`                                       | `#eef1f5`             | Khối loading skeleton                           |
| `--file-pdf / -archive / -image / -sheet / -other` | theo màu ngữ nghĩa    | Icon loại file trong FileUploader               |
| `--warning-border-strong`                          | `#f7c879`             | Viền nút warning                                |
| `--warning-hover-bg`                               | `#ffe9c7`             | Nền hover nút warning                           |
| `--danger-hover-bg`                                | `#ffecec`             | Nền hover dòng/nút nguy hiểm                    |
| `--success-border-soft`                            | `#c7ebd4`             | Viền khối nền xanh lá nhạt                      |
| `--danger-border-soft`                             | `#f2a5a5`             | Viền nút outline-danger                         |
| `--asset-icon`                                     | `#5b7bb5`             | Icon minh họa khi tài sản chưa có ảnh           |
| `--placeholder-avatar`                             | `#cbd5e1`             | Avatar khi chưa có người dùng                   |
| `--neutral-avatar`                                 | `#64748b`             | Avatar khi user chưa có màu riêng               |

Cần màu mới? **Thêm token vào `tokens.css`** (đặt tên theo ý nghĩa, không theo màu), cập nhật bảng này, rồi mới dùng.

---

## 5. Chữ, khoảng cách, bo góc, đổ bóng

**Font:** `Be Vietnam Pro` – token `--font` (đã nạp ở `index.html`, hỗ trợ tiếng Việt). Bản in dùng `Tinos` (giống Times New Roman).

| Cấp                                            | Class               | Token cỡ chữ    | Cỡ / độ đậm |
| ---------------------------------------------- | ------------------- | --------------- | ----------- |
| Tiêu đề trang                                  | `.page__title`      | `--fs-2xl`      | 28px / 700  |
| Tiêu đề khối                                   | `.section-title`    | `--fs-xl`       | 18px / 600  |
| Tiêu đề card                                   | `.card__title`      | `--fs-lg`       | 16px / 600  |
| Tiêu đề nhỏ                                    | `.subsection-title` | `--fs-title-sm` | 15px / 600  |
| Nội dung                                       | (mặc định body)     | `--fs-md`       | 14px / 400  |
| Chú thích, nhãn bảng, chip                     | `.text-sm`          | `--fs-sm`       | 13px        |
| Chữ rất nhỏ (ngày giờ, mã phụ, lỗi trong bảng) | `.text-xs`          | `--fs-xs`       | 12px        |
| Chữ siêu nhỏ (nhãn trong chip, ghi chú phụ)    | `.text-2xs`         | `--fs-2xs`      | 11px        |
| Tiêu đề lớn ngoài app, số thống kê             | –                   | `--fs-h2`       | 24px        |

Chỉ dùng 9 cỡ chữ trên. Trong CSS viết `font-size: var(--fs-sm)`; trong JSX dùng class `.text-2xs/.text-xs/.text-sm/.text-md/.text-lg/.text-h2` – **không** viết `style={{ fontSize: 13 }}`. (`print.css` dùng cỡ chữ riêng của giấy in A4.)

**Độ đậm:** chỉ 4 mức, mỗi mức một vai trò:

| Mức | Dùng cho                                                              |
| --- | --------------------------------------------------------------------- |
| 400 | Nội dung thường                                                       |
| 500 | Nút, nhãn ô nhập, tab, mục menu                                       |
| 600 | Tiêu đề khối/card, chữ cần nhấn mạnh (`.fw-600`), mã chứng từ         |
| 700 | Tiêu đề trang, tiêu đề trang đăng nhập, số thống kê lớn, chữ CareNest |

**Khoảng cách** theo lưới 4px: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32. Khoảng cách giữa các card: 16px (`.mt-16`). Padding card: 16–20px.
CSS mới viết `padding: var(--space-4)`. (CSS cũ còn vài giá trị lẻ 6/10/14px cho chi tiết rất nhỏ như chip, ô số lượng – không bắt chước, không cần sửa.)

**Bo góc:** `--radius` 8px (input, nút, bảng) · `--radius-lg` 12px (card, modal) · 999px (chip).

**Đổ bóng:** `--shadow-sm` cho card; `--shadow-md` cho dropdown, modal, toast, card khi hover. Vòng sáng khi focus / được chọn: `--focus-ring` (`0 0 0 3px var(--primary-100)`). Không dùng bóng khác.

**Màn hình:** tối ưu desktop ≥ 1366px. Chỉ dùng 2 mốc `@media`:

- `max-width: 1280px` – lưới 2–3 cột (`.grid-2`, `.split-2`, form 2 cột…) xuống 1 cột;
- `max-width: 900px` – trang đăng nhập ẩn cột thương hiệu.

---

## 6. Màu trạng thái (StatusBadge)

Mỗi trạng thái nghiệp vụ được gán **một tông** theo bảng sau. Áp dụng cho mọi module để người dùng nhìn màu là hiểu.

| Tông     | Ý nghĩa                                  | Ví dụ                                    |
| -------- | ---------------------------------------- | ---------------------------------------- |
| `gray`   | Nháp, đã hủy, không hoạt động            | Bản nháp, Đã hủy                         |
| `orange` | Đang chờ **người khác** làm              | Chờ bàn giao, Chờ kiểm kê                |
| `blue`   | Đang thực hiện                           | Đang kiểm kê, Chờ xác nhận nhận          |
| `purple` | Chờ **duyệt / phê duyệt**, có chênh lệch | Đã nộp – chờ duyệt, Chờ xử lý chênh lệch |
| `red`    | Cần xử lý, bị trả lại                    | Cần điều chỉnh, Yêu cầu kiểm lại         |
| `green`  | Hoàn tất                                 | Hoàn thành, Đã duyệt                     |
| `teal`   | Nhãn thông tin                           | Vai trò "Người nhận"                     |

Cách khai báo badge cho module mới:

```jsx
// src/components/<module>/XStatusBadge.jsx
import { FileEdit, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { X_STATUS_LABELS } from '@/models/<module>/xConstants';

export const XStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileEdit], PENDING: ['orange', Clock], DONE: ['green', CheckCircle2], CANCELLED: ['gray', XCircle] },
  X_STATUS_LABELS,
);

// dùng: <XStatusBadge status={item.status} />   hoặc size="lg" ở đầu trang chi tiết
```

Tình trạng tài sản dùng `<ConditionBadge value="GOOD|NORMAL|NEED_REPAIR|BROKEN" />` (Tốt xanh lá, Bình thường xanh dương, Cần sửa cam, Hỏng đỏ) – màu nằm ở class `.cond--good/normal/need-repair/broken`, không viết inline.

**Nhãn phân loại (không phải trạng thái)** dùng `.chip--<tông>` theo cùng ý nghĩa màu:

| Nhãn                                                                      | Tông                                |
| ------------------------------------------------------------------------- | ----------------------------------- |
| Vai trò của tôi / người liên quan ("Người bàn giao", "Người nhận", "Tôi") | `teal`                              |
| Thiếu, hư hỏng                                                            | `red`                               |
| Thừa, lệch sổ sách                                                        | `orange`                            |
| Số đếm trong tab                                                          | `.tab__count` (tự đổi màu theo tab) |

---

## 7. Component dùng chung

Import từ `@/components`. Xem ví dụ chạy được + code mẫu tại **`/ui-kit`**.

| Nhu cầu               | Component / class                                                                                                                                                                                          | Ghi chú                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----- | ------------------- |
| Nút                   | `.btn` (mặc định) + biến thể `.btn--primary` `.btn--outline-primary` `.btn--warning` `.btn--danger` `.btn--outline-danger` `.btn--success` `.btn--ghost`; cỡ `.btn--sm` `.btn--lg`; rộng hết `.btn--block` | Icon lucide 16px đặt trước chữ                       |
| Ô nhập (khuyên dùng)  | `<FormField label required error hint>` bọc `<input className="input" />`                                                                                                                                  | Tự gắn id, aria, class lỗi                           |
| Mật khẩu              | `<PasswordInput />`                                                                                                                                                                                        | Có nút hiện/ẩn                                       |
| Ô nhập (HTML thuần)   | `.field` > `.field__label` + `.input/.select/.textarea` + `.field__error`                                                                                                                                  | Lỗi: thêm `.input--error`                            |
| Form nhãn ngang       | `.form-row` > `.form-row__label` + `.form-row__control`                                                                                                                                                    | Dùng cho form dài (như wizard)                       |
| Chọn có tìm kiếm      | `<SearchSelect options value onChange />`                                                                                                                                                                  | Danh sách người, tài sản                             |
| Card                  | `.card` (+ `.card--soft-header`) > `.card__header` `.card__title` `.card__body`                                                                                                                            |                                                      |
| Bảng                  | `.table-wrap` > `table.table` (`.table--compact`), cột `.center` `.right`                                                                                                                                  | Dòng bấm được: `.row-click`                          |
| Badge                 | `<StatusBadge>`, `createStatusBadge`, `.chip--gray/orange/blue/purple/red/green/teal`, cỡ lớn `.chip--lg`                                                                                                  | Mục 6                                                |
| Tiến độ               | `<ProgressBar value total tone />`                                                                                                                                                                         | `tone`: `primary` (đang làm), `green` (đủ), `purple` |
| Thống kê              | `.stat-grid` > `button.stat-card.stat-card--blue/orange/red/purple/green` (+ `.stat-card--active`)                                                                                                         | Bấm để lọc                                           |
| Bộ lọc                | `.filter-bar` + `.search-box`                                                                                                                                                                              |                                                      |
| Tab                   | `.tabs` > `button.tab` (`.tab--active`, `.tab__count`)                                                                                                                                                     |                                                      |
| Wizard nhiều bước     | `<Stepper steps current maxReached onStepClick />` + mỗi bước một `.card.wizard-card`                                                                                                                      | Bước đã qua bấm được để quay lại                     |
| Tiến trình chứng từ   | `<ProgressSteps steps={[{ label, sub, done, warn }]} cancelled />`                                                                                                                                         | Dùng ở đầu mọi trang chi tiết                        |
| Phân trang            | `<Pagination page total onChange unit="phiếu" />` + `paginate(items, page)`                                                                                                                                | Mặc định 8 dòng/trang                                |
| Thông tin đọc         | `dl.info-list` (`.info-list--wide`), `.info-columns`                                                                                                                                                       |                                                      |
| Thông báo trong trang | `.alert.alert--info/success/warning/danger/purple`                                                                                                                                                         | Icon 18px đứng đầu                                   |
| Modal                 | `<Modal open title onClose footer size="md                                                                                                                                                                 | lg                                                   | xl">` | Esc đóng, giữ focus |
| Xác nhận              | `<ConfirmationModal open title message confirmLabel danger onConfirm onClose>`                                                                                                                             | `onConfirm` được phép async                          |
| Toast                 | `const toast = useToast(); toast.success/error/warning/info(msg, title?)`                                                                                                                                  |                                                      |
| Tải / rỗng / lỗi      | `<LoadingState>`, `<SkeletonRows>`, `<EmptyState>`, `<ErrorState onRetry>`, `<Spinner small>`                                                                                                              |                                                      |
| Breadcrumb            | `<Breadcrumb items={[{label,to}]} />`                                                                                                                                                                      |                                                      |
| Chữ ký                | `<SignaturePicker value onChange />` (dạng tab), `variant="compact"` (dạng gọn)                                                                                                                            | Tự chọn chữ ký mặc định                              |
| Ô ký trên tài liệu    | `.sig-slots` > `.sig-slot` (+ `.sig-slot--signed` đã ký, `.sig-slot--me` ô của tôi)                                                                                                                        |                                                      |
| Upload file           | `<FileUploader files onChange />`                                                                                                                                                                          | ≤ 10MB                                               |
| Ảnh bằng chứng        | `<ImageUploader images onChange max={3} />`                                                                                                                                                                | Tự nén ảnh                                           |
| Tài sản               | `<AssetThumb>`, `<ConditionBadge>`, `<ConditionSelect>`                                                                                                                                                    |                                                      |
| In A4                 | `<div className="print-sheet"><PrintHeader />…</div>` + class `ps-*`                                                                                                                                       | Mục 12.4                                             |
| Thanh nút in          | `<PrintToolbar sheetRef fileBase onCsv printLabel="In phiếu" />`                                                                                                                                           | Xuất Excel · Xuất PDF · In                           |
| Xuất file             | `exportElementToPdf(el, name)` (`@/utils/exportPdf`), `downloadCsv(rows, name)` (`@/utils/exportCsv`)                                                                                                      | CSV có BOM cho Excel                                 |
| Bố cục 2 cột          | `.split-2`, `.grid-2`, `.grid-3`                                                                                                                                                                           |                                                      |
| Tiện ích              | `.row` `.stack` `.muted` `.text-2` `.text-xs/.text-sm…` `.fw-600` `.mt-8/12/16/24` `.mb-*` `.nowrap` `.sr-only`                                                                                            |                                                      |

Người đang đăng nhập: `const { user, hasRole, logout } = useAuth();` (mục 12.0).
Phòng đang bị khóa do kiểm kê: `useLockedLocations()`.
Dữ liệu dùng chung: `useMasterData()` → `campuses, locations, users, categories` + `campusById, locationById, userById, categoryById`.

---

## 8. Khung ứng dụng & mẫu bố cục màn hình

### 8.1 Khung ứng dụng (giống nhau cho mọi vai trò)

```
┌──────────┬──────────────────────────────────────────────────────────┐
│          │ Header 64px: ☰ thu gọn · Năm học ▾ · 🔔 · tài khoản ▾       │
│ Sidebar  ├──────────────────────────────────────────────────────────┤
│ 256px    │ .page  →  Breadcrumb  →  h1.page__title  →  nội dung       │
│ (72px    │                                                          │
│ khi thu  │                                                          │
│ gọn)     ├──────────────────────────────────────────────────────────┤
│          │ Footer: © năm · CareNest · tên trường | hỗ trợ · phiên bản │
└──────────┴──────────────────────────────────────────────────────────┘
```

| Phần            | File                                              | Quy tắc                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar         | `layouts/Sidebar.jsx` + `layouts/menuConfig.js`   | **Một** kiểu hiển thị cho mọi vai trò. Mỗi mục menu khai báo **một lần** (`LINKS`, `GROUPS`, `ITEMS`: tên, icon, route); `MENUS` chỉ chọn vai trò nào thấy mục nào. Cùng chức năng thì cùng tên, cùng icon, cùng vị trí. Không viết menu riêng trong trang |
| Header          | `layouts/Header.jsx`                              | Giống nhau cho mọi vai trò: nút thu gọn, chọn **năm học**, chuông thông báo, menu tài khoản. Không thêm nút riêng của module vào header                                                                                                                    |
| Năm học         | `contexts/SchoolYearContext.jsx`, `config/app.js` | `const { schoolYear } = useSchoolYear();` – module phụ thuộc năm học truyền `schoolYear` vào service                                                                                                                                                       |
| Thông báo       | `layouts/NotificationBell.jsx`                    | Module gửi thông báo bằng `pushNotification` (mock) / backend; không tự làm chuông riêng                                                                                                                                                                   |
| Menu tài khoản  | `layouts/UserMenu.jsx`                            | Thông tin tài khoản, đăng xuất (+ UI Kit khi dev, khôi phục dữ liệu khi mock)                                                                                                                                                                              |
| Footer          | `layouts/Footer.jsx`                              | Lấy tên app, tên trường, email hỗ trợ, phiên bản từ `config/app.js`; không sửa trong trang                                                                                                                                                                 |
| Breadcrumb      | `<Breadcrumb items />`                            | **Bắt buộc** ở dòng đầu mọi trang trong app (kể cả Trang chủ, trang lỗi). Luôn bắt đầu bằng `{ label: 'Trang chủ', to: '/' }`. Mục cuối tự thành **tiêu đề tab trình duyệt** (`<tên trang> · CareNest`)                                                    |
| Tiêu đề trang   | `h1.page__title`                                  | Ngay dưới breadcrumb, trùng hoặc rõ hơn mục cuối của breadcrumb                                                                                                                                                                                            |
| Trang ngoài app | `layouts/AuthLayout.jsx`                          | Đăng nhập, quên mật khẩu…; tự đặt tiêu đề tab từ `title`                                                                                                                                                                                                   |

### 8.2 Mẫu bố cục từng loại trang

Mọi trang sau đăng nhập nằm trong `MainLayout`; trang công khai dùng `AuthLayout`. Trang bắt đầu bằng:

```jsx
<div className="page">
  <Breadcrumb items={xCrumbs('Tên trang')} />
  <h1 className="page__title">Tên trang</h1>
  ...
</div>
```

| Loại trang                                  | Bố cục chuẩn                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Danh sách**                               | Tiêu đề + nút primary bên phải → `stat-grid` (lọc nhanh theo trạng thái) → `card` gồm `filter-bar` + bảng + `<Pagination>`. Rỗng: `EmptyState` có nút hành động                          |
| **Danh sách của tôi (giáo viên/nhân viên)** | Alert hướng dẫn → `tabs` theo trạng thái có số đếm → bảng có nút hành động chính từng dòng → `<Pagination>`                                                                              |
| **Tạo / sửa**                               | Form nhiều khối `card wizard-card` (hoặc wizard có `<Stepper>`) → khối chữ ký → `page-actions`: trái _Quay lại/Hủy_, phải _Lưu nháp_ + nút primary                                       |
| **Chi tiết**                                | Tiêu đề + `StatusBadge size="lg"` + nút hành động bên phải → `<ProgressSteps>` trong một `card` → alert việc cần làm → các card thông tin → **khối chữ ký ở dưới cùng** → `page-actions` |
| **Thao tác của người được giao**            | Alert hướng dẫn → thông tin → bảng nhập liệu → chữ ký của tôi → nút hành động                                                                                                            |
| **In**                                      | Trái nút _Quay lại_, phải `<PrintToolbar>` → `print-sheet` khổ A4 bắt đầu bằng `<PrintHeader />`                                                                                         |
| **Ngoài app (đăng nhập, quên mật khẩu…)**   | `<AuthLayout title subtitle footer>` – cột trái thương hiệu, card form bên phải, form dùng `FormField` + nút `btn--primary btn--lg btn--block`                                           |

Nút hành động trang: dùng `.page-actions` (trái: quay lại; phải: các nút chính, primary ở **cuối cùng bên phải**).

**Quy tắc nút primary:** mỗi **vùng hành động** (đầu trang, chân trang, footer modal) chỉ có **1** nút `.btn--primary` – đó là việc chính người dùng cần làm ở bước này (Gửi phiếu, Xác nhận bàn giao, Phê duyệt kết quả…). Ở các trang khác, In / Xuất / Xem trước luôn là nút thường `.btn`; riêng **trang in** thì _In_ là việc chính nên là primary (đã có sẵn trong `PrintToolbar`). Trong bảng, nút hành động chính của từng dòng được dùng `.btn--primary.btn--sm`.

---

## 9. CSS: viết ở đâu, đặt tên thế nào

| File                          | Nội dung                                                           | Ai sửa                            |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `styles/tokens.css`           | Biến màu, cỡ chữ, khoảng cách                                      | Thống nhất cả nhóm trước khi thêm |
| `styles/base.css`             | Reset, body, focus                                                 | Hiếm khi sửa                      |
| `styles/components.css`       | Class dùng chung (btn, card, table, alert, form, stepper, chữ ký…) | Khi thêm component dùng chung     |
| `styles/utilities.css`        | Helper nhỏ (`.row`, `.mt-16`…)                                     |                                   |
| `styles/print.css`            | Mẫu A4 `.print-sheet`, `ps-*`, `@media print`                      |                                   |
| `layouts/layout.css`          | Sidebar, header, dropdown, menu tài khoản                          |                                   |
| `layouts/auth.css`            | Trang đăng nhập / AuthLayout                                       |                                   |
| `styles/modules/<module>.css` | **Chỉ** style riêng của module                                     | Người làm module                  |

Quy tắc:

1. Tên class kiểu BEM: `.block`, `.block__element`, `.block--modifier` (ví dụ `.sig-slot__title`, `.chip--green`).
2. Không dùng mã màu trực tiếp → dùng token. Không dùng `!important` (ngoại lệ duy nhất: `print.css` và luật giảm chuyển động trong `base.css`). Cần ghi đè → tăng độ cụ thể của selector (ví dụ `.input.input--error`).
3. Style inline (`style={{…}}`) chỉ cho giá trị động (độ rộng %, màu avatar) hoặc căn chỉnh nhỏ một lần (gap, width). Màu và cỡ chữ **không** viết inline – dùng class / token.
4. Class đã có trong `components.css` thì **không viết lại** trong module.
5. Module thấy một mẫu dùng ở ≥ 2 chỗ → chuyển lên `components.css` + component trong `src/components`.
6. File CSS của module đặt trong `styles/modules/`, tên đúng tên module: `styles/modules/facility-transfer.css`. Import ở trang/component của module: `import '@/styles/modules/facility-transfer.css';`.
7. Class trong CSS module **mới** phải có tiền tố 2–3 chữ của module để không trùng (`kk-` = kiểm kê, ví dụ module Báo hỏng dùng `bh-`). Module Luân chuyển viết trước quy tắc này nên class chưa có tiền tố (tên đã đủ riêng: `campus-card`, `route-banner`…) – không đặt class mới trùng các tên đó.

---

## 10. Kiến trúc code & luồng dữ liệu

```
Page / Component
   │  chỉ gọi hook hoặc service
   ▼
hooks (useAsync, useXxx)  ──►  services/<module>/<x>Service.js  (facade)
                                     │  VITE_USE_MOCK ?
                         ┌───────────┴────────────┐
                         ▼                        ▼
   services/<module>/mock/<x>MockRepository   services/<module>/api/<x>Api.js (axios)
            (luật nghiệp vụ + localStorage)     (Spring Boot)
```

Bắt buộc:

- Page/component **không** import `@/mocks/*`, **không** dùng `localStorage` (ESLint tự báo lỗi). Các quy tắc còn lại dưới đây kiểm tra khi review PR.
- Mọi luật nghiệp vụ (chuyển trạng thái, kiểm quyền, tính tồn kho) viết ở **repository mock** – coi như backend. Backend Spring Boot phải làm lại đúng các luật này.
- Validation viết một lần trong `utils/<module>/<x>Validation.js`, dùng cho cả UI (báo lỗi ngay) và repository (chặn phía server).
- Quyền ai làm gì viết trong `utils/<module>/<x>Permissions.js` (hàm `canXxx(entity, user)`), dùng cho cả ẩn/hiện nút và kiểm tra phía server.
- Lỗi từ service có dạng `{ status, message }` → hiển thị `toast.error(err.message)`.
- Đọc dữ liệu: `useAsync(loader, deps, { refreshOnDataChange, enabled })`. Hook của module nhận thêm `{ live }` và truyền `refreshOnDataChange: live` (xem `useTransfer`); trang đang nhập liệu gọi `useXxx(id, { live: false })` để không bị tải lại mất dữ liệu đang gõ.
- Ghi xong: `reload({ silent: true })` – không reload cả trang.

---

## 11. Quy trình thêm module mới (từng bước)

Ví dụ module **Báo hỏng** (`facility-issue`). Mỗi bước đặt file vào đúng layer, trong thư mục con `facility-issue/` của layer đó (đường dẫn dưới đây tính từ `src/`):

0. **Mockup** – đặt ảnh thiết kế vào `mockups/facility-issue/` và thêm dòng mô tả vào `mockups/README.md`.
1. **Model** – `models/facility-issue/issueConstants.js`: `ISSUE_STATUS`, `ISSUE_STATUS_LABELS`, typedef.
2. **Quy tắc** – `utils/facility-issue/issueValidation.js` (trả về `{ field: message }`), `utils/facility-issue/issuePermissions.js` (`canApproveIssue(issue, user)`…).
3. **Mock backend** – `services/facility-issue/mock/issueMockRepository.js`: dùng `readDb`, `writeDb`, `delay`, `ApiError` từ `@/mocks/mockDatabase`; gửi thông báo bằng `pushNotification`. Thêm dữ liệu mẫu vào `mocks/seed.js` (`buildSeedDatabase`) và đọc an toàn `db.issues ||= []`.
4. **API thật** – `services/facility-issue/api/issueApi.js`: các hàm axios cùng tên/tham số với mock.
5. **Facade** – `services/facility-issue/issueService.js`: `const repo = USE_MOCK ? mock : api;` rồi export các hàm `getIssues`, `approveIssue`…
6. **Hook** – `hooks/facility-issue/useIssues.js` dùng `useAsync`.
7. **Badge** – `components/facility-issue/IssueStatusBadge.jsx` bằng `createStatusBadge` (mục 6).
8. **Trang** – `pages/facility-issue/IssueListPage.jsx`… theo mẫu mục 8. Breadcrumb: `utils/facility-issue/breadcrumbs.js`.
9. **Route** – `routes/AppRoutes.jsx`: thêm vào **bên trong** khối `<Route element={<ProtectedRoute />}>` → `<Route element={<MainLayout />}>` (tự bắt đăng nhập). Trang `lazy(() => import('@/pages/facility-issue/IssueListPage'))`; trang chỉ PHT dùng thì bọc `<RoleGuard roles={[ROLES.VICE_PRINCIPAL]}>`. Trang công khai (không cần đăng nhập) đặt ngoài khối đó, dùng `AuthLayout`.
10. **Menu** – `layouts/menuConfig.js`: thêm mục vào `ITEMS` (tên, route) **một lần**, rồi thêm key đó vào nhóm `facility` (hoặc nhóm phù hợp) trong `MENUS` của từng vai trò được dùng. Không tạo tên/icon khác cho cùng chức năng.
11. **CSS** – chỉ khi cần: `styles/modules/facility-issue.css` (trùng tên module), class có tiền tố `bh-`.
12. **Kiểm tra** – đăng nhập bằng từng tài khoản liên quan, test đủ luồng, `npm run check`.

---

## 12. Quy tắc nghiệp vụ chung

### 12.0 Đăng nhập & phiên làm việc

**Luồng:** mở app → `ProtectedRoute` kiểm tra token → chưa đăng nhập thì về `/login` (nhớ trang đang mở) → đăng nhập thành công quay lại đúng trang đó.

**API (Spring Boot làm theo):**

| Endpoint            | Body / Header                   | Trả về                                                                                |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /auth/login`  | `{ email, password, remember }` | `{ accessToken, expiresAt, user }` · sai: `401 { message }` · khóa: `403 { message }` |
| `GET /auth/me`      | `Authorization: Bearer <token>` | `user` (`id, fullName, email, phone, role, campusId, locationIds, avatarColor`)       |
| `POST /auth/logout` | Bearer                          | `204`                                                                                 |

**Quy tắc:**

- Token chỉ do `services/http/tokenStorage.js` lưu (_Ghi nhớ đăng nhập_ → localStorage, không thì sessionStorage). Không nơi nào khác đọc/ghi token.
- `axiosClient` tự gắn `Authorization: Bearer` cho mọi request. API trả **401** → tự đăng xuất, về `/login` với thông báo "Phiên đăng nhập đã hết hạn".
- **Vai trò lấy từ tài khoản đăng nhập** (`user.role` do backend trả về). Không có chỗ nào cho người dùng tự đổi vai trò.
- Trong code: `const { user, hasRole, logout, isAuthenticated } = useAuth();` – ví dụ `hasRole(ROLES.VICE_PRINCIPAL)`.
- Phân quyền 3 lớp: (1) `RoleGuard` chặn route; (2) `canXxx(entity, user)` ẩn/hiện nút; (3) backend kiểm tra lại mọi request (frontend chỉ là lớp hiển thị).
- Thông báo sai đăng nhập luôn chung chung ("Email hoặc mật khẩu không đúng") – không tiết lộ email nào tồn tại.
- Chế độ mock: mật khẩu demo `123456`, danh sách tài khoản demo hiện dưới form; build production (`VITE_USE_MOCK=false`) không còn các phần này. Menu _Thư viện giao diện_ chỉ hiện khi chạy `npm run dev`.

### 12.1 Vai trò

| Mã               | Tên                 | Quyền chung                                                                                    |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `PRINCIPAL`      | Hiệu trưởng         | Xem toàn trường; cấu hình năm học, điểm trường, vai trò; phê duyệt cuối (khen thưởng, đề xuất) |
| `VICE_PRINCIPAL` | Phó hiệu trưởng     | Tạo phiếu/đợt, duyệt, phê duyệt, hủy                                                           |
| `TEAM_LEADER`    | Tổ trưởng nhóm tuổi | Kế hoạch chủ đề, duyệt giáo án trong khối; với CSVC xử lý việc được giao như giáo viên         |
| `TEACHER`        | Giáo viên           | Chỉ xử lý việc được giao                                                                       |
| `KITCHEN_STAFF`  | Nhân viên bếp       | Chỉ xử lý việc được giao                                                                       |

Vai trò đến từ tài khoản đăng nhập (mục 12.0). Ẩn nút người dùng không có quyền **và** chặn lại ở service. Route nào cho vai trò nào theo SRS 4.4 Permission Matrix: khai báo bằng `only(roles, page)` trong `routes/AppRoutes.jsx`; menu theo vai trò ở `layouts/menuConfig.js`.

### 12.2 Vòng đời chứng từ

- Luôn có `DRAFT` (lưu nháp được, chưa ai thấy) → gửi đi → các bước chờ → `COMPLETED` / `CANCELLED`.
- `COMPLETED`, `CANCELLED` là trạng thái **khóa**: không sửa.
- Mỗi thao tác ghi **lịch sử** (`history: [{ action, userId, at, note }]`) và gửi **thông báo** cho người làm bước tiếp theo.
- Sửa nội dung quan trọng sau khi đã gửi → tạo **phiên bản mới** (`version`, `revisions`), không xóa lịch sử cũ.
- Bị trả lại / từ chối / yêu cầu làm lại: **bắt buộc nhập lý do**.

### 12.3 Chữ ký

- Mỗi tài khoản lưu được nhiều chữ ký, có chữ ký mặc định (`SignaturePicker` tự chọn sẵn).
- Mỗi chữ ký trên chứng từ lưu: `type`, `signedBy`, `signedByName`, `signatureUrl`, `signedAt`, `documentVersion`, `valid`.
- Dữ liệu đã ký bị thay đổi → chữ ký cũ `valid = false` + `invalidReason`, phải ký lại.
- Trang chi tiết luôn có khối **"Chữ ký xác nhận"** ở **cuối nội dung**.

### 12.4 In / xuất

- **Một mẫu in** cho mọi trạng thái, render theo dữ liệu (dấu trạng thái góc phải, ô ký "Chưa xác nhận" nếu chưa ký).
- Cấu trúc: `<div className="print-sheet"><PrintHeader />` → tiêu đề `ps-title` + `ps-stamp` → các mục `ps-section` + `ps-table` → bảng chữ ký `ps-sign`.
- Luôn có: **In** (`window.print()`), **Xuất PDF** (`exportElementToPdf`), **Xuất Excel (CSV, UTF-8 BOM)**.
- Ai xem được chứng từ thì in được.

### 12.5 Tồn kho & khóa dữ liệu

- Số lượng tài sản chỉ thay đổi ở **bước hoàn tất cuối** (xác nhận nhận, phê duyệt kiểm kê) và luôn ghi lại trước/sau.
- Đang kiểm kê → khóa luân chuyển của phòng đó. UI đọc bằng `useLockedLocations()` (`@/hooks`), service dùng `getLockedLocations()` (`@/services/facilityLockService`); luật phía server giả nằm ở `mocks/inventoryLock.js`. Module mới đụng tới tồn kho phải kiểm tra khóa này.

---

## 13. Viết chữ trên giao diện (UX copy)

- Tiếng Việt có dấu, câu ngắn, xưng hô trung tính ("Bạn").
- Nút bắt đầu bằng **động từ**: _Gửi phiếu, Lưu nháp, Xác nhận nhận, Báo chênh lệch_. Không dùng _OK, Submit, Đồng ý_.
- Nút trong hộp xác nhận lặp lại hành động: _Hủy phiếu_, _Ký và nộp phiếu_ (không phải "Xác nhận").
- Lỗi: nói **cái gì sai + làm gì để sửa**, không đổ lỗi: _"Ghế nhựa: lệch sổ sách, bắt buộc ghi chú"_.
- Trạng thái chờ ghi rõ **chờ ai**: _"Chờ Trần Thị Mai xác nhận nhận"_.
- Nhãn bắt buộc có `<span className="req">*</span>`; placeholder chỉ để gợi ý định dạng, không thay cho nhãn.
- Định dạng: ngày `dd/mm/yyyy` (`formatDate`), giờ `dd/mm/yyyy HH:mm` (`formatDateTime`), mã chứng từ in đậm màu primary.

---

## 14. Trạng thái tải, lỗi, rỗng, xác nhận

| Tình huống                                              | Dùng                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tải trang                                               | `<LoadingState />`                                                            |
| Tải bảng                                                | `<SkeletonRows rows cols />`                                                  |
| Nút đang xử lý                                          | `disabled` + `<Spinner small />`                                              |
| Không có dữ liệu                                        | `<EmptyState title description action />` – luôn có hướng dẫn / nút tiếp theo |
| Lọc không ra kết quả                                    | `EmptyState` + nút _Đặt lại bộ lọc_                                           |
| Lỗi tải                                                 | `<ErrorState error onRetry />`                                                |
| Thành công / thất bại thao tác                          | `toast.success` / `toast.error(err.message, 'Không … được')`                  |
| Hành động không hoàn tác được (gửi, hủy, hoàn tất, xóa) | `<ConfirmationModal>`, nguy hiểm thì `danger`                                 |
| Không có quyền                                          | `RoleGuard` hoặc `EmptyState` icon `Lock`                                     |

---

## 15. Code style, đặt tên, lint

- **Prettier** (`.prettierrc`): nháy đơn, có `;`, dấu phẩy cuối, dòng ≤ 140 ký tự, 2 space. Chạy `npm run format`.
- **ESLint** (`.eslintrc.cjs`): `npm run lint` phải 0 lỗi. Có luật chặn UI import mock / dùng localStorage.
- **Đặt tên:**

| Loại            | Quy ước                                | Ví dụ                                              |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| Component, page | PascalCase, 1 file 1 component chính   | `TransferListPage.jsx`, `SignaturePicker.jsx`      |
| Hook            | `useXxx`                               | `useTransfers.js`                                  |
| Service         | `xxxService.js`, hàm động từ           | `getTransfers`, `submitTransfer`, `confirmReceipt` |
| Hằng số         | UPPER_SNAKE_CASE                       | `TRANSFER_STATUS`, `ROLE_LABELS`                   |
| Mã trạng thái   | UPPER_SNAKE_CASE tiếng Anh             | `PENDING_HANDOVER`                                 |
| Nhãn hiển thị   | map `XXX_LABELS` tiếng Việt            | `TRANSFER_STATUS_LABELS`                           |
| Quyền           | `canXxx(entity, user)`                 | `canReceive(t, user)`                              |
| Thư mục module  | kebab-case tiếng Anh                   | `facility-transfer`                                |
| Route           | `/khu-vuc/doi-tuong[/:id[/hanh-dong]]` | `/facility/transfers/:id/handover`                 |

- Code, tên biến, comment: **tiếng Anh**. Chữ hiển thị cho người dùng: **tiếng Việt**.
- Comment giải thích **vì sao**, không mô tả lại code.
- Không để `console.log` khi push.

---

## 16. Nối Spring Boot (bỏ mock)

1. `.env`: `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=http://<host>/api`.
2. Mỗi module có sẵn `services/api/*Api.js` với đường dẫn đề xuất; backend làm theo, hoặc sửa đường dẫn trong file này (UI không phải sửa).
3. Làm 3 endpoint đăng nhập ở mục 12.0. `axiosClient` tự gắn `Authorization: Bearer <token>`, chuẩn hóa lỗi về `{ status, message }` – backend trả `{ message }` khi lỗi, `401` khi token hết hạn.
4. Luật nghiệp vụ cần làm lại ở backend nằm trong các file `services/mock/*MockRepository.js`.
5. Ảnh, file, chữ ký hiện lưu dạng data URL đã nén → backend nên nhận file upload (S3) và trả URL.

---

## 17. Checklist trước khi tạo PR

- [ ] Không có mã màu / cỡ chữ viết cứng ngoài `tokens.css`.
- [ ] Chữ đạt tương phản WCAG AA (≥ 4.5:1; chữ ≥ 18.66px: ≥ 3:1). Chữ màu trên nền nhạt dùng token `-700` (`.text-success`, `.text-danger`, chip).
- [ ] Trang không cuộn ngang ở 1024px: bảng rộng cuộn trong `.table-wrap`; giá trị dài (tên file, mã) xuống dòng (`overflow-wrap: anywhere`, ô lưới `min-width: 0`).
- [ ] Không dùng emoji làm biểu tượng – dùng icon lucide; nút chỉ có icon phải có `aria-label`.
- [ ] Dùng component trong `@/components` thay vì tự viết lại (modal, badge, phân trang, timeline, stepper, thanh in, upload, chữ ký…).
- [ ] Nhãn vai trò `teal`, thiếu/hỏng `red`, thừa/lệch `orange` (mục 6).
- [ ] Trạng thái mới đã gán tông đúng bảng mục 6.
- [ ] Có Loading / Empty / Error / disabled cho mọi thao tác bất đồng bộ.
- [ ] Hành động không hoàn tác được có hộp xác nhận.
- [ ] Ẩn nút theo quyền **và** chặn trong service.
- [ ] Bắt buộc lý do khi từ chối / hủy / yêu cầu làm lại.
- [ ] Thông báo cho người làm bước tiếp theo, ghi lịch sử.
- [ ] Trang chi tiết có khối chữ ký ở cuối (nếu chứng từ có ký) và in/xuất được.
- [ ] Trang mới có `Breadcrumb` (bắt đầu bằng Trang chủ) + `h1.page__title`; menu thêm qua `menuConfig.js` (khai báo một lần).
- [ ] Route mới nằm trong `ProtectedRoute`; trang riêng vai trò có `RoleGuard`.
- [ ] Không đọc/ghi token, localStorage trong UI (dùng `useAuth`, service).
- [ ] Đã test bằng ít nhất 2 tài khoản khác vai trò (đăng xuất → đăng nhập tài khoản khác).
- [ ] `npm run check` thành công.
