---
title: Báo ăn khi tiếp nhận trẻ — phần Web
status: approved     # user duyệt 2026-11-18, chạy Subagent-driven
owner: Giáp
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-meal-registration
modules: [children, attendance, kitchen]
rules: [CHD-13, ATT-02a, HLT-06, NUT-07]
risk: high           # đổi form tiếp nhận, khai báo hồ sơ, điểm danh, dự trù bếp
created: 2026-11-18
updated: 2026-11-18
---
# Báo ăn khi tiếp nhận trẻ — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bước 3 tiếp nhận thành "Báo ăn và sức khỏe" với ô tích "Báo ăn": tích thì khai dị ứng + chế độ ăn, bỏ tích thì ẩn; cùng cờ ở màn khai báo hồ sơ, nhập Excel, điểm danh và dự trù bếp (BE giả).

**Architecture:** Cờ nằm trong state khai báo (`declaration.mealRegistered`) nên form, kiểm tra, payload dùng chung đường đi hiện có; hồ sơ trẻ trả `child.mealRegistered`. BE giả (mock) theo đúng luật BE plan; tầng UI chỉ ẩn/hiện theo cờ, không tính suất.

**Tech Stack:** React 18 + Vite, JavaScript/JSX, `node:test` (`tests/`), mock localStorage (`@/mocks/mockDatabase`).

**Spec:** `BE:docs/plans/active/2026-11-18-intake-meal-registration.md` (Context → Acceptance criteria, Quyết định đã chốt 1–7, AC-1…AC-7). Plan này chỉ phần client.

## Global Constraints

- Contract theo plan BE: request `declaration.mealRegistered` (boolean); response `child.mealRegistered` ở hồ sơ, danh sách, bảng điểm danh. Thiếu field ⇒ coi là báo ăn: luôn so `mealRegistered !== false`.
- Câu chữ đúng nguyên văn:
  - Bước 3: `Báo ăn và sức khỏe`; tiêu đề bước: `Báo ăn và sức khỏe khi tiếp nhận`; nhóm ở bước Xem lại: `Báo ăn và sức khỏe`, bảng tóm tắt: `V. Báo ăn và sức khỏe`.
  - Ô tích: `Báo ăn`; dòng gợi ý: `Trẻ ăn ở trường. Bỏ tích: không khai dị ứng, chế độ ăn và trẻ không có suất ăn.`
  - Bảng: báo ăn ⇒ `I. Dị ứng và chế độ ăn` + `II. Tiền sử và sức khỏe khác`; không báo ăn ⇒ chỉ `I. Tiền sử và sức khỏe khác`.
  - Dòng tóm tắt `Báo ăn`: `Có` / `Không`. Điểm danh, nhập Excel, hồ sơ: `Không báo ăn`.
  - Cột Excel: `Báo ăn (Có/Không, để trống = Có)`, key `mealRegistered`; lỗi `Báo ăn ghi Có hoặc Không` ở khóa `declaration.mealRegistered`.
- Ô tích dùng `Checkbox` từ `@/components` bọc `<label className="checkbox">`; không viết `<input>` tay (baseline `rawField` không được tăng: HealthDeclarationFields 6, EnrollChildPage 1, HealthDeclarationPage 1, ImportChildrenPage 4, AttendancePage 2).
- Chạy test, lint, build trong PowerShell (`Set-Location D:\project_capstone\project\web\CareNest_FE`); Git Bash làm React nạp 2 lần ⇒ lỗi giả.
- Mock là BE giả: luật mới ghi comment dẫn `CHD-13`. Tầng UI không tính suất ăn.
- Commit: `<JIRA>: <English verb …>`, 1 thay đổi logic/commit, chỉ khi user cho phép trong tin nhắn hiện tại.

## Review Focus

1. Bỏ tích rồi tích lại ở bước 3 ⇒ dị ứng đã gõ vẫn còn. Test: Task 2 `bỏ tích Báo ăn giữ nguyên dị ứng đã gõ`.
2. Bảng I đang "Có dị ứng" chưa nhập chất mà bỏ tích ⇒ bấm Tiếp tục được. Test: Task 1 `không báo ăn: dị ứng, chế độ ăn chưa đủ vẫn hợp lệ`.
3. Ô Excel `không`, ` KHÔNG `, `có`, chữ khác. Test: Task 5 `cột Báo ăn không phân biệt hoa thường, chữ khác báo lỗi`.
4. Trẻ có dị ứng bỏ báo ăn ⇒ hồ sơ ẩn dị ứng, bếp không thấy; báo ăn lại thấy dị ứng cũ. Test: Task 4 `bỏ báo ăn giữ dị ứng, báo ăn lại vẫn còn`, Task 7 `bếp không thấy dị ứng của trẻ không báo ăn`.
5. "Có mặt tất cả" hoặc đổi sang Có mặt cho trẻ không báo ăn ⇒ không bật suất. Test: Task 6 `mealsWhenPresent tắt suất cho trẻ không báo ăn`, `lưu điểm danh luôn tắt suất trẻ không báo ăn`.

---

## Context

- Chuẩn bị: clone FE đang ở `feature/G94-180-FE-FEAT-43-child-health-pickup` với 33 file WIP năm học mới chưa commit. Trước Task 1, user chọn commit hoặc stash WIP đó, rồi tạo nhánh mới từ `origin/dev`.
- Bước 3 hiện tại: `src/pages/children/EnrollChildPage.jsx:40` (STEPS), :512-526 (`HealthDeclarationFields sheet`), :257-261 (kiểm tra trước bước 4), :609-611 (Xem lại), :267-270 (gửi `enrollChild`, `declaration` đi nguyên).
- Form: `src/components/children/HealthDeclarationFields.jsx` — sheet :149-209 (bảng I :153-187, bảng II :189-205), fieldset :211-269. `IntakeSheet` clone mọi con (`IntakeSheet.jsx:14`) nên ô tích đặt ngoài bảng.
- Tóm tắt: `src/components/children/DeclarationSummary.jsx:13-62` (một danh sách dòng, không chia I/II).
- Khai báo hồ sơ: `src/pages/children/HealthDeclarationPage.jsx` `openEditor` :70-80 chỉ chép 4 khối; lưu :116-133 → `childrenService.saveHealthDeclaration` → API `childrenApi.js:247` / mock `childrenMockRepository.js:1314-1348`. Hồ sơ trẻ hiện dị ứng ở `ChildProfilePage.jsx:166-181`.
- Kiểm tra/mặc định: `childrenValidation.js:133-161`, `childrenHelpers.js:78-83`.
- Mock trẻ: `cleanDeclaration` :642-653, `createChild` :826-859 (chép dị ứng lên trẻ :842), `saveDeclaration` :1314-1348 (chép dị ứng lên trẻ :1345), `toView` :487-514 trả mọi field của bản ghi trẻ.
- Excel: `IMPORT_COLUMNS` `childrenConstants.js:191-228` (dị ứng :202, chế độ ăn :203); parser `enrollmentImport.js` (`toDeclaration` :72-99, `readEnrollmentTable` :104-150, ô lạ giữ nguyên để báo lỗi đúng dòng); file mẫu `ImportChildrenModal.jsx:19-34` (dòng mẫu theo vị trí :25-31); bảng xem trước `ImportChildrenPage.jsx:183-247`.
- Điểm danh: `AttendancePage.jsx` `setStatus` :278-285, `markAllPresent` :286-298, ô "Tham gia ăn" :624-641; mock `childView` :493-500, gán suất khi lưu :729-732; seed `attendanceSeed.js:45`.
- Bếp: `weeklyForecast.js` `forecastEnv` :40-50 (`registered` :48), đếm vắng :72-75; danh sách dị ứng của bếp `kitchenMockRepository.js:306-313` trong `publishedAllergyChanges` (trả qua `getPublishedMenu` :1810); `kitchenSeed.js` `seedMealCount` :142-160.

## Quyết định đã chốt
Như plan BE mục "Quyết định đã chốt" 1–7 (user, 2026-11-18). Thêm cho Web: cờ đi trong state khai báo; bỏ tích không xóa dữ liệu đã gõ trong form.

## Làm rõ nghiệp vụ
Xem plan BE (mục "Làm rõ nghiệp vụ"). FE bị ảnh hưởng: `/children/enroll`, `/children/:id/health-declaration`, `/children/:id`, `/children` (nhập Excel), `/attendance`, màn bếp (thực đơn đã công bố, dự trù tuần).

### Câu hỏi mở
- [x] Mã Jira + mã công việc phần Web ⇒ `G94-180` / `FE-FEAT-43` (user 2026-11-18).
- [x] WIP năm học mới trên G94-180: commit hay stash trước khi tạo nhánh mới? ⇒ Stash (user 2026-11-18).

## Acceptance criteria
- **AC-W1** (`CHD-13`): bước 3 mặc định tích "Báo ăn", hiện bảng I (dị ứng, chế độ ăn) và bảng II (tiền sử + thông tin khác); bỏ tích ⇒ chỉ còn bảng tiền sử + thông tin khác, dữ liệu đã gõ giữ trong form.
- **AC-W2** (`CHD-13`): bỏ tích ⇒ không kiểm dị ứng, chế độ ăn; gửi `declaration.mealRegistered = false`.
- **AC-W3** (`CHD-13`): bước Xem lại và màn khai báo hồ sơ hiện dòng "Báo ăn: Có/Không"; Không ⇒ không hiện dị ứng, chế độ ăn.
- **AC-W4** (`CHD-13`, `HLT-06`): màn khai báo hồ sơ mở với cờ của trẻ; bỏ báo ăn rồi lưu ⇒ dị ứng cũ còn (BE giả giữ), hồ sơ trẻ ẩn dị ứng, hiện "Không báo ăn".
- **AC-W5** (`CHD-13`): file Excel có cột "Báo ăn"; Không ⇒ trẻ không báo ăn, bỏ qua dị ứng/chế độ ăn; chữ lạ ⇒ lỗi dòng.
- **AC-W6** (`ATT-02a`, `CHD-13`): điểm danh trẻ không báo ăn không có nút "Tham gia ăn" (hiện "Không báo ăn"); lưu luôn không có suất.
- **AC-W7** (`NUT-07`, `CHD-13`): dự trù tuần và danh sách dị ứng của bếp không tính trẻ không báo ăn.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Chỗ giữ cờ ở client | `declaration.mealRegistered` | State riêng ở trang | Form, kiểm tra, payload đi chung; khớp contract BE |
| Bỏ tích | Giữ dữ liệu đã gõ trong form | Xóa bảng I | User có thể tích lại; BE bỏ qua khi `false` |
| Mặc định suất khi Có mặt | Helper `mealsWhenPresent` ở model | Rẽ nhánh trong trang | Một chỗ cho `setStatus`, `markAllPresent`, có test |

## Phases

### Phase A — Tiếp nhận, khai báo hồ sơ, nhập Excel

#### Task 1: Mặc định và kiểm tra khai báo theo cờ

**Files:**
- Modify: `src/utils/children/childrenHelpers.js:78-83`, `src/utils/children/childrenValidation.js:133-161`
- Test: `tests/children/meal-registration-declaration.test.mjs` (mới)

**Interfaces:**
- Produces: `emptyDeclaration()` có `mealRegistered: true`; `validateDeclaration(d, { dateOfBirth })` bỏ kiểm dị ứng, chế độ ăn khi `d.mealRegistered === false`; `d.mealRegistered` khác `undefined`/boolean ⇒ `errors.mealRegistered = 'Báo ăn ghi Có hoặc Không'`.

- [ ] **Step 1: Viết test hỏng** — tiền sử hợp lệ dùng chung (self, family, tbContact = `NONE_REPORTED`):
  - `khai báo trống mặc định báo ăn`: `emptyDeclaration().mealRegistered === true`.
  - `không báo ăn: dị ứng, chế độ ăn chưa đủ vẫn hợp lệ`: `mealRegistered: false`, allergies `{ state: 'REPORTED', items: [] }`, diet `{ state: 'REPORTED', text: '' }` ⇒ `validateDeclaration` trả `{}`.
  - `báo ăn: dị ứng Có mà chưa nhập chất vẫn lỗi`: như trên với `mealRegistered: true` ⇒ `errors.allergies === 'Nhập ít nhất một thực phẩm/chất gây dị ứng'`.
  - `giá trị Báo ăn lạ báo lỗi`: `mealRegistered: 'Ăn trưa'` ⇒ `errors.mealRegistered === 'Báo ăn ghi Có hoặc Không'`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/meal-registration-declaration.test.mjs` ⇒ `# fail 4`.
- [ ] **Step 3: Cài đặt** theo Interfaces.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# pass 4`, `# fail 0`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Skip allergy checks for children without school meals`.

#### Task 2: Ô tích "Báo ăn" và bố cục bảng

**Files:**
- Modify: `src/components/children/HealthDeclarationFields.jsx` (sheet :149-209, fieldset :211-269)
- Test: `tests/children/health-declaration-fields-meal.test.mjs` (mới; cách dựng như `tests/dashboard/assessment-history-view.test.mjs`: bỏ import, stub component con, `renderToStaticMarkup`)

**Interfaces:**
- Consumes: `value.mealRegistered` (Task 1).
- Produces: không thêm prop; tích/bỏ tích gọi `onChange({ ...value, mealRegistered })`, giữ nguyên `allergies`, `diet`.

- [ ] **Step 1: Viết test hỏng** (sheet mode, stub `IntakeSheet` in `title`, `IntakeChoiceRow` in `label`):
  - `báo ăn: hiện bảng I và thông tin khác nằm ở bảng II`: HTML có `I. Dị ứng và chế độ ăn`, `Dị ứng thực phẩm / thuốc`, `II. Tiền sử và sức khỏe khác`; vị trí `Thông tin sức khỏe khác` sau `II. Tiền sử và sức khỏe khác`.
  - `không báo ăn: ẩn dị ứng, chế độ ăn`: không có `Dị ứng thực phẩm / thuốc`, `Chế độ ăn`; có `I. Tiền sử và sức khỏe khác`, `Thông tin sức khỏe khác`, `Báo ăn`.
  - `bỏ tích Báo ăn giữ nguyên dị ứng đã gõ`: gọi `onChange` của ô tích với `{ target: { checked: false } }` ⇒ nhận `{ ...value, mealRegistered: false }`, `allergies.items` vẫn `['Trứng']`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/health-declaration-fields-meal.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt** — ô tích + dòng gợi ý đặt trên `.tr-intake-cols` (sheet) và đầu form (fieldset); bảng I chỉ dị ứng + chế độ ăn; dòng `otherNotes` thành dòng 4 của bảng tiền sử; tiêu đề theo Global Constraints; fieldset: ẩn khối dị ứng, chế độ ăn khi không báo ăn, chuyển khối thông tin khác xuống sau tiền sử.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# fail 0`; `npm run check:design` ⇒ `check-design: ok`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Add meal registration checkbox to health declaration`.

#### Task 3: Tên bước và tóm tắt

**Files:**
- Modify: `src/pages/children/EnrollChildPage.jsx` (:40, :514, :609-611), `src/components/children/DeclarationSummary.jsx:13-62`
- Test: `tests/children/declaration-summary-meal.test.mjs` (mới, cùng cách dựng Task 2)

**Interfaces:**
- Produces: `DeclarationSummary({ declaration, sheet, title, mealRegistered = declaration?.mealRegistered ?? true })`.

- [ ] **Step 1: Viết test hỏng** — `tóm tắt không báo ăn ẩn dị ứng, chế độ ăn`: `mealRegistered: false` ⇒ có `Báo ăn` và `Không`, không có `Dị ứng`, `Chế độ ăn`. `tóm tắt báo ăn hiện dị ứng`: mặc định ⇒ có `Báo ăn`, `Có`, `Dị ứng`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/declaration-summary-meal.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt** — dòng đầu `['Báo ăn', mealRegistered ? 'Có' : 'Không']`, bỏ 2 dòng khi không báo ăn; đổi câu chữ bước 3 theo Global Constraints.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# fail 0`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Rename intake health step to meals and health`.

#### Task 4: BE giả, màn khai báo hồ sơ, hồ sơ trẻ

**Files:**
- Modify: `src/services/children/mock/childrenMockRepository.js` (`cleanDeclaration` :642-653, `createChild` :826-859, `saveDeclaration` :1314-1348)
- Modify: `src/pages/children/HealthDeclarationPage.jsx` (`openEditor` :70-80, xem :189), `src/pages/children/ChildProfilePage.jsx:166-181`
- Modify: `src/services/children/api/childrenApi.js:7-74` (ghi chú contract), `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` (:113, :118, :137, :158-160, :178-179)
- Test: `tests/children/meal-registration-mock.test.mjs` (mới; dựng như `tests/children/enroll-activates-guardians.test.mjs`)

**Interfaces:**
- Consumes: `emptyDeclaration`, `validateDeclaration` (Task 1).
- Produces: bản ghi trẻ mock có `mealRegistered` (boolean); `toView`/`getChildDetail` trả nguyên field này.

- [ ] **Step 1: Viết test hỏng**:
  - `tiếp nhận không báo ăn: hồ sơ ghi cờ, dị ứng Chưa cung cấp`: `enrollChild` với `mealRegistered: false`, dị ứng `REPORTED ['Trứng']` ⇒ `getChildDetail`: `child.mealRegistered === false`, `declaration.allergies.state === 'NOT_PROVIDED'`, `child.allergies` deepEqual `[]`.
  - `bỏ báo ăn giữ dị ứng, báo ăn lại vẫn còn`: tiếp nhận báo ăn dị ứng `['Sữa']` → `saveDeclaration` `mealRegistered: false` kèm dị ứng `['Trứng']` và lý do ⇒ khai báo vẫn `['Sữa']`, `child.mealRegistered === false`, `child.allergies` vẫn `['Sữa']` → lưu lại `true` với `['Sữa']` ⇒ `child.mealRegistered === true`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/meal-registration-mock.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt mock** (comment `CHD-13`): `cleanDeclaration` giữ cờ; `createChild` ghi cờ lên trẻ, `false` ⇒ dị ứng, chế độ ăn `NOT_PROVIDED`, `allergies: []`; `saveDeclaration` `false` ⇒ giữ dị ứng, chế độ ăn đang lưu (cả bản chép trên trẻ), cập nhật cờ.
- [ ] **Step 4: Cài đặt màn** — `openEditor` thêm `mealRegistered: child.mealRegistered !== false`; xem: `<DeclarationSummary declaration={declaration} mealRegistered={child.mealRegistered !== false} />`; `ChildProfilePage` không báo ăn ⇒ thay khối dị ứng bằng `Không báo ăn`. Ghi `mealRegistered` vào ghi chú contract `childrenApi.js` và spec tích hợp.
- [ ] **Step 5: Chạy, thấy qua** — lệnh Step 2 ⇒ `# fail 0`; `npm run test:children` ⇒ `# fail 0`.
- [ ] **Step 6: Commit (khi user cho phép)** — `<JIRA>: Store meal registration in mock child records`.

#### Task 5: Nhập Excel cột "Báo ăn"

**Files:**
- Modify: `src/models/children/childrenConstants.js:191-228` (chèn trước dị ứng :202), `src/components/children/ImportChildrenModal.jsx:25-31` (thêm `Có` vào dòng mẫu đúng vị trí cột mới)
- Modify: `src/services/children/mock/enrollmentImport.js` (`toDeclaration` :72-99), `src/pages/children/ImportChildrenPage.jsx:245-247`
- Test: `tests/children/meal-registration-import.test.mjs` (mới; dựng CSV từ `IMPORT_COLUMNS` như `tests/children/gestation-weeks-required.test.mjs`)

**Interfaces:**
- Consumes: lỗi `errors.mealRegistered` (Task 1), mock `previewImport` gắn tiền tố `declaration.`.
- Produces: cột `{ key: 'mealRegistered', label: 'Báo ăn (Có/Không, để trống = Có)', required: false }`; `toDeclaration` trả `mealRegistered` (`true` | `false` | chữ gốc khi lạ).

- [ ] **Step 1: Viết test hỏng**:
  - `cột Báo ăn = Không bỏ qua dị ứng, chế độ ăn`: Dị ứng `Trứng` ⇒ payload `declaration.mealRegistered === false`, dị ứng `NOT_PROVIDED`.
  - `cột Báo ăn trống là báo ăn`: ⇒ `true`.
  - `cột Báo ăn không phân biệt hoa thường, chữ khác báo lỗi`: ` KHÔNG ` ⇒ `false`, `có` ⇒ `true`; `Ăn trưa` ⇒ `previewImport` dòng có lỗi `declaration.mealRegistered`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/meal-registration-import.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt** — đọc ô bằng `isYes`/`isNone` (:45-46) như `toYesNo`; `false` ⇒ dị ứng, chế độ ăn `NOT_PROVIDED`; ô dị ứng ở bảng xem trước hiện `Không báo ăn` khi cờ `false`.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# fail 0`; `npm run test:children` ⇒ `# fail 0`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Add meal registration column to intake import`.

**Exit Phase A:** `npm run verify` ⇒ mọi bộ `# fail 0`, `All matched files use Prettier code style!`, `check-design: ok`, `check-api-contract (FE): 0 lỗi`, `✓ built`. **Dừng chờ user review.**

### Phase B — Điểm danh và bếp (BE giả)

#### Task 6: Điểm danh trẻ không báo ăn

**Files:**
- Modify: `src/models/attendance/attendanceConstants.js` (sau `allMeals` :65)
- Modify: `src/pages/attendance/AttendancePage.jsx` (`setStatus` :278-285, `markAllPresent` :286-298, ô :624-641)
- Modify: `src/services/attendance/mock/attendanceMockRepository.js` (`childView` :493-500, gán suất :729-732), `src/mocks/attendanceSeed.js:45`
- Test: `tests/hardening/attendance-meal-registration.test.mjs` (mới)

**Interfaces:**
- Produces: `mealsWhenPresent(child, sessions)` ⇒ `allMeals(child?.mealRegistered !== false, sessions)`; mock `childView` thêm `mealRegistered: ch.mealRegistered !== false`.

- [ ] **Step 1: Viết test hỏng**:
  - `mealsWhenPresent tắt suất cho trẻ không báo ăn`: `mealsWhenPresent({ mealRegistered: false }, ['LUNCH'])` deepEqual `{ LUNCH: false }`; `mealsWhenPresent({}, ['LUNCH'])` deepEqual `{ LUNCH: true }`.
  - `lưu điểm danh luôn tắt suất trẻ không báo ăn`: đặt một trẻ seed `mealRegistered: false` qua `writeDb`, lưu Có mặt với mọi bữa `true` ⇒ `getClassAttendance` trả bản ghi mọi bữa `false` và `child.mealRegistered === false`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/hardening/attendance-meal-registration.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt** — mock gán suất `false` cho trẻ không báo ăn trước dòng :729 (comment `ATT-02a/CHD-13`); seed chỉ cho suất khi trẻ báo ăn; trang dùng `mealsWhenPresent` ở `setStatus`, `markAllPresent`; ô "Tham gia ăn" của trẻ không báo ăn hiện chữ `Không báo ăn` thay `Switch`.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# fail 0`; `npm run test:hardening` và `npm run test:merge` ⇒ `# fail 0`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Hide meal toggle for children without school meals`.

#### Task 7: Dự trù tuần và danh sách dị ứng của bếp

**Files:**
- Modify: `src/services/kitchen/mock/weeklyForecast.js` (`forecastEnv` :40-50, đếm vắng :72-75), `src/services/kitchen/mock/kitchenMockRepository.js:306-313`, `src/mocks/kitchenSeed.js:142-160`
- Test: `tests/kitchen/weekly-forecast-meal-registration.test.mjs` (mới; gọi `buildWeeklyForecast` như `tests/kitchen/weekly-forecast.test.mjs`), thêm 1 test vào `tests/kitchen/published-allergy-menu.test.mjs`

**Interfaces:**
- Consumes: bản ghi trẻ `mealRegistered` (Task 4).

- [ ] **Step 1: Viết test hỏng**:
  - `dự trù tuần không tính trẻ không báo ăn`: chạy `buildWeeklyForecast` hai lần trên cùng dữ liệu, lần 2 đặt 1 trẻ đang học của lớp X `mealRegistered: false` ⇒ `registered` của lớp X giảm đúng 1, `suggested` giảm đúng 1 (không trừ 2 lần).
  - Trong `published-allergy-menu.test.mjs`: `bếp không thấy dị ứng của trẻ không báo ăn` — dùng dữ liệu của test `allergy roster is scoped…`, đặt trẻ dị ứng đó `mealRegistered: false` ⇒ `getPublishedMenu` không còn trẻ đó trong `allergyChanges[].children`.
- [ ] **Step 2: Chạy, thấy hỏng** — `node --import ./scripts/register-auth-test-loader.mjs --test tests/kitchen/weekly-forecast-meal-registration.test.mjs tests/kitchen/published-allergy-menu.test.mjs` ⇒ fail.
- [ ] **Step 3: Cài đặt** (comment `NUT-07/CHD-13`) — lọc `mealRegistered !== false` ở `registered`, bỏ trẻ không báo ăn khỏi đếm vắng, lọc ở danh sách dị ứng bếp và `seedMealCount`.
- [ ] **Step 4: Chạy, thấy qua** — cùng lệnh ⇒ `# fail 0`; `npm run test:kitchen` ⇒ `# fail 0`.
- [ ] **Step 5: Commit (khi user cho phép)** — `<JIRA>: Leave children without school meals out of kitchen counts`.

**Exit Phase B:** `npm run verify` ⇒ như Exit Phase A. **Dừng chờ user review.**

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-W1 | CHD-13 | `tests/children/health-declaration-fields-meal.test.mjs` (component) | A | Pass |
| AC-W2 | CHD-13 | `tests/children/meal-registration-declaration.test.mjs` (util) | A | Pass |
| AC-W3 | CHD-13 | `tests/children/declaration-summary-meal.test.mjs` (component) | A | Pass |
| AC-W4 | CHD-13, HLT-06 | `tests/children/meal-registration-mock.test.mjs` (mock) | A | Pass |
| AC-W5 | CHD-13 | `tests/children/meal-registration-import.test.mjs` (mock) | A | Pass |
| AC-W6 | ATT-02a, CHD-13 | `tests/hardening/attendance-meal-registration.test.mjs` (model + mock) | B | Pass |
| AC-W7 | NUT-07, CHD-13 | `tests/kitchen/weekly-forecast-meal-registration.test.mjs`, `tests/kitchen/published-allergy-menu.test.mjs` | B | Pass |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE thật chưa có field khi FE lên trước | Cờ `false` bị BE cũ bỏ qua, trẻ vẫn có suất | Làm Phase 1 BE trước hoặc cùng đợt; FE đọc thiếu field là báo ăn | Revert commit FE |
| Dòng mẫu Excel theo vị trí lệch cột | File mẫu sai giá trị | Test Task 5 đọc lại CSV dựng từ `IMPORT_COLUMNS` | Revert Task 5 |
| Vượt baseline `check-design` | Verify fail | Dùng `Checkbox`, không `<input>` tay | Sửa trước commit |
| Lẫn WIP năm học mới vào nhánh mới | Commit chứa việc khác | Xử lý WIP trước Task 1 ("Câu hỏi mở") | Tách commit |

## Validation log
- [x] Khẳng định về code có `file:line` (dò ngày 2026-11-18 trên working tree G94-180 + dev `76f46bfd`)
- [x] Contract theo plan BE; consumer: các route liệt kê ở "Làm rõ nghiệp vụ"
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã tách plan BE / Web, Web chia 2 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không mâu thuẫn với plan BE (tên field, nhãn cột, khóa lỗi)

## Progress log
### 2026-11-18 — Plan approved
- Commit: chưa commit
- Verify: chưa chạy (plan)
- User trả lời "Câu hỏi mở", duyệt, chọn Subagent-driven. Chạy sau plan BE.

### 2026-11-18 — Phase A (xong; chạy tiếp Phase B theo yêu cầu user)
- Commit: `1d337723` (Task 1) · `350cbb7c` (Task 2) · `209ab1b5`, `488d9cf8` (Task 3) · `185da113`, `da1ed319`, `92232161` (Task 4) · `edf5fdd6`, `2f4dcdde` (Task 5)
- Verify: `npm run verify` → 9 bộ test `# fail 0` (children 146 pass) · `All matched files use Prettier code style!` · `check-design: ok` · `check-api-contract (FE): 0 lỗi, 2 cảnh báo` · `✓ built in 4.01s`
- Khác plan: không dừng sau Phase A (user 18/11: làm liền Phase A và B). Thêm test: fieldset mode (Task 2), dòng mẫu Excel khớp cột (Task 5). Dòng mẫu Excel chuyển sang `src/utils/children/importTemplate.js` để test không cần DOM. Task 1 RED là 3 fail + 1 pass (test 3 giữ hành vi cũ).
- Tiếp: Phase B (Task 6, 7).

### 2026-11-18 — Phase B (chờ review toàn nhánh)
- Commit: `9564fb4a`, `0bcd95a0`, `de044ce1` (Task 6) · `b1766366`, `4066cd0d` (Task 7)
- Verify: `npm run verify` → 9 bộ test `# fail 0` (kitchen 169, hardening 124, children 146 pass) · `All matched files use Prettier code style!` · `check-design: ok` · `check-api-contract (FE): 0 lỗi, 2 cảnh báo` · `✓ built in 1.61s`
- Khác plan: mỗi task tách commit nhỏ theo yêu cầu user. API điểm danh thật đã giữ nguyên `child.mealRegistered` (spread `...child`), không phải sửa. Dự trù tuần bỏ bản ghi điểm danh của trẻ không báo ăn khỏi đếm vắng để không trừ 2 lần; chợ ngày dùng chung `forecastEnv` nên cũng đúng.
- Tiếp: review toàn nhánh Web, sửa 1 lượt nếu cần, rồi dừng chờ user.
