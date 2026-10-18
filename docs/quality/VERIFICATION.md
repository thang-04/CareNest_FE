# Verification — bằng chứng trước khi báo xong (FE)

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` — chưa có code (`package.json`) ⇒ in `VERIFY SKIP`; khi có code gọi `npm run verify` (team định nghĩa: lint + typecheck + test + build). Output tóm tắt, log ở `verify.log`.

## Bằng chứng
| Claim | Bằng chứng |
| --- | --- |
| Xong (khi có code) | Dòng `VERIFY PASS …` trong lượt |
| Bug đã sửa | Output test **fail trước fix** + **pass sau fix** (chưa có test runner ⇒ bước kiểm tay ghi rõ, trình duyệt) |
| Khớp contract BE | Đối chiếu `BE:docs/api/openapi.yaml` (snapshot BE khóa bằng test) + source DTO BE, dẫn `file:line` |
| Chạy trên trình duyệt | Bước + kết quả `x/y`, môi trường (BE thật hay mock) |
| AI layer nhất quán | `node scripts/check-ai-layer.mjs` exit 0 |

## Báo cáo cuối task
```text
Làn S (≤3 dòng):  Đã làm: … · Verify: <dòng VERIFY | chưa chạy — lý do> · Memory: <chỉ khi có trigger>
Làn M (≤8 dòng):  Đã làm · Rule/AC · Verify · Chưa kiểm chứng (trình duyệt, BE thật) · Chờ BE · Memory
Làn L:            ghi đủ vào Progress log của plan; chat chỉ tóm tắt + link plan
```

## Auth gateway integration2026-10-12

40 Node auth tests pass (0fail/skip); full FE verify pass test+lint+format+build. Isolated real HTTP auth9/9 pass, runtimecleaned. BrowserUI chưa kiểm chứng: CUA iab/chrome unavailable. Source/details/limits: [báo cáo](reports/2026-10-12-react-auth-integration.md).

## Sidebar route selection 2026-10-18

Regression `tests/menu/sidebar-selection.test.mjs`: fail trước fix (2/2) và pass sau fix (2/2). Chrome local mock: `/kitchen/meal-count` và `/children/new` mỗi trang chỉ có một mục active; click đóng nhóm Bếp giữ `aria-expanded=false`; lazy loading xuất hiện ngắn rồi biến mất. `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`: xem output của lượt chạy cuối.

## Khu Con người 2026-10-18

`node scripts/verify.mjs` → `VERIFY PASS full`. `node scripts/check-ai-layer.mjs` → 0 lỗi, 4 cảnh báo có sẵn. Chrome mock: bốn tab, ma trận full catalog PHT/GV, modal thêm nhân sự và roster đã kiểm; viewport 375/768/1280, document width không vượt viewport. API thật với auth mock: `VITE_PEOPLE_CONTRACT_READY=false` hiện trạng thái chờ contract, không gọi endpoint mới. Chưa kiểm E2E BE thật: `GET /accounts?staffOnly=true` và `GET /staff-assignments/roster` chưa có trong BE.

## Mock seed backfill 2026-10-18

Legacy kitchen DB regression `tests/kitchen/mock-seed-backfill.test.mjs`: fail before fix on missing finalized stock-count history; pass after one-time seed migration. `npm.cmd run test:kitchen`: 31/31 pass. `node scripts/verify.mjs`: VERIFY PASS full. `node scripts/check-ai-layer.mjs`: 0 errors, 4 existing warnings.

Chrome local mock: `/kitchen/forecast` showed weekly serving grid and order table; `/kitchen/stock-issues` showed dated issue rows; `/kitchen/stock-counts` showed a finalized sample count. The reported generic error message was not reproduced in this browser session; other routes were smoke-checked by role-visible navigation, not exhaustively exercised in every role.

## Mock seed migrations across modules 2026-10-18

`tests/mocks/mock-seed-migration.test.mjs`: 3/3 pass (legacy base lists, school classes/children, versioned empty-collection migration preserving non-empty data). `tests/kitchen/mock-seed-backfill.test.mjs`: 1/1 pass. `npm.cmd run test:kitchen`: 31/31 pass. Final `node scripts/verify.mjs`: VERIFY PASS full.

Chrome local mock smoke: school class, menu week, facility inspection, assessment periodic, child health trend, kitchen forecast/count routes loaded without the reported generic error; loading was allowed to finish before observation. The exact error string was not reproduced in this browser session.

## Principal kitchen campus fallback 2026-10-18

Regression `tests/kitchen/kitchen-campus.test.mjs`: 2/2 pass. CUA with isolated mock Principal and `campusId=null`: `/kitchen/food-samples` selected Campus 1 and rendered its empty-state/history without ErrorBoundary; `/kitchen/forecast` also rendered after adding a guard for the first render while master data/query loads. No real browser profile data was reset.

### People list workspace alignment 2026-10-18

People tabs use one shared inline navigation style. Staff and child lists keep a single large list card; parent activation now groups the tabs, campus/class selection, and account table in one large card. Chrome local mock screenshots verified the staff and parent layouts. Focused Prettier and ESLint checks passed for the changed UI files. `node scripts/verify.mjs` was rerun and reported `VERIFY FAIL full`: repository format check stops on existing `src/pages/kitchen/KitchenFlowPage.jsx`; full build did not run.

### People tab corner spacing 2026-10-18

Added consistent 16px horizontal inset to the embedded tab labels. Staff and parent tab rails now extend to the card edges while retaining the same label inset as the child list. Browser mock comparison confirmed the tab rail bounds and label positions match across all three routes.

### Shared people list card wrapper 2026-10-18

Applied the same explicit `people-list-workspace` card class to staff, parent, and child list routes. The active workspace card contains the people tabs and list content; local Chrome mock verified the staff and parent wrappers render with the shared white surface, border, radius, and shadow. Checks for this correction are recorded after execution.

Final correction result: `node scripts/verify.mjs` -> `VERIFY PASS full`; focused Prettier and ESLint checks passed; `node scripts/check-ai-layer.mjs` -> 0 errors, 4 existing warnings.

2026-10-18 final card visibility adjustment: strengthened the shared workspace border to the design-system strong border token and used the existing elevated card shadow for all three people lists. Local mock screenshot confirmed the staff card on `/school/staff`; `node scripts/verify.mjs` -> `VERIFY PASS full`.

### People summary cards 2026-10-18

Added four large summary cards above the workspace on the Staff and Parent tabs, reusing the Child tab's card styling. Staff counts come from paginated `totalElements` queries; Parent counts come from the scoped child list and populated class groups. Chrome mock displayed the Staff cards (15 total, 15 active, 0 locked, 8 teachers) and Parent cards (24 children, 18 linked, 6 missing, 4 classes) at 1024 px. Campus-switch interaction and BE-live values were not verified in this browser pass.

### Staff summary cards across routes 2026-10-18

Chrome local mock, Principal: before fix, `/school/staff/assignments` loaded a roster without summary cards. After sharing the component, clicking `Danh sách nhân sự → Phân công theo nơi → Danh sách nhân sự → Phân công theo nơi` retained all four cards on both routes. In the roster, campus 1 showed 9 total/5 teachers and campus 2 showed 4 total/2 teachers after loading; changing campus briefly showed placeholders rather than stale counts. Live BE values were not tested.
