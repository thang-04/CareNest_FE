---
title: Nhận diện tài khoản phụ huynh theo CCCD khi nhập phụ huynh
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child]
rules: []
risk: medium
created: 2026-10-23
updated: 2026-10-23
---

# Nhận diện tài khoản phụ huynh theo CCCD khi nhập phụ huynh

## Context

- User (2026-10-23, màn Tiếp nhận trẻ): "thay đổi nghiệp vụ xác minh theo CCCD không phải là sđt nữa"; form nhập phụ huynh: CCCD | Họ và tên / SĐT | Quan hệ với trẻ / Email; bỏ 2 tab "Đã có tài khoản" / "Chưa có tài khoản"; nhập trùng CCCD thì hiện thông tin tài khoản luôn.
- Hiện tại: tab "Đã có tài khoản" tìm tài khoản của điểm trường theo SĐT/CCCD/email (`src/components/children/ExistingGuardianPicker.jsx`), gửi `accountId` (`src/pages/children/EnrollChildPage.jsx:93-111`); tab "Chưa có tài khoản" nhập tay, trùng SĐT/email/CCCD thì gợi ý "Chọn tài khoản này" (`EnrollChildPage.jsx:119-142`, `:324-339`). BE giả liên kết theo `accountId` (`src/services/children/mock/childrenMockRepository.js:823-865`); CCCD của tài khoản khác SĐT ⇒ 409 `CITIZEN_ID_TAKEN` (`src/mocks/guardianIdentity.js:18-33`). Sửa hồ sơ nhận diện phụ huynh có tài khoản theo SĐT (`childrenMockRepository.js:868-905`).
- Tên đăng nhập app của phụ huynh là SĐT (`childrenMockRepository.js:1121-1150`).

## Quyết định đã chốt

1. D1 — CCCD là khóa nhận diện tài khoản phụ huynh khi nhập phụ huynh; tên đăng nhập app vẫn là SĐT, mật khẩu qua SMS như cũ (không đổi APP) — user, 2026-10-23.
2. D2 — Nhập CCCD trùng tài khoản có sẵn ⇒ hiện thông tin tài khoản; họ tên, SĐT, email tự điền theo tài khoản và khóa; chỉ chọn Quan hệ với trẻ. Lưu thì trẻ được liên kết vào tài khoản đó, không tạo tài khoản mới, không gửi mật khẩu — user, 2026-10-23.
3. D3 — SĐT trùng tài khoản/phụ huynh khác có CCCD khác ⇒ báo lỗi như hiện tại (SĐT vẫn duy nhất vì là tên đăng nhập) — user, 2026-10-23.
4. D4 — Áp dụng ở Tiếp nhận trẻ, Sửa hồ sơ trẻ, Nhập Excel (dòng có CCCD trùng tài khoản ⇒ liên kết, dùng thông tin tài khoản) — user, 2026-10-23.
5. D5 — Bố cục ô phụ huynh: CCCD | Họ và tên; SĐT | Quan hệ với trẻ; Email. Bỏ 2 tab tài khoản — user, 2026-10-23.

**Mặc định (tự chọn, user đổi được):**
- Tra CCCD trên mọi tài khoản phụ huynh của trường (1 người 1 tài khoản, không giới hạn điểm trường); thông tin trả về chỉ gồm họ tên, SĐT, email, trạng thái, trẻ trong phạm vi người xem (trẻ khác chỉ đếm số).
- Tra khi ô CCCD đủ 12 chữ số. BE vẫn tự liên kết theo CCCD khi lưu, không tin `accountId` client gửi.
- Tài khoản cũ chưa có CCCD (dữ liệu trước 2026-10-21): SĐT trùng tài khoản đó ⇒ liên kết và bổ sung CCCD vừa nhập vào tài khoản (giữ D2 của 2026-10-21).
- Lỗi SĐT trùng phụ huynh có CCCD khác hiện dưới ô SĐT (trước đây dưới ô CCCD).
- Màn "Phụ huynh của trẻ" (module tài khoản, thêm phụ huynh) không đổi trong plan này.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor Phó hiệu trưởng (tiếp nhận, nhập Excel, sửa hồ sơ), Hiệu trưởng (sửa hồ sơ) · outcome nhập phụ huynh đã có tài khoản chỉ cần CCCD + quan hệ · rule BE: chưa có (PROPOSED, nối tiếp `docs/plans/completed/2026-10-21-guardian-citizen-id-required.md`) · flow `[S]` tiếp nhận / sửa hồ sơ / nhập Excel → `[S]` liên kết tài khoản.
- **Đối chiếu thiết kế ban đầu:** test AC-4 2026-10-21 "CCCD của tài khoản, SĐT khác ⇒ 409" — đổi theo D2 (liên kết, dùng SĐT của tài khoản).
- **Ảnh hưởng:** module child · `FE: /children/new`, `/children/:id/edit`, `/children/import` · quyền không đổi · contract: thêm tra tài khoản theo CCCD, bỏ `parent-account-options`, `accountId` trong request không còn dùng · APP không đổi.

### Câu hỏi mở

Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Xác minh theo CCCD nghĩa là gì? | Nhận diện tài khoản bằng CCCD; đăng nhập vẫn SĐT | user | 2026-10-23 | `docs/features/README.md` |
| Trùng CCCD thì sao? | Tự điền theo tài khoản, khóa | user | 2026-10-23 | `docs/features/README.md` |
| Trùng SĐT, CCCD khác? | Báo lỗi như hiện tại | user | 2026-10-23 | `docs/features/README.md` |
| Áp dụng ở đâu? | Tiếp nhận, Sửa hồ sơ, Nhập Excel | user | 2026-10-23 | `docs/features/README.md` |

## Acceptance criteria

- **AC-1** (D1, D2): Given CCCD trùng tài khoản When tra Then trả họ tên, SĐT, email, trạng thái, trẻ trong phạm vi; CCCD không trùng ⇒ null; giáo viên ⇒ 403.
- **AC-2** (D2, D4): Given tiếp nhận với CCCD trùng tài khoản (họ tên/SĐT client gửi khác) When lưu Then phụ huynh của trẻ mang họ tên, SĐT, email của tài khoản; tài khoản có thêm trẻ; trạng thái tài khoản theo tài khoản (không cần kích hoạt).
- **AC-3** (D3): Given CCCD mới, SĐT của phụ huynh có CCCD khác When lưu Then 409, lỗi dưới `guardians.i.phone`.
- **AC-4** (D4): Given sửa hồ sơ, thêm phụ huynh có CCCD trùng tài khoản When lưu Then liên kết như AC-2.
- **AC-5** (D4): Given file Excel có dòng CCCD trùng tài khoản When xem trước Then không lỗi, có ghi chú dùng thông tin tài khoản; nhập thì liên kết.
- **AC-6** (D5): Form Tiếp nhận không còn 2 tab; ô theo thứ tự CCCD | Họ tên / SĐT | Quan hệ / Email; CCCD trùng tài khoản thì 3 ô liên hệ khóa, hiện khung tài khoản.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Ai liên kết tài khoản | BE giả liên kết theo CCCD khi lưu | Client gửi `accountId` | BE là nguồn; dùng chung cho tiếp nhận, sửa hồ sơ, Excel |
| Tra CCCD trên form | API tra 1 CCCD (khớp chính xác) | Tải danh sách tài khoản điểm trường | Không đổ cả danh sách tài khoản về client; Hiệu trưởng cũng dùng được |
| Tách plan (>8 file) | Không tách | Tách BE giả / giao diện | Một quy định; tách sẽ có lúc form không khớp BE |

## Phases

### Phase 1 — Backend giả, API, test
- Files: M `src/services/children/mock/childrenMockRepository.js` · M `src/mocks/guardianIdentity.js` · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js` · M `src/hooks/children/useChildRecords.js` · M `tests/children/guardian-citizen-id.test.mjs` · C `tests/children/guardian-link-by-citizen-id.test.mjs`
- Tests: AC-1…AC-5.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 2 — Giao diện
- Files: M `src/components/children/ChildInfoFields.jsx` · M `src/pages/children/EnrollChildPage.jsx` · M `src/pages/children/EditChildPage.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · D `src/components/children/ExistingGuardianPicker.jsx` · M `src/styles/modules/children.css`
- Tests: AC-6 → chạy thử trình duyệt.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M plan này.
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (gom sau khi FE hoàn thiện)

- `child`: `GET /children/parent-accounts/by-citizen-id?idNumber=` (Phó hiệu trưởng, Hiệu trưởng) trả `{ id, fullName, phone, idNumber, email, status, children[], otherChildrenCount, relation } | null` (relation: quan hệ ghi ở hồ sơ anh/chị, để gợi ý).
- POST enrollments, PUT `/children/{id}`, import: phụ huynh có `idNumber` trùng tài khoản ⇒ BE dùng họ tên, SĐT, email của tài khoản, thêm trẻ vào tài khoản, `accountStatus` theo tài khoản; bỏ `accountId` trong request và `GET /children/parent-account-options`. SĐT trùng phụ huynh có CCCD khác ⇒ 409 `guardians.i.phone`.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1…AC-5 | D1–D4 | `tests/children/guardian-link-by-citizen-id.test.mjs` (BE giả) | 1 | 5/5 pass |
| AC-6 | D5 | Chạy thử trình duyệt: Tiếp nhận, Sửa hồ sơ | 2 | Đạt |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Gõ nhầm CCCD trùng tài khoản người khác | Trẻ liên kết sai tài khoản | Khung tài khoản hiện họ tên, SĐT, trẻ đang liên kết để kiểm tra trước khi lưu | Revert commit; sửa hồ sơ đổi CCCD |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: Tiếp nhận, Sửa hồ sơ, Nhập Excel (web); APP không đổi
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ đã cân nhắc tách (Key decisions)
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan

## Progress log

### 2026-10-23 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (chạy sau Phase 2 vì giao diện còn dùng API cũ). Test riêng: `tests/children/*.test.mjs` + `tests/integration/selective-merge/*.test.mjs` → 76 pass, 0 fail.
- Khác plan: test AC-4, AC-5 của `tests/children/guardian-citizen-id.test.mjs` (2026-10-21) viết lại theo D2 (CCCD của tài khoản ⇒ liên kết). Lookup trả thêm `relation` (quan hệ ghi ở hồ sơ anh/chị) để gợi ý ô Quan hệ.

### 2026-10-23 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Chạy thử trình duyệt (Vite, mock, Phó hiệu trưởng điểm trường 1): Tiếp nhận không còn 2 tab, ô theo thứ tự CCCD | Họ tên / SĐT | Quan hệ / Email; nhập CCCD của tài khoản Phạm Văn Hải ⇒ tự điền, khóa họ tên/SĐT/email, khung tài khoản, gợi ý "Hồ sơ trẻ khác ghi: Bố". Sửa hồ sơ Ngô Hoàng Nam: phụ huynh đã liên kết hiện khóa theo tài khoản; thêm phụ huynh bằng CCCD có sẵn rồi lưu ⇒ hồ sơ có phụ huynh theo tài khoản. Chưa thử trên BE thật.
- Khác plan: thêm `src/utils/children/childrenHelpers.js` (`withGuardianAccounts`); bỏ CSS của tab và ô chọn tài khoản cũ; lưới ô phụ huynh 2 cột ở mọi màn, 1 cột trên điện thoại.

### 2026-10-23 — Phase 3 (done)
- Commit: chưa commit
- Tài liệu: `docs/features/README.md`. Plan chuyển sang `docs/plans/completed/`.
