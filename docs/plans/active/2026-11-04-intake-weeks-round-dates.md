---
title: Tuần thai bắt buộc khi tiếp nhận; kỳ cân đo bỏ vòng đầu; ngày đo, ngày khám do hệ thống ghi
status: in-progress
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # cần xác nhận task Jira riêng trước khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, health]
rules: [CHD-05, HLT-01, HLT-08, HLT-13]
risk: high
created: 2026-11-04
updated: 2026-11-04
---

# Tuần thai bắt buộc khi tiếp nhận; kỳ cân đo bỏ vòng đầu; ngày đo, ngày khám do hệ thống ghi

Plan phần client (Web). BE (`../CareNest_BE`) do agent BE sửa song song; contract dưới đây là contract coordinator giao, BE là nguồn đúng. Rule BE liên quan: CHD-05 (hành chính khi tiếp nhận), HLT-01 (kỳ cân đo), HLT-08 (đợt khám, phiếu Phụ lục II), HLT-13 (sửa số đo có lý do) — `BE:docs/business/BUSINESS_RULES.md`.

## Context

- User yêu cầu 2026-11-04 (nguyên văn): "Phần tuần khai sinh khi tiếp nhận trẻ chuyển sang là trường nhập bắt buộc , kỳ cân đo bỏ chỉ số vòng đầu , trong các kỳ khám cân đo thời gian không được chỉnh sửa".
- Hiện trạng FE (trước khi sửa):
  - Tuần thai chỉ bắt buộc khi Sinh non = Có (`src/utils/children/childrenValidation.js:55-58`); ô luôn hiện nhưng dấu `*` chỉ khi Có (`src/components/children/ChildProfileFields.jsx:47-57`); hồ sơ chỉ hiện tuần thai khi Có (`src/components/children/ChildProfileSummary.jsx:8-10`); cột Excel không bắt buộc (`src/models/children/childrenConstants.js:187`).
  - Form số đo có ô "Ngày đo" (`src/pages/children/HealthMeasurementFormPage.jsx:324-339`) và "Vòng đầu" theo `record.rules.headCircumferenceUntil` (`:200-202`, `:340-359`); kiểm ngày, vòng đầu ở `validateMeasurement` (`childrenValidation.js:154-172`); BE giả kiểm ngày trong khoảng của kỳ (`src/services/children/mock/childrenMockRepository.js:1362-1373`), trả `rules.headCircumferenceUntil` (`:1308`).
  - Phiếu khám bước 1 có ô nhập "Ngày kiểm tra sức khỏe" bắt buộc (`src/components/children/exam/ExamAdminStep.jsx:196-217`), payload gửi `date` (`src/pages/children/HealthExamFormPage.jsx:285-292`), kiểm ngày ở `validateHealthExam` (`src/utils/children/healthExamValidation.js:104-108`); BE giả nhận `payload.date` (`src/services/children/mock/healthExamMockRepository.js:444`, `:421`).

## Quyết định đã chốt

1. "Thời gian" = ngày khám, ngày đo của từng trẻ. Giáo viên không chọn; hệ thống ghi ngày nhập (hôm nay, trong kỳ). Sửa giữ ngày cũ. Ngày bắt đầu, kết thúc của đợt/kỳ vẫn do HT/PHT sửa như hiện nay — user xác nhận (a), 2026-11-04.
2. Giữ ô "Sinh non", kiểm khớp với tuần thai — user xác nhận (b), 2026-11-04.
3. Contract BE (coordinator, 2026-11-04):
   - `HealthMeasurementRequest` bỏ `date`, `headCircumferenceCm`. Số đo mới: BE ghi ngày = hôm nay; sửa giữ ngày. Kỳ cân đo không ghi vòng đầu; dữ liệu cũ và response vẫn có `headCircumferenceCm`.
   - `HealthExamRequest` bỏ `date`. Phiếu đã có giữ ngày; phiếu mới = hôm nay kẹp vào [startDate, endDate] của đợt.
   - `ChildHealthRecordResponse` bỏ `headCircumferenceUntil`.
   - `profile.gestationWeeks` bắt buộc mọi trẻ, 20–42: trống "Nhập tuần thai khi sinh"; Sinh non Có mà ≥37 "Trẻ sinh non có tuần thai dưới 37"; Sinh non Không mà <37 "Dưới 37 tuần là sinh non: chọn Sinh non là Có hoặc sửa tuần thai". Lưu tuần thai cho mọi trẻ.
   - Mã lỗi `HEALTH_MEASUREMENT_DATE_OUTSIDE` có thể bị BE bỏ (không còn xảy ra); FE không dựa vào mã này.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor HT/PHT (tiếp nhận, nhập Excel, sửa hồ sơ), GV lớp (nhập số đo, phiếu khám) · outcome: hồ sơ trẻ luôn có tuần thai khớp ô Sinh non; số đo kỳ cân đo chỉ chiều cao, cân nặng, ghi chú; ngày đo, ngày khám không sửa được · rule CHD-05, HLT-01, HLT-08, HLT-13 · flow `[B]` BE ghi ngày khi lưu.
- **Đối chiếu thiết kế ban đầu:** tuần thai "bắt buộc khi sinh non" (`docs/features/README.md:141`, `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md:64-65`); "ngày đo trong khoảng của kỳ" (`docs/features/README.md:153`); "Giáo viên vẫn nhập ngày khám" (`docs/features/README.md:138`); vòng đầu ở số đo kỳ cân đo (HLT-01: "vòng đầu (trẻ ≤60 tháng)") — nay đổi theo yêu cầu user.
- **Ảnh hưởng:** module child, health · quyền không đổi · dữ liệu dẫn xuất không đổi (BMI, mức BMI tính từ chiều cao, cân nặng) · `FE: /children/enroll`, `/children/import`, `/children/:id/edit`, `/children/:id`, `/children/:id/health/new`, `/children/:id/health/:measurementId/edit`, `/children/:id/health`, `/children/health-checks/:campaignId/exam/:childId` · `APP:` hiển thị hồ sơ trẻ có tuần thai cho mọi trẻ (BE trả); số đo kỳ cân đo mới không có vòng đầu · dữ liệu cũ: vòng đầu cũ giữ, chỉ hiện khi có giá trị.

### Câu hỏi mở

Không còn câu hỏi chặn (chế độ tự chạy). Điểm cần BE xác nhận ghi ở Key decisions và báo cáo bàn giao.

## Acceptance criteria

- **AC-1** (CHD-05): Given hồ sơ trẻ ở tiếp nhận, nhập Excel, Sửa hồ sơ When tuần thai trống / Sinh non Có mà ≥37 / Sinh non Không mà <37 / ngoài 20–42 Then lỗi `profile.gestationWeeks` đúng câu BE; hợp lệ thì lưu tuần thai cho mọi trẻ; file Excel thiếu cột tuần thai báo thiếu cột.
- **AC-2** (CHD-05): ô "Tuần thai khi sinh" luôn có dấu bắt buộc; hồ sơ, bước Xem lại hiện tuần thai cho mọi trẻ.
- **AC-3** (HLT-01): Given kỳ cân đo đang diễn ra When GV lưu số đo mới Then ngày đo = hôm nay (client gửi ngày cũng bỏ qua), không lưu vòng đầu; sửa giữ ngày đo và vòng đầu cũ; form không có ô ngày, ô vòng đầu.
- **AC-4** (HLT-08): Given phiếu khám When lưu nháp/kết luận Then phiếu mới ngày = hôm nay kẹp vào khoảng của đợt, phiếu đã có giữ ngày (client gửi ngày cũng bỏ qua); bước 1 hiện ngày chỉ đọc, không dấu `*`.
- **AC-5** (HLT-01): Sổ sức khỏe trả không còn `rules.headCircumferenceUntil`; hộp số đo, màn đã lưu chỉ hiện vòng đầu khi có giá trị (phiếu khám, dữ liệu cũ).

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Thứ tự kiểm tuần thai | Trống → ngoài 20–42 → số lẻ → Có mà ≥37 → Không mà <37; chưa chọn Sinh non thì không kiểm khớp | Kiểm khớp trước khoảng | Như thứ tự kiểm sẵn ở BE (`EnrollmentFormValidator`); báo một lỗi rõ nhất mỗi lần |
| Tuần thai số lẻ (vd. 36,5) | FE báo "Nhập số tuần nguyên, ví dụ 38" (chỉ hỗ trợ nhập liệu) | Làm tròn như BE giả cũ | Số lẻ ở mốc 37 làm lệch kiểm khớp; BE nhận Integer |
| Gợi ý ô tuần thai | "Từ 20 đến 42 tuần; dưới 37 tuần là sinh non" | Chỉ khoảng | Người nhập biết luật khớp trước khi lưu |
| Hiển thị tuần thai ở hồ sơ | Dòng riêng "Tuần thai khi sinh" cho mọi trẻ ("Chưa cung cấp" khi dữ liệu cũ trống) | Gộp "Không · 39 tuần" | Giống phần I phiếu khám (hai dòng) |
| Cột Excel | Bắt buộc, nhãn "Tuần thai khi sinh (20–42)"; dòng mẫu 39; file cũ vẫn khớp cột theo phần trước " (" | Giữ không bắt buộc cột | Như các cột hành chính bắt buộc khác (file thiếu cột không nhập được, user chốt 2026-10-22) |
| DB demo cũ | `PROFILE_FILL_VERSION` 2: ô tuần thai trống điền 35 (sinh non) / 39 (không); seed `ch_new_1` 39; ô đã có giữ nguyên | Để trống tới khi sửa hồ sơ | Như lần điền đầy 2026-10-22 ("fill đầy ở hiện tại luôn"); dữ liệu giả |
| Ngày đo ở form số đo | Dòng chỉ đọc đầu thẻ "Số đo": nhập mới = hôm nay kẹp vào khoảng ngày của kỳ ("Hệ thống tự ghi ngày đo khi lưu, không chọn được"), sửa = ngày đã lưu ("Ngày đo đã ghi, không sửa được") | Ô ngày bị khóa | Brief: chữ chỉ đọc, không ô nhập |
| Ngày ở phiếu khám mới | Hiện `draft.date` BE trả (BE đã kẹp hôm nay vào khoảng đợt), phiếu đã có hiện `measurement.date`; không tự tính ở UI | Tự kẹp ngày ở UI | Không chép rule vào UI (AGENTS.md bất biến 2); BE vẫn quyết khi lưu |
| Lỗi `date` BE trả khi lưu phiếu (trùng ngày đo khác) | Hiện dưới dòng ngày ở bước 1; `stepOfField('date')` → bước 1 | Chỉ toast | Trước đây ánh xạ sang bước 2 (không có ô ngày) |
| Trùng ngày khi lưu số đo mới (BE giả) | 409 "Ngày đo dd/MM/yyyy trẻ đã có kết quả đo khác. Báo Hiệu trưởng hoặc Phó hiệu trưởng" (câu 5020 của BE) (không còn khóa `date`) | 422 `date` | BE có `HEALTH_MEASUREMENT_DATE_TAKEN` (409); không còn ô ngày để gắn lỗi |
| Ngày tiếp xúc lao ở phiếu khám | Kiểm "không sau ngày khám" theo ngày hiển thị (form) / ngày BE ghi (BE giả), truyền `examDate` vào `validateHealthExam` | Bỏ kiểm | Rule cũ giữ (2026-10-21); payload không còn `date` |
| Vòng đầu ở màn số đo | `MeasurementSummary`: ô Vòng đầu chỉ khi có giá trị (3 hoặc 4 ô số); mẫu cũ chỉ hiện dòng vòng đầu khi có số | Luôn hiện "—" | Brief; kỳ cân đo mới không có vòng đầu |
| Danh sách lớp của kỳ, Sổ sức khỏe, Xu hướng | Không đổi: danh sách lớp, bảng Sổ sức khỏe không có cột vòng đầu; Xu hướng giữ biểu đồ vòng đầu (lần đo có số) | Bỏ cột vòng đầu ở Xu hướng | Brief giữ biểu đồ vòng đầu (dữ liệu phiếu khám) |

## Phases

### Phase 1 — Tiếp nhận: tuần thai bắt buộc
- Files: M `src/utils/children/childrenValidation.js`, `src/components/children/ChildProfileFields.jsx`, `src/components/children/ChildProfileSummary.jsx`, `src/models/children/childrenConstants.js`, `src/pages/children/ImportChildrenPage.jsx`, `src/services/children/mock/childrenMockRepository.js`, `src/mocks/childrenSeed.js`, `tests/children/profileFixture.mjs` · C `tests/children/gestation-weeks-required.test.mjs`.
- Tests: AC-1, AC-2 → `tests/children/gestation-weeks-required.test.mjs`.

### Phase 2 — Kỳ cân đo bỏ vòng đầu; ngày đo, ngày khám do hệ thống ghi
- Files: M `src/pages/children/HealthMeasurementFormPage.jsx`, `src/pages/children/HealthExamFormPage.jsx`, `src/components/children/exam/ExamAdminStep.jsx`, `src/components/children/MeasurementSummary.jsx`, `src/utils/children/healthExamValidation.js`, `src/models/children/healthExamForm.js`, `src/services/children/mock/healthExamMockRepository.js`, `src/services/children/mock/healthScreeningRule.js`, `src/services/children/api/*.js` (docblock) · tests `tests/health/*`, `tests/children/*` · C `tests/health/server-dates.test.mjs`.
- Tests: AC-3..AC-5 → `tests/health/server-dates.test.mjs`; sửa test cũ gửi `date`.

### Phase 3 — Tri thức, kiểm trên trình duyệt
- `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md`, `docs/quality/manual-tests/health-exam-flow.md`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → 0 lỗi; Playwright 1440/375.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2 | CHD-05 | `tests/children/gestation-weeks-required.test.mjs` (validation, BE giả), thử tay | 1 | Đạt (4 test); thử tay form tiếp nhận 1440/375, hồ sơ trẻ |
| AC-3, AC-5 | HLT-01 | `tests/health/server-dates.test.mjs`, `tests/health/measurement-rounds.test.mjs` (BE giả), thử tay | 2 | Đạt (4 test số đo + AC-6 sửa lại); thử tay form số đo mới/sửa, màn đã lưu, hộp số đo ở Sổ sức khỏe |
| AC-4 | HLT-08 | `tests/health/server-dates.test.mjs` (BE giả, validation), thử tay | 2 | Đạt (4 test phiếu khám); thử tay bước 1 phiếu mới/phiếu nháp 1440/375 |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lệch contract BE đang sửa song song (câu lỗi, khóa lỗi trùng ngày) | Màn báo lỗi khác khi nối BE | Bám contract coordinator; module `children` vẫn `demo` | Sửa mock, câu lỗi theo BE |
| Dữ liệu cũ thiếu tuần thai | Sửa hồ sơ bắt nhập tuần thai | Hồ sơ hiện "Chưa cung cấp"; DB demo điền một lần | Bỏ bước điền demo |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (màn liệt kê ở Ảnh hưởng)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file: một yêu cầu user, 3 thay đổi nhỏ liên quan cùng màn tiếp nhận/sức khỏe — giữ 1 plan, 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (user xác nhận (a), (b); contract coordinator)
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-11-04 — Plan (chế độ tự chạy, không chờ duyệt)
- Commit: chưa commit
- Tiếp: Phase 1–3.

### 2026-11-04 — Phase 1–3 xong (chế độ tự chạy)
- Phase 1: `validateChildProfile` kiểm tuần thai mọi trẻ (câu lỗi BE, thứ tự ở Key decisions), dùng chung cho form tiếp nhận, Sửa hồ sơ, BE giả (tiếp nhận, nhập Excel, sửa hồ sơ). Ô tuần thai luôn `*`, gợi ý "dưới 37 tuần là sinh non"; hồ sơ, bước Xem lại có dòng "Tuần thai khi sinh". Cột Excel bắt buộc, nhãn "Tuần thai khi sinh (20–42)", dòng mẫu 39. Seed `ch_new_1` 39; `PROFILE_FILL_VERSION` 2. `enrollmentImport.js` không cần sửa: cột bắt buộc lấy từ `IMPORT_COLUMNS`, luật theo dòng qua `validateEnrollment` → `validateChildProfile`. `EditChildPage` không cần sửa (dùng `validateChildInfo`).
- Phase 2: form số đo bỏ ô ngày, ô vòng đầu; "Ngày đo" chỉ đọc đầu thẻ Số đo; payload không còn `date`, `headCircumferenceCm`; `validateMeasurement(m, { requireReason })`. BE giả `saveMeasurement`: mới = hôm nay (`todayInput`), không vòng đầu; sửa giữ ngày, vòng đầu, vận động; trùng ngày ⇒ 409; bỏ `rules` ở Sổ sức khỏe; xóa `headCircumferenceUntil` (`healthScreeningRule.js`). `MeasurementSummary`: ô vòng đầu (và dòng vòng đầu của mẫu cũ, phiếu khám) chỉ khi có số. Phiếu khám: bước 1 dòng ngày chỉ đọc, không `*`, gợi ý theo phiếu mới/đã lưu, lỗi `date` hiện dưới dòng ngày (`stepOfField('date')` → bước 1); payload không còn `date`; `validateHealthExam` bỏ kiểm ngày, nhận `examDate` cho ngày tiếp xúc lao. BE giả phiếu khám: `examDateOf` (phiếu có sẵn giữ ngày, mới = hôm nay kẹp vào đợt), xem trước điểm cần xem lại cũng theo ngày này, trùng ngày đo kiểm cả khi lưu nháp (như BE). Docblock `childrenApi.js`, `healthCheckApi.js` ghi contract mới.
- Phase 3: `docs/features/README.md` (mục mới đầu phần phiếu khám, sửa 3 dòng cũ), `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` (tuần thai), `docs/quality/manual-tests/health-exam-flow.md` (I1, I2, I5, I11, T1 bước 1, F3, F4), `.ai/CONTEXT_MAP.yaml` (từ khóa tuần thai, sinh non).
- Khác plan (thêm ngoài brief): kiểm ở 375px thấy nhãn đầu dòng phiếu khám không xuống dòng, chữ chồng sang ô kết quả (có từ commit `39456d2`, khi bỏ `table--wrap-head`) ⇒ sửa 1 dòng CSS (`children.css`, `white-space: normal` cho `th` của `tr-exam-sheet`), ghi incident `FE-BUG-261104-exam-sheet-row-header-nowrap` + ISSUE_INDEX + 1 dòng bẫy ở `docs/features/README.md`.
- Test: `tests/children` 85/85 (thêm `gestation-weeks-required` 4), `tests/health` 70/70 (thêm `server-dates` 8); sửa test cũ còn gửi `date` (`measurement-rounds` AC-6, AC-7; `auto-publish`; payload phiếu khám ở 4 file); `profileFixture` tuần thai 39.
- Kiểm trên trình duyệt (dev server tự chạy cổng 5199, BE giả): Lê Minh Anh (phiếu nháp Trần Khánh An, phiếu mới Bùi Bảo Ngọc — không lưu), Hoàng Minh Tuấn (form số đo mới Hoàng Khánh An, sửa số đo Đỗ Phương Linh; lưu thử 1 số đo rồi xóa khỏi DB demo), Nguyễn Thị Lan (form tiếp nhận: trống tuần thai, Có + 38, Không + 34; hồ sơ Bùi Bảo Ngọc). 1440px và 375px, trang không tràn ngang, không lỗi console. Ảnh `../.playwright-mcp/round-date-*.png` (ngoài repo).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (764 test; lint 0 lỗi, 1 cảnh báo có sẵn ở `ImportGoalFileModal.jsx`; `check-design: ok · hex 22/43 · cssPx 16/16 · inlineStyle 37/37`; `check-api-contract (FE): 0 lỗi, 1 cảnh báo` — cảnh báo có sẵn về module pickup, openapi BE chưa đổi route). `node scripts/check-ai-layer.mjs` → `0 lỗi, 20 cảnh báo` (đều có sẵn).
- Cần BE xác nhận: (1) kỳ cân đo quá ngày kết thúc mà chưa đóng (kỳ cân đo đóng tay, HLT-17): số đo mới ghi hôm nay nằm ngoài khoảng của kỳ — có kẹp như phiếu khám không; (2) câu lỗi trùng ngày đo khi lưu phiếu khám (khóa `date`) không còn bảo "chọn ngày khám khác"; (3) hồ sơ cũ chưa có tuần thai: giữ NULL tới khi sửa hồ sơ (FE hiện "Chưa cung cấp").
- Commit: commit, push lên nhánh feature (user cho phép 2026-11-04).
- Tiếp: coordinator soát, đồng bộ `check-api-contract --sync` khi BE xong; nối API khi module `children` chuyển `api`.

### 2026-11-04 — Đối chiếu BE xong (coordinator)
- BE chốt: số đo mới ghi hôm nay kẹp vào khoảng ngày của kỳ (kỳ cân đo còn mở sau ngày kết thúc ⇒ ghi ngày kết thúc; HLT-01 chờ user soát). BE giả và form số đo làm theo (thêm test kẹp ngày trong `tests/health/server-dates.test.mjs`); câu hỏi (1) ở mục trên đã trả lời.
- Câu 5020 theo BE: "Ngày đo dd/MM/yyyy trẻ đã có kết quả đo khác. Báo Hiệu trưởng hoặc Phó hiệu trưởng"; BE bỏ mã 5021. `check-api-contract` 0 lỗi (route không đổi, không cần `--sync`).
- Verify: FE `VERIFY PASS full`; BE `VERIFY PASS full | tests 1007 fail 0`.
