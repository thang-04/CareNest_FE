---
title: BE giả theo nghiệp vụ tiếp nhận trẻ, phụ huynh đã chốt; đặc tả việc BE cần làm
status: done   # chế độ tự chạy (CLAUDE.md): tự duyệt, giả định chờ user soát
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # theo nhánh hiện tại; xác nhận task Jira khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, identity-access]
rules: [AUTH-18, AUTH-19, AUTH-20, AUTH-21, CHD-01, CHD-02, CHD-03, CHD-04, CHD-05, CHD-06, CHD-07, HLT-06]
risk: high
created: 2026-10-28
updated: 2026-10-28
---
# BE giả theo nghiệp vụ tiếp nhận trẻ, phụ huynh đã chốt; đặc tả việc BE cần làm

## Context
User 28/10/2026: "Hãy sửa toàn bộ BE giả theo đúng nghiệp vụ hiện tại và hãy ghi lại đây những thay đổi gì về BE mới để tôi bắt đầu tạo BE".

"Nghiệp vụ hiện tại" = các quyết định L-01..L-18 (`docs/integration/CHILD_ENROLLMENT_BE_GAPS.md`, P-18 = A) đã ghi vào `BE:docs/business/BUSINESS_RULES.md` (AUTH-18..21, CHD-01..07, HLT-06). Đối chiếu BE giả với các rule đó, còn lệch:
- API kích hoạt từng phụ huynh cũ còn trong BE giả trẻ (`activateParentAccount`, `resendParentSms`, `src/services/children/mock/childrenMockRepository.js:1276`, `:1324`): tạo trạng thái `PENDING_ACTIVATION`, không kiểm CCCD bắt buộc, không cấp mật khẩu đăng nhập được; trái AUTH-20 (kích hoạt mọi phụ huynh chưa có tài khoản một lần, khi lưu form hoặc ở màn Tài khoản phụ huynh). Không màn nào gọi.
- Trạng thái phụ huynh trong hằng số FE (`src/models/children/childrenConstants.js:130`) có `PENDING_ACTIVATION` (BE không có), thiếu `INACTIVE` (khóa — AUTH-19) ⇒ phụ huynh bị khóa hiện mã thô "INACTIVE".
- Mở lại hồ sơ đòi cả quyền Sửa (`canReadmitChild`, `src/utils/children/childrenPermissions.js:56`); CHD-01 + L-01 A xếp "mở lại hồ sơ" cùng nhóm tiếp nhận (`CHILD_ENROLL`).
- Tra tài khoản theo CCCD chỉ cho người có quyền Thêm hoặc Hiệu trưởng (`findParentAccountByCitizenId`, `childrenMockRepository.js:1232`) trong khi màn Sửa hồ sơ cũng tra (`src/pages/children/EditChildPage.jsx:35`) ⇒ PHT chỉ có quyền Sửa không thấy khung tài khoản.
- Sửa hồ sơ bỏ phụ huynh đã có tài khoản: chỉ giao diện ẩn nút xóa, BE giả vẫn lưu (`updateChild`, `childrenMockRepository.js:996`) ⇒ tài khoản còn liên kết trẻ mà hồ sơ mất phụ huynh đó (trái AUTH-19: gỡ ở màn Tài khoản phụ huynh).
- So khớp SĐT ở module trẻ không đổi `+84` thành `0` (`normalizePhone`, `src/utils/children/childrenValidation.js:15`) trong khi tên đăng nhập là SĐT chuẩn hóa 10 số bắt đầu 0 (AUTH-18) ⇒ nhập `+84…` không khớp tài khoản.
- Email tài khoản phụ huynh lưu nguyên hoa/thường (`src/mocks/parentAccountMock.js:95`, `:143`); BE đã làm L-17 lưu chữ thường.

## Quyết định đã chốt
1. L-01..L-18, P-18 = A — user, 2026-10-28 (`docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` "Kết quả chốt").
2. Thông tin phụ huynh sửa được; đổi SĐT ⇒ đổi tên đăng nhập, mật khẩu tạm mới gửi SMS số mới — user, 2026-10-28 (AUTH-21).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Hiệu trưởng, Phó hiệu trưởng (mảng "Hồ sơ trẻ": Thêm = tiếp nhận, nhập Excel, mở lại hồ sơ; Sửa = sửa hồ sơ, xếp lớp, khai báo sức khỏe, kích hoạt/quản lý phụ huynh) · outcome: BE giả là bản tham chiếu đúng để làm BE thật · rule: AUTH-18..21, CHD-01..07, HLT-06 (CONFIRMED).
- **Ảnh hưởng:** FE `/children/new`, `/children/:id/edit`, `/children/activation`, hồ sơ trẻ (nhãn trạng thái phụ huynh) · dữ liệu demo cũ có `PENDING_ACTIVATION` ⇒ chuyển một lần · APP: không.

### Câu hỏi mở
Chế độ tự chạy: tự chọn phương án khuyến nghị, ghi giả định để user soát.
- [x] G1 — Phạm vi "toàn bộ BE giả" = mọi chỗ BE giả chạm nghiệp vụ tiếp nhận trẻ + tài khoản phụ huynh (module trẻ, tài khoản phụ huynh, phần mock dùng chung). Sức khỏe định kỳ/đợt khám, đón trẻ không có quyết định mới ⇒ không sửa; đặc tả ghi rõ ngoài phạm vi.
- [x] G2 — Bỏ hẳn API kích hoạt từng phụ huynh cũ (BE giả, service, contract đề xuất); "Gửi lại mật khẩu" dùng cấp lại mật khẩu ở màn Tài khoản phụ huynh như hiện nay.
- [x] G3 — `POST /children/{id}/guardians` (thêm phụ huynh kèm tạo tài khoản, BE đã có) giữ ở BE giả vì BE đã làm và test ghép nhánh dùng; FE không gọi nữa, đặc tả ghi "BE quyết giữ làm bước nội bộ hay bỏ".
- [x] G4 — Lỗi ô vẫn 422 + `details` dạng map ở BE giả (13 file mock dùng); lệch `BE:docs/contracts/ERROR_CONTRACT.md` (400 + danh sách `{field, message}`) ghi vào đặc tả và `docs/knowledge/KNOWN_ISSUES.md`, không đổi trong việc này.
- [x] G5 — Đặc tả viết ở repo FE (`docs/integration/CHILD_ENROLLMENT_BE_SPEC.md`, "ghi lại đây"); không sửa repo BE (tin nhắn này không cho phép).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| G1–G5 | Như trên (giả định chế độ tự chạy, chờ user soát) | Claude | 2026-10-28 | `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` |

## Acceptance criteria
- **AC-1** (G2): BE giả trẻ không còn `activateParentAccount`, `resendParentSms`; service, contract đề xuất không còn 2 endpoint đó; kích hoạt chỉ qua lưu form tiếp nhận và `activateGuardians`.
- **AC-2** (AUTH-19): Given tài khoản phụ huynh bị khóa, Then phụ huynh trên hồ sơ trẻ có `accountStatus` `INACTIVE`, nhãn "Đã khóa"; DB demo có `PENDING_ACTIVATION` được chuyển thành tài khoản đang hoạt động.
- **AC-3** (CHD-01): Given PHT chỉ có quyền Thêm ở điểm trường của trẻ đã nghỉ, When mở lại hồ sơ, Then được; PHT chỉ có quyền Sửa ⇒ 403.
- **AC-4**: Given PHT chỉ có quyền Sửa hồ sơ trẻ, When tra tài khoản theo CCCD, Then trả tài khoản; giáo viên ⇒ 403.
- **AC-5** (AUTH-19): Given hồ sơ có phụ huynh đã liên kết tài khoản, When Sửa hồ sơ bỏ phụ huynh đó, Then 422 `guardians`, không đổi gì; sau khi gỡ liên kết ở màn Tài khoản phụ huynh thì bỏ được.
- **AC-6** (AUTH-18): SĐT `+84…` khớp tài khoản cùng số dạng `0…` (không coi là đổi SĐT, không cấp mật khẩu mới).
- **AC-7** (L-17): email tài khoản phụ huynh lưu chữ thường; lưu lại cùng email khác hoa/thường không coi là sửa tài khoản.
- **AC-8**: đặc tả BE liệt kê dữ liệu, quyền, endpoint (request/response/lỗi), tác dụng phụ (SMS, thông báo, Keycloak), chuyển dữ liệu cũ, điểm cần thống nhất; mỗi mục dẫn rule ID và hàm BE giả tham chiếu.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| API kích hoạt cũ | Bỏ | Giữ, sửa cho đúng | Không màn nào gọi; giữ lại làm người làm BE tưởng còn cần |
| Trạng thái phụ huynh | `NOT_ACTIVATED` / `ACTIVE` / `INACTIVE` | Giữ `PENDING_ACTIVATION` | Khớp `UserStatus` BE + "chưa có tài khoản" |
| Nơi ghi đặc tả | Tài liệu riêng ở FE, link từ tài liệu lệch | Thêm mục vào tài liệu lệch | Tài liệu lệch là nơi chốt; đặc tả dùng để làm BE, dài và đổi theo BE |

## Phases
### Phase 1 — BE giả + test
- Files: M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js` · M `src/utils/children/childrenPermissions.js` · M `src/utils/children/childrenValidation.js` · M `src/mocks/parentAccountMock.js` · M `src/models/children/childrenConstants.js` · M `src/components/children/ChildBadges.jsx` · C `tests/children/mock-be-current-business.test.mjs` · M `tests/children/guardian-citizen-id.test.mjs`
- Exit: `npm run test:children`, `test:merge`, `test:health`, `test:hardening`, `test:dashboard` pass; `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Đặc tả BE + tài liệu
- Files: C `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` · M `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` · M `docs/integration/BACKEND_INTEGRATION.md` · M `docs/features/README.md` · M `docs/knowledge/KNOWN_ISSUES.md` · plan → `completed/`
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-7 | AUTH-18, AUTH-19, CHD-01 | `mock-be-current-business.test.mjs`, `guardian-citizen-id.test.mjs` AC-4 (mock) | 1 | 7/7 pass; `test:children` 73/73 |
| AC-8 | — | đọc lại, `check-ai-layer` | 2 | `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Bỏ API cũ làm hỏng chỗ còn gọi | Lỗi màn hình | grep: chỉ service + 1 test gọi | Trả lại 2 hàm |
| Chặn bỏ phụ huynh có tài khoản ở Sửa hồ sơ | Người dùng phải gỡ ở màn Tài khoản phụ huynh | Câu lỗi chỉ đường | Bỏ kiểm |
| Đổi `normalizePhone` | So khớp SĐT khác trước | Chỉ thêm `+84` → `0`, test | Trả bản cũ |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer: bỏ `POST /children/{id}/guardians/{index}/activate|resend-sms` (không consumer); `PUT /children/{id}` thêm 422 `guardians` (`EditChildPage` hiện lỗi `guardians`)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file: không tách — cùng một lượt đối chiếu
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review

## Progress log
### 2026-10-28 — Plan
- Chế độ tự chạy: plan tự duyệt theo CLAUDE.md; giả định G1–G5 chờ user soát. P-18 = A và giả định kèm theo (người không có quyền kích hoạt không sửa được tài khoản có sẵn khi tiếp nhận) đã có trên đĩa trước việc này (thay đổi chưa commit), giữ nguyên.
- Commit: chưa commit

### 2026-10-28 — Phase 1 (done)
- BE giả trẻ: bỏ `activateParentAccount`, `resendParentSms`, `sendCredentials`; `updateChild` chặn bỏ phụ huynh đang liên kết tài khoản (422 `guardians`); `findParentAccountByCitizenId` theo `canLookupParentAccounts`; DB demo `PENDING_ACTIVATION` ⇒ `ACTIVE` một lần (`parentStatusVersion`). `canReadmitChild` theo quyền Thêm ở điểm trường của trẻ. `normalizePhone` (module trẻ) đổi `+84` ⇒ `0`. `parentAccountMock`: email tài khoản chữ thường, so không phân biệt hoa thường. Hằng số `PARENT_ACCOUNT_STATUS` = `NOT_ACTIVATED` / `ACTIVE` / `INACTIVE` ("Đã khóa"), badge theo. Service, contract đề xuất bỏ 2 endpoint cũ.
- Test: `mock-be-current-business.test.mjs` 7/7; `guardian-citizen-id.test.mjs` AC-4 chuyển sang `activateGuardians`. `test:children` 73/73, `test:merge` 46/46, `test:health` 19/19, `test:hardening` 27/27, `test:dashboard` 12/12.
- Commit: chưa commit

### 2026-10-28 — Phase 2 (done)
- Đặc tả `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` (thứ tự làm, quyền, migration, endpoint, luật phụ huynh, SMS, thông báo, Keycloak, điểm cần thống nhất, ngoài phạm vi). Link từ `CHILD_ENROLLMENT_BE_GAPS.md`, `BACKEND_INTEGRATION.md`; `docs/features/README.md` thêm mục; `docs/knowledge/KNOWN_ISSUES.md` FE-KI-003 (422 + map của BE giả lệch 400 + danh sách của BE). Repo BE không sửa.
- Commit: chưa commit

### 2026-10-28 — User xác nhận (C-1..C-6)
- C-1 P-18 = A, C-2 đồng ý giả định kèm P-18 (không sửa tài khoản có sẵn khi không có quyền kích hoạt), C-3 đồng ý phạm vi (G1), C-5 A lỗi theo ô (G4: BE giữ 400 + danh sách, FE chuyển khi nối API).
- C-4 A thay G3: bỏ `addGuardian` (`POST /children/{id}/guardians`) khỏi BE giả, giữ `linkGuardian` dùng chung; `guardian-citizen-id.test.mjs` AC-8 và `tests/integration/selective-merge/guardian-compat.test.mjs` chuyển sang thêm phụ huynh lên hồ sơ rồi `activateGuardians` (18/18 pass).
- C-6 có: chép đặc tả sang `BE:docs/plans/active/2026-10-28-child-enrollment-guardian-accounts.md` (status draft, câu hỏi mở D-1..D-6); `check-ai-layer` BE 7 lỗi cũ, không thêm lỗi.
- Tài liệu: bỏ chữ "chờ user soát" ở các mục đã xác nhận (`CHILD_ENROLLMENT_BE_GAPS.md`, `CHILD_ENROLLMENT_BE_SPEC.md`, `docs/features/README.md`, `childrenApi.js`, `KNOWN_ISSUES.md` FE-KI-003).
- Commit: chưa commit

### 2026-10-28 — User chốt D-1, D-2, D-4, D-5, D-6
- D-1 A (mã quyền `CHILD_ENROLL`, `CHILD_PROFILE_EDIT`, `CHILD_PLACEMENT`, giữ `PARENT_ACCOUNT_MANAGE`), D-2 A (SMS giả trước), D-4 A (một `GET /children` phân trang), D-5c B (nhập đầy đủ thông tin trẻ, không có hồ sơ thiếu), D-6 đồng ý: ghi vào đặc tả mục 2, 3.9, 6.1, 7; không đổi code FE (mã quyền thêm vào ma trận FE khi BE có; danh sách trẻ chuyển phân trang khi nối API).
- D-5a B: quan hệ 6 loại cho hồ sơ lẫn tài khoản — `guardianConstants.js` thêm `GRANDFATHER`, `GRANDMOTHER`, `SIBLING` (giữ `OTHER` cho dữ liệu cũ); `validateChildInfo` chỉ nhận 6 quan hệ; file Excel so không dấu (`toRelation`), cột mẫu ghi 6 giá trị.
- D-5b A: `MAX_GUARDIANS` chuyển vào `childrenConstants.js`; `validateChildInfo` chặn quá 3 (BE giả 422 `guardians`).
- Test: `guardian-relation-limit.test.mjs` 3/3; `test:children` 81/81, `test:merge` 46/46, `test:health` 19/19, `test:hardening` 27/27, `test:dashboard` 12/12.
- Plan BE sinh lại từ đặc tả (quyết định 10–14; còn mở D-3 Keycloak, D-7 PHT toàn trường so với AUTH-02); `check-ai-layer` BE 7 lỗi cũ.
- Commit: chưa commit
