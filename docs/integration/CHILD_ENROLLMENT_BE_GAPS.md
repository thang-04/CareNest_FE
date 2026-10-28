# Lệch BE–FE: tiếp nhận trẻ (nhánh G94-180) — đã chốt, chờ BE

Cập nhật 2026-10-28. **Chỉ gồm phần do nhánh `feature/G94-180-FE-FEAT-43-child-health-pickup` làm hoặc chốt:** commit `G94-180`, thay đổi chưa commit, plan của nhánh. Phần từ nhánh khác (vd. quyền Phó hiệu trưởng theo mảng của G94-179, màn tài khoản phụ huynh gốc của `58e3b0a`) và phần nền có trước khi tách nhánh (`21ec095`) không đưa vào đây.

Nguồn đọc BE: commit `aa64480` (trùng `origin/dev`, 22/10/2026). `BE:` = repo CareNest_BE. BE hiện có khung hồ sơ trẻ (`children`: id, họ tên, ngày sinh; `enrollments`; `guardian_child_links`), API xem trẻ và thêm/gỡ phụ huynh (tạo tài khoản ngay).

## Trạng thái

User chốt hết ngày 28/10/2026 (bảng "Kết quả chốt" cuối tài liệu), kể cả P-18 = A (xem L-14). FE đã làm theo. Quyết định đã ghi vào repo BE ngày 28/10 (user cho phép, chưa commit; mục "Đã ghi vào BE"); phần code/API là việc của BE. ID giữ như bản đầu; số không liền vì đã bỏ mục của nhánh khác.

**Việc BE cần làm** (dữ liệu, quyền, endpoint, SMS, thông báo, Keycloak, điểm cần thống nhất): [CHILD_ENROLLMENT_BE_SPEC.md](CHILD_ENROLLMENT_BE_SPEC.md). BE giả đã đối chiếu lại với các quyết định này ngày 28/10 (plan `docs/plans/completed/2026-10-28-mock-be-current-business.md`).

Ưu tiên: **1** = chặn thiết kế API tiếp nhận; **2** = chặn chi tiết API/dữ liệu; **3** = làm sau được.

| ID | Chủ đề | Nhánh làm | Ưu tiên | Đã chốt |
| --- | --- | --- | --- | --- |
| L-01 | Hiệu trưởng tiếp nhận, nhập Excel, mở lại hồ sơ, xếp lớp như PHT | chưa commit (27/10) | 1 | A — BE thêm quyền tiếp nhận, Hiệu trưởng cố định |
| L-03 | Điểm trường của trẻ: chọn khi chưa xếp lớp, đổi theo lớp | chưa commit (27/10) | 1 | A — BE lưu điểm trường tiếp nhận |
| L-06 | Cho nghỉ học, mở lại hồ sơ | `9743bba`, `4867b60` | 2 | A — BE thêm theo FE |
| L-07 | Kiểm trùng hồ sơ | `4867b60` | 2 | A — theo FE |
| L-08 | Thông tin hành chính (form, Excel) | `cb653ec` | 2 | A — BE thêm, bảng riêng |
| L-09 | Khai báo sức khỏe khi tiếp nhận, ai chốt dị ứng (P-17) | `9743bba`, `cb653ec`, `36afa3c` | 1 | A — người tiếp nhận chốt ngay |
| L-10 | Báo khi khai tiếp xúc người bệnh lao | `cb653ec`, `36afa3c` | 3 | A — BE phát như FE |
| L-14 | Phụ huynh chưa có tài khoản: 1 bước hay 2 bước | `4867b60`, plan 28/10 | 1 | Phương án mới: form tiếp nhận kích hoạt ngay; nhập Excel, Sửa hồ sơ thêm phụ huynh theo A (2 bước); người chỉ có quyền Thêm: vẫn lưu, phụ huynh mới chờ kích hoạt (P-18 = A) |
| L-15 | Gửi mật khẩu tạm: SMS hay in phiếu | `4867b60` | 1 | A — SMS |
| L-16 | Nhận diện phụ huynh: CCCD hay SĐT | `7232ae0`, `5e7f4a5` | 1 | A — CCCD; thông tin phụ huynh sửa được, đổi SĐT thì đổi tên đăng nhập + mật khẩu mới gửi SMS số mới |
| L-17 | Email phụ huynh | plan 28/10 | — | Chỉ để liên hệ; BE đã sửa |
| L-18 | SĐT phụ huynh trùng tài khoản nhân sự | plan 28/10 | — | Bỏ kiểm; BE đã sửa |

## A. Quyền và điểm trường

### L-01 — Hiệu trưởng tiếp nhận, nhập Excel, mở lại hồ sơ, xếp lớp như Phó hiệu trưởng
- **Nhánh:** user yêu cầu 27/10, chưa commit; plan `docs/plans/completed/2026-10-27-principal-child-enrollment.md`.
- **BE:** chưa có API, chưa có quyền cho tiếp nhận, nhập Excel, mở lại hồ sơ, xếp lớp; danh mục quyền chỉ có 6 mã (`BE:src/main/java/com/carenest/utils/enums/Permission.java:17-47`). Phó hiệu trưởng "như Hiệu trưởng nhưng trong campus được phân công" (`BE:docs/business/USER_ROLES.md:21`) ⇒ hướng BE khớp yêu cầu.
- **FE:** Hiệu trưởng làm các việc trên ở mọi điểm trường (`src/utils/children/childrenPermissions.js:45`, `:52`, `:56`).
- **A (đề xuất):** BE thêm quyền theo mẫu `PARENT_ACCOUNT_MANAGE`: cố định cho Hiệu trưởng, Phó hiệu trưởng theo ma trận (AUTH-10). Ví dụ `CHILD_ENROLL` (tiếp nhận, nhập Excel, mở lại hồ sơ) và `CHILD_PLACEMENT` (xếp/chuyển lớp, cho nghỉ học).
- **B:** Hiệu trưởng chỉ xem; bỏ thay đổi 27/10.
- **Chốt 28/10: A.**

### L-03 — Điểm trường của trẻ: chọn khi chưa xếp lớp, đổi theo lớp
- **Nhánh:** 27/10, chưa commit.
- **BE:** điểm trường của trẻ suy từ lớp đang học tại ngày xét (`BE:docs/business/DOMAIN_MODEL.md:28`, `BE:docs/modules/child.md:33-34`). Trẻ chưa có lớp: chỉ Hiệu trưởng thấy (`BE:src/main/java/com/carenest/security/authorization/StaffAccessPolicy.java:118-120`, `ChildAccessPolicy.java:42-43`). Trẻ chuyển lớp/campus giữa năm là hợp lệ (`BE:docs/knowledge/CROSS_MODULE_ISSUES.md:14` CMR-04). Chưa có API ghi enrollment.
- **FE:** người tiếp nhận được vào từ 2 điểm trường (Hiệu trưởng, PHT toàn trường) chọn "Điểm trường" khi tiếp nhận chưa xếp lớp và khi nhập Excel; trẻ chưa xếp lớp thuộc điểm trường đó (`src/services/children/mock/childrenMockRepository.js:673` `enrollCampusOf`). Xếp/chuyển sang lớp ở điểm trường khác ⇒ trẻ đổi điểm trường theo lớp (`placeChild`, `:1071`).
- **A (đề xuất):** BE lưu "điểm trường tiếp nhận" cho trẻ chưa có lớp (vd. cột `children.intake_campus_id`); có lớp thì theo lớp; xếp lớp đóng enrollment cũ, mở enrollment mới. Contract: `POST /children/enrollments` và `POST /children/enrollments/import` có `campusId` (bắt buộc khi chưa xếp lớp và người dùng toàn trường; ngoài phạm vi ⇒ 422 `campusId`; lớp khác `campusId` ⇒ 422 `classId`).
- **B:** theo BE — trẻ chưa có lớp không thuộc điểm trường nào, chỉ Hiệu trưởng thấy; bỏ ô "Điểm trường", Hiệu trưởng phải chọn lớp khi tiếp nhận. Hệ quả: trẻ Phó hiệu trưởng tiếp nhận mà chưa xếp lớp sẽ không hiện lại với Phó hiệu trưởng.
- **Chốt 28/10: A.**

## B. Hồ sơ trẻ

### L-06 — Cho nghỉ học, mở lại hồ sơ
- **Nhánh:** cho nghỉ học `9743bba` (16/10); mở lại hồ sơ `4867b60` (user 23/10).
- **BE:** không có trạng thái hồ sơ; "đang học" = enrollment chưa có ngày kết thúc (`BE:docs/database/DATA_DICTIONARY.md:84-95`); không có API nghỉ học, mở lại.
- **FE:** cho nghỉ học: ngày, lý do, tự đóng phiếu theo dõi, trẻ thành "Đã nghỉ học" (`childrenMockRepository.js:1103` `withdrawChild`). Mở lại hồ sơ cũ về "Chờ xếp lớp", giữ mã trẻ, lịch sử, sức khỏe, tài khoản phụ huynh (`:889` `readmitChild`).
- **A (đề xuất):** BE thêm trạng thái hồ sơ (lưu hoặc suy từ enrollment + bản ghi nghỉ học) và API `POST /children/{id}/withdraw`, `POST /children/{id}/readmit` như FE.
- **B:** nghỉ học chỉ là kết thúc enrollment; không có "mở lại" (trẻ quay lại = hồ sơ mới).
- **Chốt 28/10: A.**

### L-07 — Kiểm trùng hồ sơ
- **Nhánh:** `4867b60` (user 23/10).
- **BE:** không có.
- **FE:** trùng = cùng họ tên (giữ dấu), ngày sinh và CCCD của ít nhất một phụ huynh; trùng trẻ đã nghỉ ⇒ gợi ý mở lại (`childrenMockRepository.js:514` `sameChildOf`, `:855` `checkDuplicate`).
- **A (đề xuất):** BE làm `GET /children/duplicate-check` như FE (cần CCCD phụ huynh — L-16).
- **B:** trùng = họ tên + ngày sinh + SĐT phụ huynh (nếu L-16 chọn SĐT).
- **Chốt 28/10: A.**

### L-08 — Thông tin hành chính
- **Nhánh:** `cb653ec` (user 17/10; bắt buộc từ 22/10; nguồn chi trả luôn BHYT 23/10).
- **BE:** không có.
- **FE:** CCCD/mã định danh của trẻ, sinh non, tuần thai, dân tộc, đối tượng, nhóm máu, nơi ở; bắt buộc trừ CCCD trẻ và nhóm máu; nhập ở form tiếp nhận, Sửa hồ sơ, cột file Excel; phiếu khám đọc từ đây (`src/models/children/childProfile.js:6-17`; `docs/features/README.md:122-128`).
- **A (đề xuất):** BE thêm, bảng riêng (dữ liệu nhạy cảm, chỉ người có quyền xem hồ sơ trẻ trong phạm vi).
- **B:** bỏ khỏi tiếp nhận, chỉ nhập ở phiếu khám.
- **Chốt 28/10: A.**

### L-09 — Khai báo sức khỏe khi tiếp nhận, ai chốt dị ứng
- **Nhánh:** chốt dị ứng ngay `9743bba` (user 14/10); tiền sử `cb653ec` (17/10); ngày tiếp xúc lao `36afa3c` (21/10).
- **BE:** dị ứng thuộc module child; ai khai báo, ai xác nhận còn PENDING P-17 (`BE:docs/business/BUSINESS_RULES.md:77`, `:147`). Chưa có bảng, chưa có API.
- **FE:** người tiếp nhận chốt dị ứng ngay khi lưu, bếp dùng luôn; tiền sử bản thân, gia đình bắt buộc Có/Không; tiếp xúc người bệnh lao "Có" ⇒ bắt buộc ngày gần nhất (`childrenMockRepository.js:736` `createChild`, `:1139` `saveDeclaration`).
- **A (đề xuất):** chốt P-17 = người tiếp nhận (Hiệu trưởng/Phó hiệu trưởng) khai báo và chốt khi tiếp nhận; sửa sau ở Khai báo sức khỏe. BE thêm API khai báo như FE.
- **B:** cần thêm bước xác nhận riêng (ghi rõ ai xác nhận).
- **Chốt 28/10: A** (đóng P-17 phía FE; BE ghi lại khi user cho phép).

### L-10 — Báo khi khai tiếp xúc người bệnh lao
- **Nhánh:** `cb653ec`, `36afa3c`; thêm người lưu 27/10.
- **BE:** module notification mới ở mức thiết kế (`BE:docs/modules/notification.md:3`); chưa có sự kiện nào.
- **FE:** khai "Có" ⇒ báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp và người lưu (`childrenMockRepository.js:623` `notifyTbContactReported`); đổi ngày tiếp xúc ⇒ báo Hiệu trưởng, Phó hiệu trưởng điểm trường và người lưu (`:643` `notifyTbContactDateChanged`).
- **A (đề xuất):** BE phát 2 sự kiện này khi làm module notification.
- **B:** bỏ.
- **Chốt 28/10: A.**

## C. Phụ huynh và tài khoản

### L-14 — Phụ huynh chưa có tài khoản: 1 bước hay 2 bước
- **Nhánh:** làm lại kích hoạt `4867b60` (kích hoạt cả nhà ở màn Tài khoản phụ huynh); kiểm điều kiện kích hoạt ngay khi tiếp nhận — plan `docs/plans/completed/2026-10-27-guardian-activation-ready-at-enrollment.md` (duyệt 28/10).
- **BE:** phụ huynh = tài khoản. Thêm phụ huynh là tạo tài khoản và liên kết trẻ ngay, "không tạo rời" (AUTH-18 `BUSINESS_RULES.md:30`; `BE:docs/modules/identity-access.md:52`). BE đã có `GET|POST /children/{id}/guardians`, `PATCH /parent-accounts/{userId}/status`, `POST /parent-accounts/{userId}/temporary-password` (`BE:docs/api/openapi.yaml:478-626`).
- **FE:** phụ huynh lưu trên hồ sơ trẻ, trạng thái "Chưa kích hoạt"; màn Tài khoản phụ huynh tạo tài khoản cho cả N phụ huynh một lần (`src/services/account/mock/guardianMockRepository.js:229` `activateGuardians`); điều kiện kích hoạt kiểm từ lúc tiếp nhận (`POST /children/guardian-check`, `src/services/children/api/childrenApi.js:48`).
- **A (đề xuất):** BE thêm "phụ huynh trên hồ sơ trẻ" (chưa có tài khoản), API kiểm điều kiện trước khi lưu và API kích hoạt tạo tài khoản theo AUTH-18. Tiếp nhận nhiều trẻ, nhập Excel không phải tạo tài khoản ngay.
- **B:** theo BE — lưu tiếp nhận là tạo luôn tài khoản phụ huynh; FE nối thẳng API BE đã có, bỏ trạng thái "Chưa kích hoạt".
- **Chốt 28/10 (phương án mới):** form tiếp nhận ⇒ lưu là tạo/liên kết tài khoản và gửi SMS ngay (như B); nhập Excel ⇒ theo A (lưu phụ huynh "Chưa kích hoạt", kích hoạt sau ở màn Tài khoản phụ huynh). FE đã làm: `enrollChild` gọi `activatePendingGuardians` (`src/mocks/parentAccountMock.js`), trả `guardianAccounts`; plan `docs/plans/completed/2026-10-28-enroll-activates-guardians.md`.
- **Bổ sung 28/10:** Sửa hồ sơ thêm phụ huynh mới ⇒ kích hoạt sau (chốt). Người lưu có quyền tiếp nhận nhưng không có quyền quản lý tài khoản phụ huynh: **chốt P-18 = A** — vẫn lưu, phụ huynh chưa có tài khoản chờ kích hoạt, phụ huynh trùng CCCD tài khoản vẫn được liên kết (`BE:docs/business/BUSINESS_RULES.md` P-18 đã đóng).
- **Kèm P-18 (user xác nhận 28/10, C-1 A, C-2 đồng ý):** người không có quyền đó không sửa được tài khoản có sẵn khi tiếp nhận — BE dùng họ tên/SĐT/email của tài khoản như nhập Excel, không đổi tên đăng nhập, không cấp mật khẩu mới (`src/services/children/mock/childrenMockRepository.js` `enrollChild`); form khóa các ô đó và bước Xem lại báo trước phụ huynh nào chờ kích hoạt. Lưu ý BE: liên kết phụ huynh hiện cần `PARENT_ACCOUNT_MANAGE` (`POST /children/{id}/guardians`); FE dùng quyền "Sửa" hồ sơ trẻ làm quyền kích hoạt ⇒ khi làm AUTH-20 cần thống nhất một quyền.

### L-15 — Gửi mật khẩu tạm: SMS hay in phiếu
- **Nhánh:** `4867b60` (user bỏ màn in phiếu 23/10).
- **BE (đã chốt 16–17/10):** mật khẩu tạm hiện một lần để in phiếu, không gửi SMS (AUTH-18 `BUSINESS_RULES.md:30`). API trả `temporaryPassword` (`AddGuardianResponse`, `ParentPasswordResponse` trong `BE:docs/api/openapi.yaml`).
- **FE (user chốt 23/10):** gửi SMS tới SĐT đăng nhập; không hiện mật khẩu, không in phiếu; có "Gửi lại SMS" (`guardianMockRepository.js:76-87`; `docs/architecture/ROUTE_MAP.md:50`).
- **Hai quyết định của user mâu thuẫn, cần chọn một.**
- **A:** SMS (quyết định mới hơn) ⇒ BE sửa AUTH-18, cần nhà cung cấp SMS và chi phí; API không trả mật khẩu.
- **B:** in phiếu (BE đã làm) ⇒ FE thêm hộp hiện mật khẩu một lần và in phiếu, bỏ "Gửi lại SMS".
- **Đề xuất:** B nếu V1 chưa có nhà cung cấp SMS; A nếu đã có (cho biết nhà cung cấp).
- **Chốt 28/10: A (SMS).** FE giữ như hiện tại. BE sửa AUTH-18 (bỏ "hiện một lần để in phiếu, không gửi SMS"), API không trả mật khẩu; nhà cung cấp SMS còn phải chọn.

### L-16 — Nhận diện phụ huynh: CCCD hay SĐT
- **Nhánh:** CCCD phụ huynh bắt buộc `7232ae0` (21/10); nhận diện tài khoản theo CCCD `5e7f4a5` (23/10).
- **BE:** tên đăng nhập = SĐT chuẩn hóa; SĐT đã là phụ huynh ⇒ chỉ thêm liên kết (AUTH-18; `BE:src/main/java/com/carenest/service/account/impl/GuardianAccountServiceImpl.java:91-103`). Không lưu CCCD phụ huynh (`AddGuardianRequest` chỉ có họ tên, SĐT, quan hệ). Tên đăng nhập không đổi được (`DATA_DICTIONARY.md:22`).
- **FE:** CCCD phụ huynh 12 số bắt buộc ở form tiếp nhận, Sửa hồ sơ, cột file Excel; là khóa nhận diện; CCCD trùng tài khoản ⇒ dùng thông tin tài khoản và liên kết; SĐT vẫn là tên đăng nhập (`childrenMockRepository.js:449`; `docs/features/README.md:138`, `:152`).
- **A (đề xuất):** BE lưu CCCD phụ huynh (duy nhất), nhận diện theo CCCD; SĐT vẫn là tên đăng nhập. Chốt kèm: phụ huynh đổi SĐT thì làm gì (tên đăng nhập không đổi được).
- **B:** theo BE — nhận diện theo SĐT; CCCD chỉ là thông tin (bắt buộc hay không: ghi rõ). Ảnh hưởng L-07.
- **Chốt 28/10: A.** Cập nhật cùng ngày (thay câu "đổi SĐT thì tên đăng nhập vẫn là số cũ"): thông tin phụ huynh (họ tên, SĐT, email, CCCD) sửa được ở hồ sơ trẻ, không khóa; sửa ⇒ tài khoản đổi theo; đổi SĐT ⇒ tên đăng nhập đổi sang SĐT mới, cấp mật khẩu tạm mới, gửi SMS tới SĐT mới. FE đã làm (plan `docs/plans/completed/2026-10-28-guardian-info-editable.md`); BE ghi AUTH-21, cần thiết kế cách đổi tên đăng nhập Keycloak.

### L-17 — Email phụ huynh — **Đã chốt**
- Chốt 28/10 (Q2-A, `docs/plans/completed/2026-10-27-guardian-activation-ready-at-enrollment.md`): email chỉ để liên hệ, không dùng nhận diện.
- **Hết lệch — BE đã sửa 28/10 (user cho phép, chưa commit; plan `BE:docs/plans/completed/2026-10-28-guardian-contact-email.md`):** `POST /children/{childId}/guardians` nhận `email` tùy chọn (đúng định dạng, ≤255 ký tự), lưu chữ thường vào `user_accounts.email`, không gửi Keycloak (không đăng nhập bằng email này, không bị chặn trùng email nhân sự). SĐT đã có tài khoản ⇒ giữ email của tài khoản. `GET /children/{childId}/guardians` và response thêm phụ huynh trả `email`. Quên mật khẩu web bỏ qua tài khoản phụ huynh.
- FE chưa gọi các API này (`src/services/account/guardianService.js` trả 501 khi không chạy mock) ⇒ khi nối API thật: gửi `email` khi thêm phụ huynh, đọc `email` từ danh sách phụ huynh.

### L-18 — SĐT phụ huynh trùng tài khoản nhân sự — **Đã chốt**
- Chốt 28/10 (Q1, cùng plan): bỏ kiểm; nhân sự có tài khoản riêng (`guardianMockRepository.js:114-115`).
- **Hết lệch — BE đã sửa 28/10 (user cho phép, chưa commit; plan `BE:docs/plans/completed/2026-10-28-staff-username-not-phone.md`; verify có Docker pass, 0 skip):** AUTH-18 bỏ "SĐT của nhân sự ⇒ từ chối"; `POST /accounts` từ chối tên đăng nhập nhân sự dạng SĐT (400 `Staff username must not be a phone number`). 409 `This phone number belongs to a staff account` chỉ còn với tài khoản nhân sự tạo trước quy ước hoặc tạo thẳng trên Keycloak.

## Kết quả chốt

| ID | Chọn | Ai | Ngày | Việc tiếp theo |
| --- | --- | --- | --- | --- |
| L-01 | A | user | 2026-10-28 | BE: quyền tiếp nhận, xếp lớp |
| L-03 | A | user | 2026-10-28 | BE: điểm trường tiếp nhận, `campusId` trong contract |
| L-06 | A | user | 2026-10-28 | BE: trạng thái, API nghỉ học, mở lại hồ sơ |
| L-07 | A | user | 2026-10-28 | BE: `GET /children/duplicate-check` |
| L-08 | A | user | 2026-10-28 | BE: bảng hành chính |
| L-09 | A | user | 2026-10-28 | BE: đóng P-17, API khai báo sức khỏe |
| L-10 | A | user | 2026-10-28 | BE: 2 sự kiện thông báo |
| L-14 | Form kích hoạt ngay; Excel, Sửa hồ sơ thêm phụ huynh theo A; P-18 = A | user | 2026-10-28 | FE xong; BE: AUTH-20 (đã ghi, P-18 đã đóng) |
| L-15 | A (SMS) | user | 2026-10-28 | BE: sửa AUTH-18, chọn nhà cung cấp SMS |
| L-16 | A; sửa được thông tin, đổi SĐT ⇒ tên đăng nhập + mật khẩu mới gửi SMS số mới | user | 2026-10-28 | FE xong; BE: AUTH-18, AUTH-21 (đã ghi), cách đổi tên đăng nhập Keycloak |
| L-17 | Email chỉ để liên hệ (Q2-A) | user | 2026-10-28 | BE đã nhận, lưu email phụ huynh (28/10, chưa commit); FE gửi/đọc `email` khi nối API phụ huynh |
| L-18 | Bỏ kiểm trùng nhân sự (Q1) | user | 2026-10-28 | BE đã sửa AUTH-18 + chặn tên đăng nhập nhân sự dạng SĐT (28/10, chưa commit) |

## Đã ghi vào BE

Đã ghi ngày 28/10/2026 (user cho phép; chưa commit) vào `BE:docs/business/BUSINESS_RULES.md`: AUTH-18 (sửa), AUTH-20, AUTH-21, CHD-01..CHD-07 (mới), HLT-06 (sửa), P-17 đóng, P-18 mới rồi đóng cùng ngày (A); cùng `BE:docs/business/USER_ROLES.md`, `BE:docs/business/DOMAIN_MODEL.md`, `BE:docs/modules/child.md`, `BE:docs/modules/identity-access.md`, `BE:docs/database/DATA_DICTIONARY.md`, `BE:docs/context/CURRENT_STATE.md`, `BE:docs/README_AI.md`. Code/API BE chưa làm (trừ L-17, L-18 — mục riêng ở trên). Bảng dưới là nội dung đã ghi theo từng file:

| File BE | Việc | Mục |
| --- | --- | --- |
| `BE:docs/business/BUSINESS_RULES.md` AUTH-18 | Mật khẩu tạm gửi SMS tới SĐT đăng nhập, không trả về giao diện, không in phiếu. Nhận diện phụ huynh theo CCCD (bắt buộc, duy nhất); tên đăng nhập = SĐT; đổi SĐT thì tên đăng nhập đổi theo, mật khẩu tạm mới gửi SMS số mới (AUTH-21). Phụ huynh lưu trên hồ sơ trẻ trước khi có tài khoản; lưu form tiếp nhận ⇒ tạo/liên kết tài khoản ngay; nhập Excel ⇒ kích hoạt sau. Email phụ huynh chỉ để liên hệ | L-14, L-15, L-16, L-17 |
| `BE:docs/business/BUSINESS_RULES.md` (rule mới nhóm child) | Tiếp nhận: Hiệu trưởng cố định, Phó hiệu trưởng theo ma trận; trẻ chưa xếp lớp thuộc điểm trường tiếp nhận; nghỉ học, mở lại hồ sơ; trùng hồ sơ = họ tên + ngày sinh + CCCD một phụ huynh; hành chính bắt buộc trừ CCCD trẻ, nhóm máu; khai "Có" tiếp xúc lao ⇒ thông báo | L-01, L-03, L-06, L-07, L-08, L-10 |
| `BE:docs/business/BUSINESS_RULES.md` P-17 | Đóng: người tiếp nhận (Hiệu trưởng/Phó hiệu trưởng) khai báo và chốt dị ứng khi tiếp nhận; sửa sau ở Khai báo sức khỏe | L-09 |
| `BE:docs/business/USER_ROLES.md`, `BE:src/main/java/com/carenest/utils/enums/Permission.java` | Quyền mới, vd. `CHILD_ENROLL`, `CHILD_PLACEMENT` | L-01 |
| `BE:docs/modules/child.md`, `BE:docs/database/DATA_DICTIONARY.md` | Trẻ: mã, giới tính, điểm trường tiếp nhận, trạng thái, ngày tiếp nhận, ngày + lý do nghỉ; bảng hành chính; phụ huynh trên hồ sơ (họ tên, quan hệ, SĐT, CCCD, email) trước khi có tài khoản; khai báo sức khỏe; CCCD phụ huynh trên tài khoản | L-03, L-06, L-08, L-09, L-14, L-16 (*) |
| Contract (`BE:docs/api/openapi.yaml`) | Theo đề xuất FE ở `src/services/children/api/childrenApi.js`: `duplicate-check`, `guardian-check`, `POST /children/enrollments` (+ `campusId`; trả `guardianAccounts`), `/enrollments/import/preview`, `/enrollments/import` (+ `campusId`), `readmit`, `withdraw`, `placement`, `health-declaration` | L-03, L-06, L-07, L-09, L-14 |

(*) Mã trẻ, giới tính là phần nền (`21ec095`), ghi kèm vì cùng bảng.
