---
title: Hồ sơ trẻ — hỏi hành chính và tiền sử khi tiếp nhận, phiếu khám điền sẵn và cập nhật ngược
status: done  # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: feature/FE-FEAT-43-child-health-pickup
modules: [child, health]
rules: [HLT-01, HLT-06]
risk: high           # dữ liệu cá nhân (CCCD, nơi ở) và sức khỏe (tiền sử, tiếp xúc lao); đổi luồng tiếp nhận + Excel; ghi ngược hồ sơ từ phiếu khám
created: 2026-10-17
updated: 2026-10-17
---
# Hồ sơ trẻ — hỏi hành chính và tiền sử khi tiếp nhận, phiếu khám điền sẵn và cập nhật ngược

Plan chỉ phần client; BE theo sau (user chốt 2026-10-17: bỏ qua BE, FE dẫn nghiệp vụ bằng backend giả). Nối tiếp [plan phiếu khám Phụ lục II](../completed/2026-10-17-health-exam-form-doctor-conclusion.md).

## Luồng (bản để đọc)
1. **Phó hiệu trưởng tiếp nhận trẻ.**
   - Bước "Thông tin trẻ & phụ huynh" có thêm khối **Thông tin hành chính**: số CCCD/mã định danh, sinh non + tuần thai, dân tộc, đối tượng, nguồn chi trả, nhóm máu, nơi ở. Không bắt buộc.
   - Bước "Khai báo sức khỏe" có thêm **Tiền sử**: bản thân, gia đình, tiếp xúc người bệnh lao. Mỗi mục chọn Có / Không / Chưa cung cấp; "Có" thì ghi rõ (trừ tiếp xúc lao).
2. **Khai "Có tiếp xúc với người bệnh lao"** (khi tiếp nhận, nhập Excel hoặc sửa khai báo): hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp (nếu đã xếp lớp), trừ người vừa lưu. Câu trung tính, không mở phiếu theo dõi.
3. **Nhập Excel** có thêm các cột hành chính và tiền sử. Để trống là chưa cung cấp.
4. **Sửa sau:** hành chính ở **Sửa hồ sơ**, tiền sử ở **Khai báo sức khỏe**.
5. **Khi khám:** bước 1 của phiếu luôn lấy từ hồ sơ trẻ và khai báo. Ô nào hồ sơ để trống (trẻ tiếp nhận từ trước) thì lấy từ phiếu khám gần nhất.
6. **Lưu kết luận:** phần hành chính và tiền sử trên phiếu được **cập nhật ngược** vào hồ sơ trẻ và khai báo sức khỏe, có ghi lịch sử "Cập nhật từ phiếu khám ngày …". Phiếu nháp không cập nhật.
7. **Trẻ đã tiếp nhận từ trước:** để "Chưa cung cấp"; Phó hiệu trưởng bổ sung khi cần.

## Context
- Form tiếp nhận 4 bước (`src/pages/children/EnrollChildPage.jsx:28`), thông tin trẻ ở `src/components/children/ChildInfoFields.jsx:16`, khai báo ở `src/components/children/HealthDeclarationFields.jsx:22`. Khai báo dùng 3 trạng thái `DECLARATION_STATE` (`src/models/children/childrenConstants.js:42`).
- Backend giả: tạo trẻ `createChild` (`src/services/children/mock/childrenMockRepository.js:278`), sửa hồ sơ `updateChild` (`:497`), khai báo `saveDeclaration` (`:642`), nhập Excel `previewImport`/`importChildren` (`:523`, `:557`), đọc CSV `src/services/children/mock/enrollmentImport.js:95`.
- Phiếu khám điền sẵn hành chính, tiền sử từ phiếu khám gần nhất (`prefillExam`, `src/services/children/mock/healthExamMockRepository.js`). Quyết định cũ D3 "không sửa ngược hồ sơ" bị thay bởi 2b.

## Quyết định đã chốt
Nguồn: user, 2026-10-17, CONFIRMED.
1. (1a) Không bắt buộc khi tiếp nhận; tiền sử có "Chưa cung cấp".
2. (2b) Phiếu khám luôn lấy từ hồ sơ; lưu kết luận thì cập nhật ngược hồ sơ, có ghi lịch sử. Thay D3 của plan phiếu khám.
3. (3b) Khai có tiếp xúc người bệnh lao ⇒ thông báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp; câu trung tính; không mở phiếu theo dõi.
4. (4b) File Excel tiếp nhận thêm cột hành chính và tiền sử.
5. (5) Trẻ đã tiếp nhận để "Chưa cung cấp"; phiếu khám lấy từ phiếu khám gần nhất nếu hồ sơ trống.

**Mặc định đề xuất (tự chọn, ghi lại để user đổi được):**
- Hành chính lưu ở hồ sơ trẻ (`child.profile`); tiền sử lưu ở khai báo sức khỏe (`declaration.medicalHistory`), cạnh dị ứng.
- Cập nhật ngược từ phiếu khám không gửi thông báo tiếp xúc lao (phiếu khám đã có luồng nguy cơ lao do bác sĩ kết luận).
- Số CCCD trong lịch sử thay đổi chỉ hiện 3 số cuối.

### Câu hỏi mở
Không còn câu hỏi mở.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Bắt buộc khi tiếp nhận? | Không; có "Chưa cung cấp" (1a) | user | 2026-10-17 | `docs/features/README.md` |
| Nguồn điền sẵn phiếu khám | Hồ sơ; cập nhật ngược khi lưu kết luận (2b) | user | 2026-10-17 | `docs/features/README.md` |
| Khai tiếp xúc lao khi tiếp nhận | Thông báo (3b) | user | 2026-10-17 | plan này |
| Excel | Thêm cột (4b) | user | 2026-10-17 | `docs/features/README.md` |
| Trẻ cũ | Chưa cung cấp (5) | user | 2026-10-17 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1** (`HLT-06`): Given Phó hiệu trưởng tiếp nhận trẻ, Then bước 1 có khối Thông tin hành chính, bước 3 có Tiền sử; bỏ trống vẫn lưu được; CCCD sai định dạng hoặc tuần thai ngoài 20–42 thì báo lỗi; tiền sử "Có" mà để trống thì báo lỗi. Bước Xem lại hiện các thông tin này.
- **AC-2**: Given khai "Có tiếp xúc với người bệnh lao" (tiếp nhận, nhập Excel, sửa khai báo từ trạng thái khác), Then Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp nhận thông báo, trừ người lưu. Lưu lại khi vẫn "Có" thì không báo lần nữa.
- **AC-3**: Given file CSV có các cột mới, Then xem trước báo lỗi đúng dòng (CCCD, tuần thai, sinh non không phải Có/Không); nhập thành công lưu đủ hành chính và tiền sử.
- **AC-4**: Given hồ sơ có hành chính và tiền sử, When mở phiếu khám mới, Then bước 1 điền sẵn đúng các ô; ô hồ sơ trống lấy từ phiếu khám gần nhất.
- **AC-5**: Given giáo viên đổi hành chính hoặc tiền sử trên phiếu và lưu kết luận, Then hồ sơ trẻ và khai báo sức khỏe được cập nhật; lịch sử ghi "Cập nhật từ phiếu khám ngày …" kèm thay đổi; phiếu nháp không cập nhật.
- **AC-6**: Hồ sơ trẻ hiện Thông tin hành chính và Tiền sử; Sửa hồ sơ và Khai báo sức khỏe sửa được.
- **AC-7**: Dữ liệu demo cũ mở được; trẻ đã có phiếu khám có hồ sơ khớp phiếu gần nhất; trẻ khác "Chưa cung cấp".

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nơi lưu | Hành chính ở hồ sơ trẻ, tiền sử ở khai báo sức khỏe | Gộp hết vào khai báo | Hành chính không phải thông tin sức khỏe; tiền sử cùng chỗ với dị ứng |
| Cách ánh xạ phiếu ↔ hồ sơ | 1 file mô hình dùng chung (`childProfile.js`) cho form, backend giả, Excel | Viết riêng mỗi chỗ | Tránh lệch nhãn và giá trị |
| Thông báo tiếp xúc lao | Chỉ khi trạng thái chuyển sang "Có" do Phó hiệu trưởng khai | Mỗi lần lưu | Không báo trùng |

## Phases
### Phase 1 — Mô hình và backend giả
- Files: C `src/models/children/childProfile.js` · M `src/models/children/childrenConstants.js` · M `src/utils/children/childrenHelpers.js` · M `src/utils/children/childrenValidation.js` · M `src/utils/children/healthExamValidation.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/enrollmentImport.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/mocks/childrenSeed.js` · M `src/services/children/api/childrenApi.js`
- Tests: kịch bản backend giả AC-1..AC-5, AC-7; bộ cũ.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
### Phase 2 — Giao diện
- Files: C `src/components/children/ChildProfileFields.jsx` · M `src/components/children/HealthDeclarationFields.jsx` · M `src/components/children/DeclarationSummary.jsx` · M `src/pages/children/EnrollChildPage.jsx` · M `src/pages/children/EditChildPage.jsx` · M `src/pages/children/HealthDeclarationPage.jsx` · M `src/pages/children/ChildProfilePage.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · M `src/components/children/exam/ExamAdminStep.jsx`
- Tests: render thử; tự kiểm `DESIGN.md` 13.1.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
### Phase 3 — Tài liệu
- Files: `docs/features/README.md`, `docs/quality/manual-tests/health-exam-flow.md`, `.ai/CONTEXT_MAP.yaml`, plan phiếu khám (trỏ sang plan này).
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (gom sau khi FE hoàn thiện)
- `BE:docs/business/BUSINESS_RULES.md` HLT-06: khai báo khi tiếp nhận thêm tiền sử (bản thân, gia đình, tiếp xúc lao), có "Chưa cung cấp"; khai tiếp xúc lao ⇒ thông báo.
- `BE:docs/modules/child.md`: hồ sơ trẻ có `profile` hành chính; phiếu khám cập nhật ngược khi lưu kết luận.
- Contract: `POST /children/enrollments` và `PUT /children/{id}` nhận `child.profile`; `PUT /children/{id}/health-declaration` nhận `medicalHistory`; file nhập Excel thêm cột.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-5, AC-7 | HLT-06, HLT-01 | Kịch bản backend giả (scratchpad `profile.js`) | 1 | 45/45 pass |
| AC-1, AC-6 | HLT-06 | Render thử (SSR smoke) + kịch bản thử tay mục I | 2 | smoke 38/38 pass; thử tay trên trình duyệt chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Giáo viên ghi sai làm hồ sơ sai | Hồ sơ lệch | Lịch sử ghi người, ngày, thay đổi; Phó hiệu trưởng sửa lại được | Sửa hồ sơ |
| Lộ dữ liệu cá nhân, tiếp xúc lao | Ảnh hưởng gia đình | CCCD che trong lịch sử; thông báo chỉ gửi đúng người; không ở danh sách | — |
| File Excel cũ (thiếu cột mới) | Nhập lỗi | Cột mới không bắt buộc | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `EnrollChildPage`, `EditChildPage`, `HealthDeclarationPage`, `ChildProfilePage`, `ImportChildrenPage`, `HealthExamFormPage` (bước 1)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách plan, vì giao diện phụ thuộc mô hình của Phase 1; 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (HLT-06 người xác nhận PENDING P-17 giữ như cũ)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan

## Progress log
### 2026-10-17 — Plan (user đã chốt 1a, 2b, 3b, 4b, 5; chạy liên tục theo thỏa thuận làn L)
- Commit: chưa commit
- Verify: chưa chạy
- Tiếp: Phase 1.

### 2026-10-17 — Phase 1–3 xong
- Phase 1: mô hình `src/models/children/childProfile.js`; kiểm tra định dạng (không bắt buộc); backend giả lưu hồ sơ, tiền sử, thông báo tiếp xúc lao khi chuyển sang "Có"; Excel thêm 13 cột (file mẫu cũ vẫn nhập); phiếu khám điền sẵn từ hồ sơ, ô trống lấy phiếu gần nhất; lưu kết luận cập nhật ngược + lịch sử (số định danh che, chỉ 3 số cuối); danh sách trẻ không trả phần hành chính; seed v8 (ch_007 đủ, ch_009 thiếu + khai lao, ch_new_1 đủ).
- Phase 2: `ChildProfileFields`, `ChildProfileSummary`; khối Tiền sử trong khai báo; Tiếp nhận, Sửa hồ sơ, Khai báo sức khỏe (lịch sử tiền sử), Hồ sơ trẻ (thẻ hành chính, dòng cập nhật gần nhất), Nhập Excel (file mẫu), bước 1 phiếu khám (ghi chú điền sẵn).
- Phase 3: `docs/features/README.md` (1a, 2b, 3b, 4b, 5), kịch bản thử tay mục I, CONTEXT_MAP, ghi chú D3 bị thay ở plan phiếu khám, contract trong `src/services/children/api/childrenApi.js`.
- Test: profile 45/45, scenario 63/63 (2 kỳ vọng sửa theo thay đổi: ch_007 giờ có tiền sử điền sẵn; seed v8), coverage 34/34, flow 71/71, watchlist 8/8, smoke 38/38.
- Verify: `VERIFY PASS full` sau Phase 2; chạy lại sau Phase 3. DESIGN 13.1: không dòng mới.
- Commit: chưa commit (chưa có yêu cầu).
- Chưa làm: thử tay trên trình duyệt.
