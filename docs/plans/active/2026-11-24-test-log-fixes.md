---
title: Sửa các lỗi user ghi ở tab Test (23/11) — phần FE
status: in-progress  # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: G94-180 / FE-FIX-14   # mỗi phần commit phải có mã task Jira — hỏi user trước khi commit
branch: fix/G94-180-FE-FIX-14-school-year-scope
modules: [children, health-check, pickup]
rules: [G94-180/CHD-03, G94-180/CHD-04, G94-180/CHD-06, G94-180/CHD-10, G94-180/CHD-14, HLT-01, HLT-08, HLT-09]
risk: high
created: 2026-11-24
updated: 2026-11-24
---
# Sửa các lỗi user ghi ở tab Test (23/11) — phần FE

> **Cho agent thực thi:** làm theo `superpowers:executing-plans` (hoặc `superpowers:subagent-driven-development`), từng task một, bước có ô `- [ ]`.
> **Plan chính (nguyên nhân, câu hỏi Q1–Q5, AC):** `BE:docs/plans/active/2026-11-24-test-log-fixes.md` (worktree `D:\project_capstone\project\web\be-school-year-scope`). Plan này chỉ phần client.

**Mục tiêu:** sửa phần màn hình của 16 lỗi tab Test: mục 1, 2, 3, 4 (file test), 5, 8, 9, 10, 11, 12, 13, 14, 15, 16.

**Cách làm:** mỗi task một màn hoặc một component, test `node:test` trước (hàm thuần hoặc đọc mã nguồn như `tests/children/refresh-after-write.test.mjs`), rồi sửa. Trường BE mới đọc qua `services/<module>/api` và BE giả `mock/` (BE giả theo cùng luật, ghi rule ID).

**Stack:** React 18 + Vite, JavaScript/JSX, `node:test`. Chạy test bằng **PowerShell** (memory `fe-tests-powershell-only`: Git Bash ổ `d:` thường nạp React hai lần ⇒ lỗi giả).

## Context

Nguyên nhân từng mục: bảng Context ở plan BE. Phần FE:

| # | Màn | Việc FE | File chính |
| --- | --- | --- | --- |
| 1 | Khai báo sức khỏe, phiếu khám bước 1 | Tiền sử bản thân/gia đình: ô nhập + "Thêm" + chip như dị ứng | `src/components/children/HealthDeclarationFields.jsx:51-149`, `src/components/children/exam/ExamAdminStep.jsx:150-160` |
| 2 | Mọi ô ngày dd/mm/yyyy | Gõ "5/9/2027" tự thành "05/09/2027"; chuỗi chưa phải ngày ⇒ câu "theo dạng dd/mm/yyyy", không ra lỗi khoảng năm học sai | `src/components/form/DateInput.jsx` (**dùng chung, file của Cần**), `src/utils/format.js`, `src/utils/children/startDate.js:36-67` |
| 3 | `/children/placement` khi header 2027-2028 | Không hiện bảng năm đang học (Q4) | `src/pages/children/ClassPlacementPage.jsx:119-126,193-198` |
| 4 | Nhập Excel (B6) | Làm lại file test có số 0 đầu; BE bù số 0 (plan BE B3) | `D:\project_capstone\project\web\TEST-nhap-tre-2027-2028.csv` (ngoài repo) |
| 5 | Hộp "Mở lại hồ sơ cũ?" | Bỏ "Giữ điểm trường cũ"; mặc định điểm trường của trẻ (`duplicate.campusId`); danh sách điểm trường theo năm tiếp nhận lại | `src/pages/children/EnrollChildPage.jsx:97,165,227-261,740-749` |
| 8 | Ô ngày ở Tiếp nhận, Xếp lớp, Mở lại hồ sơ, Nhập Excel | Câu lỗi nêu thứ 7/chủ nhật hoặc tên ngày nghỉ, cùng câu BE | `src/utils/children/startDate.js:48,65` |
| 9 | Hộp "Cho … nghỉ học?" | 2 lựa chọn: hôm nay / ngày học kế tiếp; hôm nay khóa khi BE báo trẻ có dữ liệu trong ngày | `src/components/children/WithdrawChildModal.jsx` |
| 10, 16 | Thẻ lớp ở Xếp lớp, Tiếp nhận bước 2 | Hiện "+n trẻ sắp vào", lớp đã đủ thì khóa thẻ, nhãn "Đã đủ" | `src/components/children/ClassPlacementFields.jsx:120-150`, `src/hooks/children/useChildRecords.js:68-74`, `src/services/children/api/childrenApi.js:216-222` |
| 11, 13 | Kỳ cân đo (GV) | Dòng trẻ đã chuyển lớp: chỉ xem; dòng số đo đo ở lớp khác: ghi chú + sửa được; trẻ vắng hôm nay: khóa "Nhập số đo" | `src/components/children/MeasurementRoundRoster.jsx:38-160`, `src/services/children/api/healthCheckApi.js` |
| 12 | Kỳ cân đo, đợt khám (GV nhiều lớp) | Mỗi lớp một khối thu gọn được (accordion) | `src/pages/children/HealthCheckDetailPage.jsx:315-327` |
| 14 | Phiếu khám | Lỗi không gắn ô (vd `date`) hiện thành khung báo trên phiếu; chuyển bước không tự lưu lại khi lỗi chưa sửa | `src/pages/children/HealthExamFormPage.jsx:297-332` |
| 15 | `/pickup` | Trả trẻ xong tải lại bảng (BE thật không phát sự kiện đổi dữ liệu) | `src/pages/pickup/PickupListPage.jsx:39,54-60,282-285` |

## Global constraints

- Dùng component chung `@/components` theo `docs/design/UI_CARD.md`; màu, khoảng cách qua `var(--token)`; icon qua `@/components/ui/icons`.
- Không tính nghiệp vụ ở UI: sĩ số, quyền sửa số đo, ngày nghỉ học hợp lệ, trẻ vắng đều lấy cờ/số BE trả. `canXxx` chỉ ẩn/hiện.
- BE giả (`src/services/<module>/mock/`) theo cùng luật mới, mỗi luật ghi rule ID BE.
- File dùng chung (`src/components/form/**`, `src/utils/*.js`) và file của Cần là **điểm dừng cứng**: chỉ sửa khi user đã duyệt bản tác động (mục "Bản tác động" dưới đây, Q5(d)).
- Không commit/push khi user chưa cho phép trong tin nhắn hiện tại. Được phép thì commit nhỏ, mỗi task 1 commit, dòng đầu `G94-xxx: <Verb> …` (mã Jira hỏi user).
- Iron Law: `node scripts/verify.mjs` sau lần sửa cuối. Sửa `docs/` ⇒ thêm `node scripts/check-ai-layer.mjs`.
- WIP 2A chưa commit đang sửa `ClassPlacementFields.jsx`, `ClassPlacementPage.jsx`, `EnrollChildPage.jsx`. Nên commit 2A trước (cần user cho phép + mã Jira) để tách diff.

## Quyết định đã chốt

Như plan BE. Thêm 1A (22/11): ô ngày sinh và ngày tiếp xúc lao nhập dd/mm/yyyy bằng `DateInput`; chuỗi sai ⇒ "Nhập … theo dạng dd/mm/yyyy" (`tests/children/dob-date-input.test.mjs`).

## Làm rõ nghiệp vụ

Câu hỏi mở Q1–Q5 và bảng trả lời ở plan BE. Plan này phụ thuộc:
- F2.4 ← Q1.
- F4.1 ← Q2, Q5(c).
- F4.3 ← Q3.
- F2.5 ← Q4.
- F2.1 ← Q5(a).
- F4.2 ← Q5(b).
- F1 ← Q5(d).

### Câu hỏi mở
- [x] Q1–Q5: trả lời ở `BE:docs/plans/active/2026-11-24-test-log-fixes.md` › Câu hỏi mở. User duyệt toàn bộ phương án khuyến nghị ngày 2026-11-24: Q1–Q4 = A; Q5 theo mặc định, gồm sửa `DateInput` chung (đã duyệt bản tác động F1).

### Bản tác động (điểm dừng cứng — F1)

1. **Thay đổi gì:**
   - `DateInput` nhận ngày, tháng 1 chữ số ("5/9/2027"), tự đệm số 0 khi đủ năm 4 chữ số và khi rời ô.
   - `format.js` thêm hàm thuần `padDisplayDate(text)`, không đổi hàm cũ.
2. **Ảnh hưởng:**
   - `DateInput`: 30 file dùng trực tiếp, lan 113 màn, 17 nhóm (`node scripts/ai-layer/impact.mjs src/components/form/DateInput.jsx`, chạy 24/11).
   - `format.js`: 250 file, 159 màn. Chỉ thêm export nên không đổi hành vi chỗ khác.
3. **Luồng người dùng:** gõ "5/9/2027" trước đây giữ nguyên và báo lỗi khó hiểu; nay thành "05/09/2027" và hợp lệ. Gõ dở ("5/9/20") vẫn báo dạng dd/mm/yyyy như cũ.
4. **Của ai:** `DateInput.jsx` do Cần viết (17b9207d, 6b10e780); `format.js` dùng chung.
5. **Phương án:**
   - **A** sửa `DateInput` + thêm `padDisplayDate` (khuyến nghị: mọi ô ngày đều được, 1 chỗ sửa).
   - **B** không đụng file chung: các trang của mình tự đổi chuỗi sang ISO trong `onChange` (3 trang, ô vẫn đệm vì `DateInput` hiển thị lại theo `value`).
6. **Cách kiểm:** test hàm `padDisplayDate`, test đọc mã nguồn `DateInput` có `onBlur`. Chạy `node scripts/verify.mjs`. Thử tay ô "Ngày bắt đầu đi học" gõ `5/9/2027`.

## Acceptance criteria (phần FE)

- **AC-F1** (mục 2):
  - Ô ngày gõ "5/9/2027" ⇒ hiện "05/09/2027", `onChange` nhận "2027-09-05".
  - Gõ "5/9/20" ⇒ giữ nguyên, ô báo "Nhập ngày bắt đầu đi học theo dạng dd/mm/yyyy".
- **AC-F2** (mục 1, Q5(a)):
  - Tiền sử bản thân/gia đình "Có" ⇒ ô nhập + nút "Thêm" + chip, bỏ được từng chip.
  - Lưu thành chữ nối "; ". Đọc lại tách đúng.
  - Dữ liệu cũ (có dấu phẩy) giữ là 1 chip.
- **AC-F3** (mục 5):
  - Hộp mở lại hồ sơ không còn "Giữ điểm trường cũ".
  - Ô Điểm trường mặc định điểm trường của trẻ nếu điểm trường đó có trong năm đã chọn; không có thì trống và bắt chọn.
  - Gửi `campusId` luôn có.
- **AC-F4** (mục 8): Ô ngày chọn 09/12/2026 (ngày nghỉ "Nghỉ thử") ⇒ "Ngày vào lớp 09/12/2026 trùng ngày nghỉ của trường: Nghỉ thử (09/12/2026). Chọn ngày học khác." Thứ 7 ⇒ "… là thứ Bảy. Chọn ngày từ thứ 2 tới thứ 6."
- **AC-F5** (mục 9, Q1=A):
  - Hộp "Cho nghỉ học" có 2 lựa chọn, không có ô lịch.
  - Trẻ có điểm danh hôm nay ⇒ "Hôm nay" khóa, kèm câu BE trả; mặc định ngày học kế tiếp.
  - Toast "… nghỉ học từ dd/mm/yyyy".
- **AC-F6** (mục 3, Q4=A): Header năm sắp diễn ra ⇒ `/children/placement` không có bảng. Có khung báo + nút "Mở Xếp lớp năm học mới" (`/school/placement`) + nút "Về năm học 2026-2027".
- **AC-F7** (mục 10, 16):
  - Thẻ lớp hiện "Sĩ số: 24/25 · +1 trẻ sắp vào".
  - `occupiedCount ≥ capacity` ⇒ thẻ khóa, nhãn "Đã đủ", không chọn được.
  - Đổi ngày vào lớp ⇒ số tải lại theo ngày mới.
- **AC-F8** (mục 11, Q2=A):
  - Dòng `movedTo` ⇒ nhãn "Đã chuyển sang Lớp Mầm 1 (Cơ sở 1) từ 23/11/2026", không có nút sửa.
  - Dòng `measuredIn` khác lớp này ⇒ dòng phụ "Đo ở Lớp Mầm 2 (Cơ sở 2) ngày 19/11/2026", nút "Sửa số đo" theo `canEdit`.
- **AC-F9** (mục 13): Dòng `absentToday` ⇒ chip "Vắng hôm nay", nút "Nhập số đo" khóa, title "Trẻ vắng hôm nay (điểm danh). Nhập khi trẻ có mặt."
- **AC-F10** (mục 12, Q5(b)):
  - GV có ≥2 lớp ⇒ mỗi lớp một khối thu gọn, tiêu đề "Lớp X – đã cân đo a/b trẻ" (số từ `classes` BE trả), lớp đầu mở sẵn.
  - 1 lớp ⇒ như cũ.
- **AC-F11** (mục 14):
  - Lưu nháp lỗi có lỗi ô không hiện trên bước (vd `date`) ⇒ khung đỏ đầu phiếu ghi đúng câu BE.
  - Chuyển bước vẫn đi được nhưng không gọi lưu lại khi lỗi đó còn và dữ liệu chưa đổi.
  - Q3=A: lưu được như BE.
- **AC-F12** (mục 15): Trả trẻ (ảnh hoặc gọi phụ huynh) xong ⇒ bảng đón trả tải lại; trẻ sang "Đã đón" không cần F5.

## Phases

Thứ tự: F5 (nhỏ, độc lập) → F2 → F3 → F4 → F1 (chờ duyệt bản tác động) → F6. Mỗi phase: làm → verify → Progress log → **dừng chờ review**.

### Phase F5 — Đón trẻ tải lại sau khi trả (mục 15)

**Files:** M `src/pages/pickup/PickupListPage.jsx:54-60,282-285` · Test M `tests/children/refresh-after-write.test.mjs` (thêm test; hoặc tạo `tests/pickup/refresh-after-pickup.test.mjs` cùng kiểu)

- [x] **Bước 1: Viết test hỏng.** `'mục 15: trả trẻ xong tải lại bảng đón trả'`: đọc `PickupListPage.jsx`, `assert.match` có hàm `const handedOver = () =>` gọi `closeModals()` và `reload({ silent: true })`. Cả `PickupPhotoFlow` và `PickupCallFlow` nhận `onDone={handedOver}`.
- [x] **Bước 2:** `node --test tests/...` (PowerShell) ⇒ FAIL.
- [x] **Bước 3:** thêm `handedOver`, thay `onDone={closeModals}` ở 2 flow; `onClose` của Modal giữ `closeModals`.
- [x] **Bước 4:** chạy ⇒ PASS. **Exit:** `node scripts/verify.mjs` ⇒ PASS. Dừng chờ review.

### Phase F2 — Màn hồ sơ trẻ (mục 1, 3, 5, 8, 9)

#### Task F2.1: Tiền sử thêm từng mục như dị ứng (mục 1, Q5(a))

**Files:**
- C `src/components/children/ChipListInput.jsx`: tách từ khối dị ứng `HealthDeclarationFields.jsx:60-100`, props `{ id, label, items, onChange, placeholder, maxItemLength, error }`.
- M `HealthDeclarationFields.jsx`: dị ứng dùng `ChipListInput`; `historyDetail` dùng `ChipListInput` cho `withText`.
- M `src/components/children/exam/ExamAdminStep.jsx:150-160`.
- M `src/models/children/childProfile.js`: thêm `splitHistoryText`, `joinHistoryText`.
- Test C `tests/children/medical-history-items.test.mjs`.

**Interfaces:**
- `splitHistoryText(text: string): string[]` (tách theo `;`, trim, bỏ rỗng).
- `joinHistoryText(items: string[]): string` (nối `'; '`).
- Tổng ≤300 ký tự (giới hạn BE) ⇒ nút "Thêm" khóa và hiện "Tối đa 300 ký tự cho cả mục".

- [x] **Bước 1: Viết test hỏng:**
  - `splitHistoryText('Hen phế quản; Viêm da')` ⇒ `['Hen phế quản','Viêm da']`.
  - `splitHistoryText('')` ⇒ `[]`.
  - `splitHistoryText('hen, viêm')` ⇒ `['hen, viêm']`.
  - `joinHistoryText(['A','B'])` ⇒ `'A; B'`.
  - Đọc mã nguồn: `HealthDeclarationFields.jsx` và `ExamAdminStep.jsx` có `<ChipListInput`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** viết helper, component, thay 3 chỗ. Giữ `aria-label`, lỗi ô `medicalHistory.self` / `exam.history.selfText` như cũ. Chạy lại `tests/children/health-declaration-sheet.test.mjs`, `exam-admin-from-profile.test.mjs`.
- [x] **Bước 4:** chạy ⇒ PASS.

#### Task F2.2: Mở lại hồ sơ dùng điểm trường của trẻ (mục 5)

**Files:**
- M `src/pages/children/EnrollChildPage.jsx:123,165,227-261,740-749`.
- C helper `defaultReadmitCampus` trong `src/utils/children/readmit.js`.
- M mock `src/services/children/mock/childrenMockRepository.js` (`checkDuplicate` trả `campusId`).
- Test C `tests/children/readmit-campus.test.mjs`.

**Interfaces:**
- Dùng `duplicate.campusId` (plan BE B1.2).
- `defaultReadmitCampus(duplicate, campuses): string` ⇒ `duplicate.campusId` nếu có trong `campuses`, ngược lại `''`.

- [x] **Bước 1: Viết test hỏng:**
  - `defaultReadmitCampus({campusId:'2'}, [{id:'1'},{id:'2'}])` = `'2'`; campus không có trong năm ⇒ `''`.
  - Mã nguồn `EnrollChildPage.jsx` không còn `'Giữ điểm trường cũ'`.
  - Mock `checkDuplicate` trẻ đã nghỉ có `campusId`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3: Sửa trang:**
  - `const readmitMd = useMasterData(readmitYear?.id ?? null)`, options = `childCampusesOf(user, readmitMd.campuses)`.
  - Mở hộp và khi đổi năm ⇒ `setReadmitCampusId(defaultReadmitCampus(duplicate, options))`.
  - Bỏ option rỗng. Thiếu ⇒ lỗi "Chọn điểm trường".
  - Luôn gửi `campusId`.
- [x] **Bước 4:** chạy ⇒ PASS (kèm `tests/children/duplicate-child.test.mjs`, `intake-campus-in-year.test.mjs`).

#### Task F2.3: Câu lỗi ngày học nêu lý do (mục 8) + chuỗi chưa phải ngày (mục 2 phần validator)

**Files:** M `src/utils/children/startDate.js` · Test M `tests/children/intake-start-date.test.mjs`

**Interfaces:**
- `schoolDayProblem(label: string, iso: string, holidays): string` trả `''` khi là ngày học; câu giống BE `SchoolDayMessages` (plan BE B1.4).
- `startDateError` và `placementDateError` gọi hàm này.
- Thêm kiểm `!isIsoDate(value)` ⇒ `Nhập ${label.toLowerCase()} theo dạng dd/mm/yyyy`.

- [x] **Bước 1: Viết test hỏng:**
  - `placementDateError('2026-12-09', {earliest:'2026-11-23', today:'2026-11-23', holidays:[{startDate:'2026-12-09', endDate:'2026-12-09', name:'Nghỉ thử'}]})` = `'Ngày vào lớp 09/12/2026 trùng ngày nghỉ của trường: Nghỉ thử (09/12/2026). Chọn ngày học khác.'`
  - `'2026-11-28'` ⇒ `'Ngày vào lớp 28/11/2026 là thứ Bảy. Chọn ngày từ thứ 2 tới thứ 6.'`
  - `startDateError('5/09/2027', plannedYear, today)` ⇒ `'Nhập ngày bắt đầu đi học theo dạng dd/mm/yyyy'`.
  - Sửa kỳ vọng câu cũ trong file test.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** sửa `startDate.js`; xóa `SCHOOL_DAY_HINT` nếu không còn chỗ dùng (grep trước).
- [x] **Bước 4:** chạy ⇒ PASS.

#### Task F2.4: Hộp cho nghỉ học: hôm nay / ngày học kế tiếp (mục 9, Q1=A)

**Files:**
- M `src/components/children/WithdrawChildModal.jsx`.
- M `src/services/children/api/childrenApi.js` (+ `getLeaveOptions: (id) => read(axiosClient.get(\`/children/${id}/leave-options\`))`).
- M facade `src/services/children/childrenService.js`.
- M mock `childrenMockRepository.js` (luật G94-180/CHD-03 mới).
- C hook `useLeaveOptions(childId)` trong `src/hooks/children/useChildRecords.js`.
- Test C `tests/children/withdraw-leave-options.test.mjs`.

**Interfaces:**
- Dùng `GET /children/{id}/leave-options` ⇒ `{ today, todayAllowed, todayBlockedReason, nextSchoolDay }` (plan BE B1.5).
- Hai lựa chọn: `Hôm nay (dd/mm/yyyy)` và `Ngày học kế tiếp – <thứ> dd/mm/yyyy` (dùng `formatDate` và tên thứ có sẵn ở `utils/format.js`).
- Nhóm radio: dùng component chọn có sẵn của module trẻ (`IntakeChoiceField` nếu hiển thị được ngoài bảng; không thì tạo `src/components/children/ChoiceGroup.jsx`). Không dùng `<input type="date">`.

- [x] **Bước 1: Viết test hỏng:**
  - Mock: trẻ có điểm danh hôm nay ⇒ `getLeaveOptions` trả `todayAllowed: false`, `nextSchoolDay` đúng ngày học kế tiếp (qua thứ 7, chủ nhật).
  - Mock `withdrawChild` ngày đã qua ⇒ lỗi `leftAt` "Ngày nghỉ học không được trước hôm nay".
  - Mã nguồn modal không còn `type="date"`, có `useLeaveOptions(`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3: Sửa modal:**
  - Mặc định `todayAllowed ? today : nextSchoolDay`.
  - Lựa chọn "Hôm nay" `disabled` + câu `todayBlockedReason` dưới nhóm.
  - Đang tải ⇒ `LoadingState`; lỗi ⇒ `ErrorState`.
  - Toast `${fullName} nghỉ học từ ${formatDate(leftAt)}.`
- [x] **Bước 4:** chạy ⇒ PASS.

#### Task F2.5: Xếp lớp khi header là năm sắp diễn ra (mục 3, Q4=A)

**Files:** M `src/pages/children/ClassPlacementPage.jsx:118-126` · M `src/components/children/ActiveYearNotice.jsx` (nếu cần thêm nút) · Test M `tests/children/year-locked-pages.test.mjs` (hoặc C `tests/children/placement-next-year.test.mjs`)

- [x] **Bước 1: Viết test hỏng.** Đọc mã nguồn:
  - Khi `schoolYear !== activeYear.id` và năm chọn không phải `CLOSED` ⇒ trang trả khối có `Link to="/school/placement"` và nút `setSchoolYear(activeYear.id)`, không render `<Tabs`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** thêm nhánh `return` giống khối `yearReadOnly || yearLocked`, dùng `EmptyState` với:
  - `title="Xếp lớp năm học 2027-2028 làm ở màn Xếp lớp năm học mới"`
  - `description="Trang này xếp, chuyển lớp trong năm học đang hoạt động 2026-2027."`
  - 2 nút qua `action`.
- [x] **Bước 4:** chạy ⇒ PASS.

- [x] **Exit F2:** `node scripts/verify.mjs` ⇒ PASS. Dừng chờ review.

### Phase F3 — Thẻ lớp tính trẻ hẹn vào (mục 10, 16)

#### Task F3.1

**Files:**
- M `src/services/children/api/childrenApi.js:216-222` (`getPlacementClasses` gửi `from`, `childId`, đọc `occupiedCount`).
- M mock `childrenMockRepository.js:1191` (`occupiedCount` như BE).
- M `src/hooks/children/useChildRecords.js:68-74` (`usePlacementClasses(schoolYearId, { from, childId })`, deps thêm `from`, `childId`).
- M `src/components/children/ClassPlacementFields.jsx:120-150`.
- M `ClassPlacementPage.jsx:54` (truyền `effectiveDate`, `selected?.id`).
- M `EnrollChildPage.jsx` (truyền `startDate`).
- Test C `tests/children/placement-class-occupancy.test.mjs`.

**Interfaces:**
- Dùng `occupiedCount` (plan BE B2).
- `classFullness(c) → { arriving: number, full: boolean }` trong `src/utils/children/placementClasses.js` (thuần, chỉ so số BE trả: `arriving = max(0, occupiedCount - enrolledCount)`, `full = capacity != null && occupiedCount >= capacity`).

- [x] **Bước 1: Viết test hỏng:**
  - `classFullness({capacity:25, enrolledCount:24, occupiedCount:25})` ⇒ `{arriving:1, full:true}`.
  - `{capacity:null, …}` ⇒ `full:false`.
  - Mã nguồn `ClassPlacementFields.jsx` có `Đã đủ` và `+${arriving} trẻ sắp vào`; thẻ full có `disabled`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** sửa theo Files. Thẻ full: radio `disabled`, nhãn `StatusBadge` tông đỏ "Đã đủ". Lớp đang chọn mà thành full sau khi đổi ngày ⇒ bỏ chọn, ô Lớp báo "Lớp X đã đủ từ dd/mm/yyyy. Chọn lớp khác."
- [x] **Bước 4:** chạy ⇒ PASS (kèm `refresh-after-write.test.mjs`: regex `usePlacementClasses\(\)` đổi theo chữ ký mới).
- [x] **Exit F3:** verify ⇒ PASS. Dừng chờ review.

### Phase F4 — Kỳ cân đo, phiếu khám (mục 11, 12, 13, 14)

#### Task F4.1: Dòng trẻ chuyển lớp, đo ở lớp khác, vắng hôm nay (mục 11, 13)

**Files:** M `src/services/children/api/healthCheckApi.js` (map `canEdit`, `movedTo`, `measuredIn`, `absentToday`) · M mock `healthCheckMockRepository.js` + `healthCheckRule.js` (luật HLT-09/HLT-01 mới) · M `src/components/children/MeasurementRoundRoster.jsx:44-160` · Test C `tests/children/measurement-roster-transfer.test.mjs`

- [x] **Bước 1: Viết test hỏng (mock):**
  - Trẻ đo ở lớp A rồi chuyển B ⇒ roster B có `canEdit: true`, `measuredIn.className = 'A'`.
  - Roster A có `movedTo`, không tính vào số đã cân đo.
  - Trẻ điểm danh vắng hôm nay ⇒ `absentToday: true`.
  - Mã nguồn roster: nút sửa theo `r.canEdit`, nút nhập khóa khi `r.absentToday`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** sửa map + mock + roster:
  - Dòng `movedTo` ⇒ chip xám "Đã chuyển sang …", không có hành động.
  - Dòng `measuredIn` khác lớp ⇒ dòng phụ chữ nhỏ.
  - `absentToday` ⇒ chip "Vắng hôm nay", nút "Nhập số đo" `disabled` + `title`.
  - Đếm "đã cân đo" (`MeasurementRoundRoster.jsx:46`) bỏ dòng `movedTo`.
- [x] **Bước 4:** chạy ⇒ PASS.

#### Task F4.2: Accordion khi GV có từ 2 lớp (mục 12, Q5(b))

**Files:** M `src/pages/children/HealthCheckDetailPage.jsx:315-327` · M `MeasurementRoundRoster.jsx`, `HealthCheckClassRoster.jsx` (prop `collapsible`, `defaultOpen`, `summary`) · CSS trong `src/styles/modules/` của module trẻ (tiền tố `tr-`) · Test M `tests/children/refresh-after-write.test.mjs` (test `<Roster key=…>` vẫn đúng) + C `tests/children/health-check-accordion.test.mjs`

- [x] **Bước 1: Viết test hỏng.** Đọc mã nguồn trang:
  - `classes.length > 1` ⇒ `<Roster … collapsible defaultOpen={i === 0}`.
  - Component roster có `<details` và `<summary`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** dùng `<details className="card tr-roster-fold">` + `<summary>` hiện tên lớp và tiến độ (số từ `classes` BE trả: `recorded`/`total`). Khối đóng không tải roster tới khi mở (`open` state ⇒ `enabled` của `useAsync`). Giữ focus bàn phím (summary là phần tử tương tác).
- [x] **Bước 4:** chạy ⇒ PASS.

#### Task F4.3: Phiếu khám báo đúng lỗi, không lưu lặp (mục 14)

**Files:** M `src/pages/children/HealthExamFormPage.jsx:297-332` · Test C `tests/children/exam-draft-errors.test.mjs`

- [x] **Bước 1: Viết test hỏng.** Đọc mã nguồn:
  - `saveDraft` lỗi ⇒ `setErrors(err.details …)` và `setFormError(...)`.
  - Có khối `alert alert--danger` hiện lỗi không thuộc ô của bước (`date`, `_form`).
  - `goTo` không gọi `saveDraft` khi `lastFailed && !dirtySinceFail`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3: Sửa:**
  - Lỗi lưu nháp có `details` ⇒ gộp vào `errors` (ô hiện lỗi tại chỗ); lỗi khóa không có ô trên bước ⇒ khung đỏ đầu phiếu.
  - Toast dùng câu BE (`toast.error(err, 'Chưa lưu được nháp')` giữ).
  - Đổi dữ liệu thì cho lưu lại.
  - Q3=B: khi view có `dateTakenBy` ⇒ khung báo + khóa nhập ngay khi mở.
- [x] **Bước 4:** chạy ⇒ PASS.

- [x] **Exit F4:** verify ⇒ PASS. Dừng chờ review.

### Phase F1 — Ô ngày tự đệm số 0 (mục 2) — chờ duyệt bản tác động (Q5(d))

**Files (A):** M `src/utils/format.js` (thêm `padDisplayDate`) · M `src/components/form/DateInput.jsx` · Test C `tests/children/date-input-pad.test.mjs`

**Interfaces:** `padDisplayDate(text: string): string`. Khớp `^(\d{1,2})\/(\d{1,2})\/(\d{4})$` ⇒ đệm ngày, tháng tới 2 chữ số; còn lại trả nguyên `text`.

- [x] **Bước 1: Viết test hỏng:**
  - `padDisplayDate('5/9/2027')` = `'05/09/2027'`.
  - `padDisplayDate('5/09/2027')` = `'05/09/2027'`.
  - `padDisplayDate('05/09/2027')` không đổi.
  - `padDisplayDate('5/9/20')` không đổi.
  - `padDisplayDate('')` = `''`.
  - Mã nguồn `DateInput.jsx` có `onBlur` dùng `padDisplayDate` và `handleType` gọi `parseDisplayDate(padDisplayDate(`.
- [x] **Bước 2:** chạy ⇒ FAIL.
- [x] **Bước 3:** thêm hàm; trong `DateInput`, `handleType` parse bản đã đệm; thêm `onBlur` hiển thị bản đã đệm (gọi tiếp `props.onBlur` nếu có).
- [x] **Bước 4:** chạy ⇒ PASS cùng `tests/children/dob-date-input.test.mjs`.
- [x] **Exit F1:** verify ⇒ PASS. Báo Cần (người viết `DateInput`). Dừng chờ review.

### Phase F6 — Dữ liệu test, contract, tài liệu

- [x] Viết lại `D:\project_capstone\project\web\TEST-nhap-tre-2027-2028.csv` theo kiểu file mẫu FE (SĐT, CCCD có khoảng trắng để Excel giữ chữ): `0916 231 201` / `0016 2312 0001`, `0916 231 202` / `0016 2312 0002`. Kiểm qua BE preview (BE chạy): 0 lỗi dòng. Ghi chú trong file test B6: "Không mở rồi lưu bằng Excel (Excel bỏ số 0 đầu)".
- [x] `node scripts/api-index.mjs --from ../be-school-year-scope` và `node scripts/check-api-contract.mjs --sync --from ../be-school-year-scope` (memory `fe-api-index-from-worktree`; tên script kiểm lại trong `scripts/`).
- [x] `docs/features/` của trẻ, sức khỏe, đón trẻ: thêm luật mới (chỉ dẫn rule ID BE, không chép luật). `node scripts/check-ai-layer.mjs`.
- [x] Ghi `docs/knowledge/ISSUE_INDEX.md` 3 sự cố không hiển nhiên:
  - `refreshOnDataChange` chỉ nghe mock (đón trẻ).
  - Lỗi ô `date` của phiếu khám không có ô trên form.
  - Seed thiếu tuần thai.

## Test matrix

| AC | Rule | Test | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-F12 | — | `refresh-after-write` / `refresh-after-pickup` | F5 | PASS |
| AC-F2 | G94-180/CHD-06 | `medical-history-items.test.mjs` | F2 | PASS |
| AC-F3 | G94-180/CHD-04 | `readmit-campus.test.mjs` | F2 | PASS |
| AC-F4, AC-F1 (validator) | G94-180/CHD-14 | `intake-start-date.test.mjs` | F2 | PASS |
| AC-F5 | G94-180/CHD-03 | `withdraw-leave-options.test.mjs` | F2 | PASS |
| AC-F6 | G94-180/CHD-10 | `placement-next-year.test.mjs` | F2 | PASS |
| AC-F7 | G94-180/CHD-14 | `placement-class-occupancy.test.mjs` | F3 | PASS |
| AC-F8, AC-F9 | HLT-09, HLT-01 | `measurement-roster-transfer.test.mjs` | F4 | PASS |
| AC-F10 | — | `health-check-accordion.test.mjs` | F4 | PASS |
| AC-F11 | HLT-08 | `exam-draft-errors.test.mjs` | F4 | PASS |
| AC-F1 | — | `date-input-pad.test.mjs` | F1 | PASS |

## Review Focus

Mỗi dòng có test ở task sở hữu.

1. Đổi **năm tiếp nhận lại** trong hộp mở lại hồ sơ sang năm không có điểm trường cũ ⇒ ô Điểm trường phải về trống, không giữ id cũ (F2.2 Bước 1 test thứ 2).
2. Hộp nghỉ học mở lúc BE chưa trả `leave-options` (mạng chậm) ⇒ nút "Cho nghỉ học" khóa tới khi có dữ liệu (F2.4 Bước 1: mã nguồn có `disabled` theo `loading`).
3. Đổi "Ngày vào lớp" làm lớp đang chọn thành đủ ⇒ bỏ chọn, báo ở ô Lớp (F3.1 Bước 3; thêm test mã nguồn).
4. Accordion: GV dạy thay có 2 lớp nhưng 1 lớp không có quyền nhập ⇒ khối vẫn mở xem được, nút theo `canRecord` của từng lớp (F4.2, kiểm cùng F4 ở `refresh-after-write`).
5. Ô ngày rời ô khi chuỗi dở ("5/9/20") ⇒ không đổi chữ, không gọi `onChange` sai (F1 Bước 1 test 4).

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Sửa `DateInput` dùng chung | 113 màn | Chỉ thêm đệm số 0; test cũ `dob-date-input` | Revert commit F1 |
| `usePlacementClasses` đổi chữ ký | Xếp lớp, Tiếp nhận | Tham số thứ 2 tùy chọn, mặc định như cũ | Revert F3 |
| Tách `ChipListInput` làm vỡ khối dị ứng | Khai báo sức khỏe | Test `health-declaration-sheet` cũ chạy lại | Revert F2.1 |
| Accordion ẩn lớp khiến GV không thấy trẻ | Kỳ cân đo | Lớp đầu mở sẵn, tiêu đề có số chưa cân | Revert F4.2 |

## Validation log

- [x] Khẳng định về code có `file:line` (bảng Context).
- [x] Contract BE mới có consumer cụ thể (F2.2, F2.4, F3.1, F4.1 ↔ plan BE B1.2, B1.5, B2, B4).
- [x] Mỗi AC có test; mỗi phase có Exit = verify.
- [x] >8 file, >3 phase: đã chia 6 phase; có thể tách F4 (sức khỏe) nếu user muốn.
- [x] Phần phụ thuộc Q1–Q5 ghi rõ ở từng task.
- [ ] Tự review lần 2 sau khi user trả lời Q1–Q5.

## Progress log

### 2026-11-24 — Lập plan (chờ user trả lời Q1–Q5 và duyệt bản tác động F1)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Tiếp: user trả lời → `approved` → Phase F5

### 2026-11-24 — FE xong F5, F2, F3, F4, F1, F6 và sửa review cuối
- Commit 25c4aa55..HEAD theo task: F5 9e1b4d9b; F2.1 6acdbc8f, 37e8ff4e; F2.5 ae390dde; F1 98d6b0e9; F4.2 b313781b; F2.2 e4ccb02a; F2.3 90ec790d; F4.3 14f41bb7; F2.4 70e8e9a1; 3d34b801 (Radio dùng chung); F3 ee0d6bc3; F4.1 ca5b0050, 13688020, 1ecea479; F6 1c1499ef (plan 818abebc, tài liệu 949f53bc); sửa review cuối 568e918f (dấu lỗi phiếu khám), 0edb57af (gõ "/" ở ô ngày), 0bffa672 (accordion theo classId, canEdit thiếu), 1be14444 (chỉnh nhỏ UI).
- Verify: VERIFY PASS full tại 14f41bb7 và tại 1c1499ef; sau sửa review cuối chạy lại verify full (xem báo cáo fix cuối).
- Khác plan:
  - Thêm `Radio.jsx` dùng chung và `ConfirmationModal.confirmDisabled` (cần user OK vì là file chung).
  - Đổi `RosterActions` (nút chính khóa dùng `disabledReason`).
  - Đợt khám không liên kết giữa các cơ sở (BE chốt).
- Tiếp: controller đóng plan (status giữ in-progress).
