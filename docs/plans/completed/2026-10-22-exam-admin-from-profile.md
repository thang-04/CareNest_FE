---
title: Phiếu khám chỉ xem hành chính; bắt buộc nhập khi tiếp nhận
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, health]
rules: []
risk: medium
created: 2026-10-22
updated: 2026-10-22
---

# Phiếu khám chỉ xem hành chính; bắt buộc nhập khi tiếp nhận

## Context

- User (2026-10-22): ở đợt khám, Phần I (hành chính, tiền sử) không được sửa; chỉ Hiệu trưởng, Phó hiệu trưởng sửa ở hồ sơ trẻ. Người đi cùng trẻ cũng vậy. Trẻ chưa có dữ liệu thì điền đầy.
- Hiện tại giáo viên sửa được mọi ô Phần I (`src/components/children/exam/ExamAdminStep.jsx:68-147`, `:182-220`, `:229-271`). Lưu kết luận ghi ngược vào hồ sơ và khai báo (`src/services/children/mock/healthExamMockRepository.js:144-175`, gọi ở `:536`). Ô hồ sơ trống lấy từ phiếu khám gần nhất (`healthExamMockRepository.js:105-123`).
- Khi tiếp nhận, hành chính và tiền sử không bắt buộc, tiền sử có "Chưa cung cấp" (`src/utils/children/childrenValidation.js:34-50`, `:104-118`; `src/models/children/childrenConstants.js:156-170`).
- Tiền sử sửa ở Khai báo sức khỏe, chỉ Phó hiệu trưởng điểm trường (`src/utils/children/childrenPermissions.js:55`). Hành chính sửa ở Sửa hồ sơ, Hiệu trưởng hoặc Phó hiệu trưởng (`childrenPermissions.js:51`).
- Dữ liệu mẫu: chỉ 5 trẻ có hồ sơ hành chính/tiền sử (`src/mocks/childrenSeed.js:483-540`). Phiếu mẫu ch_016 có người đi cùng là ông, không có trong hồ sơ (`childrenSeed.js:155-158`).

## Quyết định đã chốt

1. D1 — Phiếu khám Phần I chỉ xem: hành chính và tiền sử luôn lấy từ hồ sơ trẻ và khai báo sức khỏe. Bỏ cập nhật ngược khi lưu kết luận, bỏ lấy từ phiếu khám cũ. Thay 2b và 5 của `docs/plans/completed/2026-10-17-enrollment-admin-medical-history.md` — user, 2026-10-22.
2. D2 — Người đi cùng: giáo viên chỉ chọn Có/Không và chọn 1 phụ huynh trong hồ sơ. Họ tên, quan hệ, SĐT, CCCD chỉ xem. Người ngoài hồ sơ thì Hiệu trưởng/Phó hiệu trưởng thêm vào hồ sơ trước — user, 2026-10-22.
3. D3 — Bắt buộc khi tiếp nhận: sinh non (+ tuần thai khi Có), dân tộc, đối tượng, nguồn chi trả, nơi ở (tỉnh, phường/xã, số nhà), 3 mục tiền sử (bỏ "Chưa cung cấp"). Không bắt buộc: CCCD trẻ, nhóm máu. Thay 1a — user, 2026-10-22.
4. D4 — Bắt buộc ở mọi chỗ nhập: form tiếp nhận, nhập Excel (cột bắt buộc), sửa hồ sơ, khai báo sức khỏe — user, 2026-10-22.
5. D5 — Hiệu trưởng cũng sửa được Khai báo sức khỏe (như Sửa hồ sơ) — user, 2026-10-22.
6. D6 — Dữ liệu mẫu: mọi trẻ có đủ hành chính, tiền sử; mọi phụ huynh có SĐT, CCCD. DB demo đang dùng được điền đầy một lần — user, 2026-10-22 ("fill đầy ở hiện tại luôn").
7. D7 — Sửa một phần D1: tiền sử ở phiếu khám vẫn cho giáo viên sửa (điền sẵn từ khai báo); lưu phiếu thì cập nhật vào Khai báo sức khỏe của trẻ — user, 2026-10-22 (sau Phase 3). Hành chính và người đi cùng giữ như D1, D2. Giữ 2b cho phần tiền sử.

**Mặc định (tự chọn, user đổi được):**
- Phiếu đã kết luận giữ bản chụp hành chính lúc lưu, kể cả khi lưu lại sau sửa. Phiếu mới và phiếu nháp luôn hiện hành chính hiện tại của hồ sơ.
- D7: chỉ **Lưu kết luận** cập nhật khai báo; lưu nháp (tự lưu khi chuyển bước) không cập nhật, như 2b cũ. Mục tiền sử phiếu nháp còn trống thì điền từ khai báo. Lưu lại phiếu đã kết luận mà không sửa tiền sử thì không ghi đè khai báo (tránh xóa thay đổi khai báo làm sau đó).
- Ngày khám vẫn nhập ở bước 1.
- Hồ sơ thật còn trống (khi nối BE): phiếu hiện "Chưa cung cấp", không chặn giáo viên lưu.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor Phó hiệu trưởng điểm trường, Hiệu trưởng (nhập/sửa hồ sơ, khai báo); giáo viên (khám) · outcome phiếu khám dùng đúng hồ sơ trẻ, giáo viên không sửa · rule BE: chưa có (PROPOSED từ 2026-10-17) · flow `[S]` tiếp nhận / nhập Excel / sửa hồ sơ / khai báo / khám.
- **Đối chiếu thiết kế ban đầu:** `docs/features/README.md:115` ghi 1a, 2b, 5 — đảo theo D1, D3. `docs/features/README.md:119` ghi phiếu khám sửa được ngày tiếp xúc lao — bỏ theo D1.
- **Ảnh hưởng:** module child (tiếp nhận, Excel, sửa hồ sơ, khai báo) và health (phiếu khám) · quyền: khai báo thêm Hiệu trưởng · `FE: /children/new`, `/children/import`, `/children/:id/edit`, `/children/:id/health-declaration`, phiếu khám trong `/children/health-checks/:id` · `APP`: không đổi · dữ liệu cũ: D6.

### Câu hỏi mở

Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Người đi cùng "cũng vậy"? | Chọn phụ huynh trong hồ sơ, chỉ xem chi tiết | user | 2026-10-22 | `docs/features/README.md` |
| Hồ sơ trống thì sao? | Bắt nhập khi tiếp nhận | user | 2026-10-22 | `docs/features/README.md` |
| Ô nào bắt buộc? | Trừ CCCD trẻ, nhóm máu | user | 2026-10-22 | `docs/features/README.md` |
| Bắt buộc ở đâu? | Mọi chỗ nhập | user | 2026-10-22 | `docs/features/README.md` |
| Quyền sửa tiền sử? | Thêm Hiệu trưởng | user | 2026-10-22 | `docs/features/README.md` |
| Trẻ cũ trống? | Điền đầy dữ liệu demo ngay | user | 2026-10-22 | plan này |
| Tiền sử ở phiếu khám? (sau Phase 3) | Vẫn cho sửa; lưu phiếu cập nhật vào khai báo (D7) | user | 2026-10-22 | `docs/features/README.md` |

## Acceptance criteria

- **AC-1** (D1, D7): Given phiếu mới hoặc nháp When giáo viên mở Then hành chính của hồ sơ hiện tại, không có ô nhập (client gửi giá trị khác thì BE giả bỏ qua); tiền sử điền sẵn từ khai báo, sửa được, lưu nháp giữ giá trị giáo viên nhập.
- **AC-2** (D1, D7): Given lưu kết luận When xong Then hồ sơ trẻ (hành chính) không đổi; tiền sử khác khai báo thì khai báo được cập nhật, có lịch sử "Cập nhật tiền sử từ phiếu khám"; ngày tiếp xúc lao đổi thì báo Hiệu trưởng, Phó hiệu trưởng điểm trường. Lưu nháp không cập nhật; lưu lại phiếu đã kết luận mà không sửa tiền sử thì không ghi đè khai báo.
- **AC-3** (mặc định): Given phiếu đã kết luận When hồ sơ đổi sau đó, hoặc lưu lại kết luận Then Phần I của phiếu giữ bản chụp lúc lưu.
- **AC-4** (D2): Given "Có người đi cùng" When không chọn phụ huynh hoặc chọn sai chỉ số Then `422` khóa `exam.admin.companion`; When chọn phụ huynh Then phiếu lưu họ tên, quan hệ, SĐT, CCCD của phụ huynh đó.
- **AC-5** (D3, D4): Given tiếp nhận, sửa hồ sơ When thiếu ô bắt buộc Then `422` theo ô `profile.x`; khai báo tiền sử còn "Chưa cung cấp" Then `422` `medicalHistory.x`.
- **AC-6** (D3, D4): Given nhập Excel When thiếu cột bắt buộc Then lỗi file; When ô trống Then dòng lỗi.
- **AC-7** (D5): Given Hiệu trưởng When lưu khai báo sức khỏe Then lưu được; giáo viên vẫn `403`.
- **AC-8** (D6): Given DB demo mới hoặc DB cũ When khởi tạo Then mọi trẻ có đủ ô bắt buộc và 3 mục tiền sử khác "Chưa cung cấp"; ô đã có giữ nguyên.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Ai điền Phần I vào phiếu | BE giả chép từ hồ sơ khi lưu và khi trả phiếu nháp | Client gửi, BE kiểm khớp | BE là nguồn; client không có quyền sửa |
| Người đi cùng | Client gửi `guardianIndex`; BE giả chép chi tiết từ hồ sơ | Client gửi cả chi tiết | Không cho nhập tay, BE quyết định dữ liệu |
| Tách plan (>8 file) | Không tách | Tách BE giả / giao diện | Một quy định xuyên suốt; tách sẽ có lúc phiếu khóa mà hồ sơ chưa bắt buộc |

## Phases

### Phase 1 — Backend giả, kiểm nhập, dữ liệu mẫu, test
- Files: M `src/utils/children/childrenValidation.js` · M `src/utils/children/healthExamValidation.js` · M `src/utils/children/childrenPermissions.js` · M `src/models/children/childrenConstants.js` · M `src/models/children/childProfile.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/mocks/childrenSeed.js` · C `tests/children/exam-admin-from-profile.test.mjs` · M `tests/children/tb-contact-date.test.mjs` · M `tests/children/guardian-citizen-id.test.mjs` · M `tests/health/follow-up-exam.test.mjs`
- Tests: AC-1…AC-8 → `tests/children/exam-admin-from-profile.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 2 — Giao diện
- Files: M `src/components/children/exam/ExamAdminStep.jsx` · M `src/components/children/ChildProfileFields.jsx` · M `src/components/children/HealthDeclarationFields.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · trang khác nếu có câu chữ cũ.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `src/services/children/api/childrenApi.js` (ghi chú contract) · M plan này.
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (gom sau khi FE hoàn thiện)

- `health` (phiếu Phụ lục II): BE chép `exam.admin` (trừ người đi cùng) từ `child.profile` khi lưu phiếu mới/nháp; bỏ qua giá trị client gửi; phiếu đã kết luận giữ bản chụp. Bỏ cập nhật ngược hồ sơ (hành chính) khi lưu kết luận. `exam.history` client gửi (GET điền sẵn từ `declaration.medicalHistory`); lưu kết luận ⇒ cập nhật `declaration.medicalHistory` có lịch sử, đổi ngày tiếp xúc lao ⇒ `CHILD_TB_CONTACT_DATE_CHANGED` (D7, như 2b và 2026-10-21).
- Người đi cùng: request nhận `hasCompanion` + `companion.guardianIndex`; BE chép họ tên, quan hệ, SĐT, CCCD từ phụ huynh của hồ sơ; thiếu/sai ⇒ `422` `exam.admin.companion`.
- `child`: tiếp nhận, nhập Excel, sửa hồ sơ bắt buộc `profile.premature`, `gestationWeeks` (khi `YES`), `ethnicity`, `beneficiary`, `paymentSource`, `address.province|ward|street`; khai báo bắt buộc 3 mục `medicalHistory` khác `NOT_PROVIDED`.
- Quyền khai báo sức khỏe: thêm Hiệu trưởng (cùng phạm vi Sửa hồ sơ).

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1…AC-8 | D1–D7 | `tests/children/exam-admin-from-profile.test.mjs` (BE giả) | 1, 4 | 8/8 pass |
| AC-2 (ngày tiếp xúc lao) | D7 | `tests/children/tb-contact-date.test.mjs` "AC-3, AC-5" (khôi phục) | 4 | pass |
| AC-1, AC-4 (giao diện) | D1, D2 | Chạy thử trình duyệt (Vite + mock): bước 1 phiếu khám Trần Khánh An | 2 | Đạt: Phần I chỉ xem, chọn người đi cùng trong phụ huynh |
| AC-5, AC-7 (giao diện) | D3, D5 | Chạy thử trình duyệt: Hiệu trưởng mở Sửa khai báo | 2 | Đạt: tiền sử chỉ Có/Không, bắt buộc |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| DB demo cũ có trẻ thiếu dữ liệu | Không sửa được hồ sơ khi chưa bổ sung | Điền đầy một lần (D6) | Revert commit |
| Phiếu cũ có người đi cùng ngoài hồ sơ | Lưu lại kết luận báo lỗi người đi cùng | Seed ch_016 đổi sang phụ huynh; phiếu thật chọn lại phụ huynh | Revert commit |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: phiếu khám web (`ExamAdminStep`), BE giả; APP không nhập phiếu khám
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã cân nhắc tách (Key decisions)
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan

## Progress log

### 2026-10-22 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: thêm `tests/children/profileFixture.mjs` (hồ sơ giả đủ ô cho các test tiếp nhận cũ); `src/pages/children/HealthExamFormPage.jsx` truyền `guardianCount` cho kiểm nhập. Test AC-3, AC-5 cũ của `tb-contact-date.test.mjs` viết lại theo D1 (phiếu không đổi khai báo, không báo đổi ngày). Câu lỗi tiền sử nêu rõ mục ("… cho tiền sử bản thân") để dòng Excel không gộp trùng.

### 2026-10-22 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Chạy thử trình duyệt (Vite, mock): giáo viên Lớp Chồi 1 mở phiếu Trần Khánh An; Hiệu trưởng mở Sửa khai báo. Chưa thử trên BE thật.
- Khác plan: sửa thêm `src/components/children/ChildProfileSummary.jsx` (câu "Chưa cung cấp" cũ nói phiếu khám sẽ hỏi).

### 2026-10-22 — Phase 3 (done)
- Commit: chưa commit
- Verify: `node scripts/check-ai-layer.mjs` → `check-ai-layer (FE): 0 lỗi, 14 cảnh báo` (cảnh báo cũ, không thuộc plan này); `node scripts/verify.mjs` → `VERIFY PASS full`
- Khác plan: cập nhật thêm `docs/quality/manual-tests/health-exam-flow.md` (mục I, T5, T11), `src/services/children/api/healthCheckApi.js`, `src/models/children/childProfile.js` (ghi chú contract).
- Tiếp: gửi mục "Đề xuất cho BE" cho nhóm BE khi user cho phép.

### 2026-10-22 — Phase 4: D7 tiền sử sửa được ở phiếu khám (done)
- Commit: chưa commit
- User (sau Phase 3): "phần tiền sử tại mục khám sức khỏe vẫn cho sửa và sẽ thay đổi luôn trong khai báo sức khỏe của trẻ khi lưu phiếu khám".
- Files: M `src/components/children/exam/ExamAdminStep.jsx` · M `src/utils/children/healthExamValidation.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/components/children/HealthDeclarationFields.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · M `src/services/children/api/healthCheckApi.js` · M `src/services/children/api/childrenApi.js` · M `src/models/children/childProfile.js` · M `tests/children/exam-admin-from-profile.test.mjs` · M `tests/children/tb-contact-date.test.mjs` · M `docs/features/README.md` · M `docs/quality/manual-tests/health-exam-flow.md` · M plan này.
- Verify: `node scripts/check-ai-layer.mjs` → `check-ai-layer (FE): 0 lỗi, 14 cảnh báo`; `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
