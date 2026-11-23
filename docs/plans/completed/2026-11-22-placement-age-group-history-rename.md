---
title: Ngày sinh dd/mm/yyyy, xếp lớp khác nhóm tuổi, tab lịch sử sửa hồ sơ, "Khai báo ăn và sức khỏe" (đợt 1, FE)
status: done
owner: ATPX48-69
jira: G94-180 / FE-FIX-14
branch: fix/G94-180-FE-FIX-14-school-year-scope
modules: [children]
rules: [G94-180/CHD-13, CHD-13, CHD-06]
risk: medium
created: 2026-11-22
updated: 2026-11-22
---
# Ngày sinh dd/mm/yyyy, xếp lớp khác nhóm tuổi, tab lịch sử sửa hồ sơ, "Khai báo ăn và sức khỏe" (đợt 1, FE)

Phần client của `BE:docs/plans/completed/2026-11-22-placement-age-group-history-rename.md` (nghiệp vụ, AC BE ở đó). Đợt 2: `2026-11-22-intake-start-date.md`.

## Context
- Ô ngày sinh là `<input type="date">` (`src/components/children/ChildInfoFields.jsx:109-117`). Trình duyệt tiếng Anh hiện mm/dd/yyyy. Ô này dùng ở Tiếp nhận và Sửa hồ sơ (impact: `EnrollChildPage`, `EditChildPage`). Repo có sẵn `DateInput` dạng dd/mm/yyyy (`src/components/form/DateInput.jsx`). Ngày tiếp xúc lao cũng là ô ngày thô (`HealthDeclarationFields.jsx:140`). Validation hiện báo "Chọn ngày sinh của trẻ" cho cả ô trống lẫn ô gõ sai (`src/utils/children/childrenValidation.js:90`).
- Khóa ô Nhóm tuổi (Cần, e1a21550): `ClassPlacementFields.jsx:31,64,77-80,117-120`; `EnrollChildPage.jsx:567`; `ClassPlacementPage.jsx:261`. Câu cảnh báo "…Vẫn xếp được lớp khác nhóm tuổi." đã có test (`tests/children/age-group-suggestion.test.mjs:31-34`).
- Lịch sử hồ sơ đã map ở adapter (`src/services/children/api/childrenApi.js:172-173`), nhưng hồ sơ trẻ chỉ có tab "Tổng quan" và "Lịch sử xếp lớp" (`ChildProfilePage.jsx:41-44`).
- Chữ "Khai báo sức khỏe" người dùng thấy: `DeclarationSummary.jsx:16,21`, `childrenConstants.js:260`, `ChildProfilePage.jsx:300`, `EnrollChildPage.jsx:231`, `HealthDeclarationPage.jsx:74,139,154,159,165`, `ImportChildrenPage.jsx:308`, `childrenValidation.js:139`, cùng câu lỗi trong mock.

## Quyết định đã chốt
1. 1A: dùng `DateInput` cho ngày sinh (Tiếp nhận, Sửa hồ sơ) và ngày tiếp xúc lao; gõ sai ⇒ "Nhập ngày sinh theo dạng dd/mm/yyyy" — user 22/11.
2. 2A: bỏ khóa ô Nhóm tuổi ở Tiếp nhận, Xếp lớp, Chuyển lớp; giữ gợi ý, cảnh báo vàng không chặn — user 22/11.
3. 3A: thêm tab "Lịch sử sửa hồ sơ" (đọc `child.history` BE trả) — user 22/11.
4. 4A: đổi chữ người dùng thấy trong module Trẻ. Giữ nhãn quyền (`src/models/account/permissionConstants.js:86`, `src/models/school-config/permissionCatalog.js:26`, `schoolConfigConstants.js:345`, module khác) — user 22/11.

## Làm rõ nghiệp vụ
Xem plan BE. FE chỉ hiển thị, gửi yêu cầu; nhóm tuổi gợi ý bằng `suggestAgeGroupId` (đã có, chỉ hiển thị).

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| 1–4 | 1A 2A 3A 4A | user | 2026-11-22 | `docs/features/enrollment-intake-ui.md` (phase 2) |

## Acceptance criteria
- **AC-1** (1A): Given form Tiếp nhận hoặc Sửa hồ sơ, When gõ "10/03/2023", Then gửi `dateOfBirth` "2023-03-10". Gõ "31/02/2023" ⇒ "Nhập ngày sinh theo dạng dd/mm/yyyy"; để trống ⇒ "Chọn ngày sinh của trẻ". Ngày tiếp xúc lao cũng nhập dd/mm/yyyy.
- **AC-2** (`G94-180/CHD-13`): Ở Tiếp nhận, Xếp lớp, Chuyển lớp, ô Nhóm tuổi không khóa và tự chọn theo gợi ý. Chọn nhóm khác ⇒ hiện lớp của nhóm đó, kèm cảnh báo vàng không chặn lưu. Có nút "Xem lớp mọi nhóm tuổi".
- **AC-3** (3A): Tab "Lịch sử sửa hồ sơ": dòng mới nhất trước; mỗi dòng có thời điểm, người, hành động (Tiếp nhận / Sửa hồ sơ / Nghỉ học / Tiếp nhận lại), lý do, thay đổi "Nhãn: cũ → mới" (kể cả "Báo ăn"); trống ⇒ `EmptyState`.
- **AC-4** (4A): Không còn "Khai báo sức khỏe" ở màn module Trẻ (route `/children/**`).
- **AC-5** (`CHD-13`): mock: sửa khai báo đổi "Báo ăn" ⇒ thêm dòng lịch sử như BE.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Ô ngày | `DateInput` có sẵn | Tự viết ô mới | UI_CARD: ngày dùng `DateInput` |
| Bỏ khóa | Bỏ prop `lockAgeGroup` ở 2 nơi gọi; giữ component nhận prop (mặc định false) | Xóa prop | Ít thay đổi |
| Tab lịch sử | Component con `components/children/ChildProfileHistory.jsx` | Viết thẳng trong page | `ChildProfilePage` đã dài |

## Phases
### Phase 1 — 1A, 2A (sau BE phase 1)
- Files: M `ChildInfoFields.jsx`, `HealthDeclarationFields.jsx`, `childrenValidation.js`, `ClassPlacementFields.jsx`, `EnrollChildPage.jsx`, `ClassPlacementPage.jsx` · C `tests/children/dob-date-input.test.mjs` · M `tests/children/age-group-suggestion.test.mjs`
- Exit (PowerShell): `npm run test:children` pass · `npm run lint` 0 lỗi · `npm run build` ok.
- **Dừng chờ user review.**

### Phase 2 — 3A, 4A (sau BE phase 2)
- Files: C `components/children/ChildProfileHistory.jsx` · M `ChildProfilePage.jsx`, `childrenConstants.js`, các file đổi chữ ở Context, `childrenMockRepository.js` · C `tests/children/profile-history-tab.test.mjs`, `tests/children/meal-declaration-rename.test.mjs` · M `docs/features/enrollment-intake-ui.md`
- Exit: như phase 1, thêm `npm run verify` cuối đợt.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | 1A | `dob-date-input.test.mjs` | 1 | |
| AC-2 | G94-180/CHD-13 | `age-group-suggestion.test.mjs` | 1 | |
| AC-3 | 3A | `profile-history-tab.test.mjs` | 2 | |
| AC-4 | 4A | `meal-declaration-rename.test.mjs` | 2 | |
| AC-5 | CHD-13 | `meal-registration-mock.test.mjs` (bổ sung) | 2 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Ô ngày mới đổi cách nhập ở Sửa hồ sơ | Người dùng quen ô cũ | Nút lịch vẫn mở được | Revert phase 1 |
| Đổi chữ sót | Màn còn tên cũ | Test grep chữ cũ trong `src/pages/children`, `src/components/children` | — |

## Validation log
- [x] Khẳng định có `file:line`
- [x] Không đổi contract BE ở đợt này
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] Tách 2 đợt
- [x] Tự review: không placeholder

## Progress log
### 2026-11-22 — draft, chờ user duyệt
- Commit: chưa commit

### 2026-11-22 — Phase 1 (chỉ 1A) và Phase 2 (3A, 4A): chờ review
- User 22/11: phần chọn lớp khác nhóm tuổi đụng code Cần (Cần có thể đang sửa) ⇒ **2A tạm hoãn**; làm các việc không liên quan (1A, 3A, 4A).
- Khác plan: làm liền phase 1 và phase 2 theo yêu cầu user, không dừng giữa hai phase. Tab lịch sử tách hàm hiển thị `src/utils/children/profileHistory.js` (test được) và component `src/components/children/ChildProfileHistory.jsx`.
- Commit: chưa commit.
- RED trước khi sửa: `dob-date-input.test.mjs` 0/3 · `profile-history-tab.test.mjs` lỗi (chưa có module) · `meal-registration-mock.test.mjs` ca mới fail · `meal-declaration-rename.test.mjs` 14 chuỗi cũ.
- Sau sửa (PowerShell): `npm run test:children` ⇒ tests 300, pass 300, fail 0 · `npm run test:health` ⇒ 124/124 · `npm run lint` ⇒ 0 lỗi · `npx prettier --check` các file đã sửa ⇒ sạch · `npm run build` ⇒ built in 3.19s.
- Không chạy `check:design`, `check:api` (script kiểm của dự án, chỉ đạo 07/11). Chưa mở trình duyệt kiểm giao diện.
- Tiếp: user review; 2A chờ Cần.

### 2026-11-22 — sửa lỗi A8 (user báo, ngoài plan)
- User báo: trẻ sinh 10/03/2026, đổi "Năm học tiếp nhận" thì nhóm tuổi không đổi, danh sách vẫn hiện lớp. Incident `docs/knowledge/incidents/FE-BUG-261122-intake-year-age-group.md`.
- Sửa `EnrollChildPage.jsx` (effect tính lại nhóm tuổi theo năm khi nhóm tuổi của năm đó tải xong) và câu chữ trong `ClassPlacementFields.jsx`. Không đổi luật khóa nhóm tuổi của Cần.
- RED trước: `intake-year-age-group.test.mjs` 2/3 fail. Sau sửa: 3/3 · `npm run test:children` ⇒ 303/303 · `npm run lint` ⇒ 0 lỗi · `npm run build` ⇒ built in 2.67s.

### 2026-11-23 — 2A xong, đóng plan
- User 23/11: "tiếp nhận trẻ không bắt buộc trẻ phải phù hợp nhóm tuổi, cho phép chọn nhóm tuổi và lớp của nhóm tuổi đó (xếp lớp chuyển lớp cũng vậy)".
- BE: bỏ `PlacementRules.ageGroupProblem` (và phụ thuộc `AgeGroupService`), bỏ kiểm nhóm của lớp dự kiến khi tiếp nhận năm sau, bỏ luật "chuyển trong năm chỉ cùng nhóm" trong `ChildRecordServiceImpl.place`; 2416 trên bảng năm mới Cần đã tự bỏ (97a272cd). Rule G94-180/CHD-13 thêm "chuyển lớp trong năm".
- FE: bỏ `lockAgeGroup` ở `ClassPlacementFields`, Tiếp nhận, Xếp lớp; giữ gợi ý, cảnh báo vàng, nút "Xem lớp mọi nhóm tuổi".
- Verify: BE PlacementRulesTest, ChildRecordServiceImplTest, ChildEnrollmentIntegrationTest (55, gồm plannedClassOfOtherAgeGroupIsAccepted), ChildPlacementScheduleIntegrationTest (10), ChildPlacementListIntegrationTest, ChildRecordIntegrationTest, YearTransitionIntegrationTest, OpenApiSnapshotTest, ArchitectureRulesTest đạt; FE `npm run verify` exit 0, 1696 test.
- Sửa dòng Cần viết ⇒ báo Cần. Commit: chưa commit.
