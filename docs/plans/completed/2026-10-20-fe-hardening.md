---
title: FE hardening — logout 401, useAsync, tách mock, Modal, file chết
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

# FE hardening — logout 401, useAsync, tách mock, Modal, file chết

Làn L vì đụng auth/token, API client chung và hook tải dữ liệu dùng chung (>8 file). Không đổi nghiệp vụ, route nghiệp vụ, quyền hay contract BE.

Chạy song song với `2026-10-20-mobile-responsive-baseline.md` và `2026-10-20-ui-standards-status-filter-action-errors.md`. Plan này chỉ sửa JS:
- `src/services/http/*`, `src/contexts/AuthContext.jsx`, `src/hooks/useAsync.js`
- `src/services/*Service.js`, `src/mocks/*`, `src/routes/AppRoutes.jsx`
- `src/components/ui/Modal.jsx` (chỉ JS, không CSS)
- test mới trong `tests/`

## Context

Rà code (chỉ đọc, 2026-10-20) tìm ra các rủi ro sau.

1. **Vòng lặp logout khi 401.**
   - `axiosClient.js:27` phát `UNAUTHORIZED_EVENT` cho mọi 401 trừ `/auth/login`, kể cả `/auth/logout`.
   - `AuthContext.jsx:53-57` gọi `logout()` mỗi lần nhận event, không chặn trùng.
   - `authService.js:37-46` gọi `POST /auth/logout` khi token còn ⇒ 401 ⇒ event ⇒ logout lần nữa. Nhiều request song song cùng 401 ⇒ nhiều lần logout.
2. **Route demo lọt vào bản build:** `/ui-kit` (`AppRoutes.jsx:475`) đăng ký cả ở bản prod; `NutritionPrimitivesDemo` chỉ dùng trong `UiKitPage`.
3. **Thiếu `aria-label`** ở 8 nút chỉ có icon (danh sách ở Phase 3.1).
4. **Seed giống CCCD thật:** `childrenSeed.js:480,505` dùng số dạng `0312…`.
5. **`useAsync.js` không chặn kết quả cũ:** đổi filter nhanh thì response về sau ghi đè; `setState` sau unmount. `DB_CHANGED_EVENT` import từ module seed nên kéo cả seed vào bundle.
6. **Mock có thể lọt vào bản build `VITE_USE_MOCK=false`:** service chọn `USE_MOCK ? mock : api` qua hằng import (`childrenService.js:1-6`), Rollup có thể không tree-shake.
7. **`Modal.jsx:6`** không bẫy focus, không trả focus, Esc đóng mọi modal đang mở.
8. **File nghi chết** (8 file, danh sách ở Phase 3.3).

## Quyết định đã chốt
1. D6 — VPS là bản demo nên giữ `VITE_USE_MOCK=true`; không sửa deploy trong plan này — user, 2026-10-20.
2. Không thêm/nâng dependency — user, 2026-10-20.
3. File chết chỉ xoá sau khi user xác nhận danh sách — user, 2026-10-20.
4. Không commit, không tạo branch; mã Jira hỏi user khi commit — quy tắc repo.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** không đổi nghiệp vụ. Actor: mọi role đăng nhập web. Outcome: hết phiên thì đăng xuất đúng 1 lần, màn dữ liệu không hiện kết quả cũ, modal dùng được bằng bàn phím.
- **Đối chiếu thiết kế ban đầu:** không đổi contract `POST /auth/logout`, `GET /auth/me` (`authService.js:8-18`).
- **Ảnh hưởng:** FE toàn app (auth, hook tải dữ liệu, modal). BE không đổi. Dữ liệu cũ: chỉ đổi 2 số định danh giả trong seed mock.

### Câu hỏi mở
Không còn câu hỏi mở.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| VPS dùng mock hay API thật? | Giữ mock (demo) | user | 2026-10-20 | D6 plan tổng |
| Được thêm dependency (test lib, focus-trap)? | Không | user | 2026-10-20 | — |

## Acceptance criteria
- **AC-1**: Given nhiều request song song cùng nhận 401, When `UNAUTHORIZED_EVENT` phát nhiều lần, Then chỉ chạy đúng 1 lần logout và `POST /auth/logout` lỗi 401 không phát lại event.
- **AC-2**: Given người dùng đổi filter/params nhanh liên tục, When response cũ về sau response mới, Then màn hình giữ dữ liệu của lần gọi mới nhất; không `setState` sau unmount.
- **AC-3**: Given build prod (`vite build`), Then không có route `/ui-kit` và chunk `UiKitPage`.
- **AC-4**: Given spike tách mock thành công, When build với `VITE_USE_MOCK=false`, Then không còn chunk/mã `mockRepository`. Bản `VITE_USE_MOCK=true` (VPS) không đổi hành vi.
- **AC-5**: Given modal đang mở, When nhấn Tab/Shift+Tab, Then focus không thoát khỏi modal; đóng modal thì focus về phần tử đã mở; Esc chỉ đóng modal trên cùng.
- **AC-6**: 8 nút chỉ có icon có `aria-label`; seed không còn số giống CCCD thật.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Chặn logout trùng | Helper `singleFlight` trong `services/http`, AuthContext dùng | Cờ `useRef` trong component | Test được bằng `node --test` không cần render React |
| Test | `node --test` + loader sẵn có (`scripts/register-auth-test-loader.mjs`) | Thêm Vitest/RTL | Không thêm dependency |
| Tách mock | Spike trước, chỉ đổi service nếu chunk còn mock | Đổi ngay 25 service | Tránh sửa diện rộng khi không cần |

## Phases
### Phase 3.1 — Nhóm A (công nhỏ)
- Files: M `src/services/http/axiosClient.js` · C `src/services/http/singleFlight.js` · M `src/contexts/AuthContext.jsx` · M `src/services/authService.js` (nếu cần) · M `src/routes/AppRoutes.jsx` · M 8 file có nút icon · M `src/mocks/childrenSeed.js` · M `docs/plans/active/2026-10-19-vps-docker-deploy.md` · C `tests/hardening/auth-unauthorized.test.mjs` · M `package.json` (script test)
- Steps:
  1. `axiosClient.js:27` bỏ qua `/auth/logout`; AuthContext dedupe logout; logout local kể cả khi API lỗi.
  2. `/ui-kit` (kèm `NutritionPrimitivesDemo` trong `UiKitPage`) chỉ đăng ký khi `import.meta.env.DEV`.
  3. `aria-label` cho `GoalTables.jsx:361,453,493,867`, `PasswordInput.jsx:10`, `SignaturePicker.jsx:32`, `DailyHealthOverviewPage.jsx:224`, `StockReceiptFormPage.jsx:280`.
  4. `childrenSeed.js:480,505` đổi sang mẫu `999…`.
  5. Ghi chú vào plan `vps-docker-deploy`: `Dockerfile:16` copy `default.conf.template` nhưng đĩa có `docker/nginx/defaultconf.txt` (không sửa).
- Tests: AC-1 → `tests/hardening/auth-unauthorized.test.mjs`; AC-3 → grep `dist/` sau build; AC-6 → grep.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`
- **Dừng chờ user review.**

### Phase 3.2 — Nhóm B (tầng dữ liệu)
- Files: M `src/hooks/useAsync.js` · C `src/mocks/dbEvents.js` · M `src/mocks/mockDatabase.js` · M page fetch nhanh (vd. `WeeklyMenuPage.jsx:88-97`) · M ~25 `src/services/*Service.js` (chỉ khi spike cần) · C `tests/hardening/use-async-race.test.mjs`
- Steps:
  1. `useAsync`: request id, chỉ nhận kết quả lần gọi mới nhất; bỏ `setState` sau unmount.
  2. `DB_CHANGED_EVENT` chuyển sang `src/mocks/dbEvents.js`.
  3. Page có filter/params đổi nhanh tự fetch trong `useEffect` không cờ chặn ⇒ chuyển sang guarded fetch; phần còn lại ghi nợ kỹ thuật.
  4. Spike: build `VITE_USE_MOCK=false`, grep chunk `mockRepository`. Chỉ khi còn mới đổi service sang `import.meta.env.VITE_USE_MOCK === 'true'` rồi kiểm lại.
- Tests: AC-2 → `tests/hardening/use-async-race.test.mjs`; AC-4 → grep `dist/` sau build.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`
- **Dừng chờ user review.**

### Phase 3.3 — Nhóm C + D
- Files: M `src/components/ui/Modal.jsx` (JS) · D (chỉ sau khi user xác nhận) `components/kitchen/IssueBlocks.jsx`, `components/kitchen/MissingFoodForm.jsx`, `components/menu-planning/DishPortionTable.jsx`, `pages/school-config/RolePermissionFormPage.jsx`, `pages/school-config/RolePermissionListPage.jsx`, `models/Campus.js`, `models/Notification.js`, `models/Signature.js`
- Steps:
  1. `Modal.jsx`: bẫy focus, trả focus khi đóng, stack module-level để Esc chỉ đóng modal trên cùng.
  2. Grep lại import tĩnh/động và chuỗi path cho 8 file nghi chết ⇒ liệt kê ⇒ **hỏi user** trước khi xoá.
  3. Ghi nợ kỹ thuật (mục dưới).
- Tests: AC-5 → kiểm tay bằng built-in browser (Tab/Shift+Tab/Esc với 2 modal chồng).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`
- **Dừng chờ user review.**

## Nợ kỹ thuật (không làm trong đợt này)
- Test cho auth, children, pickup, facility (hiện `tests/` chỉ có menu, kitchen, merge, hardening).
- Thống nhất 3 kiểu fetch (`useAsync`, `useEffect` tự viết có cờ như `useKitchen`/`useGuardianQuery`, gọi trong handler).
- Tách file >400 dòng: 49 file JS/JSX (lớn nhất `kitchenMockRepository.js` 1 868, `schoolConfigMockRepository.js` 1 519, `assessmentMockRepository.js` 1 505 dòng).
- Esc khi modal mở trên `SidePanel`: `SidePanel.jsx:34` vẫn nghe Esc riêng nên đóng cả panel; nên dùng chung `modalStack` (ngoài phạm vi plan này).
- Nâng ESLint 8 (đổi dependency, phải hỏi).
- Tách hết mock khỏi bản build API: 5 repository (attendance, children, dailyHealth, notification, school) + `mockDatabase`/seed còn trong bundle dù không code thật nào gọi (Phase 3.2). Hướng thử tiếp: tìm lý do Rolldown giữ module, hoặc tách hằng số/quy tắc dùng chung khỏi thư mục mock.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | `tests/hardening/auth-unauthorized.test.mjs` (unit) | 3.1 | 3/3 pass |
| AC-2 | — | `tests/hardening/use-async-race.test.mjs` (unit) + bấm nhanh 4 tab nhóm tuổi ở `/menu/weekly` | 3.2 | 5/5 pass; dữ liệu đúng tab cuối, không lỗi console |
| AC-3 | — | grep `dist/` sau `vite build` | 3.1 | không còn chunk/chuỗi UiKit |
| AC-4 | — | grep `dist/` sau build `VITE_USE_MOCK=false` | 3.2 | Một phần: JS 3 470 004 → 3 182 768 byte; còn 5 repo mock + seed (xem nợ kỹ thuật) |
| AC-5 | — | `tests/hardening/modal-stack.test.mjs` (unit) + kiểm tay `/ui-kit` (2 modal chồng) | 3.3 | 5/5 pass; Tab/Shift+Tab giữ trong modal, Esc đóng từng modal trên cùng, focus về nút mở |
| AC-6 | — | grep source | 3.1 | đạt |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Dedupe logout nuốt lần logout chủ động | Người dùng bấm Đăng xuất không thoát | Dedupe chỉ gộp lần gọi đang chạy, xong thì reset | Revert `AuthContext.jsx` |
| Request id làm mất `refetch` | Màn không tải lại sau lưu | Test race + giữ API `reload` cũ | Revert `useAsync.js` |
| Đổi điều kiện mock ở service | Bản VPS (mock) đổi hành vi | So hành vi `VITE_USE_MOCK=true` trước/sau | Revert từng service |
| Focus trap chặn input trong modal lồng | Không nhập được | Chỉ bẫy trong modal trên cùng | Revert `Modal.jsx` |
| Sửa song song với plan responsive | Conflict file | Chỉ sửa JS trong danh sách file ở trên | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ không đổi contract BE
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã tách từ plan tổng thành 3 plan con
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-20 — Phase 3.1 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 67, kitchen 41, merge 38, hardening 3 pass; lint, prettier, build ok)
- Đã làm:
  - `axiosClient.js` bỏ qua 401 của `/auth/logout`; `AuthContext.jsx` bọc `logout` bằng `singleFlight` (file mới `src/services/http/singleFlight.js`).
  - `AppRoutes.jsx`: `UiKitPage` (chứa `NutritionPrimitivesDemo`) chỉ lazy-import và đăng ký route khi `import.meta.env.DEV`. `dist/` không còn chunk/chuỗi UiKit.
  - `childrenSeed.js:480,505` → `999222009007`, `999222009901`; sửa theo ở `docs/quality/manual-tests/health-exam-flow.md:270`.
  - Ghi chú `Dockerfile:16` ↔ `docker/nginx/defaultconf.txt` vào Progress log plan `2026-10-19-vps-docker-deploy.md`.
  - Test mới `tests/hardening/auth-unauthorized.test.mjs`; thêm script `test:hardening` vào `package.json` và chuỗi `verify` (không đổi dependency).
- Khác plan:
  - `authService.js:37-46` đã logout local khi API lỗi (`finally` xoá token) ⇒ không sửa.
  - 8 nút icon (`GoalTables.jsx:361,453,493,867`, `PasswordInput.jsx:10`, `SignaturePicker.jsx:32`, `DailyHealthOverviewPage.jsx:224`, `StockReceiptFormPage.jsx:280`) đã có `aria-label` sẵn trong code hiện tại ⇒ không sửa.
  - Menu "Thư viện giao diện (UI Kit)" ở `UserMenu.jsx:100` đã ẩn theo `import.meta.env.DEV` ⇒ không sửa.
- Tiếp: user review ⇒ Phase 3.2.

### 2026-10-20 — Phase 3.2 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 68, kitchen 41, merge 38, hardening 8 pass; lint, prettier, build ok)
- Đã làm:
  - `useAsync.js`: đánh số request qua helper mới `src/hooks/latestRequest.js`; chỉ lần gọi mới nhất (và khi còn mount) được `setData/setError/setLoading`; tắt `enabled` thì huỷ lần đang chạy.
  - `DB_CHANGED_EVENT` chuyển sang `src/mocks/dbEvents.js`; `mockDatabase.js` re-export; `useAsync`, `SchoolYearContext`, `useGuardianQuery`, `usePermissions`, `useKitchen` import từ `dbEvents`.
  - Guarded fetch (`ignore` trong cleanup) cho effect nạp bản nháp AI: `WeeklyMenuPage.jsx:88`, `MenuFormPage.jsx:76`, `WeeklyMenuFormPage.jsx:57`. Các list/filter khác đã đi qua `useAsync` hoặc hook có guard sẵn (`useGuardianQuery`, `useKitchen`).
  - Smoke test built-in browser (mock, PHT): bấm liên tục 4 tab nhóm tuổi ở `/menu/weekly` ⇒ bảng hiện đúng "Mẫu giáo bé" (tab cuối), không lỗi console.
  - Test mới `tests/hardening/use-async-race.test.mjs` (5 test).
- Spike tách mock (build `VITE_USE_MOCK=false`):
  - Trước: mã mock (`carenest.mockdb`, seed, mọi repository) nằm trong bản build API; JS tổng 3 470 004 byte.
  - `src/config/env.js`: `USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'` (giữ nghĩa cũ: không đặt biến ⇒ mock). Rolldown (Vite 8, `inlineConst` mặc định `smart`) gập được `USE_MOCK ? mock : api` ở mọi service ⇒ không cần sửa ~25 service.
  - `kitchenMockRepository.js:1858`: thêm `/* @__PURE__ */` cho `Object.fromEntries(Object.entries(...).map(...))` top-level ⇒ bỏ được kitchen mock + seed bếp.
  - Sau: 3 182 768 byte (−287 KB, −8,3%). Bản `VITE_USE_MOCK=true` (VPS, D6) vẫn mock như cũ.
  - Còn trong bản API: `attendanceMockRepository`, `childrenMockRepository`, `dailyHealthMockRepository`, `notificationMockRepository`, `schoolMockRepository`, `mockDatabase` + seed. Grep bản build không minify: không code thật nào gọi chúng; bundler vẫn giữ. Đã thử, không tác dụng nên đã bỏ: `@__PURE__` cho seed top-level, đăng ký listener `storage` lười, viết lại `facilityLockService` dạng ternary, `treeshake.propertyReadSideEffects: false`.
- Khác plan: không đổi ~25 service (1 dòng `env.js` cho cùng kết quả gập điều kiện); AC-4 đạt một phần ⇒ phần còn lại ghi nợ kỹ thuật.
- Tiếp: user review ⇒ Phase 3.3.

### 2026-10-20 — Phase 3.3 (chờ user xác nhận xoá file chết)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 68, kitchen 41, merge 38, hardening 13 pass; lint, prettier, build ok)
- Đã làm:
  - `Modal.jsx`: stack module-level (file mới `src/components/ui/modalStack.js`); chỉ modal trên cùng xử lý Esc/Tab; Tab/Shift+Tab vòng trong modal; bỏ qua Esc đã được component bên trong `preventDefault`; đóng thì trả focus về phần tử đã mở (nếu còn trong DOM).
  - Test mới `tests/hardening/modal-stack.test.mjs` (5 test).
  - Kiểm tay `/ui-kit` (dev, built-in browser): Tab ×7 và Shift+Tab ×5 vẫn ở trong modal; mở ConfirmationModal chồng lên Modal ⇒ Esc lần 1 chỉ đóng ConfirmationModal, lần 2 đóng Modal, focus về nút "Mở Modal"; không lỗi console. Route `/ui-kit` vẫn chạy ở bản dev.
  - Rà lại 8 file nghi chết (import tĩnh, `import()`, `import.meta.glob`, chuỗi path trong `src/`, `tests/`, `scripts/`, `docs/`, `.ai/`): không file nào được import. `models/Campus.js`, `Notification.js`, `Signature.js` chỉ chứa `@typedef` + `export {}`, không có JSDoc `import('@/models/…')` trỏ tới. `IssueBlocks.jsx` là chỗ duy nhất còn dùng class `.kb-menu` (`2026-10-18-selective-nutrition-permission-merge.md:191`) ⇒ xoá thì CSS `.kb-menu` thành thừa, để plan CSS xử lý.
  - Ghi nợ kỹ thuật (mục "Nợ kỹ thuật").
- Chưa làm: xoá 8 file — chờ user xác nhận danh sách. 4 file (`IssueBlocks.jsx`, `DishPortionTable.jsx`, `RolePermissionFormPage.jsx`, `RolePermissionListPage.jsx`) đang có thay đổi chưa commit từ việc khác.
- Tiếp: user xác nhận ⇒ xoá, chạy lại verify, đóng plan.

### 2026-10-20 — Phase 3.3 xoá file chết (done)
- Commit: chưa commit
- User xác nhận xoá cả 8 file (2026-10-20). Đã xoá: `components/kitchen/IssueBlocks.jsx`, `components/kitchen/MissingFoodForm.jsx`, `components/menu-planning/DishPortionTable.jsx`, `pages/school-config/RolePermissionFormPage.jsx`, `pages/school-config/RolePermissionListPage.jsx`, `models/Campus.js`, `models/Notification.js`, `models/Signature.js`.
- Verify: `node scripts/verify.mjs` → xem dòng VERIFY trong báo cáo cuối phiên.
- Còn mở: CSS `.kb-menu` thành thừa sau khi xoá `IssueBlocks.jsx` (để plan CSS dọn); AC-4 đạt một phần (nợ kỹ thuật).
