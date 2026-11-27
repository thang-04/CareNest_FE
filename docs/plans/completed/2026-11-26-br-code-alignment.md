---
status: done
---

# BR code alignment (FE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the Web screens for child records, health and pickup match the 26/11 business rules.

**Architecture:** Mostly local changes in existing pages/components plus API adapters for three BE contracts (photo replace, activation-code resend, phone-change requests). Mock repository mirrors every new BE behaviour. BE contracts come from `BE:docs/plans/completed/2026-11-26-br-code-alignment.md`.

**Tech Stack:** React 18 + Vite, Axios, `node --test` tests in `tests/` (`*.test.mjs`).

**Spec:** `D:\project_capstone\project\web\report\sua_sau\CODE-can-sua-theo-BR-2026-11-26.md`, `D:\project_capstone\project\web\report\BR-HLT-PAR-CP-PCK-2026-11-26.docx`, FR `D:\project_capstone\project\web\FR-III-5-6-ho-so-tre-suc-khoe-don-tre-2026-11-24.docx` (screen text already written to target).

## Global Constraints

- Branch `fix/G94-180-FE-FIX-14-school-year-scope`, prefix `G94-180: `, local only, many small commits.
- Run tests from **PowerShell** only (memory fe-tests-powershell-only): `node --test tests/<path>.test.mjs`; full suite `npm test`.
- After BE contract changes: `npm run api-index -- --from ../be-school-year-scope` and `check-api-contract --sync --from ../be-school-year-scope` (memory fe-api-index-from-worktree).
- Every API function gets a mock counterpart in the matching `services/*/mock` repository so mock mode keeps working.
- Strings below are exact.

## Review Focus

- Withdraw modal during summer (only today allowed) must still default to today, not tomorrow — test in Task 2.
- Next-child buttons when every remaining child is absent/moved must hide, not loop to the same child — test in Task 4.
- Pickup "call → hand over" with a time later than now must show `"Giờ trả trẻ không được sau giờ hiện tại."` before sending — test in Task 10.
- Resend activation code when SMS was really sent must not show a code (`activationCode` null) — test in Task 11.
- Photo change cancelled or failed must leave the old picture visible — test in Task 13.

---

### Task 1: Copy and length fixes (items 8, 11, 19, 20, 25, 27-FE)

**Files:** `components/children/HealthDeclarationFields.jsx:70`, `components/children/ChildInfoFields.jsx:282`, `components/pickup/PickupVerifyFlow.jsx:223,287`, `pages/children/ClassPlacementPage.jsx:431`, `components/account/GuardianPanel.jsx:82,139,198`, `pages/children/ParentActivationPage.jsx:186,513,527`, `pages/children/HealthMeasurementFormPage.jsx:210`, `utils/children/childrenValidation.js:197,208-209`, `pages/children/HealthCheckFormPage.jsx`
**Test:** new `tests/children/br-alignment-copy.test.mjs` (source regex style, like `scheduled-leave-cancel.test.mjs`) + `tests/health/campaign-dates.test.mjs`

- [x] **Step 1: Write failing tests** asserting:
  - allergy `maxItemLength={100}`; guardian name `maxLength={150}`;
  - pickup not-handed-over message `"${child.fullName} ở lại lớp. Nội dung cuộc gọi được lưu."` and toast `"Đã ghi nhận không trả trẻ."`;
  - transfer confirm ends `"Giáo viên lớp cũ và lớp mới được thông báo."`;
  - no `"Cấp mật khẩu mới"` left in GuardianPanel; labels `"Cấp lại mật khẩu tạm"`, confirm title `"Cấp lại mật khẩu tạm cho {tên}?"`;
  - measurement edit: `requireReason` only when a published value changed; message `"Nhập lý do sửa số đo đã công bố"`;
  - `validateHealthCheck(form, kind)`: MEASUREMENT ⇒ `"Nhập tên kỳ cân đo"`, `"Tên kỳ cân đo tối đa 150 ký tự"`; EXAM keeps `"Nhập tên đợt khám"`, `"Tên đợt khám tối đa 150 ký tự"`.
- [x] **Step 2: Run, expect FAIL** — `node --test tests/children/br-alignment-copy.test.mjs tests/health/campaign-dates.test.mjs`
- [x] **Step 3: Implement** the edits; `requireReason = published && (height, weight, note) differ from saved`.
- [x] **Step 4: Run, expect PASS**
- [x] **Step 5: Commit** (one per area: lengths, pickup copy, placement copy, password label, measurement reason, campaign kind copy)

### Task 2: Withdraw defaults to tomorrow (item 2, CP-20)

**Files:** `components/children/WithdrawChildModal.jsx:34`; mock `services/children/mock/childrenMockRepository.js` (leave options unchanged)
**Test:** `tests/children/withdraw-leave-options.test.mjs` (l.148)

- [x] **Step 1: Write failing tests** — default `leftAt` = `options.nextSchoolDay ?? addDays(options.today, 1)` when that date ≤ `maxDate`; summer case (`maxDate === today`) ⇒ default `today`.
- [x] **Step 2: Run, expect FAIL** — `node --test tests/children/withdraw-leave-options.test.mjs`
- [x] **Step 3: Implement** `defaultLeaveDate(options): string` in `utils/children/leaveDate.js` and use it in the modal.
- [x] **Step 4: Run, expect PASS**
- [x] **Step 5: Commit** — `G94-180: Default the withdraw date to tomorrow`

### Task 3: Placement screen shows scheduled leave (item 3, CP-19)

**Files:** `pages/children/ClassPlacementPage.jsx` (rows :298-309, date input :387-390, `placementDateError` call :185-191), `utils/children/startDate.js:68-79`
**Test:** `tests/children/placement-class-occupancy.test.mjs`

- [x] **Step 1: Write failing tests** — row label `"Nghỉ từ dd/mm/yyyy"` when `scheduledLeaveOn`; date input `max` = day before `scheduledLeaveOn` (else year end); `placementDateError(date, …, scheduledLeaveOn)` returns `"Trẻ nghỉ học từ dd/mm/yyyy. Hủy lịch nghỉ trước khi xếp lớp từ ngày này"` (BE text) for date ≥ leave.
- [x] **Step 2: Run, expect FAIL**
- [x] **Step 3: Implement**, reusing the label markup from `ChildrenListPage.jsx:403`.
- [x] **Step 4: Run, expect PASS**
- [x] **Step 5: Commit** — `G94-180: Show scheduled leave on the placement screen`

### Task 4: Health record and next-child buttons respect absence (items 5, 6, 29)

**Files:** `pages/children/ChildHealthRecordPage.jsx` (:85-120, :160-163), `pages/children/HealthExamFormPage.jsx` (`nextChildId` :362-371), `pages/children/HealthMeasurementFormPage.jsx:63`; extract `ABSENT_TODAY_HINT` to `utils/children/healthRoster.js` (used by both rosters)
**Test:** `tests/children/measurement-roster-transfer.test.mjs`, `tests/health/health-warnings-book.test.mjs`

- [x] **Step 1: Write failing tests**:
  - `nextRosterChild(rows, currentId, results): row|null` skips `absentToday`, `movedTo`, `!canEdit`; returns null when none (buttons hidden).
  - Health record page: when the child's row in the open round/exam has `absentToday`, input buttons render disabled with title `ABSENT_TODAY_HINT` (data from `useHealthCheckClass(roundId, classId)`); an in-progress exam keeps "Tiếp tục phiếu khám".
  - Header shows `record.latestExam` (`ConclusionCategoryBadge` + `FollowUpLevelBadge`) and `record.latestBmi` (`BmiStatusBadge`); "Chưa có" when null.
- [x] **Step 2: Run, expect FAIL**
- [x] **Step 3: Implement** helper and page changes.
- [x] **Step 4: Run, expect PASS**
- [x] **Step 5: Commit** (3) — next child, absent lock, header badges

### Task 5: Teacher sees watch list and BMI block (item 28, HLT-10)

**Files:** `pages/children/HealthCheckDetailPage.jsx` (:272, :321-350)
**Test:** `tests/children/health-check-accordion.test.mjs`

- [x] **Step 1: Write failing test** — teacher branch renders the BMI section for rounds and the `'watch'` tab (data already scoped by BE).
- [x] **Step 2–4:** run FAIL, implement (drop `!teacher` guard, render tabs in both branches), run PASS.
- [x] **Step 5: Commit** — `G94-180: Show watch list and BMI warnings to class teachers`

### Task 6: Read-only exam rows (item 4-FE, depends on BE Task 5)

**Files:** `components/children/HealthCheckClassRoster.jsx` (:45, :157-174), `components/children/MeasurementRoundRoster.jsx:159`, `pages/children/HealthExamFormPage.jsx` (:133, :203-207); mock health repository
**Test:** `tests/children/health-check-accordion.test.mjs` + new `tests/health/exam-read-only.test.mjs`

- [x] **Step 1: Write failing tests** — row action uses `r.canEdit` (not class `canRecord`); left/moved child with exam ⇒ only "Xem phiếu"; exam page with `canEdit=false` opens view mode without the access-error state; mock GET returns `canEdit:false, locked:true` for such child.
- [x] **Step 2–4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `G94-180: Open exams of left or moved children read-only`

### Task 7: No new record for a duplicate of a left child (item 7-FE, depends on BE Task 4)

**Files:** `pages/children/EnrollChildPage.jsx:491-530`, `services/children/mock/childrenMockRepository.js:1417-1419` (import preview) and mock enroll
**Test:** `tests/children/duplicate-child.test.mjs` (l.72, 90, 122)

- [x] **Step 1: Update tests** — no "Vẫn tạo hồ sơ mới"; LEFT duplicate shows only "Mở lại hồ sơ cũ"; mock enroll of LEFT duplicate ⇒ 409 `CHILD_DUPLICATE_LEFT` message (BE text); mock import preview puts it in `errors`.
- [x] **Step 2–4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `G94-180: Only reopen the old record for a withdrawn duplicate`

### Task 8: Next-year intake start date optional (item 16, CP-24)

**Files:** `components/children/IntakeStartFields.jsx:32`, `utils/children/startDate.js:49`, callers `EnrollChildPage.jsx:329`, `components/children/ImportChildrenModal.jsx:17,100`
**Test:** `tests/children/intake-start-date.test.mjs`

- [x] **Step 1: Write failing tests** — `startDateError('', plannedYear, …)` ⇒ `''`; field not `required` and hint `"Để trống = ngày học đầu tiên của năm học"` for a PLANNED year; current year still `"Chọn ngày bắt đầu đi học"`; payload omits `startDate` when blank.
- [x] **Step 2–4:** FAIL → implement → PASS
- [x] **Step 5: Commit** — `G94-180: Allow a blank start date for next-year intake`

### Task 9: Import result links to new-year placement (item 18, CP-25)

**Files:** `pages/children/ImportChildrenPage.jsx:68`
**Test:** `tests/children/new-year-intake.test.mjs`

- [x] Steps 1–5: test that a draft with a planned `schoolYearId` links `"/school/placement"` labelled `"Xếp lớp năm học mới"`, else `"/children/placement"`; FAIL → implement → PASS → commit `G94-180: Link next-year imports to new-year placement`.

### Task 10: Pickup by phone: time input and full-day warning (items 23, 24, PCK-02)

**Files:** `components/pickup/PickupVerifyFlow.jsx` (:22, :125-132, :203, :295), `utils/pickup/pickupValidation.js:30`, `pages/pickup/PickupListPage.jsx:32`
**Test:** `tests/hardening/pickup-call-note.test.mjs` + new `tests/pickup/pickup-time.test.mjs`

- [x] **Step 1: Write failing tests** —
  - phone hand-over shows the same `type="time"` input as photo match, default now;
  - `pickupTimeError(time, now)` ⇒ `"Giờ trả trẻ không được sau giờ hiện tại."` when later than now;
  - when `handoverTime < fullDayPickupFrom` (from `useCutoffSetting(schoolYear).setting.fullDayPickupFrom || '15:00'`), both flows show `"Trả trước {HH:mm}: trẻ được tính vắng buổi chiều (nửa ngày)."` above the confirm button.
- [x] **Step 2–4:** FAIL → implement → PASS
- [x] **Step 5: Commit** (2) — time input + validation; full-day warning

### Task 11: Resend activation code; result wording (item 9-FE, depends on BE Task 7)

**Files:** `services/account/api/guardianApi.js`, `services/account/guardianService.js`, guardian mock repository, `components/account/GuardianPanel.jsx`, `pages/children/ParentActivationPage.jsx`, `pages/children/EnrollChildPage.jsx:403-408`
**Test:** `tests/auth/guardian-api.test.mjs`, `tests/children/guardian-activation.test.mjs`

**Interfaces:**
- Produces: `guardianApi.resendActivationCode(userId)` → `POST /parent-accounts/{userId}/activation-code` → `{userId, username, smsStatus, expiresAt, activationCode}`; facade `resendActivationCode(userId, user)`.

- [x] **Step 1: Write failing tests** — API calls the path; menu item `"Gửi lại mã kích hoạt"` appears only for accounts shown as "Chờ kích hoạt" (reuse that label's condition); result with `activationCode` opens a print box (`"Mã kích hoạt: {mã} · hết hạn {dd/mm/yyyy HH:mm}"`, button "In phiếu", no password); null code ⇒ toast `"Đã gửi lại mã kích hoạt qua SMS tới {số}."`; intake result uses `credential`: `ACTIVATION_CODE` ⇒ `"Đã tạo tài khoản phụ huynh, mã kích hoạt gửi qua SMS tới {số}."`, button `"Gửi lại mã kích hoạt"`; else current password wording.
- [x] **Step 2–4:** FAIL → implement (+ mock) → PASS
- [x] **Step 5: Commit** (2) — resend action; result wording

### Task 12: Guardian phone change requests (item 14, CP-18)

**Files:** new `services/account/api/phoneChangeApi.js` (+ facade in `guardianService.js`, mock), `components/children/ChildInfoFields.jsx:288-294` (button next to read-only phone), new `components/children/PhoneChangeModal.jsx`, `pages/children/ParentActivationPage.jsx` (new section)
**Test:** new `tests/children/phone-change.test.mjs`

**Interfaces:**
- Produces: `requestPhoneChange(childId, guardianId, {newPhone, reason})` → `POST /children/{childId}/guardians/{guardianId}/phone-change-requests`; `listPhoneChangeRequests(status)` → `GET /parent-accounts/phone-change-requests?status=`; `approvePhoneChange(id)` → `POST …/{id}/approve`; `rejectPhoneChange(id, note)` → `POST …/{id}/reject` `{note}`.

- [x] **Step 1: Write failing tests** — API paths; Edit page shows `"Đổi số"` beside a saved phone; modal validates phone (10 digits starting 0 — reuse existing phone validator) and reason (required, ≤ 300); success toast `"Đã gửi yêu cầu đổi số điện thoại. Hồ sơ giữ số cũ tới khi được duyệt."`; Tài khoản phụ huynh page section `"Yêu cầu đổi số điện thoại"` lists PENDING rows (trẻ, phụ huynh, số cũ → số mới, lý do, người gửi) with "Duyệt"/"Từ chối" only when `canDecide`; reject note required.
- [x] **Step 2–4:** FAIL → implement (+ mock) → PASS
- [x] **Step 5: Commit** (3) — API+mock; request from edit; review section

### Task 13: Change photos on Edit; "Thiếu ảnh" label (item 1-FE, depends on BE Task 6)

**Files:** `services/children/api/childrenApi.js` (+ facade, mock), `pages/children/EditChildPage.jsx:185`, `components/children/ChildInfoFields.jsx` (`photosEnabled` :64, pickers :79-99, :242-266), `pages/children/ChildrenListPage.jsx:367-371`
**Test:** `tests/children/enrollment-photos.test.mjs` + new `tests/children/photo-replace.test.mjs`

**Interfaces:**
- Produces: `replaceChildPhoto(childId, file, reason)` → `PUT /children/{childId}/photo` (multipart `photo`, `reason`); `replaceGuardianPhoto(childId, guardianId, file, reason)` → `PUT /children/{childId}/guardian-photos/{guardianId}`.

- [x] **Step 1: Write failing tests** — Edit page renders photo pickers with button `"Đổi ảnh"` for leaders only; chosen photos upload on "Lưu thay đổi" with the edit reason, after the profile save; `portraitFileError` reused; failure keeps the old picture and shows the BE field error; list shows chip `"Thiếu ảnh"` when `photoMissing`.
- [x] **Step 2–4:** FAIL → implement (+ mock) → PASS
- [x] **Step 5: Commit** (2) — photo change; missing-photo chip

### Task 14: Contract sync, full suite, docs

- [x] `npm run api-index -- --from ../be-school-year-scope`; `check-api-contract --sync --from ../be-school-year-scope`; commit `G94-180: Sync BE API contract for BR alignment`.
- [x] `npm test` (PowerShell) — all pass.
- [x] Update FE docs for intake/health/pickup UI; plan `status: done`, move to `docs/plans/completed/`; commit.
- [x] Controller (not subagent): re-shoot screens 5.1.1, 5.1.2, 5.2.2, 5.2.4, 5.3.1, 6.1.3, 6.1.5, 6.2.1, 6.3.2 and regenerate `FR-III-5-6-ho-so-tre-suc-khoe-don-tre-2026-11-24.docx`; mark items done in `report/sua_sau/CODE-can-sua-theo-BR-2026-11-26.md`.

## Completion log — 27/11/2026

- Tasks 1–13 implemented and locally committed. Independent spec and quality reviews completed, with fixes for roster loading/error gating, archived mock exams, teacher phone requests and the IntakeField rendering regression.
- Full PowerShell `npm test` passed 2,007 tests across 11 groups, with zero failures and zero skips. `npm run lint` and `npm run build` passed. Build retains existing Vite/rolldown/lottie warnings.
- OpenAPI was regenerated in `../be-school-year-scope`. Actual sync commands were `node scripts/ai-layer/api-index.mjs --from ../be-school-year-scope`, `node scripts/check-api-contract.mjs --sync ../be-school-year-scope/docs/api/openapi.yaml`, and `node scripts/check-api-contract.mjs --consumers`. The contract check passed with zero errors and ten existing warnings about sibling snapshots and pending APIs.
- Nine requested screens were captured through the browser using mock data. Other module education/assessment demo collections were cleared in that isolated browser session to fit localStorage. Screenshots and manifest are in `../.playwright-mcp/br-alignment-2026-11-27/`.
- Updated the nine matching screenshots in both the root FR dated 24/11 and `../report/FR-III-5-6-ho-so-tre-suc-khoe-don-tre-2026-11-26.docx`. All document prose was preserved and ZIP/XML contents validated.
- BE/App work and final BE verification are tracked separately in the corresponding backend plan. Local commits only.