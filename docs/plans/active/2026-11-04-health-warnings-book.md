---
title: Cảnh báo sức khỏe ở Sổ sức khỏe; bỏ phiếu theo dõi; cảnh báo BMI theo tuổi cho kỳ cân đo
status: in-progress
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # cần xác nhận task Jira riêng trước khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health]
rules: [HLT-03, HLT-10, HLT-12, HLT-16, HLT-18, HLT-19]
risk: high
created: 2026-11-04
updated: 2026-11-04
---

# Cảnh báo sức khỏe ở Sổ sức khỏe; bỏ phiếu theo dõi; cảnh báo BMI theo tuổi cho kỳ cân đo

Plan phần client (Web). Plan chính, contract và rule: `BE:docs/plans/active/2026-11-04-health-warnings-book.md`. Rule BE: HLT-16 **REMOVED**, HLT-18 (BMI theo tuổi WHO, mới), HLT-19 (cảnh báo ở Sổ sức khỏe, mới), HLT-10, HLT-12 sửa cùng đợt (`BE:docs/business/BUSINESS_RULES.md`, đều PROPOSED/chưa có xác nhận trường).

## Context

- User quyết định 2026-11-04 (qua coordinator): giảm việc của giáo viên. Bỏ hẳn "phiếu theo dõi sức khỏe" (danh sách, chi tiết, ghi trao đổi phụ huynh, kết quả chuyên khoa, đóng phiếu, nhắc, thông báo, số đếm). Cảnh báo nằm ở Sổ sức khỏe, tính khi đọc, không ai phải xử lý.
  - Đợt khám: kết luận bác sĩ là cảnh báo (nhóm kết luận NORMAL / ISSUE / REFERRAL / TB_RISK; FOLLOWING_NO_NEW / FOLLOWING_NEW chỉ còn ở dữ liệu cũ), mức theo dõi giữ nguyên.
  - Kỳ cân đo: hệ thống xếp mức BMI theo tuổi theo WHO (HLT-18), chỉ sàng lọc, không chẩn đoán (HLT-12).
- Hiện trạng FE (trước khi sửa):
  - Mock phiếu theo dõi: `src/services/children/mock/healthCheckRule.js:87-455`, 5 endpoint `src/services/children/mock/healthCheckMockRepository.js:651-762`, mở phiếu khi lưu kết luận/số đo (`healthExamMockRepository.js:540`, `childrenMockRepository.js:1495`, `:1506`), tự đóng khi cho nghỉ học (`childrenMockRepository.js:1261`), nhắc hằng ngày (`childrenMockRepository.js:337-348`).
  - Màn: `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId` (`src/routes/AppRoutes.jsx:102-103`, `:332-336`), menu `src/layouts/menuConfig.js:171-174`.
  - Sổ sức khỏe có thẻ "Theo dõi sức khỏe" (component `HealthFollowUpCard`, nay đã xóa) và khối "Kết quả khám chuyên khoa" (`src/pages/children/ChildHealthRecordPage.jsx:184-219`, trước khi sửa).
  - BMI chỉ là số, không nhãn (`src/services/children/mock/healthScreeningRule.js:17-23`, `:72-75`); kết quả mẫu cũ xếp mức theo ngưỡng tạm (`healthScreeningRule.js:200-245`).

## Quyết định đã chốt

1. Bỏ phiếu theo dõi (HLT-16 REMOVED) và mọi màn, API, thông báo, nhắc, số đếm liên quan — user, 2026-11-04.
2. Kỳ cân đo có mức BMI theo tuổi WHO (HLT-18): `bmiStatus` 6 mức, `bmiZScore` 2 chữ số; chỉ cho số đo của kỳ cân đo (đợt khám theo bác sĩ) — user, 2026-11-04.
3. Sổ sức khỏe giữ cảnh báo (HLT-19): `latestExam`, `latestBmi`; không có bước xử lý — user, 2026-11-04.
4. Dữ liệu cũ: nhãn lịch sử khai báo `UPDATED_FROM_FOLLOW_UP` vẫn đọc được; phiếu khám đã kết luận theo mẫu `FOLLOW_UP` giữ mẫu khi xem/sửa; phiếu mới, phiếu nháp dùng `STANDARD` — user, 2026-11-04.
5. Contract BE (coordinator, 2026-11-04): xem mục "Contract client" bên dưới; BE là nguồn đúng.
6. Bổ sung contract từ coordinator cùng ngày (sau review BE): `classes[].bmiWarning`; `watchList` = "trẻ cần chú ý" có thứ tự BE trả; phân loại BMI so ngưỡng bằng z-score đã làm tròn 2 chữ số HALF_UP; `knownCondition` lấy tiền sử bản thân đã khai khi chưa có lần khám mức KNOWN_STABLE.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor GV lớp (nhập), HT/PHT (xem) · outcome: GV không còn việc theo dõi; Sổ sức khỏe, danh sách lớp, chi tiết đợt/kỳ hiện cảnh báo · rule HLT-18, HLT-19 (PROPOSED), HLT-16 REMOVED · flow `[S]` hệ thống tính mức BMI khi đọc.
- **Đối chiếu thiết kế ban đầu:** phiếu theo dõi ở `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md`, `2026-10-21-health-follow-up-close-outcome.md`; "bỏ nhãn phân loại BMI" ở `docs/plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md` (user chốt 2026-10-17) — nay đổi theo HLT-18.
- **Ảnh hưởng:** module health · quyền không đổi (bỏ `canUpdateFollowUp`) · dữ liệu dẫn xuất: mức BMI tính khi đọc · `FE: /children/:id/health`, `/children/:id/health/new|:measurementId/edit`, `/children/health-checks(/:campaignId)`, `/children/health-checks/:campaignId/exam/:childId`, `/children/health-trends`; bỏ `/children/health-follow-ups*` · `APP:` màn Sức khỏe phụ huynh (BE trả `bmiStatus`; APP tự quyết hiển thị) · dữ liệu cũ: seed demo v14.

### Câu hỏi mở

Không còn câu hỏi chặn. Giả định tự chọn ghi ở Key decisions (chế độ tự chạy).

## Contract client (mirror BE, mock trả đúng dạng)

- `HealthBmiStatus`: `SEVERE_THINNESS` Gầy còm nặng · `THINNESS` Gầy còm · `NORMAL` Bình thường · `OVERWEIGHT_RISK` Nguy cơ thừa cân · `OVERWEIGHT` Thừa cân · `OBESE` Béo phì.
- Lần đo: bỏ `followUpId`, `followUpEffect`, `parentContact`; thêm `bmiStatus`, `bmiZScore` (chỉ kỳ cân đo, có chiều cao + cân nặng, 0–84 tháng; mock: cả kết quả mẫu cũ). `bmi` 1 chữ số giữ cho mọi lần đo. `bmiZScore` = z làm tròn 2 chữ số HALF_UP, và chính số đã làm tròn này dùng để so ngưỡng (z thô +1,004 ⇒ 1,00 ⇒ NORMAL; +1,006 ⇒ 1,01 ⇒ OVERWEIGHT_RISK; −2,004 ⇒ −2,00 ⇒ NORMAL).
- `GET /children/{id}/health`: bỏ `latestHealth`, `openFollowUp`, `externalResults`; thêm `latestExam { measurementId, campaignId, campaignName, date, followUpLevel, conclusionCategory, conclusion, knownCondition }`, `latestBmi { measurementId, campaignId, campaignName, date, ageMonths, bmi, bmiStatus, bmiZScore }`. Mock giữ phần thêm `child`, `cls`, `declaration`, `rules`.
- Đợt/kỳ: `progress` bỏ `waitingFollowUpCount`, `overdueFollowUpCount` (ở campaign), bỏ `byConclusion` (BE không có); thêm `progress.bmi { severeThinness, thinness, overweightRisk, overweight, obese }` (đợt khám luôn 0). Chi tiết: `classes[].bmiWarning`; `classes[].bmiWarning` (đợt khám luôn 0); `watchList` = "trẻ cần chú ý", BE xếp sẵn: đợt khám WATCH/CLOSE_WATCH (CLOSE_WATCH trước, rồi theo tên); kỳ cân đo `bmiStatus` khác NORMAL (SEVERE_THINNESS/OBESE, rồi THINNESS/OVERWEIGHT, rồi OVERWEIGHT_RISK, cùng nhóm theo tên tiếng Việt). Dòng trẻ: bỏ `followUp`, `criteria`; thêm `bmi`, `bmiStatus`. Đóng đợt: bỏ `waitingFollowUpCount`.
- Phiếu khám: bỏ `openFollowUp`, `latestExternalResult`; `conclusionMode` STANDARD trừ phiếu đã kết luận mẫu FOLLOW_UP; `knownCondition` = vấn đề (issueText) của lần khám đã kết luận gần nhất ở mức KNOWN_STABLE; nếu không có thì tiền sử bản thân đã khai (khai báo sức khỏe, bản thân REPORTED ⇒ text), đọc như bản điền sẵn của phiếu khám; không có thì null.
- Bỏ mọi endpoint `/health-follow-ups`.

## Acceptance criteria

- **AC-1** (HLT-18): Given số đo kỳ cân đo có chiều cao, cân nặng, trẻ 0–84 tháng When đọc Then `bmiStatus` theo z-score LMS (đuôi ±3SD theo WHO), ngưỡng ≤60 / ≥61 tháng đúng bảng; đợt khám ⇒ null.
- **AC-2** (HLT-19): Given trẻ có phiếu khám đã kết luận và số đo kỳ cân đo When mở Sổ sức khỏe Then thẻ "Cảnh báo sức khỏe" hiện kết luận bác sĩ và BMI theo tuổi; không còn dữ liệu phiếu theo dõi.
- **AC-3** (HLT-16 REMOVED): không còn route, menu, API, thông báo, nhắc phiếu theo dõi; lưu kết luận/số đo, cho nghỉ học không tạo/đóng phiếu.
- **AC-4** (HLT-19): chi tiết đợt/kỳ: đợt khám giữ "Trẻ cần theo dõi"; kỳ cân đo có số trẻ theo mức BMI, tab trẻ có cảnh báo BMI, cột BMI ở danh sách lớp; danh sách đợt cột "Cảnh báo".
- **AC-5** (dữ liệu cũ): phiếu đã kết luận mẫu FOLLOW_UP giữ mẫu; phiếu mới/nháp STANDARD; nhãn `UPDATED_FROM_FOLLOW_UP` còn đọc được.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bảng WHO trong mock | Sinh `whoBmiForAge.js` từ `BE:src/main/resources/health/who-bmi-for-age.csv` (cùng nội dung CSV coordinator đưa), không gõ tay | Gõ tay số | Tránh sai số; mock là BE giả, dẫn HLT-03/HLT-18 |
| Kết quả mẫu cũ (LEGACY, chỉ mock) | Có `bmiStatus` như kỳ cân đo; mức theo dõi = `UNAVAILABLE` (bỏ ngưỡng tạm làm cảnh báo); giữ vòng đầu/vận động trong hộp chi tiết, ghi "Mẫu cũ" | Giữ mức theo ngưỡng tạm | Theo brief; ngưỡng tạm không phải chuẩn |
| Tông `OVERWEIGHT_RISK` | Cam + icon Eye (như "Cần theo dõi"); Gầy còm/Thừa cân cam + AlertTriangle; Gầy còm nặng/Béo phì đỏ | Vàng `approval` | DESIGN §2.1.7: vàng chỉ cho "chờ duyệt" |
| Nhấn mạnh panel | Nền/viền token `--color-danger-bg`/`--color-danger-border` khi CLOSE_WATCH hoặc Gầy còm nặng/Béo phì | Banner `.alert--danger` cả khối | Rõ mà không gắt; dùng token có sẵn |
| Ý kiến phụ huynh (`needsParentOpinion`) | Giữ: phiếu khám mức theo dõi sát có người đi cùng vẫn bắt buộc ý kiến (BE validator còn rule, contract còn `exam.conclusion.parentOpinion`) | Bỏ | Ghi tại buổi khám, không tạo việc sau khám; bỏ phần "ghi vào phiếu theo dõi" |
| Thông báo nguy cơ lao khi lưu kết luận | Bỏ (là thông báo của phiếu theo dõi `HEALTH_FOLLOW_UP`); màn kết quả nói cảnh báo nằm ở Sổ sức khỏe | Giữ thông báo riêng | Brief bỏ mọi thông báo theo dõi; BE health không gửi thông báo |
| Tổng cảnh báo BMI ở danh sách đợt | Cộng 5 số BE trả trong `progress.bmi` để hiện "N trẻ có cảnh báo BMI" | Hiện từng mức | Brief yêu cầu tổng; không tính lại từ số đo |
| Danh sách trẻ cảnh báo BMI | Dùng `watchList` BE trả (coordinator chốt) | Gộp danh sách lớp ở UI | Không tính ở UI |
| DB demo cũ | `HEALTH_SEED_VERSION` 14: xóa `healthFollowUps`, thông báo `HEALTH_FOLLOW_UP`; thêm số đo seed cho kỳ cân đo c2 (lớp Lá A) khi kỳ còn nguyên; seed thông báo v2 | Xóa sạch DB | Giữ dữ liệu người dùng đã nhập |
| `latestHealth` của danh sách trẻ (mock, cho Xu hướng sức khỏe) | Rút gọn theo lần khám gần nhất có kết luận | Bỏ hẳn | Giữ sắp xếp trẻ cần chú ý ở Xu hướng |
| Thẻ số trẻ theo mức BMI ở chi tiết kỳ | Chỉ HT/PHT; 5 thẻ luôn hiện (kể cả 0) | Hiện cho giáo viên; ẩn mức 0 | Màn giáo viên không có hàng thẻ tiến độ (user chốt 2026-10-22); đủ 5 mức để so sánh |
| Số đo seed của kỳ cân đo c2 | Cân nặng dựng ngược từ z mục tiêu (`bmiForZScore`) theo các lần đo trước của chính trẻ (`ROUND_BMI_Z`): Lá A đủ 6 trẻ (1 gầy còm), Mầm 1 có 2 trẻ (béo phì, nguy cơ thừa cân) ⇒ 3 trẻ có cảnh báo | Mỗi mức 1 trẻ ở Lá A | Bản đầu cho trẻ gầy còm cũ thành béo phì, biểu đồ gãy; mức không đổi theo ngày chạy |
| `latestBmi` (mock) | Lấy lần đo không phải đợt khám mới nhất, gồm cả kết quả mẫu cũ (LEGACY, chỉ demo) | Chỉ kỳ cân đo | Trẻ demo chưa có kỳ cân đo vẫn có BMI theo tuổi; BE không có LEGACY |
| Badge mức theo dõi trong thẻ cảnh báo | Nhãn ngắn (`FollowUpLevelShortBadge`, "Cần theo dõi sát") | Nhãn đầy đủ | Nhãn đầy đủ tràn khối ở 375px; nhãn đầy đủ vẫn ở phiếu khám |
| Cột "Cảnh báo" ở bảng các lần đo | UI đọc `conclusion` (mock thêm bản tóm tắt) hoặc `exam.conclusion` | Thêm field BE | Chạy được với BE không có `conclusion` |
| Thông báo demo cũ `HEALTH_FOLLOW_UP` (seed thông báo) | Thay bằng `CHILD_TB_CONTACT`, seed thông báo v2; DB cũ xóa thông báo `HEALTH_FOLLOW_UP` | Giữ | Loại thông báo không còn |
| Incident `FE-BUG-261023-health-follow-up-verification` | Đóng `fixed` (tính năng và test đã bỏ) | Để `open` | Không còn gì để sửa; ISSUE_INDEX chỉ nhận open/workaround/fixed |
| Biểu đồ Xu hướng sức khỏe | Không đổi (không vẽ mức BMI) | Tô màu điểm theo mức | Ngoài brief |

## Phases

### Phase 1 — BE giả, model, test
- Files: C `src/services/children/mock/whoBmiForAge.js`, C `src/services/children/mock/bmiForAgeRule.js` · M `healthScreeningRule.js`, `healthCheckRule.js`, `healthCheckMockRepository.js`, `healthExamMockRepository.js`, `childrenMockRepository.js`, seeds, constants, validation, permissions · D test phiếu theo dõi.
- Tests: AC-1 `tests/health/bmi-for-age.test.mjs`; AC-2..AC-5 `tests/health/health-warnings-book.test.mjs`; sửa test cũ.
### Phase 2 — UI
- Files: C `HealthWarningsCard.jsx`, `HealthWarningCell.jsx` · M Sổ sức khỏe, số đo, phiếu khám, đợt/kỳ, xu hướng, cho nghỉ học · D trang, component, hook phiếu theo dõi; route, menu.
### Phase 3 — Tri thức
- `ROUTE_MAP.md`, `features/README.md`, `CURRENT_STATE.md`, `manual-tests/health-exam-flow.md`, `.ai/CONTEXT_MAP.yaml`, `docs/knowledge`, DESIGN §3.2.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`; `node scripts/check-ai-layer.mjs`.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | HLT-18 | `tests/health/bmi-for-age.test.mjs` (mock) | 1 | Đạt (7 test, gồm làm tròn z ở ngưỡng) |
| AC-2, AC-3, AC-5 | HLT-19, HLT-16 | `tests/health/health-warnings-book.test.mjs` (mock) | 1 | Đạt (9 test, gồm `knownCondition` từ khai báo) |
| AC-4 | HLT-19 | `tests/health/health-warnings-book.test.mjs`, thử tay | 1–2 | Đạt; thử tay A0.1–A0.9 (`docs/quality/manual-tests/health-exam-flow.md`) vai Hiệu trưởng |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lệch contract BE đang sửa song song | Màn sai khi nối BE | Bám contract coordinator; module `children` vẫn `demo` | Sửa mock theo BE |
| DB demo cũ còn dữ liệu phiếu theo dõi | Lỗi đọc | Nâng seed v14, xóa collection | "Khôi phục dữ liệu demo" |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (màn liệt kê ở Ảnh hưởng)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file: một thay đổi nghiệp vụ liên kết (bỏ một tính năng) — giữ 1 plan, chia 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (HLT-18, HLT-19 PROPOSED theo BE, user yêu cầu)
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-11-04 — Plan (chế độ tự chạy, không chờ duyệt)
- Commit: chưa commit
- Tiếp: Phase 1.

### 2026-11-04 — Phase 1–3 xong (chế độ tự chạy)
- Phase 1: BE giả theo contract coordinator: `whoBmiForAge.js` sinh từ CSV của BE, `bmiForAgeRule.js`; bỏ phiếu theo dõi khỏi mock (mở, đóng, nhắc, thông báo); seed sức khỏe v14, seed thông báo v2. Coordinator bổ sung giữa chừng, đã làm theo: `classes[].bmiWarning` và thứ tự `watchList`; so ngưỡng bằng z đã làm tròn 2 chữ số; `knownCondition` lấy tiền sử bản thân đã khai khi chưa có lần khám mức KNOWN_STABLE.
- Phase 2: thẻ "Cảnh báo sức khỏe" ở Sổ sức khỏe, cột "Cảnh báo" và bộ lọc "Chỉ lần có cảnh báo"; chi tiết kỳ cân đo (thẻ số trẻ theo mức BMI, tab "Trẻ có cảnh báo BMI", cột theo lớp); danh sách lớp của kỳ có BMI, mức BMI, lọc; thông báo lưu số đo kèm mức BMI. Xóa 2 trang, 1 component, 1 test của phiếu theo dõi; bỏ route, menu.
- Phase 3: ROUTE_MAP, features README, CURRENT_STATE, CONTEXT_MAP, ISSUE_INDEX và incident (đóng `fixed`), DESIGN 3.4, CHILD_ENROLLMENT_BE_SPEC, kịch bản thử tay (mục A0 theo seed mới; đã chạy A0.1–A0.9 trên trình duyệt, vai Hiệu trưởng, không lỗi console).
- Test: `tests/health` 62/62 (`bmi-for-age` 7, `health-warnings-book` 9), `tests/children` 81/81, `tests/hardening` 72/72.
- Verify: `VERIFY PASS full | npm run verify | log verify.log`. Lint 0 lỗi (1 cảnh báo có sẵn ở `src/components/education-plan/ImportGoalFileModal.jsx`); `check-design: ok · hex 22/43 · cssPx 16/16 · inlineStyle 37/37`; `check-api-contract (FE): 0 lỗi, 1 cảnh báo` (`be-api-routes.json` khác openapi BE cạnh bên; chưa chạy `--sync` vì BE đang sửa song song); `check-ai-layer (FE): 0 lỗi, 20 cảnh báo` (không cảnh báo nào của plan này).
- Commit: chưa commit (coordinator quyết).
- Tiếp: coordinator soát và commit. Khi BE xong: nối API (module `children` vẫn `demo`), chạy `node scripts/check-api-contract.mjs --sync`, so `watchList`, `knownCondition`, `latestBmi` với BE, rồi chuyển plan sang `completed/`. APP đồng bộ mức BMI theo ghi chú DESIGN 3.4.
