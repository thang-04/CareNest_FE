---
title: Tiếp nhận bằng form kích hoạt tài khoản phụ huynh ngay; ghi các quyết định lệch BE–FE
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # theo nhánh hiện tại; xác nhận task Jira khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, identity-access]
rules: [AUTH-18]
risk: high
created: 2026-10-28
updated: 2026-10-28
---
# Tiếp nhận bằng form kích hoạt tài khoản phụ huynh ngay; ghi các quyết định lệch BE–FE

## Context
User chốt 28/10/2026 danh sách lệch BE–FE của nhánh (`docs/integration/CHILD_ENROLLMENT_BE_GAPS.md`): "L-01 A, L-03 A, L-06 A, L-07 A, L-08 A, L-09 A, L-10 A, L-14 chuyển thành khi tiếp nhận trẻ thì kích hoạt ngay còn khi nhập từ Excel thì theo A, L-15 A, L-16 A (phụ huynh đổi SĐT thì tài khoản đăng nhập vẫn là số cũ)".

Hiện trạng FE: form tiếp nhận lưu phụ huynh ở trạng thái "Chưa kích hoạt" (`createChild`, `src/services/children/mock/childrenMockRepository.js:724`); kích hoạt ở màn Tài khoản phụ huynh (`activateGuardians`, `src/services/account/mock/guardianMockRepository.js:229`). Logic tạo/liên kết tài khoản (`linkGuardian`, `:110`) nằm ở module tài khoản, mà module này đã import module trẻ (`guardianMockRepository.js:2`) ⇒ module trẻ không gọi ngược được. Ô SĐT của phụ huynh đã có tài khoản đang khóa (`src/components/children/ChildInfoFields.jsx:188-199`).

## Quyết định đã chốt
1. L-01 A, L-03 A, L-06 A, L-07 A, L-08 A, L-09 A, L-10 A, L-15 A (SMS), L-16 A (nhận diện theo CCCD) — user, 2026-10-28. FE đã làm đúng các mục này; phần còn lại là việc của BE (đề xuất ở tài liệu lệch).
2. L-14: tiếp nhận bằng form ⇒ kích hoạt tài khoản phụ huynh ngay khi lưu; nhập Excel ⇒ 2 bước (lưu phụ huynh, kích hoạt sau) — user, 2026-10-28.
3. L-16: phụ huynh đổi SĐT thì tên đăng nhập vẫn là số cũ — user, 2026-10-28.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Hiệu trưởng, Phó hiệu trưởng · outcome: lưu form tiếp nhận xong thì phụ huynh có tài khoản, mật khẩu tạm gửi qua SMS · rule: AUTH-18 (BE CONFIRMED, lệch — đề xuất BE sửa theo L-14, L-15, L-16) · flow: [S] nhập trẻ, phụ huynh → [S] kiểm trùng, kiểm điều kiện phụ huynh → [S] lưu = tạo hồ sơ + tạo/liên kết tài khoản + gửi SMS.
- **Đối chiếu thiết kế ban đầu:** quyết định 23/10 "kích hoạt cả nhà ở màn Tài khoản phụ huynh" (`docs/architecture/ROUTE_MAP.md:50`) nay chỉ còn cho hồ sơ nhập từ Excel và phụ huynh chưa kích hoạt.
- **Ảnh hưởng:** FE `/children/new` (bước Xem lại, màn kết quả), `/children/import` (câu chữ), `/children/activation` (không đổi) · BE contract `POST /children/enrollments` · APP: phụ huynh nhận SMS sớm hơn · dữ liệu cũ: không đổi.

### Câu hỏi mở
Chế độ tự chạy: tự chọn phương án khuyến nghị, ghi giả định để user soát.
- [x] G1 — Phụ huynh khớp tài khoản có sẵn (CCCD, hoặc SĐT với tài khoản cũ chưa có CCCD) ⇒ chỉ liên kết, không tạo tài khoản, không gửi SMS (như kích hoạt hiện nay).
- [x] G2 — Người lưu không có quyền kích hoạt phụ huynh ở điểm trường đó ⇒ vẫn lưu hồ sơ, phụ huynh "Chưa kích hoạt", kích hoạt sau (như Excel).
- [x] G3 — Tạo tài khoản cùng giao dịch với lưu hồ sơ (lỗi tạo tài khoản ⇒ không lưu gì); SMS lỗi không hủy lưu, màn kết quả chỉ lối gửi lại ở màn Tài khoản phụ huynh.
- [x] G4 — Sửa hồ sơ thêm phụ huynh mới: giữ như cũ (kích hoạt ở màn Tài khoản phụ huynh) vì quyết định chỉ nói "khi tiếp nhận".
- [x] G5 — L-16 "đổi SĐT": FE hiện không cho đổi SĐT của phụ huynh đã có tài khoản (ô khóa) nên tên đăng nhập không đổi; cho đổi SĐT liên lạc là việc mới (SĐT đang là khóa nối phụ huynh–tài khoản ở nhiều màn) ⇒ chỉ ghi quy tắc + đề xuất BE, làm ở plan khác khi user yêu cầu.
- [x] G6 — Bước Xem lại báo trước "lưu sẽ tạo tài khoản, gửi SMS" khi người dùng có quyền kích hoạt (SMS là hành động ra ngoài, không thu hồi được).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| G1–G6 | Như trên (giả định chế độ tự chạy, chờ user soát) | Claude | 2026-10-28 | `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` |

## Acceptance criteria
- **AC-1** (AUTH-18, L-14): Given form tiếp nhận có 2 phụ huynh chưa có tài khoản, When lưu, Then tạo 2 tài khoản (tên đăng nhập = SĐT), gửi SMS, phụ huynh "Đang hoạt động"; kết quả trả `guardianAccounts` = CREATED.
- **AC-2** (G1): Given phụ huynh có CCCD khớp tài khoản có sẵn, When lưu, Then chỉ liên kết (LINKED), không tạo tài khoản, không gửi SMS.
- **AC-3** (G3): Given SĐT gửi SMS lỗi, When lưu, Then hồ sơ và tài khoản vẫn lưu, `smsStatus` FAILED.
- **AC-4** (L-14): Given nhập Excel, When nhập, Then phụ huynh "Chưa kích hoạt", không tạo tài khoản; kích hoạt sau ở màn Tài khoản phụ huynh được.
- **AC-5** (G2): Given người lưu có quyền Thêm nhưng không có quyền Sửa hồ sơ trẻ, When lưu, Then hồ sơ lưu, phụ huynh "Chưa kích hoạt" (NOT_ACTIVATED).
- **AC-6** (G6): bước Xem lại có ghi chú tạo tài khoản + SMS; màn kết quả liệt kê từng phụ huynh (tạo mới / liên kết / chưa kích hoạt / SMS lỗi) và lối sang màn Tài khoản phụ huynh khi cần.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nơi kích hoạt khi lưu form | BE giả: `enrollChild` gọi hàm dùng chung `activatePendingGuardians` (tách sang `src/mocks/parentAccountMock.js`) | Trang `EnrollChildPage` gọi thêm `activateGuardians` của module tài khoản | Trang ở `pages/children` không được import module tài khoản (ESLint, không thêm nợ); một giao dịch thì không có hồ sơ lưu mà tài khoản hỏng |
| Báo kết quả tài khoản | Trả `guardianAccounts` [{ fullName, phone, result, smsStatus }] trong kết quả lưu | Màn hình tự suy từ `guardians[].accountStatus` | Không suy nghiệp vụ ở UI; contract rõ cho BE |

## Phases
### Phase 1 — BE giả + test
- Files: C `src/mocks/parentAccountMock.js` · M `src/services/account/mock/guardianMockRepository.js` · M `src/services/children/mock/childrenMockRepository.js` · C `tests/children/enroll-activates-guardians.test.mjs` · M `tests/children/guardian-activation-ready.test.mjs`
- Tests: AC-1..AC-5 → `enroll-activates-guardians.test.mjs`; AC-1, AC-2, AC-4 cũ của `guardian-activation-ready.test.mjs` sửa theo L-14.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Màn hình
- Files: M `src/utils/children/childrenPermissions.js` · M `src/pages/children/EnrollChildPage.jsx` · M `src/pages/children/ImportChildrenPage.jsx`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; chạy thử trình duyệt (mock).

### Phase 3 — Tài liệu
- Files: M `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` (kết quả chốt + đề xuất BE) · M `docs/features/README.md` · M `docs/architecture/ROUTE_MAP.md` · M `src/services/children/api/childrenApi.js` (contract) · plan → `completed/`
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-18 | `enroll-activates-guardians.test.mjs` (mock) | 1 | pass; trình duyệt: tạo + SMS tới 0900000911 |
| AC-2 | — | `enroll-activates-guardians.test.mjs` (mock) | 1 | pass |
| AC-3 | — | `enroll-activates-guardians.test.mjs` (mock) | 1 | pass; trình duyệt: số đuôi 99 báo SMS lỗi, nút "Gửi lại mật khẩu" |
| AC-4 | — | `enroll-activates-guardians.test.mjs`, `guardian-activation-ready.test.mjs` (mock) | 1 | pass |
| AC-5 | — | `enroll-activates-guardians.test.mjs` (mock) | 1 | pass |
| AC-6 | — | trình duyệt (mock, Hiệu trưởng) | 2 | pass: ghi chú ở Xem lại; màn kết quả; màn Tài khoản phụ huynh hiện 2 tài khoản Đang hoạt động |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lưu form gửi SMS ngay | Phụ huynh nhận tin không thu hồi được | Bước Xem lại báo trước; kiểm điều kiện phụ huynh ở bước 1 (plan 27/10) | Bỏ lời gọi `activatePendingGuardians` trong `enrollChild` |
| Tách `linkGuardian` sang file dùng chung | Lỗi màn Tài khoản phụ huynh | Giữ nguyên logic, chạy toàn bộ test children + merge | Trả hàm về `guardianMockRepository.js` |
| BE chưa đổi AUTH-18 | Chế độ API thật lệch | Ghi contract đề xuất; đề xuất BE ở tài liệu lệch | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `POST /children/enrollments` (`EnrollChildPage`) trả thêm `guardianAccounts`
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách — một thay đổi liền mạch (lưu form = kích hoạt)
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-28 — Plan
- Chế độ tự chạy: plan tự duyệt theo CLAUDE.md, làm liền các phase; giả định G1–G6 chờ user soát.
- Commit: chưa commit

### 2026-10-28 — Phase 1 (done)
- Tách `linkGuardian`, `sendPasswordSms`, `temporaryPassword`, xem tài khoản, phụ huynh chờ kích hoạt sang `src/mocks/parentAccountMock.js` (logic giữ nguyên) + `activatePendingGuardians`; `guardianMockRepository.js` dùng lại; `enrollChild` kích hoạt khi người lưu có quyền, trả `guardianAccounts`.
- Test: `enroll-activates-guardians.test.mjs` 5 ca mới; `guardian-activation-ready.test.mjs` AC-1, AC-2, AC-4 sửa theo L-14 (kiểm `guardianAccounts` thay vì gọi `activateGuardians` sau khi lưu form). `npm run test:children` 58/58, `test:merge` 46/46, `test:health` 19/19, `test:hardening` 27/27, `test:dashboard` 12/12.
- Khác plan: test mới viết sau khi sửa code (không có lần chạy đỏ trước).
- Commit: chưa commit

### 2026-10-28 — Phase 2 (done)
- `canActivateParentsAt` (`childrenPermissions.js`); `EnrollChildPage` ghi chú ở bước Xem lại + màn kết quả theo `guardianAccounts`; `ImportChildrenPage` câu chữ "kích hoạt sau".
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Trình duyệt (Vite mock, Hiệu trưởng): AC-6 như bảng trên. Vite cũ còn giữ cổng 5199 (PID 9776) — dùng tạm rồi tắt.
- Commit: chưa commit

### 2026-10-28 — Phase 3 (done)
- `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` (kết quả chốt, mục "Đề xuất cho BE"), `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, contract ở `childrenApi.js`. Plan chuyển sang `docs/plans/completed/`.
- Commit: chưa commit

### 2026-10-28 — User soát giả định
- G4 chốt: Sửa hồ sơ thêm phụ huynh mới ⇒ kích hoạt sau.
- G2 chưa chốt (user chưa rõ) ⇒ ghi PENDING `BE:docs/business/BUSINESS_RULES.md` P-18; FE giữ cách tạm (lưu, phụ huynh chờ kích hoạt).
- G5 thay bằng quyết định mới: sửa được thông tin phụ huynh, đổi SĐT ⇒ đổi tên đăng nhập + mật khẩu mới (`docs/plans/completed/2026-10-28-guardian-info-editable.md`).
