---
title: Tiếp nhận trẻ cho năm học sắp tới từ ngày mở chuẩn bị — phần Web
status: done         # xong 2026-11-18: Phase A + Phase B, npm run verify exit 0 tại 06cdcac6
owner: Giáp
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-new-year-intake   # tạo từ f0ca4ca0 (nhánh G94-179 của Cần)
modules: [children, pickup]
rules: [G94-180/CHD-09, G94-180/CHD-10, G94-180/CHD-11, G94-180/CHD-12, G94-180/ATT-09, CFG-YR-05]
risk: high           # context dùng chung; màn tiếp nhận, danh sách, hồ sơ, sức khỏe, đón trẻ
created: 2026-11-18
updated: 2026-11-18
---
# Tiếp nhận trẻ cho năm học sắp tới — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header chọn năm sắp tới chưa tới ngày mở chuẩn bị ⇒ màn trẻ, sức khỏe, đón trẻ của năm đó chỉ xem. Từ ngày mở chuẩn bị: tiếp nhận, nhập Excel, mở lại hồ sơ vào năm đó; trẻ năm sau hiện ở danh sách và hồ sơ năm đó; BE giả của module trẻ khớp BE.

**Architecture:** `SchoolYearContext` thêm `yearLocked`, `lockedYear`, `preparingYear`, tính từ cờ `preparing` BE trả (CFG-YR-05). Các màn đọc cờ để ẩn nút ghi và hiện `YearLockedNotice`. Ô "Năm học tiếp nhận" (Cần làm ở `EnrollChildPage`) chỉ liệt kê năm đang mở tiếp nhận, chọn sẵn theo header. Danh sách, hồ sơ hiện `child.plannedAdmission` do BE trả; tầng UI không tự tính trạng thái.

**Tech Stack:** React 18 + Vite, JavaScript/JSX, `node:test` (`tests/`), mock localStorage (`@/mocks/mockDatabase`).

**Spec:** `BE:docs/plans/active/2026-11-18-new-year-intake-prep-date.md` (Kịch bản, Quyết định đã chốt, AC-1…AC-9) — ở worktree `D:\project_capstone\project\web\be-new-year-intake`. Plan này chỉ phần client.

## Global Constraints

- Contract theo BE plan. Response: `plannedAdmission` là `null` hoặc `{ schoolYearId, schoolYearName, campusId, classId, className, startDate, status }` ở hồ sơ và danh sách. Request: `schoolYearId`, `startDate` ở `POST /children/enrollments` (đã có), body nhập Excel, body mở lại hồ sơ. Lỗi 2412: hiện `desc` của BE, không so chữ.
- Không thêm trạng thái trẻ `UPCOMING`. Nhãn "Sắp nhập học" hiện khi `child.plannedAdmission` khác `null`.
- Tài khoản phụ huynh của trẻ năm sau như tiếp nhận thường (Q2 = b): không đổi `canActivateParent`, không đổi luồng tài khoản ở màn tiếp nhận.
- Câu chữ nguyên văn:
  - Năm bị khóa: `Năm học {label} mở chuẩn bị từ {dd/mm/yyyy} – chỉ xem.`; thêm `{việc}: làm được từ ngày mở chuẩn bị.` khi màn truyền `action`.
  - Hồ sơ: `Đăng ký năm học {label}, {lớp dự kiến {className} | chưa xếp lớp}, vào học từ {dd/mm/yyyy}. Xếp, đổi lớp dự kiến ở Xếp lớp năm học mới.`
  - Danh sách: nhãn `Sắp nhập học`; ô lớp `{className} (dự kiến)` hoặc `Chưa xếp lớp`.
- `src/contexts/SchoolYearContext.jsx` là vùng dùng chung: chỉ thêm 3 key, không đổi key cũ (user duyệt cách này ngày 17/11).
- Không sửa file của Cần (Q5): mock cấu hình trường (`schoolConfigMockRepository.js`) giữ nguyên, nên ở chế độ mock năm sau không bao giờ "đang chuẩn bị". Thử luồng thật với BE + dữ liệu dev (BE Task 4).
- Lấy lại code từ WIP: file mới bằng `git show 'stash@{0}^3:<file>'`, đoạn sửa bằng `git diff 'stash@{0}^1' 'stash@{0}' -- <file>`. Không `git stash pop` hoặc `apply` (4 file xung đột, mô hình `UPCOMING`).
- Chạy test, lint, build trong PowerShell (`Set-Location D:\project_capstone\project\web\CareNest_FE`). Git Bash làm React nạp 2 lần ⇒ lỗi giả.
- Mock là BE giả: luật mới ghi comment dẫn `CHD-11`/`CHD-12`.
- Commit nhỏ (user nhắc 18/11): mỗi commit 1 thay đổi logic kèm test của nó, `npm run test:children` xanh sau mỗi commit; message `G94-180: <English verb …>`, không ghi công cụ AI. Không push.

## Review Focus

1. Header ở năm bị khóa, mở thẳng URL `/children/enroll` ⇒ trang báo chỉ xem, không có form. Test: Task 2 `year-locked-pages`.
2. Màn Đón trẻ khi header ở năm bị khóa ⇒ không có nút trả trẻ, có nút về năm đang hoạt động, không lỗi. WIP gọi `lockedYear` mà context chưa có key này ⇒ trang lỗi. Test: Task 1 context có `lockedYear`, Task 2.
3. Header ở năm đang hoạt động, năm sau đang chuẩn bị ⇒ ô "Năm học tiếp nhận" có cả hai, chọn sẵn năm đang hoạt động. Test: Task 1 `defaultIntakeYearId`.
4. Mock: trẻ năm sau không ở danh sách năm đang học, không xếp lớp năm nay được, nghỉ học thì hủy đăng ký. Test: Task 4.
5. Năm chưa có `prepDate` (dữ liệu trình duyệt cũ) ⇒ coi như chưa mở (khóa), không lỗi. Test: Task 1.

---

## Phases

### Phase A — Khóa trước ngày mở chuẩn bị, tiếp nhận năm sau

#### Task 1: Helper ngày mở chuẩn bị, context, YearLockedNotice

**Files:**
- Create: `src/utils/schoolYearPrep.js` (từ WIP, bỏ phần `UPCOMING`)
- Modify: `src/contexts/SchoolYearContext.jsx:96-103`
- Create: `src/components/children/YearLockedNotice.jsx` (từ WIP, đọc `lockedYear` từ context)
- Test: `tests/children/school-year-prep.test.mjs`, `tests/children/year-locked-notice.test.mjs` (từ WIP)

**Interfaces (Produces):**
- `lockedYearOf(schoolYears, schoolYear) → year | null`: năm header là PLANNED và `!preparing`.
- `preparingYearOf(schoolYears, schoolYear) → year | null`: năm header là PLANNED và `preparing`.
- `intakeYearOptions(schoolYears) → year[]`: năm ACTIVE và năm PLANNED đang chuẩn bị, giữ thứ tự danh sách.
- `defaultIntakeYearId(schoolYears, schoolYear) → id | null`: năm header nếu có trong `intakeYearOptions`, không thì id năm ACTIVE.
- `lockedYearMessage(year) → string`: câu ở Global Constraints.
- `useSchoolYear()` thêm `yearLocked: boolean`, `lockedYear: year | null`, `preparingYear: year | null`.

- [ ] **Step 1:** Test pure function trong `school-year-prep.test.mjs` (danh sách năm: `ACTIVE` 2026-2027; `PLANNED` 2027-2028 có/không `preparing`; `PLANNED` không `prepDate`):
  - `'CHD-12: năm sau chưa tới ngày mở chuẩn bị là năm bị khóa'`: `lockedYearOf(..., '2027-2028')` trả năm đó; `preparingYearOf` trả `null`.
  - `'CHD-11: năm sau đang chuẩn bị mở tiếp nhận'`: `intakeYearOptions` = [2026-2027, 2027-2028]; khi chưa chuẩn bị chỉ còn [2026-2027].
  - `'CHD-11: năm tiếp nhận mặc định theo header'`: header 2027-2028 đang chuẩn bị ⇒ `'2027-2028'`; header 2026-2027 ⇒ `'2026-2027'`; header năm bị khóa ⇒ `'2026-2027'`.
  - `'năm không có prepDate coi như chưa mở'`, và `lockedYearMessage` với `prepDate` `2027-08-01` có `01/08/2027`.
- [ ] **Step 2:** `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/school-year-prep.test.mjs tests/children/year-locked-notice.test.mjs` ⇒ FAIL (chưa có module).
- [ ] **Step 3:** Viết helper; thêm 3 key vào context (comment dẫn `CFG-YR-05`, `CHD-12`); `YearLockedNotice({ action })`.
- [ ] **Step 4:** Chạy lại ⇒ PASS.
- [ ] **Step 5:** 2 commit: `G94-180: Add prep date helpers for the school year` (helper + test), `G94-180: Expose locked and preparing years in the year context` (context + notice + test).

#### Task 2: Màn chỉ xem khi năm bị khóa (CHD-12)

**Files** (điểm khóa lấy theo diff WIP của từng file, bỏ phần `UPCOMING` và `intakeYear` cũ):
- Children: `src/pages/children/ChildrenListPage.jsx`, `ChildProfilePage.jsx`, `EditChildPage.jsx`, `EnrollChildPage.jsx` (khối `if (yearReadOnly)` `:376` thêm `|| yearLocked`), `ClassPlacementPage.jsx`, `ImportChildrenPage.jsx`, `ParentActivationPage.jsx`, `src/components/children/ImportChildrenModal.jsx`
- Sức khỏe: `src/pages/children/ChildHealthRecordPage.jsx`, `HealthDeclarationPage.jsx`, `HealthCheckListPage.jsx`, `HealthCheckDetailPage.jsx`, `HealthCheckFormPage.jsx`, `HealthExamFormPage.jsx`, `HealthMeasurementFormPage.jsx`, `HealthTrendPage.jsx`, `src/components/children/HealthCheckClassRoster.jsx`, `MeasurementRoundRoster.jsx`
- Đón trẻ: `src/pages/pickup/PickupListPage.jsx` (dùng `lockedYearMessage` từ `@/utils`, không import component của module children; nút `Chuyển sang năm học {label}`)
- Test: `tests/children/year-locked-pages.test.mjs`

- [ ] **Step 1:** Test đọc mã nguồn (như `attendance-meal-not-registered.test.mjs`): mỗi file trong danh sách có `yearLocked`; các trang children và sức khỏe có `YearLockedNotice`; `PickupListPage.jsx` có `lockedYearMessage(lockedYear)` và không import `@/components/children`; `EnrollChildPage.jsx` có `yearReadOnly || yearLocked`.
- [ ] **Step 2:** Chạy ⇒ FAIL.
- [ ] **Step 3:** Áp điểm khóa từng file.
- [ ] **Step 4:** Chạy test + `npm run lint` ⇒ PASS.
- [ ] **Step 5:** 3 commit (test chia theo nhóm, mỗi commit kèm phần test của nhóm đó): `G94-180: Make child screens read-only before the prep date`, `G94-180: Make health screens read-only before the prep date`, `G94-180: Make pickup read-only before the prep date`.

#### Task 3: Ô "Năm học tiếp nhận" và BE giả tiếp nhận năm sau

**Files:**
- Modify: `src/pages/children/EnrollChildPage.jsx:101-134` (state năm: mặc định `defaultIntakeYearId`), `:480-508` (options `intakeYearOptions`)
- Modify: `src/mocks/schoolYearScope.js` (thêm `isPreparingYear(year, today)` từ WIP)
- Modify: `src/services/children/mock/childrenMockRepository.js:1046-1080` (`enrollChild`)
- Test: `tests/children/new-year-intake.test.mjs`

**Interfaces:** Consumes Task 1 helper. Mock theo BE: năm PLANNED chưa chuẩn bị (`isPreparingYear` đọc `prepDate` của năm trong `db.schoolYears`) ⇒ `ApiError(409, 'Năm học {name} chưa tới ngày mở chuẩn bị ({dd/mm/yyyy})')`; tài khoản phụ huynh như thường.

- [ ] **Step 1:** Test mock (seed thêm năm `2027-2028` PLANNED vào `db.schoolYears`, `prepDate` trước/sau hôm nay; khung test như `principal-enrollment.test.mjs`):
  - `'CHD-11: năm sau chưa tới ngày mở chuẩn bị ⇒ 409, không tạo trẻ'`
  - `'CHD-11: từ ngày mở chuẩn bị ⇒ trẻ Chờ xếp lớp, đăng ký PLACED, ngày bắt đầu'`
  - `'CHD-11: phụ huynh mới của trẻ năm sau được tạo tài khoản như thường'`
- [ ] **Step 2:** FAIL. **Step 3:** code. **Step 4:** `npm run test:children` PASS.
- [ ] **Step 5:** 2 commit: `G94-180: Refuse next-year intake before the prep date in mock`, `G94-180: Offer only open years in the intake year select`.

#### Task 4: Trẻ năm sau ở danh sách, hồ sơ; BE giả khớp BE

**Files:**
- Modify: `src/services/children/mock/childrenMockRepository.js`: `toView` `:484` thêm `plannedAdmission`; `inSchoolYear` `:533-546` (trẻ có đăng ký mở chỉ ở năm đăng ký); `placeChild` `:1234` chặn 409 câu như BE 2414; `withdrawChild` `:1266` hủy đăng ký
- Modify: `src/pages/children/ChildrenListPage.jsx` (thống kê và nhãn `Sắp nhập học`, ô lớp `(dự kiến)`, câu danh sách trống), `src/pages/children/ChildProfilePage.jsx` (thông báo đăng ký; ẩn nút Xếp lớp `:92` khi có đăng ký), `src/components/children/ChildBadges.jsx` (nhãn Sắp nhập học)
- Test: `tests/children/planned-admission-view.test.mjs`

- [ ] **Step 1:** Test:
  - `'CHD-09, CHD-11: trẻ năm sau chỉ ở danh sách năm đó, có plannedAdmission'`
  - `'CHD-11: xếp lớp năm nay cho trẻ năm sau ⇒ 409'`
  - `'CHD-11: cho nghỉ học ⇒ đăng ký CANCELLED, rời danh sách năm sau'`
- [ ] **Step 2:** FAIL. **Step 3:** code. **Step 4:** PASS.
- [ ] **Step 5:** 3 commit: `G94-180: Return planned admission from the child mock`, `G94-180: Keep next-year children out of current-year mock flows` (danh sách, xếp lớp, nghỉ học), `G94-180: Show next-year children on the list and profile`.

**Cuối Phase A:** `npm run verify` (PowerShell) exit 0; ghi Progress log; dừng chờ review.

### Phase B — Nhập Excel, mở lại hồ sơ cho năm sau

#### Task 5: Nhập Excel và mở lại hồ sơ vào năm sau

**Files:**
- Modify: `src/components/children/ImportChildrenModal.jsx`, `src/pages/children/ImportChildrenPage.jsx` (chọn năm theo `intakeYearOptions`; năm sau thêm ô ngày bắt đầu)
- Modify: `src/services/children/api/childrenApi.js:201` (`readmitChild` gửi `{ reason, schoolYearId, startDate }`), `:235` (`importChildren(rows, user, campusId, { schoolYearId, startDate } = {})`), `src/services/children/childrenService.js`
- Modify: mock `importChildren` `:1204`, `readmitChild` `:987`; `src/pages/children/EnrollChildPage.jsx:213` (mở lại gửi năm, ngày khi năm tiếp nhận là năm sau)
- Docs: `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` (mục tiếp nhận năm sau)
- Test: thêm vào `tests/children/new-year-intake.test.mjs`

- [ ] **Step 1:** Test `'CHD-11: nhập Excel vào năm sau ⇒ đăng ký PENDING'`, `'CHD-11: nhập Excel năm chưa mở ⇒ 409'`, `'CHD-11: mở lại hồ sơ vào năm sau ⇒ đăng ký PENDING'`.
- [ ] **Step 2:** FAIL. **Step 3:** code. **Step 4:** PASS.
- [ ] **Step 5:** 3 commit: `G94-180: Import children into the next school year`, `G94-180: Readmit a child into the next school year`, `G94-180: Document next-year intake in the enrollment spec`.

**Cuối Phase B:** `npm run verify` exit 0; Progress log; dừng chờ review.

## Cách thử với BE thật

1. BE: `D:\project_capstone\run-be-local.ps1 -Repo D:\project_capstone\project\web\be-new-year-intake -ResetLocalDb` (DB `carenest_local` có seed BE Task 4).
2. FE: `D:\project_capstone\run-fe-local.ps1` (nhánh `feature/G94-180-FE-FEAT-43-new-year-intake`, `.env.local` trỏ BE local).
3. Năm 2027-2028 của seed mở chuẩn bị 02/08/2027 ⇒ đang khóa. Thử CHD-12: HT chọn 2027-2028 ở header. Thử tiếp nhận: HT đổi ngày mở chuẩn bị về hôm nay ở Cấu hình năm học.

## Rủi ro & rollback

- `stash@{0}` (WIP 17/11) giữ tới khi Phase A xong; sau đó user quyết định xóa (`git stash drop` cần user cho phép).
- Nhánh chồng lên G94-179 của Cần; PR mở sau khi PR của Cần và BE plan vào `dev`.
- Rollback: revert commit; không có dữ liệu thật trong mock.

## Validation log

- Vị trí dòng kiểm ngày 18/11 trên `f0ca4ca0`. Context dùng chung chỉ thêm key. Đón trẻ dùng helper ở `@/utils`, giữ ranh giới module (ESLint).
- 5 task, khoảng 30 file (phần lớn là điểm khóa giống nhau) ⇒ 2 phase, dừng review sau mỗi phase.

## Progress log

### 2026-11-18 — Draft

- Viết cùng BE plan.

### 2026-11-18 — Plan approved

- User duyệt, chọn Subagent-driven; Q2 = b ⇒ bỏ phần chờ kích hoạt tài khoản; Q5 ⇒ bỏ task mock của Cần, thử với BE thật + dữ liệu dev; nhắc chia commit nhỏ. Nhánh `feature/G94-180-FE-FEAT-43-new-year-intake` tạo từ `f0ca4ca0`.

### 2026-11-18 — Phase A và Phase B xong

- Chạy Subagent-driven song song với BE plan: mỗi task một implementer và một reviewer (sonnet). Review cuối toàn nhánh chạy trên sonnet vì opus hết hạn mức 5 giờ và fable cần credit trả phí.
- Không dừng chờ review sau Phase A vì user đã trả lời Q3 "có".
- 20 commit code chia nhỏ theo task, từ `cf63bb2a` đến `06cdcac6`.
- Phase A (Task 1–4): `npm run verify` exit 0 tại `a9e2cbf8`.
- Phase B (Task 5): `npm run verify` exit 0 tại `4387b6dc`.
- Sau review cuối (4 commit sửa): `npm run verify` exit 0 tại `06cdcac6`, 1486 test, 0 lỗi; lint, prettier, check:design, check:api, build đạt.
- Khác plan:
  - Lỗi Prettier của Task 3 sửa bằng commit riêng `5c0a3419`, không amend, nên riêng `de9acc19` và `a1cd7ce7` không qua `format:check`.
  - Mock danh sách trả `classId` và `className` null cho trẻ năm sau, giống BE (`a9e2cbf8`).
  - Mock nhập Excel và mở lại hồ sơ lấy ngày đầu năm học làm ngày bắt đầu khi bỏ trống, giống BE (`4387b6dc`).
  - Sau review cuối: empty state Sức khỏe bỏ gợi ý "Tạo đợt khám" khi năm học khóa; test quét source kiểm biểu thức khóa thật; `ImportChildrenModal` điền năm và ngày mặc định khi danh sách năm học tải xong.

## Kết quả

- Xong 5 task theo plan. Mỗi task qua review spec và chất lượng. Review cuối toàn nhánh đạt sau 1 đợt sửa.
- Chưa kiểm: xem giao diện trên trình duyệt với BE thật (mục "Cách thử với BE thật").
