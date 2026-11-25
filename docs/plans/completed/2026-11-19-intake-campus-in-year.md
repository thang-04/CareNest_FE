---
title: Tiếp nhận theo năm học — phần Web
status: done         # xong 2026-11-22: F1–F3, `npm run verify` exit 0 tại 1e0b6425
owner: Giáp
jira: G94-180 / FE-FIX-14 (F2 tuổi tối thiểu: G94-433)
branch: fix/G94-180-FE-FIX-14-school-year-scope   # tạo từ fix/G94-394-FE-FIX-13-child-management-bugs @6181b56e (có new-year-intake + dev)
modules: [children]
rules: [G94-180/CHD-02, G94-180/CHD-11, G94-180/CHD-13, SCH-01]
risk: medium         # màn tiếp nhận, nhập Excel, tiếp nhận lại, danh sách và hồ sơ trẻ; không sửa vùng dùng chung, không sửa code Cần
created: 2026-11-19
updated: 2026-11-22
---
# Tiếp nhận theo năm học — Web

Phần client của `BE:docs/plans/completed/2026-11-19-intake-campus-in-year.md` (mục 1, 2, 5 bản phân tích 22/11). Mục 3: `2026-11-22-year-scoped-master-data.md`.

## Context
- **Mục 2:** `EnrollChildPage.jsx:91` và `ImportChildrenModal.jsx:75` gọi `useMasterData()` không truyền năm ⇒ ô Điểm trường (`EnrollChildPage.jsx:151-153`) là danh sách của năm đang hoạt động, kể cả khi tiếp nhận cho năm sau. Hook của Cần đã nhận tham số năm (`src/hooks/useMasterData.js:7`, commit 038f73dc). `beClient` tự đổi tên năm sang id. Tiếp nhận lại (`:208-215`, modal `:687`) chưa có ô điểm trường.
- **Mục 5:** `suggestAgeGroupId` (`src/utils/children/childrenHelpers.js:12-18`) tính tuổi theo năm sinh: (năm bắt đầu − năm sinh) × 12. Bảng xếp lớp năm mới của Cần tính tháng tròn tới ngày bắt đầu năm. Bé sinh 02/09–31/12 lệch một nhóm. Hàm dùng ở `EnrollChildPage.jsx:147`, `ClassPlacementPage.jsx:57,62`; cảnh báo vàng ở `ClassPlacementFields.jsx:71-74`.
- **BUG-52 (G94-433):** `childrenValidation.js:89-91` chỉ chặn ngày sinh trống, ở tương lai, trước 2018-01-01. Hàm dùng chung cho tiếp nhận (`EnrollChildPage.jsx:175`) và Sửa hồ sơ.
- **Mục 1:** `plannedAdmissionNotice` (`childrenHelpers.js:40-41`) chỉ nói "chưa xếp lớp … Xếp, đổi lớp dự kiến ở Xếp lớp năm học mới", không nói việc này chặn kích hoạt năm. Màn của Cần: `/school/placement?tab=new` (`YearPlacementPage.jsx:43`).

## Quyết định đã chốt
1. Như plan BE: theo luật BUG-43 của Cần (xếp lớp trước khi kích hoạt); điểm trường theo năm tiếp nhận (Q2); tiếp nhận lại có ô điểm trường (Q1 = b); trẻ được vào lớp khác nhóm tuổi; tuổi tối thiểu đủ 3 tháng tại ngày tiếp nhận — user 22/11.
2. Dùng `useMasterData(yearId)` sẵn có, không tạo hook `useYearCampusIds` như bản 19/11.
3. Bỏ Task F3 cũ (cảnh báo trẻ ở điểm trường bị gỡ khỏi năm): Cần đã chặn gỡ điểm trường khi còn trẻ đã tiếp nhận.
4. Không sửa code Cần (`school-config/**`, `useMasterData.js`, `masterDataService.js`), không sửa vùng dùng chung.

### Câu hỏi mở
Không còn. Bảng trả lời ở plan BE.

## Acceptance criteria
- **AC-F1** (CHD-02): chọn năm tiếp nhận 2027-2028 ⇒ ô Điểm trường chỉ hiện điểm trường của 2027-2028. Đổi năm sau khi đã chọn ⇒ điểm trường không còn trong năm bị bỏ chọn, chỉ xét khi danh sách đã tải xong.
- **AC-F2** (CHD-02): PHT không có điểm trường nào trong năm tiếp nhận ⇒ câu báo `Điểm trường của bạn không có trong năm học {tên năm}. Chọn năm học khác hoặc báo Hiệu trưởng.`
- **AC-F3** (CHD-11): modal tiếp nhận lại có ô "Điểm trường": lựa chọn đầu `Giữ điểm trường cũ`, sau đó là điểm trường của năm tiếp nhận. Chỉ gửi `campusId` khi có chọn. Lỗi `details.campusId` hiện dưới ô, modal giữ nguyên.
- **AC-F4** (CHD-13): bé sinh 05/09/2024, năm bắt đầu 01/09/2027 ⇒ 35 tháng ⇒ gợi ý Nhà trẻ (24–36 tháng), khớp bảng của Cần.
- **AC-F5** (CHD-13): bước 1 tiếp nhận, ngày sinh chưa đủ 3 tháng tới hôm nay ⇒ lỗi ô Ngày sinh `Trẻ phải đủ 3 tháng tuổi tại ngày tiếp nhận`. Sửa hồ sơ không kiểm. Mock tiếp nhận, nhập Excel chặn như BE.
- **AC-F6** (CHD-13): chọn lớp khác nhóm tuổi gợi ý ⇒ chỉ cảnh báo vàng, vẫn tiếp tục và lưu được.
- **AC-F7** (CHD-11): trẻ Sắp nhập học chưa có lớp dự kiến:
  - danh sách trẻ ở năm đó báo `{N} trẻ Sắp nhập học chưa có lớp. Phải xếp lớp trước khi kích hoạt năm học.` kèm link `Xếp lớp năm học mới` (`/school/placement?tab=new`);
  - hồ sơ trẻ và màn kết quả tiếp nhận nói cùng ý.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Danh sách điểm trường của năm | `useMasterData(intakeYear?.id \|\| activeYear?.id)` | hook mới gọi `getCampusList` | Hook của Cần đã nhận năm; ít code hơn |
| Cách tính tháng tuổi | Tháng tròn từ ngày sinh tới ngày bắt đầu năm, trừ 1 nếu ngày trong tháng của ngày sinh lớn hơn | giữ năm sinh | Khớp `fitsAgeGroup` của Cần, gợi ý không lệch bảng xếp lớp |
| Kiểm tuổi tối thiểu | Tham số `intakeDate` của `validateChildInfo`, chỉ tiếp nhận truyền | hàm riêng | Sửa hồ sơ giữ nguyên hành vi |

## Phases
### F1 — Điểm trường theo năm tiếp nhận (G94-180)
- Files: M `src/pages/children/EnrollChildPage.jsx` (:91, :151-153, readmit :208-215, modal :687) · M `src/components/children/ImportChildrenModal.jsx` (:75) · M `src/services/children/mock/childrenMockRepository.js` (`readmitChild` :1062 nhận `campusId`) · C `tests/children/intake-campus-in-year.test.mjs`.
- Steps: test (fail) AC-F1..F3 (hàm thuần `keepCampusPick`, mock readmit, kiểm nguồn); `useMasterData(năm tiếp nhận)`; chỉnh `campusPick` khi danh sách tải xong; câu báo AC-F2; ô điểm trường trong modal tiếp nhận lại. `childrenApi.readmitChild` (:214-215) đã gửi nguyên body nên không sửa.
- Exit: `npm run test:children` pass (PowerShell).
- Commit: `G94-180: Offer only campuses of the intake year`, `G94-180: Let readmission pick a campus of the intake year`.
- **Dừng chờ user review.**

### F2 — Tuổi: gợi ý theo tháng tròn, tuổi tối thiểu 3 tháng
- Files: M `childrenHelpers.js` (:12-18) · M `childrenValidation.js` (:85-91) · M `EnrollChildPage.jsx` (:175) · M `ClassPlacementFields.jsx` (:74, câu cảnh báo nói rõ vẫn xếp được) · M mock `enrollChild` (:1114), `importChildren` (:1283) · M `tests/children/…` (test mới cho AC-F4..F6).
- Exit: `npm run test:children` pass.
- Commit: `G94-180: Suggest age groups by full months at year start` (AC-F4, F6) và `G94-433: Require children to be at least 3 months old at intake` (AC-F5).
- **Dừng chờ user review.**

### F3 — Trẻ Sắp nhập học phải xếp lớp trước khi kích hoạt (G94-180)
- Files: M `childrenHelpers.js` (:40-41) · M `src/pages/children/ChildrenListPage.jsx` (cạnh :141, khối cảnh báo :188) · M `EnrollChildPage.jsx` (màn kết quả :303) · M test.
- Exit: `npm run verify` exit 0 (PowerShell).
- Commit: `G94-180: Explain that planned children need a class before activation`.

## Test matrix
| AC | Rule | Test | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-F1..F3 | CHD-02, CHD-11 | `tests/children/intake-campus-in-year.test.mjs` | F1 | |
| AC-F4, F6 | CHD-13 | `tests/children/age-group-suggestion.test.mjs` | F2 | |
| AC-F5 | CHD-13 | `tests/children/intake-min-age.test.mjs` | F2 | |
| AC-F7 | CHD-11 | `tests/children/planned-needs-class.test.mjs` | F3 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Danh sách điểm trường đang tải làm mất lựa chọn | Người dùng phải chọn lại | Chỉ chỉnh lựa chọn khi `md.loading` = false | revert F1 |
| Cần chưa bỏ chặn 2416 | Lớp dự kiến khác nhóm tuổi hỏng ở bảng xếp lớp năm mới | Cảnh báo vàng; gửi Cần tin nhắn trong plan BE | — |

## Validation log
- [x] Khẳng định về code có `file:line` (đọc trên `CareNest_FE` @6181b56e).
- [x] Contract BE thêm `campusId` (tùy chọn) cho readmit và lỗi mới: theo plan BE.
- [x] Mỗi AC có test; mỗi phase có Exit.
- [x] 3 phase, 8 file nguồn. Không cần tách thêm (mục 3 đã tách plan riêng).
- [x] Không dùng rule PENDING/OPEN như đã chốt.

## Progress log
### 2026-11-19 — plan draft
- Commit: chưa commit. Chờ Q1–Q4.
### 2026-11-22 — cập nhật theo quyết định user
- Đổi sang `useMasterData(năm)`; bỏ F3 cũ; thêm tuổi (gợi ý, tối thiểu 3 tháng) và cảnh báo xếp lớp trước kích hoạt.
- Tiếp: user duyệt ⇒ `status: approved`, tạo nhánh, làm F1 sau Phase 1 BE.
### 2026-11-22 — duyệt
- User duyệt plan và yêu cầu làm hết các phase liên tục (không dừng giữa phase). Nhánh tạo trong worktree riêng.
### 2026-11-22 — F1–F3 done
- Commit: `45b31721`, `c4bd36bd` (F1); `8121521b`, `831cc207` (F2, G94-433); `4df1336a`, `f4353800` (F3).
- Verify từng phần: `tests/children` 288/288, `tests/auth` 107/107, `tests/health` 124/124 (PowerShell).
- Khác plan: F3 làm cả câu ở màn kết quả tiếp nhận bằng `plannedAdmissionNotice`; test cũ `planned-admission-view` cập nhật câu mới (commit riêng `f4353800`).
### 2026-11-22 — verify, đóng plan
- Verify `npm run verify` (PowerShell) tại `1e0b6425` (cùng nhánh với plan master data): exit 0; 1616 test pass, 0 fail; Prettier sạch; `check-design` ok; `check-api-contract` 0 lỗi, 2 cảnh báo (có sẵn); build ok.
- Chưa push. Plan chuyển sang `docs/plans/completed/`.
