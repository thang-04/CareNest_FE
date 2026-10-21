---
title: Mức Xem / Sửa cho phân quyền theo vai trò và ngoại lệ
status: in-progress
owner: thangnd
jira: G94-209 / FE-FEAT-53 (task Jira riêng cho giai đoạn này: user gửi trước khi commit)
branch: dev
modules: [identity-access]
rules: [AUTH-07, AUTH-10, AUTH-11, AUTH-13, AUTH-14, AUTH-16, AUTH-17, AUTH-18]
risk: high
created: 2026-10-20
updated: 2026-10-20
---
# Mức Xem / Sửa cho phân quyền theo vai trò và ngoại lệ

Plan FE, phần client. BE chưa duyệt contract ⇒ mục "Đề xuất contract BE" là đề xuất để team BE duyệt, không sửa repo BE (user chọn 2026-10-20).

## Context

Nguồn BE: thư mục `../CareNest_BE` ở nhánh `feature/G94-60-BE-FEAT-01-authentication`. BE main (`921bc09`) **chưa có** enum Permission, ADR-0017, rule AUTH-10..19 hay các guard dưới đây (rule ID trong plan là trạng thái CONFIRMED trên nhánh G94-60) ⇒ đường dẫn BE trong plan ghi dạng chữ thường (checker đọc BE main sẽ báo thiếu), không phải contract đã lên main.

- Mỗi quyền BE là cờ có/không; 6 mã (nhánh G94-60: src/main/java/com/carenest/utils/enums/Permission.java dòng 16-50). Không có cặp xem/sửa riêng.
- Quyền xem đang "đi kèm" quyền sửa: `GET /accounts`, `GET /accounts/{userId}` mở cho `hasAny(ACCOUNT_MANAGE, ACCOUNT_STATUS_MANAGE, STAFF_ASSIGNMENT_MANAGE, PERMISSION_MANAGE)` (nhánh G94-60: controller/account/AccountController.java dòng 89-110); `GET /children/{childId}/guardians` nằm dưới `PARENT_ACCOUNT_MANAGE` (nhánh G94-60: controller/child/GuardianController.java dòng 38). ⇒ Không cấu hình được "xem danh sách nhưng không sửa".
- Giai đoạn 1 (làm rõ UI, 2026-10-20, chưa commit): ma trận 4 cột, ô khóa Có/Không, dòng "Mở được" (`src/pages/school-config/RoleDefaultsPage.jsx`, `src/models/account/permissionConstants.js`).
- Màn đang demo: service non-mock trả 501 (`src/services/account/permissionService.js:4-7`); dữ liệu từ `src/services/account/mock/permissionMockRepository.js`.

## Quyết định đã chốt
1. Làm 2 giai đoạn: (1) làm rõ UI không đổi BE, (2) thêm mức Xem/Sửa — user, 2026-10-20.
2. Mức chỉ **Không / Xem / Sửa**, không có Duyệt — user, 2026-10-20.
3. Phạm vi: 4 nhóm hiện có (hồ sơ trẻ, tài khoản nhân sự, phân công, tài khoản phụ huynh) — user, 2026-10-20.
4. Màn "Quyền ngoại lệ từng người" dùng chung mô hình mức — user, 2026-10-20.
5. Đổi BE: FE viết đề xuất contract cho team BE duyệt, không sửa repo BE — user, 2026-10-20.
6. Cột HT (chỉ đọc) và cột Bếp hiển thị — giả định giai đoạn 1, user chưa phản đối.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor: Hiệu trưởng · Outcome: cấu hình cho PHT/GV/bếp quyền chỉ xem hoặc xem + sửa theo từng nghiệp vụ, cả theo vai trò lẫn từng người · Rule: AUTH-10, AUTH-11, AUTH-13, AUTH-14 (CONFIRMED), AUTH-07 (ACCEPTED) · Flow: [B] HT chọn mức → [S] lưu danh sách mã quyền kèm lý do → [S] BE tính quyền hiệu lực, ghi lịch sử.
- **Đối chiếu:** ADR-0017 (nhánh G94-60: docs/decisions/ADR-0017-configurable-permissions.md) chốt mô hình cờ có/không theo mã; đề xuất giữ mô hình này, chỉ thêm mã `*_VIEW` + metadata ⇒ không trái ADR. ADR loại "Full/Restricted/None" vì "Full" vượt scope; mức ở đây không đụng scope (AUTH-13).
- **Ảnh hưởng:** FE `/school/roles`, `/permissions/overrides`, `/permissions/history`; menu/route ẩn hiện theo `GET /accounts/me.permissions` (thêm mã VIEW); APP: không (màn phân quyền chỉ web). Dữ liệu cũ: role đang có mã `*_MANAGE` phải được seed thêm mã VIEW tương ứng để không mất quyền xem đang có ngầm.

### Câu hỏi mở
Không còn câu chặn Phase A. Chờ ngoài plan: team BE duyệt đề xuất contract (ảnh hưởng Phase C, có thể làm lại util/mock); mã Jira user gửi trước khi commit.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Làm Phase A trước khi BE duyệt? | Có, trên mock theo contract đề xuất | user | 2026-10-20 | plan này |
| Mã Jira giai đoạn 2 | Gửi sau (trước khi commit) | user | 2026-10-20 | frontmatter |
| Mức quyền | Xem / Sửa | user | 2026-10-20 | plan này |
| Phạm vi nghiệp vụ | 4 nhóm hiện có; sau này thêm luồng GV làm thay | user | 2026-10-20 | `docs/features/permission-center-demo.md` |
| Ngoại lệ dùng mức | Dùng chung | user | 2026-10-20 | plan này |
| Đổi BE | FE viết đề xuất | user | 2026-10-20 | plan này |

## Đề xuất contract BE

Giữ mô hình ADR-0017 (cờ theo mã, resolver, payload lưu). Thêm:

1. **Mã mới** (enum `Permission` + migration seed `role_permissions`):

   | Nhóm nghiệp vụ (`feature`) | VIEW | MANAGE (thao tác sửa) |
   | --- | --- | --- |
   | `child-profile` Hồ sơ trẻ | `CHILD_PROFILE_VIEW` (có sẵn) | — (BE chưa có endpoint ghi hồ sơ trong quyền này) |
   | `staff` Nhân sự | `STAFF_ACCOUNT_VIEW` (mới) | `ACCOUNT_MANAGE`, `ACCOUNT_STATUS_MANAGE`, `STAFF_ASSIGNMENT_MANAGE` |
   | `parent-account` Tài khoản phụ huynh | `PARENT_ACCOUNT_VIEW` (mới) | `PARENT_ACCOUNT_MANAGE` |
   | `permission` Phân quyền | — | `PERMISSION_MANAGE` (cố định HT, AUTH-11) |

2. **Catalog `GET /permissions`** thêm mỗi mã: `feature` (khóa nhóm), `action` (`VIEW` | `MANAGE`), `requires` (mảng mã; MANAGE cần VIEW cùng feature). FE dựng mức từ các field này, không tự viết quan hệ.
3. **Guard:** `GET /accounts`, `GET /accounts/{userId}` ⇒ `STAFF_ACCOUNT_VIEW`; `GET /children/{childId}/guardians` (và các GET phụ huynh khác) ⇒ `PARENT_ACCOUNT_VIEW`. Scope vẫn ở `StaffAccessPolicy` / policy hiện có.
4. **Ràng buộc `requires`** (BE quyết): `PUT /role-permissions/{role}` có MANAGE thiếu VIEW ⇒ 400; ngoại lệ REVOKE VIEW trong khi còn MANAGE hiệu lực ⇒ 400 (hoặc resolver bỏ MANAGE — BE chọn, ghi ADR).
5. **Migration dữ liệu:** role/ngoại lệ đang có bất kỳ MANAGE của `staff` ⇒ thêm `STAFF_ACCOUNT_VIEW`; có `PARENT_ACCOUNT_MANAGE` ⇒ thêm `PARENT_ACCOUNT_VIEW`. Lịch sử ghi lý do "Tách quyền xem" để HT biết vì sao xuất hiện mã mới.
6. Cập nhật ADR-0017 (mục Bổ sung) + `BE:docs/modules/identity-access.md` + AUTH-10.
7. (Tùy chọn) `GET /permission-change-logs` trả thêm mức trước/sau của nghiệp vụ cho mỗi `batchId` + đối tượng: log hiện chỉ có mã đã đổi nên FE không dựng chính xác "Sửa → Xem" trong lịch sử, chỉ gom theo nghiệp vụ.

## Acceptance criteria
- **AC-1** (AUTH-10): Given HT ở `/school/roles`, When chọn mức cho PHT ở nhóm "Tài khoản phụ huynh", Then có 3 lựa chọn Không / Xem / Sửa; chọn Sửa ⇒ payload lưu chứa cả `PARENT_ACCOUNT_VIEW` và `PARENT_ACCOUNT_MANAGE`.
- **AC-2** (AUTH-10): Given nhóm "Nhân sự" mức Sửa, When HT bỏ chọn từng thao tác (cấp tài khoản / khóa-mở / phân công), Then payload chỉ chứa thao tác còn chọn + `STAFF_ACCOUNT_VIEW`; bỏ hết thao tác ⇒ mức tự về Xem.
- **AC-3** (AUTH-10): Given nhóm chỉ có VIEW trong catalog (Hồ sơ trẻ), Then chỉ hiện Không / Xem.
- **AC-4** (AUTH-11): Cột HT và ô không cấu hình hiển thị mức dạng chỉ đọc (Không / Xem / Sửa), không có control.
- **AC-5** (AUTH-10, AUTH-14): Given ngoại lệ từng người, When HT chọn "Chỉ xem" cho một PHT đang có Sửa theo vai trò, Then lưu REVOKE các mã MANAGE của nhóm, giữ VIEW; lịch sử hiển thị theo mức ("Sửa → Xem").
- **AC-6** (AUTH-07): Menu/route nhân sự và phụ huynh mở khi có mã VIEW; nút tạo/khóa/phân công chỉ hiện khi có mã MANAGE tương ứng; 403 từ BE vẫn hiển thị trạng thái không quyền.
- **AC-7**: BE trả 400 vì vi phạm `requires` ⇒ FE báo lỗi theo message BE, giữ lựa chọn chưa lưu.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Mô hình mức | Thêm mã VIEW + metadata `feature/action/requires`, mức dựng ở FE | Lưu enum mức theo role×nghiệp vụ ở BE | Giữ ADR-0017, payload lưu không đổi; ADR đã loại mô hình mức kiểu Full |
| Control trong ô | Segmented Không/Xem/Sửa; Sửa mở danh sách thao tác con | Mỗi mã một công tắc như hiện tại | Đúng câu hỏi "xem nhưng không sửa"; vẫn giữ độ chi tiết từng thao tác |
| Quan hệ MANAGE→VIEW | Lấy từ `requires` của BE | Viết cứng ở FE | AGENTS.md nguyên tắc 2: không chép business rule vào FE |

## Phases
### Phase A — Ma trận theo mức (mock)
- Files: M `src/services/account/mock/permissionMockRepository.js` (catalog thêm `feature/action/requires`, 2 mã VIEW, kiểm `requires` ⇒ 400) · M `src/models/account/permissionConstants.js` (nhãn nhóm, nhãn mức, "Mở được" theo mức) · M `src/utils/account/permissionMatrix.js` (gom mã theo `feature`, tính mức từ mã) · C PermissionLevelControl.jsx (đã xóa, thay bằng `src/components/permissions/PermissionTable.jsx` ở Phase A3) · M `src/pages/school-config/RoleDefaultsPage.jsx` · M `src/styles/modules/permissions.css` · M `tests/integration/selective-merge/permission-center.test.mjs`
- Steps: 1. mock + util tính mức (test trước). 2. `PermissionLevelControl` (radiogroup bàn phím được, thao tác con khi Sửa). 3. Gắn vào ma trận, giữ thanh lưu + `ReasonModal`, câu thay đổi theo mức ("Phó hiệu trưởng: Tài khoản phụ huynh Sửa → Xem").
- Tests: AC-1..4, AC-7 → `permission-center.test.mjs` (util + mock); browser `/school/roles` 1280px + 375px.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0
- **Dừng chờ user review.**

### Phase B — Ngoại lệ + lịch sử theo mức (mock)
- Files: M `src/components/permissions/OverrideWizardModal.jsx` · M `src/pages/permissions/UserOverridesPage.jsx` · M `src/pages/school-config/PermissionHistoryPage.jsx` · M `src/components/permissions/PermissionBadges.jsx` · M mock repository · M test
- Steps: 1. Wizard bước 2 dùng `PermissionLevelControl` (mức theo vai trò hiện mờ làm mốc). 2. Map mức ⇒ GRANT/REVOKE từng mã. 3. Lịch sử gom dòng cùng `batch_id` + feature thành "mức trước → sau".
- Tests: AC-5, AC-7; hồi quy draft wizard 2→3→2 (`docs/knowledge/incidents/FE-BUG-261019-permission-wizard-draft-history.md`).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0
- **Dừng chờ user review.**

### Phase C — Nối API thật (sau khi BE xong contract)
- Ngoài plan này: plan riêng khi BE có endpoint; gồm thay 501 trong `permissionService.js`, AC-6 cho menu/route.

## Ngoài phạm vi
- Mức Duyệt; mã quyền cho điểm danh, sức khỏe, thực đơn, đánh giá (module chưa có BE).
- **GV A làm thay GV B** (user nêu 2026-10-20, PENDING): đề xuất xử lý bằng **phạm vi**, không bằng mã quyền — phân công tạm A vào lớp của B với `validFrom/validTo` (`BE:docs/modules/school-structure.md` mục Entities — StaffAssignment, AUTH-03, AUTH-13). Mô hình mức của plan này không cần đổi nếu A nhận đủ quyền của vai trò GV trong lớp đó. Cần chốt khi làm: ai tạo (HT/PHT), thời hạn tối đa, B còn quyền trong thời gian đó không, A nhận toàn bộ hay một phần thao tác (một phần ⇒ cần thêm khái niệm ngoại lệ có thời hạn).

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-10 | `permission-center.test.mjs` util + browser | A | pass (test + browser lưu Sửa → Xem) |
| AC-2 | AUTH-10 | `permission-center.test.mjs` util | A | pass |
| AC-3 | AUTH-10 | `permission-center.test.mjs` util | A | pass |
| AC-4 | AUTH-11 | `permission-center.test.mjs` util + browser `/school/roles` | A | pass |
| AC-5 | AUTH-10, AUTH-14 | `permission-center.test.mjs` mock + browser | B | pass ở wizard + danh sách ngoại lệ; lịch sử gom theo nghiệp vụ, chưa hiện mức (cần đề xuất mục 7) |
| AC-6 | AUTH-07 | plan Phase C | C | ngoài plan |
| AC-7 | AUTH-10 | `permission-center.test.mjs` mock | A, B | pass (ma trận vai trò + ngoại lệ) |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE chọn contract khác đề xuất | Làm lại util/mock Phase A | Hỏi BE trước khi code (câu hỏi mở 3); util tách khỏi UI | Giữ UI giai đoạn 1 |
| Thiếu migration VIEW | PHT mất quyền xem danh sách đang có | Ghi rõ mục 5 đề xuất; test mock seed | BE revert migration |
| Bảng 4 cột + segmented chật | Tràn ngang desktop | Control gọn (icon + nhãn ngắn), kiểm 1280px/375px | Quay về công tắc |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (`RoleDefaultsPage`, `OverrideWizardModal`, `UserOverridesPage`, `PermissionHistoryPage`, menu nhân sự/phụ huynh ở Phase C)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã tách: Phase A 7 file, Phase B 6 file, Phase C plan riêng
- [x] Không dùng rule PENDING/OPEN như đã chốt (luồng làm thay để ngoài phạm vi)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-20 — Phase A3: bảng việc × vai trò, ô tick (thay A2, chờ review)
- Lý do: user xem A2 thấy "vẫn khó nhìn và khó hiểu" — không hiểu Xem/Sửa, mức + thao tác con rối; yêu cầu giữ dạng bảng, phân quyền theo từng việc như ban đầu, đổi cách hiển thị cho dễ chọn. User duyệt thiết kế bảng + ô tick 2026-10-20.
- Quyết định đổi: UI **không còn khái niệm mức Không/Xem/Sửa**. Mỗi dòng = một mã quyền viết bằng lời thường; mã xem đứng đầu nhóm, mã có `requires` thụt "↳". Tick việc cần xem ⇒ tự tick dòng xem; bỏ tick dòng xem ⇒ tự bỏ các dòng cần nó; có dòng thông báo `role="status"`. Contract đề xuất (mã `*_VIEW`, `feature/action/requires`) giữ nguyên. AC-1..AC-5 về "mức" thay bằng: tick/bỏ tick đúng `requires`, lưu payload đúng mã, ngoại lệ hiển thị theo từng việc.
- Thay đổi: C `src/components/permissions/PermissionTable.jsx` (bảng + `PermissionCheckCell` ô tick phủ cả ô + `PermissionFixedCell` ✓/—); D `FeatureLevelCard.jsx`, `PermissionOverview.jsx`; M `RoleDefaultsPage.jsx` (cột HT cố định/PHT/GV/Bếp, chú thích, câu xác nhận "Bật/Tắt “việc” cho vai trò"), `OverrideWizardModal.jsx` (cột Theo vai trò | Người này | Khác vai trò), `UserOverridesPage.jsx` (về badge theo từng ngoại lệ, nhãn mới), `PermissionHistoryPage.jsx`, `PermissionBadges.jsx` (bỏ badge mức), `permissionConstants.js` (nhãn việc bằng lời thường, bỏ hằng số mức), `permissionMatrix.js` (bỏ helper mức; thêm `permissionTableRows`, `toggleWithRequires`, `codeDiff`), `permissions.css` (bỏ CSS thẻ/tổng quan, thêm CSS bảng; cột việc ghim trái khi cuộn ngang), test.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `npm run lint` exit 0; `npm run test:merge` 46 pass / 0 fail.
- Chưa kiểm: xem bằng mắt ở 1280px/375px (không có công cụ trình duyệt trong phiên).

### 2026-10-20 — Phase A2: bố cục "vai trò trước" (thay bằng A3)
- Lý do: user review thiết kế hiển thị/chọn quyền, chọn phương án B (so với A chỉnh ma trận, C ma trận + panel) ngày 2026-10-20.
- Thay đổi: `/school/roles` = dải tổng quan chip màu (vai trò × nghiệp vụ, gồm bản nháp, bấm ô ⇒ mở tab + cuộn tới thẻ) + tab vai trò (số thay đổi chưa lưu) + thẻ nghiệp vụ `FeatureLevelCard` (radio Không/Xem/Sửa kèm mô tả từng mức, thao tác con dưới Sửa, chip mốc "Hiệu trưởng: …"). Wizard ngoại lệ dùng cùng thẻ (mốc "Vai trò: …", badge chỉ khi khác vai trò). Danh sách ngoại lệ badge ngắn "+ Phụ huynh: Sửa", câu đầy đủ ở tooltip + sr-only. Lịch sử dùng "Có/Không" thay "Bật/Tắt". Chip mức: Không xám, Xem xanh dương (icon mắt), Sửa xanh lá (icon bút).
- File: C FeatureLevelCard.jsx, PermissionOverview.jsx (cả hai đã xóa ở Phase A3); D `PermissionLevelControl.jsx` (tạo trong Phase A); M `PermissionBadges.jsx`, `RoleDefaultsPage.jsx`, `OverrideWizardModal.jsx`, `UserOverridesPage.jsx`, `permissionConstants.js`, `permissionMatrix.js`, `permissions.css` (bỏ CSS ma trận + danh sách wizard cũ), test.
- Khác thiết kế đã duyệt: lịch sử chưa có chip mức (log không có mức — đề xuất contract mục 7).
- Verify: `node scripts/verify.mjs` → xem dòng dưới; `npm run lint` exit 0; `npm run test:merge` 46 pass / 0 fail.
- Chưa kiểm: so ảnh với wireframe ở 1280px/375px (công cụ trình duyệt ngắt trong phiên, Playwright chưa cài).

### 2026-10-20 — Tự review Phase A + B
- Sửa: migration demo bản 1 thêm GRANT mã xem cho ngoại lệ đang GRANT mã sửa (trước đó lần lưu ngoại lệ sau cho người đó bị 400 dù không đổi gì) + test; nút thử lại ở danh sách ngoại lệ tải lại cả catalog/ma trận.
- Còn mở (BE quyết, đã nằm trong đề xuất contract mục 4): HT tắt mã xem của vai trò trong khi một người có ngoại lệ GRANT mã sửa ⇒ quyền hiệu lực người đó thiếu mã xem; mock hiện chưa chặn ở `PUT /role-permissions`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `npm run test:merge` 46 pass / 0 fail.

### 2026-10-20 — Phase B (chờ review)
- Commit: chưa commit (chờ mã Jira)
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (lần chạy trước fail ở `format:check` của 2 file menu-planning do phiên khác đang sửa; chạy lại sau khi phiên đó xử lý thì pass).
- Browser (mock, HT demo): wizard cho PHT đặt phụ huynh Xem → Sửa, nhân sự Sửa → Xem; tóm tắt "+1 Cấp thêm −1 Thu hồi"; bước 3 ghi mức; quay lại bước 2 giữ draft; lưu thành công; danh sách ngoại lệ hiển thị "+ Tài khoản phụ huynh: Xem → Sửa", "− Tài khoản & phân công nhân sự: Sửa → Xem"; lịch sử gom 2 mã nhân sự vào một dòng.
- Khác plan: lịch sử chỉ gom theo lần lưu + nghiệp vụ, không hiện "Sửa → Xem" (log không đủ dữ liệu ⇒ thêm đề xuất contract mục 7); phân trang lịch sử vẫn đếm theo mã nên một lần lưu có thể bị tách qua 2 trang; không sửa `PermissionBadges.jsx` (badge hiện có đủ dùng). Helper mô tả thay đổi (`featureDiffs`, `describeFeatureDiff`) dùng chung cho ma trận, wizard, danh sách ngoại lệ.
- Tiếp: user review Phase B; Phase C chờ BE duyệt contract.

### 2026-10-20 — Phase A (chờ review)
- Commit: chưa commit (chờ mã Jira)
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `npm run test:merge` 43 pass / 0 fail
- Browser (mock, HT demo): 1280px bảng vừa khung, 375px không tràn trang (bảng cuộn trong khung); đổi PHT "Tài khoản phụ huynh" Sửa → Xem + đổi thao tác nhân sự, hộp lý do liệt kê đúng 2 dòng, lưu thành công, lịch sử ghi 2 mã.
- Khác plan: migration mock bản 2 nằm trong `ensure` (role có mã sửa được thêm mã xem); cột đầu ma trận 320px → 280px để 4 cột + segmented vừa 1280px; lịch sử vẫn hiển thị theo từng mã tới Phase B.
- Tiếp: user review Phase A; Phase B (ngoại lệ + lịch sử theo mức) sau khi duyệt.

### 2026-10-20 — Giai đoạn 1 (làm rõ UI) done, chờ review
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: không (giai đoạn 1 duyệt trong chat, trước plan này)
- Tiếp: chờ trả lời 3 câu hỏi mở rồi mới `approved`.
