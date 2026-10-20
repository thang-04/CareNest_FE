# Refactor cấu trúc thư mục: feature-first → layer-first

Ngày: 08/10/2026 · Phạm vi: chỉ di chuyển file + sửa đường dẫn import, không đổi UI, route, nghiệp vụ, mock/API, CSS hiển thị. Chưa commit.

## 1. Cấu trúc trước refactor

```
src/
  features/
    auth/pages/                       LoginPage.jsx
    education-plan/                   components/ hooks/ models/ pages/ services/{mock,api}/ utils/ education-plan.css
    facility-transfer/                components/(wizard/) hooks/ models/ pages/ services/{mock,api}/ utils/ facility-transfer.css
    inventory-inspection/             components/ hooks/ models/ pages/ services/{mock,api}/ utils/ inventory-inspection.css
  assets/ components/(ui, brand, signature, upload, asset, print, form) config/ contexts/ hooks/ layouts/
  mocks/ models/ pages/ routes/ services/(http, *Service.js) styles/ utils/ App.jsx main.jsx
```

## 2. Cấu trúc sau refactor

```
src/
  assets/brand/
  components/   ui/ brand/ signature/ upload/ asset/ print/ form/ index.js
                education-plan/ facility-transfer/(wizard/) inventory-inspection/
  pages/        auth/ education-plan/ facility-transfer/ inventory-inspection/
                HomePage.jsx NotificationsPage.jsx UiKitPage.jsx ui-kit.css ComingSoonPage.jsx NotFoundPage.jsx
  hooks/        (dùng chung, giữ nguyên) useAsync useMasterData useSignatures useNotifications useLockedLocations
                usePageTitle useClickOutside index.js
                education-plan/ facility-transfer/ inventory-inspection/
  services/     http/ authService.js masterDataService.js signatureService.js notificationService.js facilityLockService.js
                education-plan/{educationPlanService.js, mock/, api/}
                facility-transfer/{transferService.js, mock/, api/}
                inventory-inspection/{inspectionService.js, mock/, api/}
  models/       (dùng chung, giữ nguyên) User Campus Location Asset Signature Notification index.js
                education-plan/ facility-transfer/ inventory-inspection/
  utils/        (dùng chung, giữ nguyên) format file id exportPdf exportCsv
                education-plan/ facility-transfer/ inventory-inspection/
  styles/       tokens base components utilities print index .css
                modules/{education-plan.css, facility-transfer.css, inventory-inspection.css}
  config/ contexts/ layouts/ mocks/ routes/ App.jsx main.jsx
```

`src/features/` đã xóa.

## 3. File đã move (94 file)

| Từ | Đến | Số file |
|---|---|---|
| features/auth/pages | pages/auth | 1 |
| features/education-plan/pages | pages/education-plan | 14 |
| features/education-plan/components | components/education-plan | 8 |
| features/education-plan/hooks | hooks/education-plan | 1 |
| features/education-plan/models | models/education-plan | 1 |
| features/education-plan/services (+mock/, api/) | services/education-plan | 3 |
| features/education-plan/utils | utils/education-plan | 1 |
| features/facility-transfer/pages | pages/facility-transfer | 8 |
| features/facility-transfer/components (+wizard/) | components/facility-transfer | 20 |
| features/facility-transfer/hooks | hooks/facility-transfer | 3 |
| features/facility-transfer/models | models/facility-transfer | 7 |
| features/facility-transfer/services (+mock/, api/) | services/facility-transfer | 3 |
| features/facility-transfer/utils | utils/facility-transfer | 5 |
| features/inventory-inspection/pages | pages/inventory-inspection | 5 |
| features/inventory-inspection/components | components/inventory-inspection | 1 |
| features/inventory-inspection/hooks | hooks/inventory-inspection | 1 |
| features/inventory-inspection/models | models/inventory-inspection | 2 |
| features/inventory-inspection/services (+mock/, api/) | services/inventory-inspection | 3 |
| features/inventory-inspection/utils | utils/inventory-inspection | 4 |
| features/<module>/<module>.css (3 file) | styles/modules/ | 3 |

Tên file không đổi. Shared `components/ui…form`, `hooks/*.js`, `models/*.js`, `utils/*.js`, `services/*Service.js` giữ nguyên vị trí (import ở nhiều nơi, di chuyển không mang lại lợi ích).

## 4. File đã sửa import (74 file, 301 import)

Tất cả import trỏ tới file đã move, và mọi import tương đối trong file đã move, được đổi sang alias `@/…` (giữ nguyên kiểu có/không đuôi file).

- Ngoài `features/` cũ: `routes/AppRoutes.jsx` (29 – lazy import các trang), `pages/HomePage.jsx` (4), `pages/UiKitPage.jsx` (4), `mocks/educationPlanSeed.js` (1).
- Trong các file đã move: pages/education-plan (14 file), pages/facility-transfer (8), pages/inventory-inspection (5), components/education-plan (8), components/facility-transfer (+wizard, 16), components/inventory-inspection (1), hooks/* (5), models/facility-transfer (2), models/inventory-inspection (1), services/*/ và mock/ (6), utils/facility-transfer (3), utils/inventory-inspection (1).
- Import CSS module: `import '@/styles/modules/<module>.css'`.

Sửa khác (không phải import):
- `.eslintrc.cjs`: override UI layer từ `src/features/*/pages/**`, `src/features/*/components/**` → chỉ còn `src/pages/**`, `src/components/**` (vẫn phủ toàn bộ trang/component module); sửa text gợi ý đường dẫn service.
- `README.md`: đường dẫn `src/features/*/services/{api,mock}` → `src/services/<module>/{api,mock}`.
- `src/styles/components.css`: comment đầu file trỏ tới `styles/modules/`.

## 5. Thay đổi trong DESIGN.md

- §2 Cấu trúc thư mục: bỏ mô tả `src/features/<ten-module>/…` ("MỖI MODULE MỘT THƯ MỤC, tự chứa"); thay bằng giải thích layer-first + module grouping, bảng 3 nhóm layer (Presentation / Business-Domain / Data access), cây thư mục theo source thực tế, sơ đồ Page → Service facade → Mock (localStorage) | API (Axios → Spring Boot).
- §2 Import: luôn dùng alias `@/`, ví dụ mới; quy tắc module A không import code riêng module B, phần dùng chung lên gốc layer.
- §6 ví dụ badge: đường dẫn `src/components/<module>/…`, import `@/models/<module>/…`.
- §9 CSS: bảng file CSS và quy tắc 6 → `styles/modules/<module>.css`.
- §10 sơ đồ luồng + validation/permissions → `services/<module>/…`, `utils/<module>/…`.
- §11 quy trình thêm module: mọi bước đặt file vào `<layer>/facility-issue/`, ví dụ lazy import `@/pages/facility-issue/IssueListPage`, CSS `styles/modules/facility-issue.css`.
- Không còn chữ `features/` trong DESIGN.md.

## 6. Còn `src/features`?

Không. `grep "features/"` trong `src/`, `.eslintrc.cjs`, `vite.config.js`, `jsconfig.json`, `README.md`, `DESIGN.md` → 0 kết quả.

## 7. Kết quả

| Lệnh | Kết quả |
|---|---|
| `npm run format` | OK |
| `npm run lint` | 0 lỗi, 0 cảnh báo |
| `npm run build` | thành công |
| `npm run check` | thành công |

Bundle sau refactor có cùng hash với trước refactor (ví dụ `LessonFormPage-dVsdUhGa.js`, `index-D08LS3eh.js`): code biên dịch không đổi.

Chạy thử dev server (cổng 5180), đăng nhập 3 vai trò:
- lan.nguyen (Phó HT): Trang chủ, /education/goals, goals/:id, goals/new, approvals, approvals/chu-de/:id, themes/:id, lessons/:id, /facility/transfers (+new, +:id), /facility/inspections (+new), /notifications, /ui-kit – đều hiển thị.
- ha.tran (Tổ trưởng): /education, themes, themes/new, themes/:id/edit, reviews, reviews/:id, overview, lessons, CSVC – hiển thị; goals/new bị RoleGuard chặn đúng.
- minhanh.le (Giáo viên): /education, overview, lessons, lessons/new, lessons/:id/edit, themes/:id, CSVC – hiển thị; approvals bị RoleGuard chặn đúng.

## 8. Vấn đề chưa giải quyết

- Không có vấn đề mới do refactor.
- (Có từ trước) `node scripts/verify.mjs` báo FAIL trên Windows do script gọi `"npm.cmd"` có ngoặc kép qua cmd; chạy thẳng `npm run verify` / `npm run check` thì pass.
