---
title: Sức khỏe — phiếu theo dõi dài hạn, hạn trao đổi, dùng kết quả khám bên ngoài
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: feature/FE-FEAT-43-child-health-pickup
modules: [health, child]
rules: [HLT-01]
risk: high           # dữ liệu sức khỏe, đổi vòng đời phiếu, chặn công bố cho phụ huynh, nâng cấp dữ liệu demo, contract PROPOSED
created: 2026-10-16
updated: 2026-10-16
---
# Sức khỏe — phiếu theo dõi dài hạn, hạn trao đổi, dùng kết quả khám bên ngoài

> 2026-10-17: hạn trao đổi 7 ngày và chặn công bố (quyết định 1–2) chỉ còn áp khi phiếu khám không có người đi cùng; kết quả khám bên ngoài thêm chuyên khoa / nơi khám, ảnh và nhắc sau 30 ngày — [plan phiếu khám Phụ lục II](2026-10-17-health-exam-form-doctor-conclusion.md).

Plan chỉ phần client. BE chưa có API health; FE dẫn nghiệp vụ, BE làm theo sau (user chốt 2026-10-15). Plan này nối tiếp `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md` (phiếu theo dõi, đề xuất HLT-09).

## Context
User rà luồng phiếu theo dõi (2026-10-16) và thấy ghi trao đổi hay ghi kết quả khám bên ngoài không có tác dụng gì. Hiện trạng:
- Phiếu chỉ có 1 lần trao đổi và 1 kết quả khám bên ngoài (`src/services/children/mock/healthCheckMockRepository.js:470-506`). Trạng thái chỉ dùng để đếm (`:144`, `:414`, `:457`).
- Lần khám sau lại "Cần theo dõi sát" khi phiếu đã qua bước trao đổi: kết quả được ghi thêm, nhưng không ghi được lần trao đổi mới (`FE-CASE-261016-health-follow-up-repeat-close-watch`).
- Trẻ nghỉ học khi phiếu còn mở: không ai đóng được phiếu (`FE-CASE-261016-health-follow-up-child-withdrawn`).
- Công bố kết quả không phụ thuộc phiếu (`src/services/children/mock/childrenMockRepository.js:808-823`).
- Lời bác sĩ chuyên khoa chỉ nằm trong phiếu (`src/pages/children/HealthFollowUpDetailPage.jsx:291-311`).

## Quyết định đã chốt
Nguồn: user, 2026-10-16, mức PROPOSED (chưa ghi vào BE). Không đảo khi chưa hỏi user.
1. **Hạn trao đổi 7 ngày.** Phiếu chờ trao đổi quá hạn: nhắc giáo viên, báo Hiệu trưởng và Phó hiệu trưởng, danh sách hiện "Quá hạn". Ghi trao đổi thì dừng nhắc.
2. **Trao đổi trước khi công bố.** Kết quả "Cần theo dõi sát" chỉ công bố được cho phụ huynh sau khi giáo viên ghi trao đổi trong phiếu.
3. **Dùng kết quả khám bên ngoài.** Lời bác sĩ chuyên khoa hiện ở Sổ sức khỏe và ở đợt khám sau (form nhập, danh sách trẻ cần theo dõi). Có ngày hẹn khám lại thì tới ngày đó nhắc giáo viên hỏi phụ huynh.
4. **1 phiếu dài hạn cho mỗi trẻ.** Phiếu ghi được nhiều lần trao đổi và nhiều kết quả khám bên ngoài. Kết quả "Cần theo dõi sát" mới đưa phiếu về "Chờ trao đổi phụ huynh". Trang chi tiết dạng dòng thời gian. (User không chọn đề xuất "mỗi vòng 1 phiếu".)
5. **Trẻ nghỉ học khi phiếu còn mở:** hệ thống tự đóng phiếu, lý do "Trẻ nghỉ học: <lý do nghỉ>". Hộp xác nhận cho nghỉ học báo trước.
6. **Câu chữ:** thêm "Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường." ở hộp xác nhận đóng phiếu, khối đóng phiếu và danh sách phiếu; bỏ câu nhắc "khi không cần theo dõi thêm".
7. Không làm: ghi "phụ huynh đồng ý / chưa đồng ý đưa trẻ đi khám" (user không chọn).

**Mặc định đề xuất, duyệt cùng plan:**
- **Vòng theo dõi** bắt đầu khi phiếu mở hoặc khi có kết quả "Cần theo dõi sát" mới. Trạng thái phiếu = tiến độ của vòng hiện tại.
- **Hạn** = ngày bắt đầu vòng + 7 ngày. Quá hạn khi hôm nay sau hạn mà vòng chưa có trao đổi. Mỗi vòng nhắc 1 lần.
- **Ghi trao đổi** được ở mọi trạng thái chưa đóng. Ngày trao đổi không trước ngày khám của kết quả mở vòng, không ở tương lai.
- **Ghi kết quả khám bên ngoài** khi vòng hiện tại đã có trao đổi, ghi nhiều lần được. Ngày hẹn khám lại tùy chọn, phải sau ngày khám.
- **Kết quả "Cần theo dõi sát" mới khi vòng hiện tại chưa trao đổi** được gộp vào vòng đó: không lùi hạn, không gửi thêm thông báo.
- **Nhắc ngày hẹn khám lại**: 1 lần cho mỗi kết quả khám bên ngoài, khi phiếu còn mở và chưa có kết quả khám bên ngoài mới hơn ngày hẹn.
- **Công bố** kết quả "Cần theo dõi sát" được khi phiếu chứa kết quả đã đóng, hoặc đã có trao đổi ghi sau khi kết quả vào phiếu.
- **Phiếu đã đóng**, lần khám sau lại "Cần theo dõi sát": mở phiếu mới (giữ như cũ).
- **Thông báo khi phiếu mở hoặc vào vòng mới**: Hiệu trưởng, Phó hiệu trưởng điểm trường (như cũ) và giáo viên lớp (trừ người vừa lưu).
- Mock không có job chạy nền: nhắc được tạo khi có thao tác đọc dữ liệu sức khỏe. BE chạy job hằng ngày.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: giáo viên phụ trách lớp (cập nhật phiếu, công bố kết quả); Hiệu trưởng, Phó hiệu trưởng (xem, nhận nhắc quá hạn); Hiệu trưởng, Phó hiệu trưởng điểm trường (cho trẻ nghỉ học).
  - Outcome: mỗi kết quả "Cần theo dõi sát" được trao đổi với phụ huynh trong hạn, trước khi phụ huynh xem trên APP; lời bác sĩ chuyên khoa đi theo trẻ tới đợt khám sau.
  - Rule: HLT-01 (CONFIRMED, cần mở rộng) · HLT-09 (đề xuất trong plan trước, chưa có ở BE).
  - Flow: `[S]` lưu kết quả "Cần theo dõi sát" ⇒ phiếu mở hoặc vào vòng mới, hạn 7 ngày → `[B]` giáo viên trao đổi với phụ huynh → `[S]` ghi trao đổi ⇒ được công bố → `[S]` công bố → `[B]` phụ huynh đưa trẻ đi khám → `[S]` ghi kết quả khám bên ngoài (+ ngày hẹn) → `[S]` nhắc ngày hẹn → `[S]` đợt khám sau hiện lời bác sĩ → `[S]` giáo viên đóng phiếu (lý do).
- **Đối chiếu thiết kế ban đầu:** plan trước chốt "mỗi trẻ 1 phiếu chưa đóng, ghi thêm kết quả" và mỗi bước ghi 1 lần (`docs/plans/completed/2026-10-15-health-check-campaign-assessment.md:42`, `:54`). User đổi sang phiếu dài hạn, ghi nhiều lần (2026-10-16). BE chưa có rule phiếu.
- **Ảnh hưởng:**
  - FE: `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId`, `/children/:id/health`, `/children/:id/health/new` và `/edit`, `/children/health-checks/:campaignId`, danh sách trẻ (cho nghỉ học).
  - Quyền không đổi.
  - Dữ liệu cũ: phiếu trong localStorage đổi dạng (seed v4, chuyển nội dung sang dòng thời gian).
  - APP: phụ huynh chỉ thấy kết quả đã công bố; việc chặn công bố làm kết quả "Cần theo dõi sát" tới phụ huynh sau khi giáo viên đã trao đổi.

### Câu hỏi mở
Không còn câu hỏi mở.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Phiếu có tác dụng nào? | Hạn trao đổi 7 ngày; trao đổi trước khi công bố; dùng kết quả khám bên ngoài | user | 2026-10-16 | Đề xuất cho BE (HLT-09) |
| Lần khám sau lại "Cần theo dõi sát" khi phiếu đã qua bước trao đổi | 1 phiếu dài hạn mỗi trẻ | user | 2026-10-16 | Đề xuất cho BE (HLT-09) |
| Trẻ nghỉ học khi phiếu còn mở | Tự đóng phiếu | user | 2026-10-16 | Đề xuất cho BE (HLT-09) |
| Câu "đóng phiếu không có nghĩa là đã khỏe" | Thêm | user | 2026-10-16 | — |

## Acceptance criteria
- **AC-1** (`HLT-01`): Given trẻ chưa có phiếu mở, When lưu kết quả "Cần theo dõi sát", Then có phiếu "Chờ trao đổi phụ huynh", hạn = ngày lưu + 7 ngày. Hiệu trưởng, Phó hiệu trưởng và giáo viên lớp (trừ người lưu) nhận thông báo.
- **AC-2**: Given phiếu đang mở, When lưu kết quả "Cần theo dõi sát" mới, Then không có phiếu thứ hai và dòng thời gian có kết quả mới. Nếu vòng hiện tại đã trao đổi: phiếu về "Chờ trao đổi phụ huynh" với hạn mới, Hiệu trưởng và Phó hiệu trưởng nhận thông báo. Nếu chưa trao đổi: giữ hạn cũ.
- **AC-3**: Given phiếu chờ trao đổi đã quá hạn, Then phiếu có cờ quá hạn kèm số ngày. Danh sách có ô "Quá hạn" và lọc được. Giáo viên lớp, Hiệu trưởng, Phó hiệu trưởng nhận nhắc đúng 1 lần mỗi vòng.
- **AC-4**: Given phiếu mở, When giáo viên ghi trao đổi nhiều lần, Then mỗi lần thêm vào dòng thời gian. Lần đầu của vòng chuyển phiếu sang "Đã trao đổi" và hết quá hạn. Ngày trao đổi trước ngày bắt đầu vòng ⇒ 422.
- **AC-5**: Given vòng hiện tại chưa có trao đổi, When ghi kết quả khám bên ngoài, Then 409. Given đã có trao đổi, Then ghi được nhiều lần, kèm ngày hẹn khám lại tùy chọn (trước ngày khám ⇒ 422).
- **AC-6**: Given kết quả "Cần theo dõi sát" mà phiếu đang mở chưa có trao đổi ghi sau khi kết quả vào phiếu, When công bố, Then 409. UI không cho bấm công bố và có link tới phiếu. Sau khi ghi trao đổi, hoặc khi phiếu đã đóng ⇒ công bố được.
- **AC-7**: Given trẻ có kết quả khám bên ngoài, Then Sổ sức khỏe có mục "Kết quả khám chuyên khoa (phụ huynh báo lại)". Form nhập kết quả hiện lời bác sĩ gần nhất. Tab "Trẻ cần theo dõi" và danh sách trẻ của đợt hiện phiếu đang mở (cờ quá hạn, lời bác sĩ gần nhất).
- **AC-8**: Given ngày hẹn khám lại ≤ hôm nay, phiếu còn mở, chưa có kết quả khám bên ngoài mới hơn, Then giáo viên lớp nhận nhắc đúng 1 lần.
- **AC-9**: Given trẻ có phiếu mở, When cho trẻ nghỉ học, Then hộp xác nhận báo trước; phiếu tự đóng với lý do "Trẻ nghỉ học: <lý do>". DB cũ có trẻ đã nghỉ mà phiếu còn mở ⇒ phiếu được đóng khi nâng cấp.
- **AC-10**: Câu "Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường." có ở hộp xác nhận đóng phiếu, khối đóng phiếu, danh sách phiếu. Không còn câu "khi không cần theo dõi thêm".
- **AC-11**: DB demo cũ (phiếu v3: 1 `contact`, 1 `externalResult`) mở được, giữ nội dung, trạng thái tính lại theo vòng.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Vòng đời phiếu khi lần khám sau lại "Cần theo dõi sát" | 1 phiếu dài hạn, vòng mới | Mỗi vòng 1 phiếu (đề xuất ban đầu) | User chọn 2026-10-16 |
| Lưu nội dung phiếu | Dòng thời gian `history`, mỗi sự kiện mang dữ liệu (ngày, nội dung, ngày hẹn, kết quả) | Mảng riêng cho trao đổi và kết quả khám bên ngoài | Một nguồn cho dòng thời gian; vòng và trạng thái tính lại từ đó; BE trả `timeline[]` |
| Trạng thái phiếu | Tính từ dòng thời gian, lưu lại sau mỗi thay đổi để lọc | Đổi tay theo từng hành động | Không lệch khi nâng cấp dữ liệu cũ |
| Nhắc việc trong mock | Tạo khi đọc dữ liệu sức khỏe | Timer trong trình duyệt | Mock không có job; BE chạy job hằng ngày |

## Phases
### Phase 1 — Backend giả: vòng theo dõi, hạn, nhắc, chặn công bố, nghỉ học, nâng cấp dữ liệu
- Files: M `src/services/children/mock/healthCheckRule.js` · M `src/services/children/mock/healthCheckMockRepository.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/mocks/healthCheckSeed.js` · M `src/utils/children/childrenValidation.js` · M `src/models/children/healthCheckConstants.js` · M `src/services/children/api/healthCheckApi.js`
- Tests: kịch bản backend giả trong scratchpad cho AC-1..AC-9, AC-11; bộ kịch bản cũ.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
### Phase 2 — Giao diện
- Files: M `src/pages/children/HealthFollowUpDetailPage.jsx` (dòng thời gian) · M `src/pages/children/HealthFollowUpListPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/pages/children/HealthCheckDetailPage.jsx` · M `src/components/children/HealthCheckClassRoster.jsx` · M `src/components/children/WithdrawChildModal.jsx` · M `src/components/children/ChildBadges.jsx` · M `src/styles/modules/children.css`
- Tests: AC-6, AC-7, AC-10 qua kịch bản và đọc lại câu chữ; tự kiểm `DESIGN.md` 13.1.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
### Phase 3 — Tài liệu
- Files: 2 incident `FE-CASE-261016-*` (đổi `fixed`), `docs/knowledge/ISSUE_INDEX.md`, `.ai/CONTEXT_MAP.yaml` (từ khóa), `docs/features/README.md`, plan trước (trỏ sang plan này).
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (chưa sửa repo BE — cần user cho phép)
Cập nhật HLT-09 đề xuất ở plan trước:
- Mỗi trẻ tối đa 1 phiếu chưa đóng, phiếu dài hạn. Kết quả "Cần theo dõi sát" mới mở vòng mới: trạng thái về "Chờ trao đổi phụ huynh", hạn mới = ngày bắt đầu vòng + 7 ngày.
- Dòng thời gian: `OPENED`/`MEASUREMENT_ADDED` (measurementId) · `PARENT_CONTACTED` (on, note) · `EXTERNAL_RESULT` (on, note, nextVisitOn?) · `OVERDUE_REMINDED` · `NEXT_VISIT_REMINDED` · `CLOSED` (reason, auto?).
- Kết quả "Cần theo dõi sát" chỉ công bố khi phiếu đã đóng hoặc có trao đổi sau khi kết quả vào phiếu (409 nếu chưa).
- Cho trẻ nghỉ học tự đóng phiếu đang mở.
- Job hằng ngày: nhắc quá hạn (giáo viên lớp, Hiệu trưởng, Phó hiệu trưởng điểm trường), nhắc ngày hẹn khám lại (giáo viên lớp).
- Contract PROPOSED (`src/services/children/api/healthCheckApi.js`): `POST /health-follow-ups/{id}/parent-contacts` `{contactedOn, note}` · `POST /health-follow-ups/{id}/external-results` `{resultOn, note, nextVisitOn?}` · `GET /health-follow-ups?overdue=true` · view phiếu có `currentRound {startedAt, dueOn, contacted, overdueDays}`, `timeline[]`, `latestExternalResult` · kết quả khám có `publishBlockedReason` · Sổ sức khỏe có `externalResults[]`.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-5, AC-8 | HLT-09 (đề xuất) | Kịch bản backend giả (scratchpad) | 1 | Đạt (trong 25/25 kịch bản) |
| AC-6 | HLT-09 (đề xuất) | Kịch bản backend giả + UI | 1, 2 | Đạt backend; UI đổi nút công bố thành link phiếu; chưa kiểm trên trình duyệt |
| AC-7 | HLT-09 (đề xuất) | Kịch bản backend giả + UI | 1, 2 | Đạt backend; UI Sổ sức khỏe, form nhập, đợt khám; chưa kiểm trên trình duyệt |
| AC-9 | HLT-09 (đề xuất) | Kịch bản backend giả + UI | 1, 2 | Đạt backend; hộp xác nhận nghỉ học có cảnh báo; chưa kiểm trên trình duyệt |
| AC-10 | — | Đọc lại câu chữ (grep) | 2 | Đạt: câu có ở 3 chỗ, không còn "không cần theo dõi thêm" |
| AC-11 | — | Kịch bản DB v3 giả lập | 1 | Đạt 11/11 |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Chặn công bố làm phụ huynh nhận kết quả "Cần theo dõi sát" chậm | Phụ huynh chờ lâu | Hạn 7 ngày và nhắc; nút công bố nói rõ cần ghi trao đổi, có link phiếu | Bỏ kiểm tra trong `publishMeasurement` |
| Nhắc tạo khi đọc (mock) khác job BE | Demo thấy nhắc khi mở trang | Ghi rõ trong plan, đề xuất BE | — |
| Nâng cấp phiếu cũ trong localStorage | Mất nội dung trao đổi cũ | Chuyển `contact`/`externalResult` vào dòng thời gian; kịch bản DB v3 | Xóa localStorage để seed lại |
| Nhiều thông báo | Người dùng bị làm phiền | Mỗi vòng nhắc quá hạn 1 lần; mỗi kết quả khám bên ngoài nhắc ngày hẹn 1 lần | Tắt nhắc trong mock |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `healthCheckApi` → `healthCheckService` → `useHealthChecks` → các trang phiếu
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách plan vì giao diện phụ thuộc dạng dữ liệu mới của Phase 1; 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (ngưỡng sàng lọc vẫn là ngưỡng tạm, P-13)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan
- Duyệt: user duyệt trước mọi plan làn L và yêu cầu code liên tục tới khi xong (2026-10-15).

## Progress log
### 2026-10-16 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: kịch bản phiếu dài hạn 25/25; nâng cấp DB v3 11/11; bộ kịch bản cũ 44/44 (cập nhật theo dạng dòng thời gian); nâng cấp DB v1 đạt; số liệu các đợt đã đóng không đổi.
- Khác plan:
  - Ngày trao đổi so với ngày khám của kết quả mở vòng (không phải ngày lưu), để ghi được lần trao đổi ngay trong ngày khám.
  - Kết quả mới khi vòng chưa trao đổi được gộp vào vòng đó (không lùi hạn), để hạn trao đổi không bị kéo dài và cờ quá hạn không bị xóa.
  - Seed: kết quả tháng 9 của 2 trẻ có phiếu chờ trao đổi chuyển thành chưa công bố, cho khớp quy tắc mới.
  - Sửa thêm lỗi ngày UTC trong `childrenValidation.js` (`FE-BUG-261016-utc-today-date-validation`).

### 2026-10-16 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: tự kiểm `DESIGN.md` 13.1 trên file đã sửa: 0 mã màu, 0 px mới, 0 import Tabler, 0 `style={{}}` mới. Chưa kiểm thủ công trên trình duyệt (phiên không có công cụ trình duyệt).
- Khác plan: bỏ thanh 4 bước ở trang chi tiết phiếu; dùng dòng thời gian và khối "Tình hình hiện tại".

### 2026-10-16 — Phase 3 (done) + đóng plan
- Commit: chưa commit
- Verify: xem dòng VERIFY trong báo cáo cuối của lượt này; `node scripts/check-ai-layer.mjs` 0 lỗi.
- Nội dung: 2 incident `FE-CASE-261016-*` chuyển `fixed`; thêm `FE-BUG-261016-utc-today-date-validation`; `ISSUE_INDEX.md`; `.ai/CONTEXT_MAP.yaml`; `docs/features/README.md`; plan 2026-10-15 trỏ sang plan này.
- Tiếp: user kiểm trên trình duyệt; xin phép sửa repo BE để ghi HLT-09 bản phiếu dài hạn.
