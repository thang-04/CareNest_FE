# CareNest Web — Coding Guide

Cách chạy, tổ chức code, luồng dữ liệu, quy trình thêm module, quy tắc chung và checklist PR của repo web. **Giao diện** (màu, chữ, component, bố cục, câu chữ, trạng thái) nằm ở `DESIGN.md` (gốc repo) — design system chung web + app.

Nội dung chuyển nguyên từ `DESIGN.md` cũ (mục 1–2, 9–12, 15–17) ngày 2026-10-09; chỉ đổi số mục và đường dẫn.

## Mục lục

1. [Chạy dự án & lệnh](#1-chạy-dự-án--lệnh)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [CSS: viết ở đâu, đặt tên thế nào](#3-css-viết-ở-đâu-đặt-tên-thế-nào)
4. [Kiến trúc code & luồng dữ liệu](#4-kiến-trúc-code--luồng-dữ-liệu)
5. [Quy trình thêm module mới](#5-quy-trình-thêm-module-mới-từng-bước)
6. [Quy tắc nghiệp vụ chung](#6-quy-tắc-nghiệp-vụ-chung)
7. [Code style, đặt tên, lint](#7-code-style-đặt-tên-lint)
8. [Nối Spring Boot (bỏ mock)](#8-nối-spring-boot-bỏ-mock)
9. [Checklist trước khi tạo PR](#9-checklist-trước-khi-tạo-pr)

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
  DESIGN.md            design system chung web + app
  README.md            cách chạy, tài khoản demo, routes
  docs/                tài liệu (file này: docs/architecture/CODING_GUIDE.md)
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
  assets/illustrations/  tranh sáp màu (nền, dải đầu trang, màn trống)
  components/            UI – import phần dùng chung từ '@/components'
    ui/                  Modal, ConfirmationModal, States, Breadcrumb, SearchSelect, Avatar, StatusBadge,
                         ProgressBar, ProgressSteps, Stepper, Pagination, SidePanel, StatCardIcon, icons.js
    brand/               Logo, LogoMark, LogoFull, Wordmark
    charts/              MiniCharts (RingChart, BarList, DonutChart)
    signature/           SignaturePicker, SignatureUploader
    upload/              FileUploader, ImageUploader
    asset/               AssetThumb, ConditionBadge, ConditionSelect
    print/               PrintHeader, PrintToolbar
    form/                FormField, PasswordInput
    <module>/            component riêng của từng module
    index.js             barrel export phần dùng chung
  pages/                 các trang (export default), nhóm theo module
  hooks/                 dùng chung: useAsync, useMasterData, useSignatures, useNotifications, useLockedLocations,
                         usePageTitle, useClickOutside, index.js; hook riêng module trong <module>/
  services/
    http/                axiosClient, tokenStorage
    <module>/            <x>Service.js (facade) + mock/ + api/
  models/                dùng chung: User/ROLES, Campus, Location, Asset, Signature, Notification; hằng số module trong <module>/
  utils/                 dùng chung: format.js (ngày, tìm kiếm bỏ dấu, avatarTone), file.js, id.js, exportPdf.js, exportCsv.js;
                         validation, permissions, breadcrumbs của module trong <module>/
  config/                env.js, app.js (tên app, tên trường, phiên bản, năm học), printTemplate.js
  contexts/              AuthContext (useAuth), ToastContext (useToast), SchoolYearContext (useSchoolYear)
  layouts/               MainLayout, AuthLayout, Sidebar, Header, HeaderSearch, QuickCreateMenu, Footer,
                         NotificationBell, UserMenu, menuConfig.js (menu duy nhất cho mọi vai trò), quickActions.js
  mocks/                 "backend giả": mockDatabase, seed, *Seed, các *MockRepository dùng chung
  routes/                AppRoutes, ProtectedRoute / GuestRoute (bắt đăng nhập), RoleGuard (bắt vai trò)
  styles/                tokens.css, base.css, components.css, utilities.css, print.css, index.css
    modules/             <module>.css (style riêng module)
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

## 3. CSS: viết ở đâu, đặt tên thế nào

| File                          | Nội dung                                                           | Ai sửa                            |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `styles/tokens.css`           | Biến màu, cỡ chữ, khoảng cách (giá trị theo `DESIGN.md` mục 3)     | Thống nhất cả nhóm trước khi thêm |
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
3. Style inline (`style={{…}}`) chỉ cho giá trị động (độ rộng %, màu từ dữ liệu). Màu, cỡ chữ, khoảng cách **không** viết inline – dùng class / token.
4. Class đã có trong `components.css` thì **không viết lại** trong module.
5. Module thấy một mẫu dùng ở ≥ 2 chỗ → chuyển lên `components.css` + component trong `src/components`.
6. File CSS của module đặt trong `styles/modules/`, tên đúng tên module: `styles/modules/facility-transfer.css`. Import ở trang/component của module: `import '@/styles/modules/facility-transfer.css';`.
7. Class trong CSS module **mới** phải có tiền tố 2–3 chữ của module để không trùng (`kk-` = kiểm kê, ví dụ module Báo hỏng dùng `bh-`). Module Luân chuyển viết trước quy tắc này nên class chưa có tiền tố (tên đã đủ riêng: `campus-card`, `route-banner`…) – không đặt class mới trùng các tên đó.

---

## 4. Kiến trúc code & luồng dữ liệu

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

Hook dùng chung: người đang đăng nhập `const { user, hasRole, logout } = useAuth();` (mục 6.1) · phòng đang bị khóa do kiểm kê `useLockedLocations()` · dữ liệu dùng chung `useMasterData()` → `campuses, locations, users, categories` + `campusById, locationById, userById, categoryById`.

---

## 5. Quy trình thêm module mới (từng bước)

Ví dụ module **Báo hỏng** (`facility-issue`). Mỗi bước đặt file vào đúng layer, trong thư mục con `facility-issue/` của layer đó (đường dẫn dưới đây tính từ `src/`):

0. **Mockup** – đặt ảnh thiết kế vào `mockups/facility-issue/` và thêm dòng mô tả vào `mockups/README.md`.
1. **Model** – `models/facility-issue/issueConstants.js`: `ISSUE_STATUS`, `ISSUE_STATUS_LABELS`, typedef.
2. **Quy tắc** – `utils/facility-issue/issueValidation.js` (trả về `{ field: message }`), `utils/facility-issue/issuePermissions.js` (`canApproveIssue(issue, user)`…).
3. **Mock backend** – `services/facility-issue/mock/issueMockRepository.js`: dùng `readDb`, `writeDb`, `delay`, `ApiError` từ `@/mocks/mockDatabase`; gửi thông báo bằng `pushNotification`. Thêm dữ liệu mẫu vào `mocks/seed.js` (`buildSeedDatabase`) và đọc an toàn `db.issues ||= []`.
4. **API thật** – `services/facility-issue/api/issueApi.js`: các hàm axios cùng tên/tham số với mock.
5. **Facade** – `services/facility-issue/issueService.js`: `const repo = USE_MOCK ? mock : api;` rồi export các hàm `getIssues`, `approveIssue`…
6. **Hook** – `hooks/facility-issue/useIssues.js` dùng `useAsync`.
7. **Badge** – `components/facility-issue/IssueStatusBadge.jsx` bằng `createStatusBadge` (`DESIGN.md` mục 3.2).
8. **Trang** – `pages/facility-issue/IssueListPage.jsx`… theo công thức `DESIGN.md` mục 8. Breadcrumb: `utils/facility-issue/breadcrumbs.js`.
9. **Route** – `routes/AppRoutes.jsx`: thêm vào **bên trong** khối `<Route element={<ProtectedRoute />}>` → `<Route element={<MainLayout />}>` (tự bắt đăng nhập). Trang `lazy(() => import('@/pages/facility-issue/IssueListPage'))`; trang chỉ PHT dùng thì bọc `<RoleGuard roles={[ROLES.VICE_PRINCIPAL]}>`. Trang công khai (không cần đăng nhập) đặt ngoài khối đó, dùng `AuthLayout`.
10. **Menu** – `layouts/menuConfig.js`: thêm mục vào `ITEMS` (tên, route) **một lần**, rồi thêm key đó vào nhóm `facility` (hoặc nhóm phù hợp) trong `MENUS` của từng vai trò được dùng. Không tạo tên/icon khác cho cùng chức năng.
11. **CSS** – chỉ khi cần: `styles/modules/facility-issue.css` (trùng tên module), class có tiền tố `bh-`.
12. **Kiểm tra** – đăng nhập bằng từng tài khoản liên quan, test đủ luồng, `npm run check`.

---

## 6. Quy tắc nghiệp vụ chung

Nghiệp vụ, quyền, contract do `CareNest_BE` sở hữu; mục này mô tả cách web hiện thực, chỗ nào lệch BE thì BE thắng.

### 6.1 Đăng nhập & phiên làm việc

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

### 6.2 Vai trò

| Mã               | Tên                 | Quyền chung                                                                                    |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `PRINCIPAL`      | Hiệu trưởng         | Xem toàn trường; cấu hình năm học, điểm trường, vai trò; phê duyệt cuối (khen thưởng, đề xuất) |
| `VICE_PRINCIPAL` | Phó hiệu trưởng     | Tạo phiếu/đợt, duyệt, phê duyệt, hủy                                                           |
| `TEAM_LEADER`    | Tổ trưởng nhóm tuổi | Kế hoạch chủ đề, duyệt giáo án trong khối; với CSVC xử lý việc được giao như giáo viên         |
| `TEACHER`        | Giáo viên           | Chỉ xử lý việc được giao                                                                       |
| `KITCHEN_STAFF`  | Nhân viên bếp       | Chỉ xử lý việc được giao                                                                       |

Vai trò đến từ tài khoản đăng nhập (mục 6.1). Ẩn nút người dùng không có quyền **và** chặn lại ở service. Route nào cho vai trò nào theo SRS 4.4 Permission Matrix: khai báo bằng `only(roles, page)` trong `routes/AppRoutes.jsx`; menu theo vai trò ở `layouts/menuConfig.js`.

### 6.3 Vòng đời chứng từ

- Luôn có `DRAFT` (lưu nháp được, chưa ai thấy) → gửi đi → các bước chờ → `COMPLETED` / `CANCELLED`.
- `COMPLETED`, `CANCELLED` là trạng thái **khóa**: không sửa.
- Mỗi thao tác ghi **lịch sử** (`history: [{ action, userId, at, note }]`) và gửi **thông báo** cho người làm bước tiếp theo.
- Sửa nội dung quan trọng sau khi đã gửi → tạo **phiên bản mới** (`version`, `revisions`), không xóa lịch sử cũ.
- Bị trả lại / từ chối / yêu cầu làm lại: **bắt buộc nhập lý do**.

### 6.4 Chữ ký

- Mỗi tài khoản lưu được nhiều chữ ký, có chữ ký mặc định (`SignaturePicker` tự chọn sẵn).
- Mỗi chữ ký trên chứng từ lưu: `type`, `signedBy`, `signedByName`, `signatureUrl`, `signedAt`, `documentVersion`, `valid`.
- Dữ liệu đã ký bị thay đổi → chữ ký cũ `valid = false` + `invalidReason`, phải ký lại.
- Trang chi tiết luôn có khối **"Chữ ký xác nhận"** ở **cuối nội dung**.

### 6.5 In / xuất

- **Một mẫu in** cho mọi trạng thái, render theo dữ liệu (dấu trạng thái góc phải, ô ký "Chưa xác nhận" nếu chưa ký).
- Cấu trúc: `<div className="print-sheet"><PrintHeader />` → tiêu đề `ps-title` + `ps-stamp` → các mục `ps-section` + `ps-table` → bảng chữ ký `ps-sign`.
- Luôn có: **In** (`window.print()`), **Xuất PDF** (`exportElementToPdf`), **Xuất Excel (CSV, UTF-8 BOM)**.
- Ai xem được chứng từ thì in được. Bản in dùng font `Tinos` và màu giấy trong `print.css`.

### 6.6 Tồn kho & khóa dữ liệu

- Số lượng tài sản chỉ thay đổi ở **bước hoàn tất cuối** (xác nhận nhận, phê duyệt kiểm kê) và luôn ghi lại trước/sau.
- Đang kiểm kê → khóa luân chuyển của phòng đó. UI đọc bằng `useLockedLocations()` (`@/hooks`), service dùng `getLockedLocations()` (`@/services/facilityLockService`); luật phía server giả nằm ở `mocks/inventoryLock.js`. Module mới đụng tới tồn kho phải kiểm tra khóa này.

---

## 7. Code style, đặt tên, lint

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

- Code, tên biến: **tiếng Anh**. Chữ hiển thị cho người dùng: **tiếng Việt**. Comment theo khối "Comment trong code" của `AGENTS.md`.
- Comment giải thích **vì sao**, không mô tả lại code.
- Không để `console.log` khi push.

---

## 8. Nối Spring Boot (bỏ mock)

1. `.env`: `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=http://<host>/api`.
2. Mỗi module có sẵn `services/<module>/api/*Api.js` với đường dẫn đề xuất; backend làm theo, hoặc sửa đường dẫn trong file này (UI không phải sửa). Contract thật: `docs/integration/BACKEND_INTEGRATION.md` và BE.
3. Làm 3 endpoint đăng nhập ở mục 6.1. `axiosClient` tự gắn `Authorization: Bearer <token>`, chuẩn hóa lỗi về `{ status, message }` – backend trả `{ message }` khi lỗi, `401` khi token hết hạn.
4. Luật nghiệp vụ cần làm lại ở backend nằm trong các file `services/<module>/mock/*MockRepository.js`.
5. Ảnh, file, chữ ký hiện lưu dạng data URL đã nén → backend nên nhận file upload (S3) và trả URL.

---

## 9. Checklist trước khi tạo PR

Giao diện: chạy tự kiểm và checklist ở `DESIGN.md` mục 13. Thêm các mục code:

- [ ] Ẩn nút theo quyền **và** chặn trong service.
- [ ] Bắt buộc lý do khi từ chối / hủy / yêu cầu làm lại.
- [ ] Thông báo cho người làm bước tiếp theo, ghi lịch sử.
- [ ] Trang chi tiết có khối chữ ký ở cuối (nếu chứng từ có ký) và in/xuất được.
- [ ] Trang mới có `Breadcrumb` (bắt đầu bằng Trang chủ) + tiêu đề trang; menu thêm qua `menuConfig.js` (khai báo một lần).
- [ ] Route mới nằm trong `ProtectedRoute`; trang riêng vai trò có `RoleGuard`.
- [ ] Không đọc/ghi token, localStorage trong UI (dùng `useAuth`, service).
- [ ] Đã test bằng ít nhất 2 tài khoản khác vai trò (đăng xuất → đăng nhập tài khoản khác).
- [ ] `node scripts/verify.mjs` → `VERIFY PASS`.
