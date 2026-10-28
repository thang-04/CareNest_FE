---
title: Tiếp nhận trẻ kiểm đủ điều kiện kích hoạt tài khoản phụ huynh
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # tạm theo nhánh; xác nhận task Jira trước khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, identity-access]
rules: [AUTH-18]     # lệch: user bỏ "SĐT của nhân sự ⇒ từ chối" (2026-10-28) — đề xuất BE ở Phase 3
risk: high
created: 2026-10-27
updated: 2026-10-28
---
# Tiếp nhận trẻ kiểm đủ điều kiện kích hoạt tài khoản phụ huynh

## Context
User yêu cầu (27/10/2026): "khi tiếp nhận trẻ mọi thông tin kích hoạt tài khoản phải được đúng và phù hợp hết", hỏi "SĐT, email trùng tài khoản nhân sự là gì", đọc plan rồi chốt (28/10/2026).

Hiện trạng FE (BE giả) trước khi sửa:
- Kích hoạt (`/children/activation`, khung "Phụ huynh của bé"): `activateGuardians` (`src/services/account/mock/guardianMockRepository.js:238-251`) kiểm định dạng bằng `validateGuardian` (`src/utils/account/guardianValidation.js:16-26`), rồi `linkGuardian` (`:110-172`) kiểm từng phụ huynh:
  - **K1** — SĐT hoặc email trùng SĐT/email hồ sơ của tài khoản không phải phụ huynh (`:114-120`) ⇒ 409 "Số điện thoại hoặc email thuộc tài khoản nhân sự."
  - **K2** — SĐT thuộc tài khoản phụ huynh này, email thuộc tài khoản phụ huynh khác (`:121-124`). Tài khoản tìm theo SĐT **hoặc email** (`:125`): SĐT mới + email của tài khoản người khác thì bị ghép vào tài khoản đó, hoặc báo lỗi CCCD khó hiểu (`:129`).
  - **K3** — 1 người 1 tài khoản, `identityConflict` (`:128-130`, `src/mocks/guardianIdentity.js:17-32`).
  - **K4** — hai phụ huynh của trẻ trùng CCCD (`:131-133`).
- Tiếp nhận `enrollChild` (`src/services/children/mock/childrenMockRepository.js:908-929`), Sửa hồ sơ `updateChild` (`:931-976`), nhập Excel `previewImport` / `importChildren` (`:978-1027`, `:1031-1056`) kiểm: định dạng `validateChildInfo` (`src/utils/children/childrenValidation.js:69-93`), trùng hồ sơ, K3 (`guardianConflicts` `:694-706`), K4 và trùng SĐT trong cùng trẻ (`childrenValidation.js:88-91`). Thiếu K1, K2; họ tên phụ huynh ≤150 ký tự chỉ kiểm ở kích hoạt (`guardianValidation.js:20`), nhập Excel không giới hạn (form có ô nhập 100 ký tự, `src/components/children/ChildInfoFields.jsx:177`).
- Form tiếp nhận chỉ báo K3 khi bấm lưu ở bước cuối (`src/pages/children/EnrollChildPage.jsx:203-205`); bước 1 chỉ kiểm trùng hồ sơ (`:156-180`).
- Hệ quả: hồ sơ lưu được, bấm "Kích hoạt tài khoản" mới báo lỗi — user gặp ngày 23/10/2026 (`docs/knowledge/incidents/FE-BUG-261021-seed-guardian-staff-phone-overlap.md:30`).
- Đường kích hoạt cũ `childrenMockRepository.activateParentAccount` (`:1211-1264`) chép riêng K1, K2 (`:1220-1229`); không màn nào gọi, chỉ test `tests/children/guardian-citizen-id.test.mjs:265-280`.

BE (bản local `D:\project_capstone\project\be\CareNest_BE`, commit `aa64480` 22/10/2026 — không có sibling `../CareNest_BE`):
- AUTH-18 (CONFIRMED, `BE:docs/business/BUSINESS_RULES.md:30`): tên đăng nhập phụ huynh = SĐT chuẩn hóa; "SĐT của nhân sự ⇒ từ chối".
- `BE:src/main/java/com/carenest/service/account/impl/GuardianAccountServiceImpl.java:95-100`: tài khoản có **tên đăng nhập** = SĐT mà không phải PARENT ⇒ 409 `This phone number belongs to a staff account` (`BE:docs/contracts/AUTH_CONTRACT.md:225`).
- BE không lưu SĐT nhân sự (`BE:src/main/java/com/carenest/entity/account/UserAccount.java:28-57`). Tài khoản phụ huynh không có email (`BE:src/main/java/com/carenest/dto/child/AddGuardianRequest.java:9-12`: phone ≤20, fullName ≤150, relationship; `GuardianAccountServiceImpl.java:110,114` truyền email `null`). Tên đăng nhập nhân sự tự đặt `^[A-Za-z0-9._-]+$` (`BE:src/main/java/com/carenest/dto/account/CreateAccountRequest.java:15-17`).
- Keycloak có thể từ chối ký tự trong họ tên (400) (`BE:docs/modules/identity-access.md:42`); contract chưa ghi danh sách ký tự.
- BE chưa có API tiếp nhận trẻ; contract tiếp nhận ở FE là PROPOSED (`src/services/children/api/childrenApi.js:4`).

## Quyết định đã chốt
1. Mọi điều kiện dữ liệu để kích hoạt tài khoản phụ huynh phải kiểm ngay khi tiếp nhận (form, nhập Excel) và khi Sửa hồ sơ; bấm kích hoạt không còn lỗi do dữ liệu đã nhập — user, 2026-10-27.
2. Bỏ kiểm trùng nhân sự: nhân sự có tài khoản riêng, không liên quan SĐT phụ huynh (Q1) — user, 2026-10-28. PROPOSED — chờ BE (lệch AUTH-18).
3. Email phụ huynh chỉ là thông tin liên hệ, không dùng nhận diện tài khoản (Q2-A) — user, 2026-10-28.
4. Form tiếp nhận báo lỗi CCCD/SĐT phụ huynh ngay khi bấm "Tiếp tục" ở bước 1, lưu thì kiểm lại (Q3-A) — user, 2026-10-28.
5. Sửa hồ sơ luôn kiểm phụ huynh chưa có tài khoản (Q4-A) — user, 2026-10-28.
6. Làm sau plan "Hiệu trưởng tiếp nhận trẻ" (Q5-A) — user, 2026-10-28; plan đó `status: done` (`docs/plans/completed/2026-10-27-principal-child-enrollment.md`).
7. Giữ nguyên: kích hoạt một lần cho mọi phụ huynh chưa có tài khoản, lỗi một người thì không tạo ai; mật khẩu tạm gửi SMS; CCCD là khóa nhận diện, 1 người 1 tài khoản (`docs/features/README.md:138-160`) — user, 2026-10-21 và 2026-10-23.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Phó hiệu trưởng, Hiệu trưởng · outcome: hồ sơ trẻ lưu được ⇒ kích hoạt tài khoản phụ huynh được; lỗi còn lại chỉ là gửi SMS · rule: AUTH-18 (CONFIRMED, phần "SĐT của nhân sự ⇒ từ chối" user bỏ — đề xuất BE); 1 người 1 tài khoản, CCCD là khóa (quyết định FE, PROPOSED — chờ BE) · flow: [S] nhập trẻ và phụ huynh → [S] kiểm định dạng, trùng hồ sơ, CCCD/SĐT khớp phụ huynh đã có → [S] lưu → [S] kích hoạt (kiểm lại, phòng dữ liệu đổi sau khi lưu) → [S] gửi SMS.
- **Đối chiếu thiết kế ban đầu:** AUTH-18 "SĐT của nhân sự ⇒ từ chối" (`BE:docs/business/BUSINESS_RULES.md:30`) — user chốt bỏ (2026-10-28) ⇒ FE theo user, ghi PROPOSED, đề xuất BE sửa rule. Demo tìm và ghép tài khoản theo email (`guardianMockRepository.js:121-125`) — BE không có email phụ huynh, user chốt email chỉ là liên hệ ⇒ bỏ.
- **Ảnh hưởng:** module child (tiếp nhận, Sửa hồ sơ, nhập Excel), identity-access (kích hoạt) · quyền/scope: không đổi · FE: `/children/new`, `/children/import`, `/children/:id/edit`, `/children/activation` · APP: không · dữ liệu cũ: phụ huynh trùng SĐT/email nhân sự hết bị chặn kích hoạt; DB demo không có trường hợp này (`tests/hardening/seed-integrity.test.mjs:45-57`).

### Câu hỏi mở
- [x] Q1 — "SĐT trùng tài khoản nhân sự" tính theo gì?
- [x] Q2 — Email phụ huynh có dùng để nhận diện tài khoản không?
- [x] Q3 — Form tiếp nhận báo lỗi lúc nào?
- [x] Q4 — Hồ sơ đang có phụ huynh chưa kích hoạt bị vướng điều kiện thì sao?
- [x] Q5 — Thứ tự với plan "Hiệu trưởng tiếp nhận trẻ"?

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Q1 | Bỏ kiểm trùng nhân sự; nhân sự có tài khoản riêng, không đụng SĐT phụ huynh (phương án mới, không phải A/B/C) | user | 2026-10-28 | `docs/features/README.md`; đề xuất BE sửa AUTH-18 (Phase 3) |
| Q2 | A — email chỉ là liên hệ; bỏ kiểm và bỏ ghép tài khoản theo email | user | 2026-10-28 | `docs/features/README.md` |
| Q3 | A — báo ở "Tiếp tục" bước 1, lưu kiểm lại | user | 2026-10-28 | `docs/features/README.md` |
| Q4 | A — Sửa hồ sơ luôn kiểm phụ huynh chưa có tài khoản (sau Q1, Q2 các kiểm này đã có sẵn ở Sửa hồ sơ) | user | 2026-10-28 | — |
| Q5 | A — làm sau plan Hiệu trưởng tiếp nhận (plan đó đã done) | user | 2026-10-28 | — |

## Acceptance criteria
- **AC-1**: Given phụ huynh chưa có tài khoản có SĐT và email trùng SĐT, email của một tài khoản nhân sự, When tiếp nhận rồi kích hoạt, Then lưu được, tạo tài khoản phụ huynh với tên đăng nhập là SĐT đó; tài khoản nhân sự không đổi.
- **AC-2**: Given email phụ huynh trùng email một tài khoản phụ huynh khác (SĐT, CCCD khác), When tiếp nhận rồi kích hoạt, Then lưu được; kích hoạt tạo tài khoản mới theo SĐT, không ghép vào tài khoản có email đó.
- **AC-3**: Given giá trị phụ huynh bị kích hoạt từ chối vì định dạng (`validateGuardian`: họ tên trống hoặc quá 150 ký tự, SĐT, email, CCCD), When kiểm ở tiếp nhận / Sửa hồ sơ (`validateChildInfo`), Then cũng bị từ chối; nhập Excel có họ tên phụ huynh quá 150 ký tự ⇒ dòng lỗi.
- **AC-4**: Given hồ sơ vừa tiếp nhận thành công (form hoặc Excel) có phụ huynh chưa có tài khoản, When kích hoạt ngay, Then tạo đủ tài khoản.
- **AC-5**: Given CCCD/SĐT phụ huynh lệch phụ huynh đã có (1 người 1 tài khoản), When bấm "Tiếp tục" ở bước 1 tiếp nhận, Then 409 với lỗi theo ô, ở lại bước 1; hợp lệ ⇒ không lỗi. Giáo viên gọi ⇒ 403.
- **AC-6** (giữ): Sửa hồ sơ và kích hoạt vẫn chặn CCCD/SĐT lệch phụ huynh khác — test có sẵn `tests/children/guardian-citizen-id.test.mjs` (AC-4, AC-7, AC-8).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Kiểm trùng nhân sự | Bỏ hẳn ở kích hoạt (đường chính và đường cũ) | Giữ theo BE (so tên đăng nhập) | User chốt 2026-10-28; BE cần sửa AUTH-18 (đề xuất Phase 3) |
| Email | Chỉ là liên hệ; tài khoản tìm theo SĐT | Khóa phụ | User chốt Q2-A; BE không lưu email phụ huynh |
| Hàm kiểm dùng chung mới | Không cần: bỏ K1, K2 xong thì mọi kiểm dữ liệu còn lại của kích hoạt (định dạng, K3, K4) tiếp nhận đã có; K3 vốn dùng chung `identityConflict` | Thêm hàm chung (bản plan 2026-10-27) | Ít code hơn, không lệch |
| Giới hạn họ tên phụ huynh ở tiếp nhận | 150 ký tự (bằng kích hoạt và BE `AddGuardianRequest`) | 100 (bằng ô nhập form, bản plan 2026-10-27) | Họ tên lấy theo tài khoản khi CCCD khớp; giới hạn 100 có thể chặn tiếp nhận em của phụ huynh có tài khoản tên dài 101–150 ký tự |
| Kiểm sớm bước 1 | `checkGuardianConflicts` ném 409 + lỗi theo ô như khi lưu; gọi sau kiểm trùng hồ sơ | Trả map lỗi; gọi song song | Cùng dạng lỗi với lưu, trang xử lý một kiểu; trùng hồ sơ báo trước vì quan trọng hơn |
| API kiểm sớm | `POST /children/guardian-check` (PROPOSED) | `GET` với query | CCCD, SĐT không đi trên URL |
| Đường kích hoạt cũ `activateParentAccount` | Bỏ K1, K2 như đường chính; không xóa | Xóa (không màn nào gọi) | Không xóa ngoài phạm vi khi chưa hỏi |
| Màn kích hoạt | Không đổi giao diện; vẫn kiểm K3, K4 khi bấm | Hiện lỗi trước khi bấm | Sơ đồ kích hoạt không có bước kiểm trước khi bấm |

## Phases
### Phase 1 — Kích hoạt bỏ kiểm nhân sự và email; tiếp nhận đồng bộ định dạng
- Files: M `src/services/account/mock/guardianMockRepository.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/utils/children/childrenValidation.js` · C `tests/children/guardian-activation-ready.test.mjs` · M `tests/integration/selective-merge/guardian-compat.test.mjs` · M `tests/children/guardian-citizen-id.test.mjs` · M `tests/children/guardian-activation.test.mjs`
- Steps:
  1. Test đỏ cho AC-1 đến AC-4 (dữ liệu giả, CCCD `999…`).
  2. `linkGuardian` (`:110-133`): bỏ K1, bỏ tìm theo email và K2; tài khoản tìm theo SĐT.
  3. `activateParentAccount` (`:1220-1229`): như bước 2; email vẫn lưu vào tài khoản mới làm liên hệ.
  4. `validateChildInfo`: họ tên phụ huynh tối đa 150 ký tự.
  5. Sửa test đang chờ chặn theo nhân sự/email (`guardian-compat.test.mjs:32-37`); bỏ lọc `notStaff` và comment đã sai (`guardian-citizen-id.test.mjs:32-33`, `guardian-activation.test.mjs:25`).
- Tests: AC-1..AC-4 → `tests/children/guardian-activation-ready.test.mjs`; `guardian-compat.test.mjs` (nhân sự/email không chặn, ghép theo SĐT).
- Exit: `npm run test:children` và `npm run test:merge` pass; `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 2 — Báo lỗi CCCD/SĐT ngay ở bước 1 form tiếp nhận
- Files: M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/api/childrenApi.js` · M `src/services/children/childrenService.js` · M `src/pages/children/EnrollChildPage.jsx` · M `tests/children/guardian-activation-ready.test.mjs`
- Steps:
  1. Mock `checkGuardianConflicts(guardians, user)`: quyền như `checkDuplicate`; `withAccounts` + `guardianConflicts` + `throwConflicts` (409, lỗi theo ô).
  2. API PROPOSED `POST /children/guardian-check { guardians }` (cùng tên, cùng tham số với mock); facade.
  3. `EnrollChildPage` `next()` bước 1 (`:156-180`): sau kiểm trùng hồ sơ, gọi `checkGuardianConflicts`; 409 có `details` ⇒ đặt lỗi vào `errors.info`, ở lại bước 1. Lưu vẫn kiểm lại (`:203-205` giữ).
- Tests: AC-5 → `checkGuardianConflicts` (mock); chạy thử trên trình duyệt.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; trình duyệt: CCCD của phụ huynh khác + SĐT khác ⇒ lỗi dưới ô CCCD ở bước 1.

### Phase 3 — Tài liệu và đề xuất BE
- Files: M `docs/features/README.md` (mục CCCD / nhận diện tài khoản phụ huynh) · M `docs/knowledge/incidents/FE-BUG-261021-seed-guardian-staff-phone-overlap.md` (ghi chú quy tắc đã bỏ) · M plan này
- Steps:
  1. Ghi quyết định Q1–Q4 theo `.ai/workflows/update-knowledge.md` T1; grep tham chiếu "tài khoản nhân sự" trong `docs .ai .claude .agents`.
  2. Soạn đề xuất BE (chỉ sửa repo BE khi user cho phép): (a) sửa AUTH-18 — bỏ "SĐT của nhân sự ⇒ từ chối", tài khoản nhân sự tách riêng; tên đăng nhập là duy nhất nên BE cần chặn tên đăng nhập nhân sự có dạng SĐT (10 số, bắt đầu 0) để không đụng tên đăng nhập phụ huynh; (b) API tiếp nhận trẻ (khi có) kiểm 1 người 1 tài khoản như FE; `POST /children/guardian-check`; (c) BE ghi rõ ký tự họ tên Keycloak từ chối để FE kiểm khi tiếp nhận.
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-18 (lệch, user chốt) | `tests/children/guardian-activation-ready.test.mjs` "AC-1" (mock); `guardian-compat.test.mjs` | 1 | pass (đỏ trước khi sửa: 409 nhân sự) |
| AC-2 | — | cùng file, "AC-2" (mock); `guardian-compat.test.mjs` | 1 | pass (đỏ trước khi sửa: 409 CCCD do ghép theo email) |
| AC-3 | — | cùng file, "AC-3" (utils + mock Excel) | 1 | pass (đỏ trước khi sửa: họ tên 151 ký tự lọt) |
| AC-4 | AUTH-18 | cùng file, "AC-4" (mock) | 1 | pass (chặn hồi quy) |
| AC-5 | — | cùng file, "AC-5" (mock) + trình duyệt | 2 | pass; trình duyệt đạt |
| AC-6 | — | `tests/children/guardian-citizen-id.test.mjs` AC-4, AC-7, AC-8 (có sẵn) | 1 | pass |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE thật vẫn 409 khi SĐT là tên đăng nhập nhân sự (AUTH-18 chưa sửa) | Khi nối API, trường hợp hiếm này vẫn lỗi ở kích hoạt | Phase 3 đề xuất BE; ghi PROPOSED | — |
| Bỏ ghép tài khoản theo email | Phụ huynh trước đây được ghép theo email nay tạo tài khoản theo SĐT | BE vốn không ghép theo email; DB demo không có trường hợp SĐT mới + email của tài khoản khác | Trả lại tìm theo email |
| Giới hạn họ tên 150 chặn Sửa hồ sơ có họ tên phụ huynh dài hơn (nhập Excel trước đây) | Phải rút gọn tên khi sửa | Câu lỗi đúng ô | — |
| Phiên Claude khác đang mở trên cùng repo, cùng sửa `childrenMockRepository.js`, `EnrollChildPage.jsx` | Sửa chồng nhau | Đọc lại file ngay trước khi sửa; sửa từng đoạn nhỏ | Hoàn lại từng đoạn của plan này; không dùng lệnh git phá hủy khi chưa hỏi |
| Contract tiếp nhận PROPOSED; `POST /children/guardian-check` chưa có ở BE | API thật có thể khác | Phase 3 đề xuất BE | — |
| Keycloak từ chối ký tự họ tên, chưa có danh sách | Kích hoạt thật có thể 400 | Phase 3 đề xuất BE ghi rõ; FE không đoán | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `checkGuardianConflicts` mới — `EnrollChildPage.jsx:156-180`; kích hoạt bỏ lỗi K1, K2 — `src/components/account/GuardianPanel.jsx:44`, `guardianMockRepository.addGuardian` (`:214`); giới hạn họ tên mới — `EnrollChildPage.jsx`, `src/pages/children/EditChildPage.jsx:103`, `previewImport` (`childrenMockRepository.js:1010-1011`)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file (12 file, không tính plan): không tách — một thay đổi liền mạch, Phase 2 nhỏ và dựa vào cùng kiểm của Phase 1
- [x] Không dùng rule PENDING/OPEN như đã chốt (lệch AUTH-18 do user chốt, ghi PROPOSED)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-27 — Plan (draft)
- Chưa sửa code. Verify sau khi viết plan: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.

### 2026-10-28 — User chốt Q1–Q5, plan approved
- Q1 user chọn phương án mới (bỏ hẳn kiểm trùng nhân sự) ⇒ bỏ hàm kiểm chung mới; Phase 1 thành bỏ K1, K2 ở kích hoạt + đồng bộ giới hạn họ tên.
- Khác plan 2026-10-27: giới hạn họ tên 150 thay 100 (lý do ở Key decisions).
- Chế độ tự chạy (CLAUDE.md): làm liền Phase 1–3, không dừng giữa phase.

### 2026-10-28 — Phase 1 (done)
- `linkGuardian` và `activateParentAccount` bỏ K1, K2, tài khoản tìm theo SĐT; `validateChildInfo` chặn họ tên phụ huynh quá 150 ký tự. Test cũ: `guardian-compat` đổi sang "không chặn, ghép theo SĐT"; bỏ lọc `notStaff` ở 2 file test.
- Test mới đỏ trước khi sửa (AC-1, AC-2, AC-3, AC-5), sau sửa: `npm run test:children` 52/53 (còn AC-5 của Phase 2), `npm run test:merge` 46/46.
- Commit: chưa commit.

### 2026-10-28 — Phase 2 (done)
- Mock/API/facade `checkGuardianConflicts`; `EnrollChildPage` bước 1 gọi sau kiểm trùng hồ sơ, 409 ⇒ lỗi theo ô + toast "Thông tin phụ huynh chưa đúng".
- `npm run test:children` 53/53; prettier, eslint các file sửa sạch.
- Trình duyệt (dev server 5173 có sẵn, Playwright): CCCD của phụ huynh đã ghi ở hồ sơ khác + SĐT khác ⇒ ở lại bước 1, lỗi dưới ô CCCD, toast 409; sửa CCCD ⇒ lỗi mất, sang bước "Xếp lớp". Không lưu hồ sơ thử.
- Commit: chưa commit.

### 2026-10-28 — Phase 3 (done)
- `docs/features/README.md` mục "Tiếp nhận được thì kích hoạt được"; ghi chú cập nhật ở incident FE-BUG-261021.
- Đề xuất BE cho Q1, Q2 đã có ở `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` L-17, L-18 (phiên khác soạn, dẫn plan này); đề xuất `POST /children/guardian-check` ghi ở `docs/features/README.md`. Chưa sửa repo BE.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Khác plan: không tự soạn mục `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` riêng vì file lệch BE–FE ở trên đã gom; ký tự họ tên Keycloak vẫn là đề xuất mở (chưa ghi ở file đó).
