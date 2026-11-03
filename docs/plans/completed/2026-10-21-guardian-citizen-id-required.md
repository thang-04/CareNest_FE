---
title: Tiếp nhận trẻ — phụ huynh bắt buộc nhập số CCCD
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none / FE-FEAT-43   # mã Jira hỏi khi user yêu cầu commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child]
rules: [AUTH-04]
risk: high           # dữ liệu cá nhân phụ huynh; thêm field vào contract hồ sơ trẻ và tài khoản phụ huynh (PROPOSED); file Excel mẫu cũ không nhập được nữa
created: 2026-10-21
updated: 2026-10-21
---
# Tiếp nhận trẻ — phụ huynh bắt buộc nhập số CCCD

Plan chỉ phần client; FE dẫn nghiệp vụ bằng backend giả, BE làm theo sau (như plan sức khỏe, user chốt 2026-10-17). User yêu cầu 2026-10-21: "khi tiếp nhận trẻ phụ huynh bắt buộc phải nhập CCCD" (số điện thoại đã bắt buộc từ trước).

## Luồng (đã chốt)
Mã trong ngoặc (D1, D2…) trỏ tới mục "Quyết định đã chốt".

### A. Tiếp nhận một trẻ (form 4 bước)
1. **Nhập phụ huynh mới** (tab "Chưa có tài khoản"). Mỗi phụ huynh có thêm ô "Số CCCD", bắt buộc, đúng 12 chữ số (D1, D3). Hai phụ huynh của cùng trẻ không được trùng CCCD (D4).
2. **Gợi ý tài khoản có sẵn.** SĐT, email hoặc CCCD trùng tài khoản phụ huynh của điểm trường thì hiện "đã có tài khoản phụ huynh …" với nút "Chọn tài khoản này", như khi trùng SĐT hiện nay (D4).
3. **Chọn tài khoản có sẵn** (tab "Đã có tài khoản"). Tài khoản đã có CCCD thì hiện số, không nhập lại. Tài khoản chưa có CCCD thì thẻ tài khoản hiện ô CCCD bắt buộc. Khi lưu, số này ghi vào hồ sơ trẻ và bổ sung vào tài khoản (D2).
4. **Lưu.** BE giả kiểm lại: thiếu hoặc sai định dạng ⇒ `422`. CCCD đã thuộc phụ huynh khác (SĐT khác), hoặc SĐT đã ghi cho phụ huynh có CCCD khác ⇒ `409`. Lỗi hiện ngay dưới ô CCCD (D4, D6).

### B. Nhập nhiều trẻ từ Excel
5. **File mẫu có cột "Số CCCD phụ huynh"**, bắt buộc. File thiếu cột ⇒ báo lỗi file. Ô trống hoặc sai ⇒ dòng lỗi. Hai dòng cùng CCCD mà khác SĐT ⇒ dòng lỗi (D1, D4). File theo mẫu cũ (chưa có cột này) không nhập được nữa.

### C. Sau khi tiếp nhận
6. **Sửa hồ sơ trẻ.** Mỗi phụ huynh có ô CCCD bắt buộc. Phụ huynh chưa có CCCD phải nhập mới lưu được (D2). Phụ huynh đã có tài khoản và tài khoản đã có CCCD thì ô khóa, ghi "Theo tài khoản phụ huynh", như ô SĐT đăng nhập (D5).
7. **Thêm phụ huynh ở màn Tài khoản phụ huynh.** Form có ô CCCD bắt buộc. Tài khoản tìm theo SĐT/email chưa có CCCD thì bổ sung; khác CCCD thì `409` (D1, D4).
8. **Kích hoạt tài khoản.** Không có ô nhập. Tạo tài khoản thì chép CCCD từ hồ sơ; liên kết tài khoản có sẵn chưa có CCCD thì bổ sung; khác CCCD thì `409` (D4, D7).

### D. Hiển thị
9. **Mọi vai xem được thông tin phụ huynh thấy CCCD đầy đủ**, như SĐT: hồ sơ trẻ, khung xem nhanh, bước xem lại khi tiếp nhận, bảng xem trước khi nhập Excel, chọn tài khoản có sẵn, màn Tài khoản phụ huynh (D8). Danh sách trẻ, thông báo, AI không thêm CCCD.

### Ngoài phạm vi
- Sửa CCCD đã ghi trên tài khoản phụ huynh (nhập nhầm): chưa có màn; ghi vào đề xuất BE.

## Context
- Phụ huynh hiện có họ tên, quan hệ, SĐT (bắt buộc), email: `src/utils/children/childrenValidation.js:60-70`, `src/components/children/ChildInfoFields.jsx:122-166`, `src/utils/children/childrenHelpers.js:28`.
- Tab "Đã có tài khoản" lấy liên hệ từ tài khoản: `src/pages/children/EnrollChildPage.jsx:92-108`; BE giả đọc lại theo `accountId`: `src/services/children/mock/childrenMockRepository.js:680-707`.
- Liên kết phụ huynh ↔ tài khoản theo SĐT: `src/services/account/mock/guardianCompatibility.js:4-13`; bản ghi phụ huynh: `cleanGuardians` `childrenMockRepository.js:386-397`.
- Nhập Excel: cột `src/models/children/childrenConstants.js:144-169`, đọc file `src/services/children/mock/enrollmentImport.js:125-158`, file mẫu `src/pages/children/ImportChildrenPage.jsx:33-44`.
- Thêm phụ huynh ở màn tài khoản: `src/services/account/mock/guardianMockRepository.js:109-160`, kiểm nhập `src/utils/account/guardianValidation.js:15-23`, form `src/components/account/GuardianPanel.jsx:169-205`.
- Kích hoạt: `childrenMockRepository.js:934-979`.
- Dữ liệu mẫu phụ huynh: `src/mocks/schoolSeed.js:95-103`, `:150-158`, `:179-208`, `src/mocks/classSeed.js:142-149`; tài khoản: `src/mocks/childrenSeed.js:559-583`.
- BE (bản local `project/be/CareNest_BE`, `main` `921bc09`): `docs/modules/child.md` chưa có field định danh phụ huynh, chưa có API; `BUSINESS_RULES.md` không có luật CCCD.

## Quyết định đã chốt
1. D1 — Bắt buộc ở mọi chỗ thêm phụ huynh: form tiếp nhận, nhập Excel, sửa hồ sơ, thêm phụ huynh ở màn tài khoản — user, 2026-10-21.
2. D2 — Phụ huynh có từ trước chưa có CCCD: bắt bổ sung khi chạm tới (liên kết tài khoản có sẵn vào trẻ mới, sửa hồ sơ); đã có thì hiện, không nhập lại; dữ liệu mẫu điền CCCD giả — user, 2026-10-21.
3. D3 — Chỉ CCCD 12 chữ số (không nhận hộ chiếu) — user, 2026-10-21.
4. D4 — Trùng: hai phụ huynh cùng trẻ không trùng; trùng tài khoản có sẵn ⇒ gợi ý liên kết như SĐT; 1 người 1 tài khoản: CCCD đã thuộc phụ huynh khác mà SĐT khác ⇒ không cho lưu (`409`) — user, 2026-10-21. Suy ra (1 người 1 tài khoản): SĐT đã ghi cho phụ huynh có CCCD khác cũng `409`.
5. D8 — Hiển thị: mọi vai xem bình thường (số đầy đủ, như SĐT) — user, 2026-10-21 ("tất cả roll xem bình thường").
6. D9 — Dữ liệu demo (mock): mọi phụ huynh, tài khoản phụ huynh và người đi cùng là phụ huynh đều phải có CCCD, kể cả phụ huynh người dùng nhập trước quy định (bổ sung một lần) — user, 2026-10-21 ("sửa tất cả các data mock phụ huynh buộc phải có CCCD"). Thay phần "dữ liệu mẫu" của D2; D2 vẫn áp cho dữ liệu thật khi nối BE.
7. D5, D6, D7 — kỹ thuật, xem "Key decisions".

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Phó hiệu trưởng phụ trách điểm trường (tiếp nhận, nhập Excel, sửa hồ sơ, tài khoản phụ huynh) · outcome mỗi phụ huynh gắn trẻ có số CCCD · rule: chưa có rule BE; AUTH-04 (CONFIRMED, quyền phụ huynh theo liên kết) không đổi · flow `[S]` tiếp nhận / nhập Excel / sửa hồ sơ / thêm phụ huynh / kích hoạt.
- **Đối chiếu thiết kế ban đầu:** `BE:docs/modules/child.md` (GuardianChildLink: childId, userId, relation) không có định danh phụ huynh; FE dẫn trước (PROPOSED). `docs/features/README.md:113` ghi "file mẫu cũ vẫn nhập được (4b)" cho cột hành chính — cột CCCD phụ huynh bắt buộc nên file mẫu cũ không nhập được (hệ quả D1).
- **Ảnh hưởng:** module child (hồ sơ, tiếp nhận, nhập Excel, kích hoạt) và account (Tài khoản phụ huynh) · quyền không đổi (BE giả vẫn kiểm vai) · `FE: /children/new`, `/children/import`, `/children/:id/edit`, `/children/:id`, `/children/activation` · `APP`: hồ sơ phụ huynh có thể hiện CCCD (chờ BE) · dữ liệu cũ: phụ huynh do người dùng tạo trên DB demo chưa có CCCD ⇒ D2.

### Câu hỏi mở
Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| CCCD bắt buộc ở đâu? | Mọi chỗ thêm phụ huynh | user | 2026-10-21 | `docs/features/README.md` |
| Phụ huynh cũ chưa có CCCD? | Bắt bổ sung khi chạm tới | user | 2026-10-21 | `docs/features/README.md` |
| Định dạng? | Chỉ CCCD 12 chữ số | user | 2026-10-21 | `docs/features/README.md` |
| Kiểm trùng? | Như SĐT + 1 người 1 tài khoản | user | 2026-10-21 | `docs/features/README.md` |
| Ai xem, hiển thị thế nào? | Mọi vai xem bình thường | user | 2026-10-21 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1** (D1, D3): Given tab "Chưa có tài khoản" When thiếu CCCD / CCCD không đúng 12 chữ số Then lỗi "Nhập số CCCD của phụ huynh" / "Số CCCD gồm đúng 12 chữ số" dưới ô; BE giả `422` cùng khóa `guardians.{i}.idNumber`.
- **AC-2** (D4): Given hai phụ huynh cùng trẻ When trùng CCCD Then lỗi "Hai phụ huynh không được dùng chung số CCCD".
- **AC-3** (D4): Given CCCD trùng tài khoản phụ huynh của điểm trường When nhập Then hiện gợi ý "Chọn tài khoản này".
- **AC-4** (D4): Given CCCD đã thuộc phụ huynh khác có SĐT khác, hoặc SĐT đã ghi cho phụ huynh có CCCD khác When lưu (tiếp nhận, sửa hồ sơ, thêm phụ huynh, kích hoạt) Then `409`, lỗi dưới ô CCCD; nhập Excel thì dòng lỗi, kể cả hai dòng trong cùng file.
- **AC-5** (D2): Given tab "Đã có tài khoản" When tài khoản có CCCD Then hiện số, không có ô nhập; When chưa có Then ô CCCD bắt buộc và khi lưu số được ghi vào hồ sơ trẻ và tài khoản.
- **AC-6** (D1): Given nhập Excel When file thiếu cột "Số CCCD phụ huynh" Then lỗi file; When ô trống/sai Then dòng lỗi; file mẫu tải về có cột này.
- **AC-7** (D2, D5): Given sửa hồ sơ When phụ huynh chưa có CCCD Then phải nhập mới lưu; When phụ huynh có tài khoản đã có CCCD Then ô khóa và BE giả giữ số của tài khoản.
- **AC-8** (D1, D4): Given màn Tài khoản phụ huynh When thêm phụ huynh thiếu/sai CCCD Then `400`; When tài khoản theo SĐT chưa có CCCD Then bổ sung; When khác CCCD Then `409`.
- **AC-9** (D8): Given mọi vai xem được hồ sơ trẻ When mở hồ sơ, khung xem nhanh Then thấy CCCD đầy đủ của phụ huynh (phụ huynh thiếu ⇒ "Chưa có").
- **AC-10** (D9): Given DB demo When khởi tạo hoặc nâng cấp Then mọi phụ huynh trên hồ sơ trẻ, mọi tài khoản phụ huynh và người đi cùng là phụ huynh ở phiếu khám có CCCD (kể cả phụ huynh người dùng nhập trước quy định); cùng SĐT dùng chung CCCD đã ghi.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Lưu CCCD ở đâu | Field `idNumber` trên bản ghi phụ huynh của hồ sơ trẻ và trên tài khoản phụ huynh; đọc bản ghi, thiếu thì lấy tài khoản cùng SĐT | Chỉ trên tài khoản | Giống họ tên/email đang lưu ở cả hai nơi; phụ huynh chưa kích hoạt chưa có tài khoản. Tên `idNumber` như CCCD của trẻ và người đi cùng |
| D5 — CCCD của phụ huynh đã có tài khoản | Khóa ô khi tài khoản đã có CCCD; BE giả giữ số của tài khoản | Cho sửa rồi lan sang tài khoản và hồ sơ anh/chị | Như SĐT đăng nhập; tránh lệch giữa các hồ sơ và lách kiểm trùng. Sửa nhầm: đề xuất BE |
| D6 — Mã lỗi trùng danh tính | `409` kèm `details` theo ô (`guardians.{i}.idNumber`, `idNumber`) | `422` | Trùng là xung đột dữ liệu như trùng SĐT hiện nay; `details` để hiện dưới ô |
| D7 — Kích hoạt khi hồ sơ chưa có CCCD | Không chặn, chép nếu có | Bắt bổ sung trước khi kích hoạt | Màn kích hoạt không có ô nhập; dữ liệu mới và dữ liệu mẫu đều có CCCD |
| Chỗ đặt luật | Kiểm định dạng: `src/utils/citizenId.js` (chung 2 module). Kiểm trùng (BE giả): `src/mocks/guardianIdentity.js` | Viết lại ở mỗi module | ESLint chặn import chéo module; một luật một chỗ |
| CCCD giả của dữ liệu mẫu | "999" + 9 số cuối SĐT; bổ sung DB cũ: cùng SĐT dùng CCCD đã ghi, số giả trùng SĐT khác thì tăng dần | Số ngẫu nhiên | Rõ là giả (không có mã tỉnh 999); 1 SĐT ↔ 1 CCCD nên không tự tạo xung đột |
| Tách plan (>8 file) | Không tách | Tách BE giả / giao diện | Một field xuyên suốt; tách sẽ có lúc một đường nhập bỏ qua quy định |

## Phases
### Phase 1 — Backend giả, kiểm nhập, dữ liệu mẫu
- Files: C `src/utils/citizenId.js` · C `src/mocks/guardianIdentity.js` · C `tests/children/guardian-citizen-id.test.mjs` · M `src/utils/children/childrenValidation.js` · M `src/utils/account/guardianValidation.js` · M `src/utils/children/childrenHelpers.js` · M `src/models/children/childrenConstants.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/enrollmentImport.js` · M `src/services/account/mock/guardianMockRepository.js` · M `src/mocks/schoolSeed.js` · M `src/mocks/classSeed.js` · M `src/mocks/childrenSeed.js` · M `tests/integration/selective-merge/guardian-compat.test.mjs` · M `package.json` (script `test:children`)
- Steps: 1. Kiểm định dạng + bắt buộc + trùng trong trẻ. 2. Kiểm trùng danh tính (BE giả, `409`). 3. Tiếp nhận (2 tab), sửa hồ sơ, nhập Excel, thêm phụ huynh, kích hoạt ghi/bổ sung CCCD. 4. View trả `idNumber` (mọi vai). 5. Dữ liệu mẫu + nâng cấp một lần.
- Tests: AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-8, AC-10 → `tests/children/guardian-citizen-id.test.mjs`; `guardian-compat.test.mjs` thêm CCCD vào form.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0

### Phase 2 — Giao diện
- Files: M `src/components/children/ChildInfoFields.jsx` · M `src/components/children/ExistingGuardianPicker.jsx` · M `src/pages/children/EnrollChildPage.jsx` · M `src/pages/children/EditChildPage.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · M `src/pages/children/ChildProfilePage.jsx` · M `src/components/children/ChildQuickPanel.jsx` · M `src/components/account/GuardianPanel.jsx`
- Steps: 1. Ô CCCD (bắt buộc, khóa theo tài khoản). 2. Tab có sẵn: hiện số hoặc ô bổ sung; gợi ý theo CCCD; lỗi `409` về đúng bước. 3. Excel: file mẫu, cột xem trước. 4. Hiển thị CCCD ở hồ sơ, xem nhanh, xem lại, màn tài khoản.
- Tests: AC-3, AC-9 kiểm tay (chưa có test component); logic qua test Phase 1.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `src/services/children/api/childrenApi.js` (ghi chú contract) · M plan này
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Đề xuất cho BE (gom sau khi FE hoàn thiện)
- `child`: bản ghi phụ huynh của hồ sơ (request tiếp nhận, sửa hồ sơ, nhập Excel; response hồ sơ) thêm `idNumber` (string, đúng 12 chữ số), bắt buộc; `422` khóa `guardians.{i}.idNumber`; trùng trong trẻ ⇒ `422` `guardians`.
- `identity-access`: tài khoản phụ huynh thêm `idNumber`; danh sách tài khoản cho tab "Đã có tài khoản" trả `idNumber`; request liên kết tài khoản có sẵn nhận `idNumber` khi tài khoản chưa có.
- Luật đề xuất (chưa có ID): 1 người 1 tài khoản — CCCD duy nhất trên tài khoản phụ huynh và bản ghi phụ huynh; CCCD trùng mà SĐT khác, hoặc SĐT trùng mà CCCD khác ⇒ `409` kèm `details` theo ô.
- Mẫu nhập Excel thêm cột bắt buộc "Số CCCD phụ huynh".
- Quyền xem: mọi vai xem được liên hệ phụ huynh thì xem `idNumber` đầy đủ (user chốt 2026-10-21); không đưa vào thông báo, AI, log.
- Cần thêm: thao tác sửa CCCD trên tài khoản phụ huynh (nhập nhầm), có lý do và lịch sử.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | D1, D3 | `guardian-citizen-id.test.mjs` (mock repo) | 1 | pass (`test:children`) |
| AC-2 | D4 | `guardian-citizen-id.test.mjs` | 1 | pass (`test:children`) |
| AC-3 | D4 | kiểm tay `/children/new` | 2 | chưa kiểm tay trên trình duyệt |
| AC-4 | D4 | `guardian-citizen-id.test.mjs` | 1 | pass (`test:children`) |
| AC-5 | D2 | `guardian-citizen-id.test.mjs` | 1 | pass (`test:children`) |
| AC-6 | D1 | `guardian-citizen-id.test.mjs` (`readEnrollmentCsv`, `previewImport`) | 1 | pass (`test:children`) |
| AC-7 | D2, D5 | `guardian-citizen-id.test.mjs` | 1 | pass (`test:children`) |
| AC-8 | D1, D4 | `guardian-citizen-id.test.mjs`, `guardian-compat.test.mjs` | 1 | pass (`test:children`) + `guardian-compat` |
| AC-9 | D8 | kiểm tay `/children/:id` | 2 | BE giả pass (giáo viên thấy CCCD); giao diện chưa kiểm tay |
| AC-10 | D9 | `guardian-citizen-id.test.mjs` | 1 | pass (`test:children`) |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| CCCD là dữ liệu cá nhân, hiện cho mọi vai | Lộ số định danh phụ huynh | Theo user chốt; không đưa vào danh sách trẻ, thông báo, AI, log; dữ liệu mẫu chỉ dùng số giả "999…" | Revert commit |
| File Excel mẫu cũ không nhập được | Người dùng giữ file cũ bị báo thiếu cột | Báo rõ "Thiếu cột: Số CCCD phụ huynh"; tải lại file mẫu | Đổi cột sang không bắt buộc |
| DB demo có phụ huynh do người dùng tạo, chưa có CCCD | Sửa hồ sơ phải nhập CCCD | Đúng D2; dữ liệu mẫu được bổ sung | Xóa dữ liệu demo |
| BE làm khác contract đề xuất | Phải sửa lại FE khi nối API | Ghi đề xuất cho BE; field `idNumber` như các ô định danh khác | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (tiếp nhận, sửa hồ sơ, nhập Excel, tab tài khoản có sẵn, Tài khoản phụ huynh, kích hoạt)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách plan (không tách, lý do ở Key decisions)
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-21 — Plan approved
- User trả lời 5 câu nghiệp vụ trong chat; plan làn L được duyệt trước theo cách làm user đã chốt (chạy liền các phase, báo cuối).
- Tiếp: Phase 1.

### 2026-10-21 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (gồm `test:children` 9/9)
- Khác plan: CCCD giả của dữ liệu mẫu gán một lần ở `src/mocks/seed.js` (`addSeedGuardianIds`) thay vì sửa từng chỗ ở `schoolSeed.js`, `classSeed.js` — ít chỗ sửa, phủ cả trẻ bổ sung sau. DB cũ: `backfillSeedGuardianIds` trong `childrenMockRepository.js` (cờ `guardianIdSeeded`).
- Phát hiện: 52 phụ huynh mẫu trùng SĐT nhân sự ⇒ kích hoạt báo "đã được dùng cho tài khoản nhân viên" (có từ trước, ghi ISSUE_INDEX ở Phase 3); test chọn SĐT không trùng.
- Tiếp: Phase 2.

### 2026-10-21 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: thêm tìm tài khoản có sẵn theo CCCD (ô tìm của tab "Đã có tài khoản") để khớp gợi ý theo CCCD; màn nhập Excel thêm câu hướng dẫn giữ số 0 đầu của CCCD trong Excel.
- Chưa kiểm chứng: chưa mở trình duyệt (repo không có công cụ chạy trình duyệt tự động) — AC-3, phần giao diện AC-9 cần kiểm tay.

### 2026-10-21 — Phase 3 (done), đóng plan
- Commit: chưa commit
- Tài liệu: `docs/features/README.md` (mục CCCD phụ huynh), ghi chú contract `src/services/children/api/childrenApi.js`, `docs/knowledge/ISSUE_INDEX.md` + `incidents/FE-BUG-261021-seed-guardian-staff-phone-overlap.md` (open).
- Verify: `node scripts/check-ai-layer.mjs` → `0 lỗi, 14 cảnh báo` (cảnh báo có từ trước); `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Plan chuyển `docs/plans/completed/`; còn kiểm tay trên trình duyệt (AC-3, giao diện AC-9).

### 2026-10-21 — Bổ sung: mọi dữ liệu mẫu phụ huynh có CCCD (D9, user yêu cầu)
- Commit: chưa commit
- Đổi: bổ sung một lần (cờ `guardianIdVersion: 2`, thay `guardianIdSeeded`) cho mọi phụ huynh, tài khoản phụ huynh (`fillMissingCitizenIds` — `src/mocks/guardianIdentity.js`) và người đi cùng chọn từ phụ huynh ở phiếu khám (`backfillGuardianIds` — `childrenMockRepository.js`). Phiếu khám mới: người đi cùng là phụ huynh điền sẵn CCCD phụ huynh (`healthExamMockRepository.js`, nút chọn phụ huynh `ExamAdminStep.jsx`); seed phiếu khám lấy CCCD phụ huynh (`childrenSeed.js`).
- Khác plan: bỏ mục ngoài phạm vi "Điền sẵn CCCD người đi cùng từ CCCD phụ huynh" (nay làm, theo D9).
