---
title: Khai báo sức khỏe — ngày tiếp xúc người bệnh lao gần nhất, báo khi đổi ngày
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none / FE-FEAT-43   # mã Jira hỏi khi user yêu cầu commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, health]
rules: [HLT-01]
risk: high           # dữ liệu sức khỏe; thêm field vào khai báo và phiếu khám (contract PROPOSED); thêm thông báo; đổi quyết định 3b (phiếu khám cập nhật ngược không báo)
created: 2026-10-21
updated: 2026-10-21
---
# Khai báo sức khỏe — ngày tiếp xúc người bệnh lao gần nhất, báo khi đổi ngày

Plan chỉ phần client; FE dẫn nghiệp vụ bằng backend giả, BE làm theo sau (như plan sức khỏe, user chốt 2026-10-17). User yêu cầu 2026-10-21: tích "Có tiếp xúc người bệnh lao" thì khai ngày; phiếu khám tự điền; ngày tiếp xúc thay đổi thì báo Hiệu trưởng, Phó hiệu trưởng điểm trường.

## Luồng (đã chốt)
### A. Khai báo
1. **Chọn "Có" ở "Tiền sử tiếp xúc với người bệnh lao"** (form Khai báo sức khỏe và bước khai báo khi tiếp nhận). Hiện ô "Ngày tiếp xúc gần nhất", bắt buộc, chọn ngày đầy đủ; không nhớ chính xác thì ghi ngày ước lượng theo lời phụ huynh (D1, D4). Ngày không ở tương lai, không trước ngày sinh.
2. **Nhập Excel.** Thêm cột "Ngày tiếp xúc người bệnh lao gần nhất (dd/mm/yyyy)"; cột "Tiếp xúc người bệnh lao" là "Có" mà thiếu ngày ⇒ dòng lỗi (D2).
3. **Lưu lần đầu "Có"** ⇒ báo như hiện nay (Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp, trừ người lưu), câu báo có thêm ngày tiếp xúc.

### B. Phiếu khám
4. **Phiếu khám điền sẵn** "Tiền sử tiếp xúc với người bệnh lao" và ngày tiếp xúc từ khai báo (khai báo trống thì lấy từ phiếu khám gần nhất, như các mục tiền sử khác). Giáo viên hỏi lại, sửa được. Chọn "Có" thì ngày bắt buộc; không sau ngày khám (D2).
5. **Lưu kết luận** ⇒ cập nhật ngược vào khai báo như hiện nay (2b).

### C. Báo khi đổi ngày
6. **Đã có ngày mà ngày mới khác ngày cũ** — dù đổi ở Khai báo sức khỏe hay khi lưu kết luận phiếu khám — báo Hiệu trưởng và Phó hiệu trưởng điểm trường, trừ người lưu; không báo giáo viên. Câu báo nêu ngày cũ, ngày mới và nơi đổi (D3). Thay một phần quyết định 3b ("cập nhật từ phiếu khám không báo"): chỉ việc đổi ngày mới báo.

### D. Dữ liệu cũ và dữ liệu demo
7. **Khai "Có" từ trước chưa có ngày:** bổ sung khi sửa khai báo hoặc khi lưu phiếu khám (như CCCD, D2 plan CCCD). Không tính là đổi ngày.
8. **Dữ liệu demo:** mọi khai báo và phiếu khám "Có tiếp xúc" đều có ngày (như D9 plan CCCD); DB cũ được bổ sung một lần.

## Context
- Tiền sử khai báo: `src/models/children/childProfile.js:17-45` (`tbContact: { state }`), ánh xạ phiếu khám `:96-112`; form `src/components/children/HealthDeclarationFields.jsx:160-198`; kiểm `src/utils/children/childrenValidation.js:92-104`.
- Báo khai lần đầu: `src/services/children/mock/childrenMockRepository.js:486-510` (`notifyTbContactReported`), gọi ở tiếp nhận/nhập Excel `:583`, sửa khai báo `:957-964`.
- Phiếu khám: tiền sử `src/models/children/healthExamForm.js:80-84`, `:339`; điền sẵn `src/services/children/mock/healthExamMockRepository.js:103-136`; cập nhật ngược, không báo (3b) `:138-167`; UI `src/components/children/exam/ExamAdminStep.jsx:226-255`; kiểm `src/utils/children/healthExamValidation.js:128-133`; lịch sử sửa `healthExamMockRepository.js:297-301`.
- Excel: `src/models/children/childrenConstants.js:169`, `src/services/children/mock/enrollmentImport.js:87-120`.
- Seed: khai báo `src/mocks/childrenSeed.js:503-509` (ch_009 "Có"); phiếu khám `:108-119` (ch_006), `:150-170` (ch_016).
- `docs/features/README.md:113` (3b). BE (bản local `main`): chưa có field ngày tiếp xúc, chưa có API khai báo.

## Quyết định đã chốt
1. D1 — Ngày = "Ngày tiếp xúc gần nhất" theo lời phụ huynh; không tương lai, không trước ngày sinh — user, 2026-10-21.
2. D2 — Bắt buộc ở mọi chỗ khai tiếp xúc lao: form khai báo (cả bước tiếp nhận), nhập Excel (cột mới, bắt buộc khi "Có"), phiếu khám (điền sẵn, sửa được, bắt buộc khi "Có") — user, 2026-10-21.
3. D3 — Báo mọi lần đổi ngày (đã có ngày, ngày mới khác) ở khai báo hoặc khi lưu kết luận phiếu khám; người nhận Hiệu trưởng + Phó hiệu trưởng điểm trường, trừ người lưu, không giáo viên; lần đầu khai "Có" báo như hiện nay — user, 2026-10-21.
4. D4 — Ngày đầy đủ dd/mm/yyyy; không nhớ thì ghi ngày ước lượng — user, 2026-10-21.
5. D5 — Dữ liệu cũ chưa có ngày: bổ sung khi chạm tới; dữ liệu demo bổ sung hết — theo tiền lệ user chốt cho CCCD (D2, D9 plan `2026-10-21-guardian-citizen-id-required.md`).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Phó hiệu trưởng (khai báo, nhập Excel), giáo viên phụ trách lớp (phiếu khám) · outcome khai "Có" luôn kèm ngày tiếp xúc gần nhất; đổi ngày thì BGH biết · rule HLT-01 (phiếu khám, user chốt 2026-10-17, PROPOSED) · flow `[S]` khai báo / nhập Excel / lưu kết luận phiếu khám.
- **Đối chiếu thiết kế ban đầu:** `docs/features/README.md:113` ghi "cập nhật từ phiếu khám không báo (3b)" — yêu cầu mới: đổi ngày tiếp xúc từ phiếu khám có báo (D3). Mẫu Phụ lục II chỉ có Có/Không cho mục này; ô ngày là phần thêm của trường.
- **Ảnh hưởng:** `FE: /children/:id/health-declaration`, `/children/new` (bước khai báo), `/children/import`, phiếu khám `/children/health-checks/:campaignId/exam/:childId` · thông báo CHILD_TB_CONTACT + loại mới · APP: phụ huynh xem tiền sử (chờ BE) · dữ liệu cũ ⇒ D5.

### Câu hỏi mở
Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Ô ngày là ngày gì? | Ngày tiếp xúc gần nhất | user | 2026-10-21 | `docs/features/README.md` |
| Bắt buộc ở đâu? | Mọi chỗ khai tiếp xúc lao | user | 2026-10-21 | `docs/features/README.md` |
| Khi nào báo đổi ngày? | Mọi lần đổi ngày | user | 2026-10-21 | `docs/features/README.md` |
| Không nhớ ngày? | Ngày đầy đủ, ghi ngày ước lượng | user | 2026-10-21 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1** (D1, D2, D4): Given khai báo "Có tiếp xúc" When thiếu ngày / ngày tương lai / trước ngày sinh Then lỗi dưới ô; BE giả `422` khóa `declaration.medicalHistory.tbContactDate` (tiếp nhận) hoặc `medicalHistory.tbContactDate` (sửa khai báo).
- **AC-2** (D2): Given nhập Excel When "Có" mà thiếu/sai ngày Then dòng lỗi; có ngày dd/mm/yyyy Then lưu đúng ngày.
- **AC-3** (D2): Given phiếu khám mới When khai báo có ngày Then phiếu điền sẵn "Có" + ngày; When chọn "Có" mà thiếu ngày hoặc ngày sau ngày khám Then lỗi `exam.history.tbContactDate`.
- **AC-4** (D3): Given khai báo đã có ngày When sửa khai báo sang ngày khác Then Hiệu trưởng + Phó hiệu trưởng điểm trường (trừ người lưu) nhận thông báo đổi ngày; giáo viên không nhận; lưu lại cùng ngày thì không báo.
- **AC-5** (D3): Given khai báo đã có ngày When lưu kết luận phiếu khám với ngày khác Then khai báo nhận ngày mới và BGH nhận thông báo đổi ngày; cùng ngày thì không báo.
- **AC-6** (D3): Given lần đầu khai "Có" When lưu Then báo như hiện nay (gồm giáo viên), câu báo có ngày.
- **AC-7** (D5): Given DB demo When khởi tạo/nâng cấp Then mọi khai báo và phiếu khám "Có tiếp xúc" có ngày.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Field | `medicalHistory.tbContact.contactDate` (khai báo), `exam.history.tbContactDate` (phiếu khám), `YYYY-MM-DD` | Ô chữ tự do | So sánh "đổi ngày" rõ ràng; theo quy ước ngày của repo |
| Bổ sung ngày cho khai báo cũ (lần đầu có ngày) | Không tính là đổi ngày, không báo | Báo như đổi ngày | D3: "đã có ngày mà ngày mới khác" |
| Thông báo đổi ngày | Loại mới `CHILD_TB_CONTACT_DATE_CHANGED`, link tới khai báo | Dùng lại `CHILD_TB_CONTACT` | Tách để người nhận phân biệt khai lần đầu với đổi ngày |
| Ngày giả của dữ liệu demo | Seed: ngày cố định trước đợt khám; DB cũ: lấy từ khai báo/phiếu khám cùng trẻ, không có thì 30 ngày trước ngày khai báo/ngày khám (không trước ngày sinh) | Để trống | Theo D5 (dữ liệu demo đủ field bắt buộc) |

## Phases
### Phase 1 — Model, kiểm nhập, backend giả, dữ liệu mẫu
- Files: M `src/models/children/childProfile.js` · M `src/models/children/healthExamForm.js` · M `src/models/children/childrenConstants.js` · M `src/utils/children/childrenValidation.js` · M `src/utils/children/healthExamValidation.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/services/children/mock/enrollmentImport.js` · M `src/mocks/childrenSeed.js` · C `tests/children/tb-contact-date.test.mjs`
- Tests: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 → `tests/children/tb-contact-date.test.mjs`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Giao diện
- Files: M `src/components/children/HealthDeclarationFields.jsx` · M `src/components/children/DeclarationSummary.jsx` (qua `historyItemText`) · M `src/pages/children/HealthDeclarationPage.jsx` · M `src/pages/children/EnrollChildPage.jsx` · M `src/components/children/exam/ExamAdminStep.jsx` · M `src/components/children/exam/ExamSummary.jsx` · M `src/pages/children/ImportChildrenPage.jsx`
- Tests: kiểm tay (chưa có test component).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `src/services/children/api/childrenApi.js` (ghi chú contract) · M plan này
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Đề xuất cho BE (gom sau khi FE hoàn thiện)
- `child` (khai báo sức khỏe): `medicalHistory.tbContact.contactDate` (date), bắt buộc khi `state = REPORTED`; `422` khi thiếu, ở tương lai, trước ngày sinh.
- `health` (phiếu khám, HLT-01): `exam.history.tbContactDate`, bắt buộc khi `tbContact = YES`, không sau ngày khám; lưu kết luận cập nhật ngược ngày vào khai báo.
- Thông báo mới `CHILD_TB_CONTACT_DATE_CHANGED` tới Hiệu trưởng + Phó hiệu trưởng điểm trường (trừ người lưu) khi ngày đã có đổi sang ngày khác, từ khai báo hoặc phiếu khám (thay một phần 3b). `CHILD_TB_CONTACT` kèm ngày.
- File nhập thêm cột "Ngày tiếp xúc người bệnh lao gần nhất (dd/mm/yyyy)".

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | D1, D2, D4 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-2 | D2 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-3 | D2 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-4 | D3 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-5 | D3 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-6 | D3 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |
| AC-7 | D5 | `tb-contact-date.test.mjs` | 1 | pass (`test:children`) |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi 3b: phiếu khám đổi ngày có báo | Thêm thông báo cho BGH | Chỉ khi ngày đã có đổi sang ngày khác; không báo giáo viên | Bỏ lời gọi báo trong cập nhật ngược |
| Ngày giả trong DB demo | Ngày không phải lời phụ huynh | Chỉ dữ liệu demo; dữ liệu mẫu đều là giả | Xóa dữ liệu demo |
| BE làm khác contract | Sửa lại khi nối API | Ghi đề xuất cho BE | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (khai báo, tiếp nhận, nhập Excel, phiếu khám, thông báo)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ không tách: một field xuyên suốt khai báo – phiếu khám, tách sẽ có lúc một đường nhập bỏ qua
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-21 — Plan approved
- User trả lời 4 câu nghiệp vụ trong chat; plan làn L duyệt trước theo cách làm user đã chốt (chạy liền các phase, báo cuối).
- Tiếp: Phase 1.

### 2026-10-21 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (gồm `tb-contact-date.test.mjs` 5/5)
- Khác plan: dùng lại `addDays` của `healthCheckRule.js` (export) cho bổ sung ngày DB cũ, không viết thêm bản mới.

### 2026-10-21 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Chưa kiểm chứng: chưa mở trình duyệt (không có công cụ chạy trình duyệt tự động) — ô ngày ở Khai báo sức khỏe, bước tiếp nhận, phiếu khám cần kiểm tay.

### 2026-10-21 — Phase 3 (done), đóng plan
- Commit: chưa commit
- Tài liệu: `docs/features/README.md` (mục ngày tiếp xúc lao, thay một phần 3b), ghi chú contract `src/services/children/api/childrenApi.js`.
- Plan chuyển `docs/plans/completed/`.
