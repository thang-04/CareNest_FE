---
title: Tự công bố mọi kết quả sức khỏe; ghi ý kiến phụ huynh tại buổi khám
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health]
rules: []
risk: medium
created: 2026-10-23
updated: 2026-10-23
---

# Tự công bố mọi kết quả sức khỏe; ghi ý kiến phụ huynh tại buổi khám

## Context

- User (2026-10-23): "chuyển hết mọi trường hợp sẽ tự công bố cho phụ huynh".
- Hiện tại chỉ phiếu khám có người đi cùng tự công bố khi lưu kết luận (`src/services/children/mock/healthExamMockRepository.js:540-543`). Các kết quả khác giáo viên bấm "Công bố": phiếu khám không có người đi cùng (`src/pages/children/HealthExamFormPage.jsx:447-480`), cân đo ngoài đợt (`src/pages/children/HealthMeasurementFormPage.jsx:179-235`), mẫu cũ và mọi dòng ở Sổ sức khỏe (`src/pages/children/ChildHealthRecordPage.jsx:380-396`). API `publishMeasurement` (`src/services/children/mock/childrenMockRepository.js:1306-1330`).
- Sửa kết quả đã công bố thì về "Chưa công bố" (`childrenMockRepository.js:1300`, `healthExamMockRepository.js:533`).
- Kết quả "Cần theo dõi sát" chỉ công bố sau khi giáo viên ghi trao đổi trong phiếu theo dõi (`src/services/children/mock/healthCheckRule.js:277-286`, user chốt 2026-10-16). Phiếu có người đi cùng thì hệ thống ghi sẵn lần trao đổi tại buổi khám, ghi chú là tóm tắt kết luận (`healthCheckRule.js:137-147`, `:161-175`).
- Danh sách lớp của đợt khám có bộ lọc "Phụ huynh: Đã/Chưa công bố" (`src/components/children/HealthCheckClassRoster.jsx:21-22`, `:44`, `:97-105`).

## Quyết định đã chốt

1. D1 — Mọi kết quả tự công bố cho phụ huynh khi lưu: phiếu khám (lưu kết luận, có hay không có người đi cùng), cân đo ngoài đợt. Phiếu nháp không công bố. Bỏ nút "Công bố". Bỏ điều kiện "Cần theo dõi sát phải trao đổi trước khi công bố" (thay quyết định 2026-10-16) — user, 2026-10-23.
2. D2 — Kết quả "Cần theo dõi sát" (nguy cơ lao, chuyển khám chuyên khoa, hoặc trẻ đang có phiếu theo dõi) có người đi cùng: bước kết luận có ô **"Ý kiến phụ huynh"**, bắt buộc; ghi vào lần trao đổi tại buổi khám của phiếu theo dõi — user, 2026-10-23.
3. D3 — Phiếu khám "Cần theo dõi sát" ghi trạng thái trao đổi: có người đi cùng ⇒ "Đã trao đổi phụ huynh"; không có ⇒ "Chưa trao đổi phụ huynh", tới khi giáo viên ghi trao đổi trong phiếu theo dõi thì thành "Đã trao đổi phụ huynh" — user, 2026-10-23.
4. D4 — Trạng thái trao đổi chỉ hiện trên phiếu khám. Sổ sức khỏe và danh sách lớp chỉ còn "Đã công bố"; bỏ bộ lọc "Phụ huynh" ở danh sách lớp — user, 2026-10-23.
5. D5 — Kết quả đang "Chưa công bố" (mẫu cũ, cân đo ngoài đợt, phiếu khám không có người đi cùng) công bố hết một lần — user, 2026-10-23.
6. D6 — Sửa kết quả đã công bố: lưu là công bố lại bản mới, phụ huynh nhận thông báo kết quả đã cập nhật; lịch sử sửa giữ như cũ — user, 2026-10-23.

**Mặc định (tự chọn, user đổi được):**
- Ý kiến phụ huynh tối đa 500 ký tự. Lưu lại phiếu đã kết luận (sửa) thì cập nhật ghi chú của lần trao đổi tại buổi khám.
- "Đã trao đổi phụ huynh" khi không có người đi cùng: lần trao đổi đầu tiên ghi trong phiếu theo dõi sau lần khám này; hiện ngày trao đổi.
- Mẫu cũ, cân đo ngoài đợt không có trạng thái trao đổi (không phải phiếu khám).
- Dữ liệu cũ (D5): ngày công bố = ngày kết luận (phiếu khám) hoặc ngày tạo; không gửi thông báo.
- Thông báo cho phụ huynh (D1, D6) do BE/app gửi; web demo không có tài khoản phụ huynh ⇒ ghi "Đề xuất cho BE".

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor giáo viên phụ trách lớp (nhập phiếu, cân đo, ghi trao đổi) · outcome phụ huynh luôn thấy kết quả ngay khi lưu; giáo viên biết phiếu nào chưa trao đổi · rule BE: chưa có (PROPOSED từ 2026-10-16, 2026-10-17) · flow `[S]` lưu kết luận / lưu cân đo / sửa → `[S]` công bố.
- **Đối chiếu thiết kế ban đầu:** `docs/features/README.md:113` "không có người đi cùng thì giáo viên công bố sau khi ghi trao đổi" — đảo theo D1. `src/services/children/mock/healthCheckRule.js:277` "Cần theo dõi sát chỉ công bố sau khi ghi trao đổi (2026-10-16)" — bỏ theo D1.
- **Ảnh hưởng:** module health · `FE: /children/:id/health`, `/children/:id/health/new`, `/children/:id/health/:measurementId/edit`, phiếu khám và danh sách lớp trong `/children/health-checks/:id`, `/children/health-follow-ups/:id` (câu hướng dẫn) · quyền không đổi · `APP`: phụ huynh nhận kết quả sớm hơn, nhận thông báo cập nhật · contract: bỏ endpoint công bố, thêm `exam.conclusion.parentOpinion`, `parentContact`.

### Câu hỏi mở

Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| "Cần theo dõi sát" tự công bố thế nào? | Vẫn tự công bố; buổi khám ghi ý kiến phụ huynh; phiếu ghi Đã/Chưa trao đổi | user | 2026-10-23 | `docs/features/README.md` |
| Kết quả đang chưa công bố? | Công bố hết ngay | user | 2026-10-23 | plan này |
| Sửa kết quả đã công bố? | Tự công bố lại, báo phụ huynh | user | 2026-10-23 | `docs/features/README.md` |
| Cột/bộ lọc "Phụ huynh"? | Giữ cột "Đã công bố"; trạng thái trao đổi chỉ trên phiếu khám; bỏ bộ lọc | user | 2026-10-23 | `docs/features/README.md` |
| Ô ý kiến phụ huynh? | Có người đi cùng thì bắt buộc | user | 2026-10-23 | `docs/features/README.md` |
| Không người đi cùng, ghi trao đổi sau? | Đổi thành "Đã trao đổi phụ huynh" | user | 2026-10-23 | `docs/features/README.md` |

## Acceptance criteria

- **AC-1** (D1): Given phiếu khám (có hoặc không có người đi cùng, mọi mức) When lưu kết luận Then `published = true`; phiếu nháp `published = false`.
- **AC-2** (D1): Given cân đo ngoài đợt When lưu mới Then `published = true`. API công bố riêng không còn.
- **AC-3** (D6): Given kết quả đã công bố When sửa (cân đo hoặc phiếu khám) Then vẫn `published = true`, `publishedAt` mới, lịch sử sửa có lý do.
- **AC-4** (D2): Given có người đi cùng và kết luận Cần theo dõi sát When thiếu ý kiến phụ huynh Then `422` `exam.conclusion.parentOpinion`; When có Then lần trao đổi tại buổi khám ghi ý kiến; kết luận không Cần theo dõi sát hoặc không người đi cùng thì ô bị bỏ.
- **AC-5** (D3): Given phiếu Cần theo dõi sát When có người đi cùng Then `parentContact.contacted = true`, `atExam = true`; When không có Then `contacted = false` tới khi giáo viên ghi trao đổi trong phiếu theo dõi, sau đó `contacted = true` kèm ngày. Phiếu không Cần theo dõi sát: `parentContact = null`.
- **AC-6** (D5): Given DB demo có kết quả chưa công bố (không phải nháp) When khởi tạo Then tất cả đã công bố; phiếu nháp giữ nguyên.
- **AC-7** (D4): Sổ sức khỏe, danh sách lớp không còn nút "Công bố"/"Ghi trao đổi để công bố"; danh sách lớp không còn bộ lọc "Phụ huynh"; phiếu khám hiện "Đã/Chưa trao đổi phụ huynh" khi Cần theo dõi sát.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Ai xác định cần ý kiến phụ huynh | Hàm dùng chung `needsParentOpinion` trong kiểm nhập (FE hiện ô, BE giả kiểm 422) | Gọi BE xem trước mức theo dõi | Kiểm nhập phiếu đã dùng chung cho FE và BE giả; quy tắc mức theo dõi theo kết luận đã chốt (D9 2026-10-15, 2026-10-21) |
| Trạng thái trao đổi | BE giả trả `parentContact` trong kết quả | Client tự đọc phiếu theo dõi | BE là nguồn; client không tính trạng thái nghiệp vụ |
| Tách plan (>8 file) | Không tách | Tách BE giả / giao diện | Một quy định; tách sẽ có lúc giao diện còn nút công bố mà API đã bỏ |

## Phases

### Phase 1 — Backend giả, kiểm nhập, dữ liệu mẫu, test
- Files: M `src/services/children/mock/healthCheckRule.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/models/children/healthCheckConstants.js` · M `src/models/children/healthExamForm.js` · M `src/utils/children/healthExamValidation.js` · M `src/utils/children/childrenPermissions.js` · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js` · M `src/services/children/api/healthCheckApi.js` · M `src/mocks/childrenSeed.js` · C `tests/health/auto-publish.test.mjs` · M `tests/health/follow-up-exam.test.mjs`
- Tests: AC-1…AC-6 → `tests/health/auto-publish.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 2 — Giao diện
- Files: M `src/pages/children/HealthExamFormPage.jsx` · M `src/components/children/exam/ExamConclusionStep.jsx` · M `src/components/children/exam/ExamSummary.jsx` · M `src/components/children/ChildBadges.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/components/children/HealthCheckClassRoster.jsx` · M `src/pages/children/HealthCheckDetailPage.jsx` · M `src/pages/children/HealthFollowUpDetailPage.jsx`
- Tests: AC-7 → chạy thử trình duyệt (Vite + mock).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `docs/quality/manual-tests/health-exam-flow.md` · M plan này.
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (gom sau khi FE hoàn thiện)

- `health`: lưu kết luận phiếu khám, lưu/sửa cân đo ⇒ công bố ngay (`published = true`, `publishedAt`); phiếu nháp không công bố. Bỏ `POST /children/{id}/health/measurements/{measurementId}/publish` và `publishBlockedReason`. Sửa kết quả đã công bố ⇒ công bố lại, gửi phụ huynh thông báo "kết quả đã cập nhật".
- Phiếu khám: thêm `exam.conclusion.parentOpinion` (≤500), bắt buộc khi có người đi cùng và kết luận ở mức Cần theo dõi sát (`422` `exam.conclusion.parentOpinion`), bỏ khi không cần; ghi vào ghi chú lần trao đổi tại buổi khám của phiếu theo dõi.
- Kết quả phiếu khám trả `parentContact: { contacted, atExam, on, opinion } | null` (null khi không Cần theo dõi sát).
- Dữ liệu cũ: công bố mọi kết quả đã kết luận/cân đo chưa công bố, không gửi thông báo.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1…AC-6 | D1–D3, D5, D6 | `tests/health/auto-publish.test.mjs` (BE giả) | 1 | 7/7 pass |
| AC-7 | D4 | Chạy thử trình duyệt: Sổ sức khỏe, phiếu khám, danh sách lớp | 2 | Đạt |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Phụ huynh đọc "Cần theo dõi sát" trước khi giáo viên gọi | Phụ huynh lo lắng | Phiếu ghi "Chưa trao đổi phụ huynh"; phiếu theo dõi vẫn hạn 7 ngày trao đổi | Revert commit |
| DB demo đã công bố hết (D5) | Không quay lại "Chưa công bố" | Chỉ dữ liệu giả | Xóa DB demo trong trình duyệt |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: Sổ sức khỏe, form cân đo, phiếu khám web; APP phụ huynh đọc `published`
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã cân nhắc tách (Key decisions)
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan

## Progress log

### 2026-10-23 — Phase 1 (done)
- Commit: chưa commit
- Verify: chạy chung với Phase 2 (giao diện còn gọi API công bố đã bỏ nên build chỉ qua khi xong Phase 2). Test riêng: `node --import ./scripts/register-auth-test-loader.mjs --test tests/health/*.test.mjs tests/children/*.test.mjs` → 44 pass, 0 fail.
- Khác plan: nâng seed sức khỏe lên v12 để DB demo cũ nhận ý kiến phụ huynh mẫu; sửa thêm `src/models/children/childrenConstants.js` (typedef `parentContact`), `src/mocks/healthCheckSeed.js` (ghi chú trao đổi mẫu có ý kiến phụ huynh). Bỏ `canPublishMeasurement`.

### 2026-10-23 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Chạy thử trình duyệt (Vite, mock, DB demo cũ v11): DB nâng lên v12, chỉ còn phiếu nháp chưa công bố; Sổ sức khỏe không còn nút Công bố. Phiếu khám Chồi 1 có người đi cùng + chuyển khám hiện ô *Ý kiến phụ huynh* bắt buộc. Phiếu mẫu Vũ Tuấn Kiệt (có người đi cùng): *Đã trao đổi phụ huynh* + ý kiến. Phiếu Ngô Hoàng Nam (không người đi cùng): *Chưa trao đổi phụ huynh*; ghi trao đổi ở phiếu theo dõi ⇒ *Đã trao đổi phụ huynh*, ngày 23/10/2026. Danh sách lớp không còn bộ lọc Phụ huynh. Chưa thử trên BE thật.
- Khác plan: ô Ý kiến phụ huynh thêm khoảng cách trên (`mt-12`) sau khi xem ảnh chụp.

### 2026-10-23 — Phase 3 (done)
- Commit: chưa commit
- Tài liệu: `docs/features/README.md`, `docs/quality/manual-tests/health-exam-flow.md`. Plan chuyển sang `docs/plans/completed/`.
