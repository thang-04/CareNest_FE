---
title: Sửa được thông tin phụ huynh đã có tài khoản; đổi SĐT thì đổi tên đăng nhập, gửi mật khẩu mới
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
# Sửa được thông tin phụ huynh đã có tài khoản; đổi SĐT thì đổi tên đăng nhập, gửi mật khẩu mới

## Context
User chốt 28/10/2026 (trả lời mục 2): "vẫn cho đổi thông tin không khóa đổi thông tin như hiện tại, nếu đổi sđt thì tài khoản cũng đổi sđt và mật khẩu mới, gửi lại về cho sđt này". Thay câu chốt trước đó cùng ngày ở L-16 ("đổi SĐT thì tên đăng nhập vẫn là số cũ", `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md`). Cùng tin nhắn: "Sửa hồ sơ thêm phụ huynh mới ⇒ kích hoạt sau" — chốt.

Hiện trạng FE:
- Form khóa ô phụ huynh có tài khoản: CCCD (`idLocked`), họ tên/SĐT/email khi CCCD khớp tài khoản (`!!acc`), SĐT của phụ huynh đã có tài khoản (`locked`) — `src/components/children/ChildInfoFields.jsx:120-230`; giá trị hiển thị và gửi đi bị thay bằng giá trị tài khoản (`withGuardianAccounts`, `src/utils/children/childrenHelpers.js:35-39`).
- BE giả không tin client: CCCD khớp tài khoản ⇒ họ tên/SĐT/email theo tài khoản (`withAccounts`, `src/services/children/mock/childrenMockRepository.js:449`); Sửa hồ sơ giữ CCCD theo tài khoản (D5, `updateChild`).
- Kiểm trùng danh tính (`identityConflict`, `src/mocks/guardianIdentity.js:18`) coi bản ghi cũ của chính phụ huynh (cùng CCCD, SĐT cũ) là người khác ⇒ đổi SĐT sẽ báo lỗi nhầm.
- Phụ huynh nối với tài khoản bằng SĐT ở nhiều chỗ (`parentAccountOf`, `src/services/account/mock/guardianCompatibility.js:4`).

## Quyết định đã chốt
1. Thông tin phụ huynh (họ tên, SĐT, email, CCCD) sửa được ở hồ sơ trẻ, không khóa; sửa ⇒ tài khoản đổi theo — user, 2026-10-28.
2. Đổi SĐT của phụ huynh đã có tài khoản ⇒ tên đăng nhập đổi sang SĐT mới, cấp mật khẩu tạm mới, gửi SMS tới SĐT mới — user, 2026-10-28.
3. Sửa hồ sơ thêm phụ huynh mới ⇒ kích hoạt sau ở màn Tài khoản phụ huynh — user, 2026-10-28.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Hiệu trưởng, Phó hiệu trưởng (quyền sửa hồ sơ trẻ) · outcome: sửa đúng thông tin phụ huynh mà không phải gỡ/tạo lại tài khoản · rule: AUTH-18 (BE: tên đăng nhập = SĐT, không đổi được ⇒ đề xuất BE) · flow: [S] sửa ô phụ huynh → [S] lưu → [S] cập nhật tài khoản + mọi hồ sơ trẻ của phụ huynh đó → [S] đổi SĐT thì cấp mật khẩu mới, SMS số mới.
- **Ảnh hưởng:** FE `/children/:id/edit`, `/children/new` (CCCD khớp tài khoản) · màn Tài khoản phụ huynh hiện tên đăng nhập mới · APP: phụ huynh đăng nhập bằng số mới · dữ liệu cũ: không đổi.

### Câu hỏi mở
Chế độ tự chạy: tự chọn phương án khuyến nghị, ghi giả định để user soát.
- [x] H1 — Áp dụng ở cả form tiếp nhận (CCCD khớp tài khoản) lẫn Sửa hồ sơ; ô trống điền sẵn theo tài khoản, số đã gõ không bị ghi đè; SĐT khác tài khoản thì cảnh báo ngay dưới phụ huynh.
- [x] H2 — Nhập Excel giữ như cũ: dòng có CCCD khớp tài khoản dùng thông tin tài khoản, không sửa tài khoản từ file.
- [x] H3 — Không đổi cùng lúc CCCD và SĐT của phụ huynh đã có tài khoản (dễ thành thay người khác vào tài khoản cũ) ⇒ báo lỗi, đổi từng thông tin hoặc gỡ phụ huynh ở màn Tài khoản phụ huynh rồi thêm người mới.
- [x] H4 — Phụ huynh đã có tài khoản vẫn không xóa được ở form (gỡ ở màn Tài khoản phụ huynh) vì quyết định chỉ nói "đổi thông tin".
- [x] H5 — Số mới trùng SĐT/CCCD của phụ huynh khác ⇒ 409 như hiện nay.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| H1–H5 | Như trên (giả định chế độ tự chạy, chờ user soát) | Claude | 2026-10-28 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1**: Given phụ huynh đã có tài khoản, When Sửa hồ sơ đổi SĐT, Then tài khoản đổi SĐT và tên đăng nhập sang số mới, cấp mật khẩu tạm mới, SMS tới số mới; mọi hồ sơ trẻ khác của phụ huynh đó hiện số mới; kết quả lưu trả `accountChanges`.
- **AC-2**: Given phụ huynh đã có tài khoản, When đổi họ tên, email hoặc CCCD, Then tài khoản và mọi hồ sơ trẻ của phụ huynh đó đổi theo, không cấp mật khẩu mới.
- **AC-3**: Given form tiếp nhận có CCCD khớp tài khoản và SĐT khác, When lưu, Then liên kết tài khoản, đổi tên đăng nhập, gửi mật khẩu mới; `guardianAccounts` báo đổi SĐT.
- **AC-4** (H5): Given số mới đã thuộc phụ huynh khác, When lưu, Then 409 dưới ô SĐT; không đổi gì.
- **AC-5** (H3): Given đổi cả CCCD và SĐT của phụ huynh đã có tài khoản, When lưu, Then 422 dưới ô CCCD.
- **AC-6** (H2): Given nhập Excel dòng CCCD khớp tài khoản, Then dùng thông tin tài khoản như cũ.
- **AC-7**: các ô phụ huynh không khóa; cảnh báo khi SĐT khác tài khoản; màn kết quả/toast báo đổi tên đăng nhập + SMS.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nhận ra tài khoản khi sửa | Theo CCCD; đổi CCCD thì theo phụ huynh cũ cùng vị trí | Theo SĐT như hiện nay | SĐT là thứ đang đổi; CCCD là khóa nhận diện (L-16) |
| Kiểm trùng khi đổi | `identityConflict` bỏ qua bản ghi của chính tài khoản đó | Giữ nguyên | Bản ghi cũ cùng CCCD, SĐT cũ là cùng một người |

## Phases
### Phase 1 — BE giả + test
- Files: M `src/mocks/guardianIdentity.js` · M `src/mocks/parentAccountMock.js` · M `src/services/children/mock/childrenMockRepository.js` · C `tests/children/guardian-info-editable.test.mjs` · M `tests/children/guardian-citizen-id.test.mjs`, `tests/children/guardian-link-by-citizen-id.test.mjs` (theo quyết định mới)
- Exit: `npm run test:children`, `test:merge` pass; `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Màn hình
- Files: M `src/utils/children/childrenHelpers.js` · M `src/components/children/ChildInfoFields.jsx` · M `src/pages/children/EditChildPage.jsx` · M `src/pages/children/EnrollChildPage.jsx`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; chạy thử trình duyệt (mock).

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md` · M `src/services/children/api/childrenApi.js` (contract) · plan → `completed/`
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-6 | AUTH-18 | `guardian-info-editable.test.mjs` (mock) | 1 | 6/6 pass |
| AC-7 | — | trình duyệt (mock) | 2 | pass lần 2 (đổi SĐT ⇒ tên đăng nhập `0900000921`, SMS, toast); lần 1 lưu số cũ, chưa tái hiện — `FE-BUG-261028-edit-child-first-save-stale-phone` |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Gõ nhầm SĐT của phụ huynh đã có tài khoản | Đổi tên đăng nhập, mật khẩu cũ mất hiệu lực | Cảnh báo ngay dưới phụ huynh; điền sẵn không ghi đè; chặn đổi cả CCCD + SĐT | Khóa lại ô SĐT (bản trước) |
| Bản sao phụ huynh ở hồ sơ khác lệch tài khoản | Mất liên kết, thông báo gửi sai | Cập nhật mọi bản sao trong cùng giao dịch; test hồ sơ anh/chị | — |
| BE chưa cho đổi tên đăng nhập (Keycloak) | Chế độ API thật lệch | Ghi đề xuất BE | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `PUT /children/{id}` (`EditChildPage`) trả `accountChanges`; `POST /children/enrollments` (`EnrollChildPage`) `guardianAccounts` thêm `phoneChanged`
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file: không tách — một quy tắc liền mạch
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review

## Progress log
### 2026-10-28 — Plan
- Chế độ tự chạy: plan tự duyệt theo CLAUDE.md; giả định H1–H5 chờ user soát.
- Commit: chưa commit

### 2026-10-28 — Phase 1 (done)
- `identityConflict` nhận `sameAccount`; `parentAccountMock.js` thêm `differsFromAccount`, `applyGuardianEdits`; children mock: `attachAccounts` (giữ giá trị client, nhận tài khoản theo CCCD/phụ huynh cũ cùng vị trí), `cleanGuardians` giữ trạng thái theo CCCD, `enrollChild`/`updateChild` cập nhật tài khoản (`guardianAccounts.phoneChanged`, `accountChanges`), chặn đổi cùng lúc CCCD + SĐT; `checkGuardianConflicts` không ghi đè giá trị.
- Test: `guardian-info-editable.test.mjs` 6/6; sửa `guardian-citizen-id.test.mjs` (AC-4, AC-5) và `guardian-link-by-citizen-id.test.mjs` (AC-2, AC-4) theo quyết định mới — trước đó vẫn qua nhưng chỉ vì so với chính object tài khoản đã bị sửa. `test:children` 64/64, `test:merge` 46/46, `test:health` 19/19, `test:hardening` 27/27, `test:dashboard` 12/12.
- Commit: chưa commit

### 2026-10-28 — Phase 2 (done)
- `withGuardianAccounts` chỉ điền ô trống; `ChildInfoFields` mở khóa ô, gợi ý mới, cảnh báo SĐT khác tài khoản, phụ huynh có tài khoản vẫn không xóa; `EditChildPage` toast đổi tên đăng nhập; `EnrollChildPage` dòng kết quả đổi tên đăng nhập.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Trình duyệt: như bảng test; incident `FE-BUG-261028-edit-child-first-save-stale-phone` (open).
- Commit: chưa commit

### 2026-10-28 — Phase 3 (done)
- `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_GAPS.md`, contract `childrenApi.js`, `docs/knowledge/ISSUE_INDEX.md` + incident. Repo BE: nhánh phụ ghi AUTH-18, AUTH-20, AUTH-21, CHD-01..07, HLT-06, P-17 đóng, P-18 (user cho phép, chưa commit). Plan chuyển sang `docs/plans/completed/`.
- Commit: chưa commit
