---
title: Hiệu trưởng tiếp nhận trẻ như Phó hiệu trưởng
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # theo nhánh hiện tại; xác nhận task Jira khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child]
rules: [AUTH-02]
risk: medium
created: 2026-10-27
updated: 2026-10-27
---
# Hiệu trưởng tiếp nhận trẻ như Phó hiệu trưởng

## Context
User yêu cầu (27/10/2026): "tại nghiệp vụ tiếp nhận trẻ hãy cho hiệu trưởng quyền giống như phó hiệu trưởng".

Hiện trạng FE (mock):
- Tiếp nhận chỉ Phó hiệu trưởng: `canEnrollChild` (`src/utils/children/childrenPermissions.js:44`); xếp lớp `canPlaceChild = vpEditable` (`:54`); mở lại hồ sơ đã nghỉ học cần `vpOfCampus` (`:56-57`). Hiệu trưởng đã sửa hồ sơ, cho nghỉ học, khai báo sức khỏe, kích hoạt phụ huynh (`:50-62`).
- Route `/children/new`, `/children/import`, `/children/placement` chỉ `VP_ONLY` (`src/routes/AppRoutes.jsx:356-358`); menu Hiệu trưởng thiếu "Tiếp nhận trẻ", "Xếp lớp" (`src/layouts/menuConfig.js:146`); Tạo nhanh "Tiếp nhận trẻ" chỉ PHT (`src/layouts/quickActions.js:37`); màn Xếp lớp chặn bằng `isVicePrincipal` (`src/pages/children/ClassPlacementPage.jsx:65`).
- Mock: trẻ chưa xếp lớp nhận `user.campusId` (`src/services/children/mock/childrenMockRepository.js:713`) — Hiệu trưởng (toàn trường; tài khoản demo có `campusId: 'c1'`) sẽ âm thầm tiếp nhận vào điểm trường 1; xếp lớp không cập nhật điểm trường theo lớp (`:1060-1061`). Hai điểm trường demo cùng có "Lớp Mầm 1" (`src/mocks/schoolSeed.js`).

BE (đọc bản local `D:\project_capstone\project\be\CareNest_BE`, nhánh `feature/G94-180-BE-FEAT-43-child-health-pickup`, commit `aa64480` 22/10/2026 — không có sibling `../CareNest_BE`):
- `BE:docs/business/USER_ROLES.md:21` Vice Principal "Như Principal nhưng trong campus được phân công (AUTH-02)" ⇒ yêu cầu khớp mô hình quyền BE.
- `BE:docs/modules/child.md`: chưa có API tiếp nhận/xếp lớp; `BE:docs/business/DOMAIN_MODEL.md:28` campus suy từ classroom. Contract tiếp nhận ở FE là PROPOSED (`src/services/children/api/childrenApi.js:3`).

## Quyết định đã chốt
1. Hiệu trưởng làm được mọi việc của Phó hiệu trưởng trong tiếp nhận trẻ, trên mọi điểm trường: tiếp nhận (form, nhập Excel, kiểm trùng), mở lại hồ sơ trẻ đã nghỉ học, xếp lớp / chuyển lớp — user, 2026-10-27.
2. Quyền Phó hiệu trưởng giữ nguyên (theo quyền "Hồ sơ trẻ" Hiệu trưởng giao) — suy từ yêu cầu (chỉ thêm cho Hiệu trưởng).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Hiệu trưởng · outcome: tiếp nhận / nhập Excel / mở lại hồ sơ / xếp lớp như PHT, phạm vi toàn trường · rule: AUTH-02 (scope PHT theo campus; HT toàn trường) · flow: [B] phụ huynh nộp hồ sơ → [S] tiếp nhận (thông tin, xếp lớp tùy chọn, khai báo sức khỏe) → [S] xếp lớp nếu còn Chờ xếp lớp.
- **Đối chiếu thiết kế ban đầu:** FE ghi "Chỉ Phó hiệu trưởng phụ trách điểm trường được tiếp nhận trẻ" (`src/pages/children/EnrollChildPage.jsx:82`), mở lại hồ sơ "Phó hiệu trưởng của điểm trường của trẻ" (`childrenPermissions.js:55`, `docs/features/README.md:145`) ⇒ yêu cầu mới thay. BE không có rule riêng cho tiếp nhận.
- **Ảnh hưởng:** module child · quyền/scope: HT toàn trường · FE: `/children`, `/children/new`, `/children/import`, `/children/placement`, `/children/:id` (nút Xếp lớp), menu, Tạo nhanh · APP: không · dữ liệu cũ: không đổi (trẻ cũ giữ điểm trường).

### Câu hỏi mở
Chế độ tự chạy (CLAUDE.md, user chốt 2026-10-23): tự chọn phương án khuyến nghị, ghi giả định để user soát.
- [x] G1 — "Nghiệp vụ tiếp nhận trẻ" là luồng nào? ⇒ luồng hồ sơ `/children/new` (+ nhập Excel, mở lại hồ sơ, xếp lớp), không phải "Tiếp nhận từng trẻ" buổi sáng ở `/attendance` (màn đó HT/PHT không nhập; menu "Tiếp nhận trẻ" = `/children/new`, chỉ PHT).
- [x] G2 — Trẻ chưa xếp lớp do HT tiếp nhận thuộc điểm trường nào? ⇒ HT chọn "Điểm trường" (bắt buộc) ở bước Xếp lớp và ở màn nhập Excel, như PHT tiếp nhận vào điểm trường mình.
- [x] G3 — HT xếp lớp cho trẻ: lớp nào hiện? ⇒ ô "Điểm trường" mặc định điểm trường của trẻ, lớp lọc theo ô; chọn lớp điểm trường khác = chuyển điểm trường, điểm trường của trẻ theo lớp (`BE:docs/business/DOMAIN_MODEL.md:28`).
- [x] G4 — Trang chủ HT có thêm KPI "Chờ xếp lớp" như PHT? ⇒ không (ngoài yêu cầu); lối vào là menu, Tạo nhanh, nút ở Danh sách trẻ, hồ sơ trẻ.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| G1–G4 | Như trên (giả định chế độ tự chạy, chờ user soát) | Claude | 2026-10-27 | `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md` |

## Acceptance criteria
- **AC-1** (AUTH-02): Given Hiệu trưởng, When mở menu Quản lý trẻ / Tạo nhanh / Danh sách trẻ, Then có "Tiếp nhận trẻ", "Xếp lớp", "Nhập từ Excel" như PHT.
- **AC-2**: Given Hiệu trưởng tiếp nhận không chọn lớp, When chọn điểm trường 2 và lưu, Then trẻ Chờ xếp lớp thuộc điểm trường 2; không chọn điểm trường ⇒ 422 `campusId`, form quay về bước Xếp lớp.
- **AC-3**: Given Hiệu trưởng chọn điểm trường ở bước Xếp lớp, Then chỉ hiện lớp của điểm trường đó; lưu có lớp ⇒ trẻ thuộc điểm trường của lớp; lớp khác điểm trường đã chọn ⇒ 422 `classId`.
- **AC-4**: Given Hiệu trưởng nhập Excel, When chọn điểm trường và nhập, Then trẻ Chờ xếp lớp ở điểm trường đó; thiếu điểm trường ⇒ 422 `campusId`.
- **AC-5**: Given trẻ đã nghỉ học ở bất kỳ điểm trường, When Hiệu trưởng kiểm trùng, Then `canReadmit = true` và mở lại được hồ sơ.
- **AC-6**: Given Hiệu trưởng ở màn Xếp lớp, When xếp trẻ Chờ xếp lớp hoặc chuyển lớp, Then thành công; chọn lớp điểm trường khác ⇒ điểm trường của trẻ theo lớp.
- **AC-7**: Given PHT một điểm trường, Then hành vi không đổi: không có ô điểm trường, tiếp nhận vào điểm trường mình; gửi điểm trường khác ⇒ 422 `campusId`; giáo viên vẫn 403.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Điểm trường của trẻ chưa xếp lớp khi HT tiếp nhận | HT chọn ô "Điểm trường" (chỉ hiện khi người dùng tiếp nhận được vào ≥2 điểm trường), mặc định điểm trường của tài khoản nếu có quyền ở đó | (b) Bắt buộc HT chọn lớp; (c) dùng `user.campusId` của HT | (b) lệch "giống PHT" (PHT được bỏ trống lớp) và nhập Excel vẫn cần điểm trường; (c) âm thầm sai điểm trường |
| Lớp hiện khi HT xếp lớp | Lọc theo ô "Điểm trường", mặc định điểm trường của trẻ; điểm trường của trẻ theo lớp khi lưu | (b) Hiện lớp cả 2 điểm trường; (c) chỉ lớp điểm trường của trẻ, cấm chuyển | (b) trùng tên lớp giữa 2 điểm trường; (c) bớt quyền PHT toàn trường đang có |
| Nơi kiểm điểm trường | Mock (BE giả) kiểm `campusId`: tồn tại, đang hoạt động, có quyền Thêm; lớp thuộc điểm trường đã chọn | Chỉ UI | BE quyết quyền/scope (invariant 1, 3) |

## Phases
### Phase 1 — Quyền + mock + test
- Files: M `src/utils/children/childrenPermissions.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js` · C `tests/children/principal-enrollment.test.mjs`
- Steps: 1. `canEnrollChild`, `canPlaceChild`, `canReadmitChild` theo quyền "Hồ sơ trẻ" (HT = Sửa toàn trường); thêm `canOpenPlacement`, `childCampusesOf`. 2. Mock: `enrollChild` nhận `campusId`, `importChildren(rows, user, campusId)`, `placeChild` cập nhật điểm trường theo lớp. 3. Contract PROPOSED ghi ở `childrenApi.js`.
- Tests: AC-1..AC-7 → `tests/children/principal-enrollment.test.mjs`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Lối vào + màn hình
- Files: M `src/routes/AppRoutes.jsx` · M `src/layouts/menuConfig.js` · M `src/layouts/quickActions.js` · M `src/components/children/ClassPlacementFields.jsx` · M `src/pages/children/EnrollChildPage.jsx` · M `src/pages/children/ImportChildrenPage.jsx` · M `src/pages/children/ClassPlacementPage.jsx` · M `src/pages/menu-planning/AllergyMenuListPage.jsx` (câu chữ "Phó hiệu trưởng đã chốt")
- Steps: 1. Route, menu, Tạo nhanh cho HT. 2. Ô Điểm trường trong `ClassPlacementFields` (≥2 điểm trường). 3. Tiếp nhận / nhập Excel gửi `campusId`; Xếp lớp mặc định điểm trường của trẻ. 4. Câu 403 không còn "Chỉ Phó hiệu trưởng".
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; chạy thử trình duyệt (mock) bằng tài khoản HT và PHT.

### Phase 3 — Tài liệu
- Files: M `docs/architecture/ROUTE_MAP.md` · M `docs/features/README.md` · plan → `docs/plans/completed/`
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-02 | `principal-enrollment.test.mjs` menu + Tạo nhanh (config) | 1 | pass; trình duyệt: menu, Tạo nhanh HT có "Tiếp nhận trẻ" |
| AC-2 | — | `principal-enrollment.test.mjs` enroll không lớp (mock) | 1 | pass; trình duyệt: thiếu điểm trường báo lỗi, lưu Campus 2 ⇒ `c2` Chờ xếp lớp |
| AC-3 | — | `principal-enrollment.test.mjs` enroll có lớp (mock) | 1 | pass; trình duyệt: lớp lọc theo điểm trường |
| AC-4 | — | `principal-enrollment.test.mjs` import (mock) | 1 | pass; trình duyệt: nhập 1 dòng CSV giả vào Campus 2 |
| AC-5 | — | `principal-enrollment.test.mjs` readmit (mock) | 1 | pass (chưa thử trình duyệt) |
| AC-6 | — | `principal-enrollment.test.mjs` placement (mock) | 1 | pass; trình duyệt: xếp Lớp Mầm 2 Campus 2; hộp xác nhận chuyển điểm trường (đã hủy) |
| AC-7 | AUTH-02 | `principal-enrollment.test.mjs` PHT/giáo viên + `duplicate-child.test.mjs` hiện có | 1 | pass; trình duyệt PHT Campus 1: Nhập Excel, Xếp lớp không có ô điểm trường |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE thật chưa có quyền HT tiếp nhận / chưa nhận `campusId` | Chế độ API thật lệch mock | Ghi contract PROPOSED trong `childrenApi.js` và báo cáo | Gỡ HT khỏi route/menu (Phase 2) |
| PHT toàn trường thấy ô Điểm trường mới | Thêm 1 ô, mặc định điểm trường của PHT | Mặc định giữ kết quả cũ | Ẩn ô theo vai |
| Chuyển lớp khác điểm trường đổi điểm trường của trẻ | PHT điểm trường cũ không còn thấy trẻ | Đúng mô hình BE (campus theo lớp); hộp xác nhận nêu điểm trường mới | Bỏ cập nhật điểm trường trong `placeChild` |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `POST /children/enrollments` (`EnrollChildPage`), `POST /children/enrollments/import` (`ImportChildrenPage`), `POST /children/{id}/placement` (`ClassPlacementPage`) — đều PROPOSED, chưa có ở BE
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách — một thay đổi quyền liền mạch; tách thì HT vào được route nhưng lưu sai điểm trường
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-27 — Plan
- Chế độ tự chạy: plan tự duyệt theo CLAUDE.md, làm liền các phase; giả định G1–G4 ở "Câu hỏi mở" chờ user soát.
- Commit: chưa commit

### 2026-10-27 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Test riêng `tests/children/*.test.mjs` → 48 pass, 0 fail (7 ca mới đỏ trước khi sửa).
- Khác plan: menu, Tạo nhanh làm luôn ở Phase 1 (AC-1 cần). Cổng lần đầu FAIL vì lỗi có sẵn ngoài phạm vi: (1) `tests/menu/ai-week.test.mjs` cố định tuần 02/11 trùng tuần nháp seed sinh theo hôm nay ⇒ sửa test tính tuần theo hôm nay (incident `FE-BUG-261024-menu-ai-week-verification` → fixed); (2) Prettier báo 4 file education-plan từ commit merge (`useEducationPlan.jsx`, `SchoolPlansPage.jsx`, `educationPlanApi.js`, `educationPlanService.js`) ⇒ chạy `prettier --write`, chỉ đổi xuống dòng/dòng trống. Nên tách commit riêng.

### 2026-10-27 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (chạy lại sau sửa file mẫu).
- Trình duyệt (Vite mock, 1920px + 390px): HT tiếp nhận vào Campus 2 không lớp, xếp lớp, xem hộp chuyển điểm trường, nhập Excel; PHT Campus 1 không thấy ô điểm trường. 390px: khung xếp lớp vừa màn; header cả app tràn 34px (có sẵn, liên quan `FE-BUG-261020-layout-css-loaded-before-components`) — không sửa.
- Khác plan: thêm `defaultCampusId` ở `src/utils/children/childrenHelpers.js`; sửa dòng mẫu file mẫu nhập Excel lệch cột (lỗi có sẵn, incident `FE-BUG-261027-import-template-misaligned-row`). Câu "Liên hệ Hiệu trưởng để mở lớp" trong `ClassPlacementFields` đổi thành câu trung tính (HT cũng thấy).
- Ghi chú công cụ: sau khi chọn file bằng Playwright MCP, bấm chuột thật không tới trang (không có sự kiện nào); đóng và mở lại trình duyệt thì bình thường — không phải lỗi app.

### 2026-10-27 — Phase 3 (done)
- Tài liệu: `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, `docs/context/CURRENT_STATE.md`, tri thức `docs/knowledge/ISSUE_INDEX.md` + 2 incident. Plan chuyển sang `docs/plans/completed/`.
- Commit: chưa commit
