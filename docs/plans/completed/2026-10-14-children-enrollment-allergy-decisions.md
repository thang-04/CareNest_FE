---
title: Hồ sơ trẻ — tiếp nhận không bắt buộc lớp, Phó hiệu trưởng chốt dị ứng
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: dev
modules: [child, health]
rules: [HLT-06, P-17]
risk: high           # bỏ endpoint confirm-allergies (contract PROPOSED) + đổi luồng nhiều màn hình
created: 2026-10-14
updated: 2026-10-14
---
# Hồ sơ trẻ — tiếp nhận không bắt buộc lớp, Phó hiệu trưởng chốt dị ứng

## Context
Review màn 27–35 so với tài liệu nghiệp vụ (Google Doc "Nghiệp vụ", 2026-10-14) để lại nhóm câu hỏi "Đợt 3". User đã chốt. Hiện trạng code:

- Nhập tay bắt buộc chọn lớp: `src/pages/children/EnrollChildPage.jsx:123-126` gọi `validatePlacement`; mock bắt lớp ở `src/services/children/mock/childrenMockRepository.js:319-326`. Import lại tạo trẻ "Chờ xếp lớp" (`childrenMockRepository.js:211`), hai luồng không nhất quán.
- Dị ứng chính thức chỉ có sau khi Hiệu trưởng xác nhận: `canConfirmAllergies` (`src/utils/children/childrenPermissions.js:46`), `confirmAllergies` (`childrenMockRepository.js:467-483`, `src/services/children/api/childrenApi.js:23`), nút xác nhận `src/pages/children/HealthDeclarationPage.jsx:63-67,101-111`, widget/KPI `src/pages/dashboard/PrincipalDashboard.jsx:165-174,317-335`, cảnh báo `src/pages/children/ChildrenListPage.jsx:133-137`.
- Khai báo đổi thì xác nhận cũ bị xóa nhưng `child.allergies` giữ danh sách cũ (`childrenMockRepository.js:455-462`), nên bếp dùng dữ liệu cũ.

## Quyết định đã chốt
1. Phó hiệu trưởng **không bắt buộc** chọn lớp khi tiếp nhận trẻ (nhập tay và import). Trẻ chưa có lớp ở trạng thái "Chờ xếp lớp"; màn Xếp lớp giữ nguyên — user, 2026-10-14.
2. Dị ứng do Phó hiệu trưởng khai báo khi tiếp nhận là **dữ liệu chính thức ngay**, không chờ Hiệu trưởng duyệt — user, 2026-10-14.
3. Phó hiệu trưởng sửa khai báo dị ứng sau tiếp nhận: có hiệu lực ngay, **bắt buộc lý do**, lưu lịch sử (ai, lúc nào, cũ, mới) — user, 2026-10-14.
4. Chỉ giáo viên phụ trách lớp của trẻ được sửa số đo. Code đã đúng (`childrenPermissions.js:49-53`), không sửa — user, 2026-10-14.
5. Sửa số đo đã công bố (phụ huynh có thấy bản cũ không) và đơn nghỉ cho ngày đã khóa: **tạm thời chưa sửa** — user, 2026-10-14.
6. Chỉ làm Đợt 3; các việc Đợt 1 (chỉ FE) để task riêng — user, 2026-10-14.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor: Phó hiệu trưởng (tiếp nhận, khai báo, xếp lớp trong campus); Hiệu trưởng chỉ xem. Outcome: hồ sơ trẻ được tạo khi chưa có lớp; dị ứng khai báo dùng ngay cho bếp/điểm danh. Rule: HLT-06 (CONFIRMED phần "dị ứng thuộc child") · P-17 (PENDING ở BE — quyết định 2–3 trả lời câu này). Flow: [B] phụ huynh cung cấp → [S] Phó hiệu trưởng nhập → dữ liệu chính thức.
- **Đối chiếu tài liệu:** SRS screen 30 + GBR-CP-02 ghi Hiệu trưởng xác nhận dị ứng; UC 3.8 yêu cầu xếp lớp trước khi chốt nhập học. Quyết định 1–2 đi khác SRS ⇒ cần cập nhật SRS và `BE:docs/business/BUSINESS_RULES.md` (P-17, HLT-06).
- **Ảnh hưởng:** FE: `/children/enroll`, `/children/import`, `/children/:id/health-declaration`, `/children`, dashboard Hiệu trưởng. Contract: bỏ `POST /children/{id}/health-declaration/confirm-allergies`; `POST /children/enroll` cho `classId` rỗng. Trẻ chưa có lớp: campus đang lấy từ `user.campusId` (`childrenMockRepository.js:210`), BE cần cách xác định campus khi chưa có Enrollment. Bếp/điểm danh đọc `child.allergies` — không đổi chỗ đọc. Dữ liệu cũ: seed `allergyConfirmation` (`src/mocks/childrenSeed.js:62`).

### Câu hỏi mở
- [x] Import xếp lớp thế nào ⇒ không bắt buộc lớp, giữ "Chờ xếp lớp".
- [x] Sửa dị ứng sau tiếp nhận ⇒ hiệu lực ngay, bắt buộc lý do.
- [x] Màn Xếp lớp ⇒ giữ.
- [x] Jira key ⇒ chưa commit trong plan này; hỏi khi user yêu cầu commit.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Trẻ chờ xếp lớp có hợp lệ? | Có; tiếp nhận không bắt buộc lớp | user | 2026-10-14 | đề xuất BE (Phase 3) |
| Ai sửa số đo? | Chỉ giáo viên phụ trách lớp của trẻ | user | 2026-10-14 | đề xuất BE (Phase 3) |
| Ai chốt dị ứng? | Phó hiệu trưởng khi tiếp nhận/sửa; không chờ Hiệu trưởng | user | 2026-10-14 | đề xuất BE P-17 (Phase 3) |
| Sửa bản đã công bố / đơn nghỉ ngày khóa | Tạm chưa sửa | user | 2026-10-14 | — |

## Acceptance criteria
- **AC-1** (QĐ 1): Given Phó hiệu trưởng ở bước Xếp lớp của wizard, When không chọn lớp và bấm Tiếp tục, Then được đi tiếp; lưu xong trẻ có trạng thái "Chờ xếp lớp", màn thành công không nhắc tên lớp.
- **AC-2** (QĐ 1): Given chọn lớp, When lưu, Then hành vi như hiện tại (kiểm sức chứa, campus, báo giáo viên lớp).
- **AC-3** (QĐ 1): Màn Xếp lớp vẫn bắt buộc chọn lớp khi xếp/chuyển lớp.
- **AC-4** (QĐ 1): Câu chữ sau import không còn nói tiếp nhận "hoàn tất sau khi xếp lớp".
- **AC-5** (QĐ 2): Given khai báo "Có dị ứng" khi tiếp nhận, When lưu, Then `child.allergies` = danh sách khai báo ngay; không có thông báo/nút/widget "chờ Hiệu trưởng xác nhận".
- **AC-6** (QĐ 3): Given trẻ đã có khai báo, When Phó hiệu trưởng sửa mà không nhập lý do, Then báo lỗi lý do; có lý do thì lưu, `child.allergies` cập nhật theo khai báo mới (rỗng nếu "Không có"/"Chưa cung cấp"), lịch sử ghi người, thời điểm, lý do.
- **AC-7** (QĐ 2): Hiệu trưởng mở khai báo sức khỏe chỉ xem, không có nút xác nhận; dashboard Hiệu trưởng không còn KPI/widget "Dị ứng chờ xác nhận".

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bắt lớp ở wizard | Thêm prop `required` cho `ClassPlacementFields`, bỏ `validatePlacement` ở bước 1 wizard | Đổi `validatePlacement` chung | Màn Xếp lớp vẫn cần bắt buộc (AC-3) |
| Trường `allergyConfirmation` | Bỏ khỏi mock/seed/typedef | Giữ, tự điền khi Phó hiệu trưởng lưu | Không còn bước xác nhận; người chốt = `declaredBy/declaredAt` đã có |

## Phases
### Phase 1 — Tiếp nhận không bắt buộc lớp
- Files: M `src/pages/children/EnrollChildPage.jsx` · M `src/components/children/ClassPlacementFields.jsx` · M `src/services/children/mock/childrenMockRepository.js` (`enrollChild`) · M `src/pages/children/ImportChildrenPage.jsx` (câu chữ :122, :305)
- Steps: 1. `ClassPlacementFields` nhận `required` (mặc định true), wizard truyền false. 2. Bước 1 wizard không chặn khi thiếu lớp; màn xem lại và màn thành công hiển thị "Chưa xếp lớp". 3. Mock `enrollChild` chỉ kiểm lớp/báo giáo viên khi có `classId`. 4. Sửa câu chữ import.
- Tests: AC-1..4 → kiểm tay trên mock (repo chưa có test runner cho page — xác nhận khi chạy verify).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0
- **Dừng chờ user review.**

### Phase 2 — Phó hiệu trưởng chốt dị ứng
- Files: M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js` · M `src/utils/children/childrenPermissions.js` · M `src/pages/children/HealthDeclarationPage.jsx` · M `src/components/children/DeclarationSummary.jsx` · M `src/pages/dashboard/PrincipalDashboard.jsx` · M `src/pages/children/ChildrenListPage.jsx` · M `src/mocks/childrenSeed.js` · M `src/models/children/childrenConstants.js` (typedef)
- Steps: 1. Mock: `createChild`/`saveDeclaration` đồng bộ `child.allergies` theo khai báo; lý do bắt buộc khi đã có khai báo; bỏ `confirmAllergies`, `notifyAllergyToConfirm`, `allergyPending`. 2. Bỏ `confirmAllergies` ở service/api, `canConfirmAllergies`. 3. Trang khai báo: bỏ nút/modal xác nhận, nhãn lịch sử. 4. `DeclarationSummary`: thay dòng "Xác nhận dị ứng" bằng người khai báo + thời điểm. 5. Bỏ KPI/widget dashboard và cảnh báo ở danh sách trẻ. 6. Seed bỏ `allergyConfirmation`.
- Tests: AC-5..7 → kiểm tay trên mock; grep không còn `confirmAllergies|allergyPending|allergyConfirmation` trong `src`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0
- **Dừng chờ user review.**

### Phase 3 — Tri thức
- Files: M `docs/features/README.md` (dòng "Hồ sơ trẻ, ghi danh, dị ứng") · M `docs/knowledge/incidents/FE-CASE-261010-report3-child-screen-alignment.md` · M `docs/knowledge/incidents/FE-CASE-261014-health-role-flow-alignment.md`
- Steps: ghi quyết định 1–5; soạn đề xuất cho BE (P-17 đóng, HLT-06, Enrollment không bắt buộc lớp, bỏ endpoint confirm-allergies, actor sửa số đo) đưa user — không sửa repo BE.
- Exit: `node scripts/check-ai-layer.mjs` PASS + `node scripts/verify.mjs` PASS.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..4 | QĐ 1 | Kiểm tay mock + verify | 1 | |
| AC-5..7 | QĐ 2–3, P-17 | Kiểm tay mock + grep + verify | 2 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lệch SRS (GBR-CP-02, UC 3.8) | Tài liệu nộp và code khác nhau | Phase 3 ghi rõ, đề xuất cập nhật SRS/BE | Revert phase |
| BE chưa đổi contract | FE gọi BE thật thiếu endpoint/validate lớp | Contract đang PROPOSED, chạy mock; đề xuất BE ở Phase 3 | Revert phase |
| localStorage mock còn dữ liệu cũ có `allergyConfirmation` | Hiển thị lẫn | Code bỏ qua trường thừa; reset mock nếu cần | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `HealthDeclarationPage` (confirmAllergies), `EnrollChildPage` (enroll không lớp)
- [x] Mỗi AC có cách kiểm; mỗi phase có Exit
- [x] >8 file ⇒ đã tách 3 phase, dừng review giữa các phase
- [x] Không dùng rule PENDING như đã chốt: P-17 vẫn PENDING ở BE, quyết định của user ghi là nguồn user
- [x] Tự review: không placeholder (trừ Jira chờ user)

## Đề xuất cho BE (chưa sửa repo BE)
Nguồn: user, 2026-10-14. Mức: quyết định của user, BE cần ghi nhận và đổi trạng thái rule.

| File BE | Rule/mục | Đề xuất |
| --- | --- | --- |
| `BE:docs/business/BUSINESS_RULES.md` | P-17, HLT-06 | Đóng P-17: Phó hiệu trưởng campus khai báo dị ứng khi tiếp nhận và đó là dữ liệu chính thức ngay; sửa sau bắt buộc lý do, lưu lịch sử (người, thời điểm, cũ, mới); Hiệu trưởng chỉ xem |
| `BE:docs/modules/child.md` | Enrollment | Cho phép tiếp nhận trẻ chưa có lớp (trạng thái chờ xếp lớp); cần cách xác định campus khi chưa có Enrollment (`campusOfChild`) |
| `BE:docs/modules/health.md`, `BE:docs/business/USER_ROLES.md` | Quyền số đo | Chỉ giáo viên được phân công lớp của trẻ nhập/sửa/công bố số đo; BGH chỉ xem |
| Contract child (PROPOSED) | API | Bỏ `POST /children/{id}/health-declaration/confirm-allergies`; `POST /children/enroll` nhận `classId` rỗng; `PUT` khai báo bắt buộc `reason` khi đã có khai báo |
| `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` | SRS | Ghi lệch SRS cần sửa tài liệu nộp: GBR-CP-02 (Hiệu trưởng xác nhận dị ứng), UC 3.8 (xếp lớp trước khi chốt nhập học), HLT-03 (BGH sửa số đo) |

## Progress log
### 2026-10-14 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: không. Chưa kiểm tay AC-1..4 trên trình duyệt.
- Tiếp: Phase 2 sau khi user review.
### 2026-10-14 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (lần đầu FAIL prettier 3 file vừa sửa; đã `prettier --write`, chỉ đổi dòng đã sửa)
- Khác plan: thêm 6 file ngoài danh sách — `ChildProfilePage.jsx`, `ChildQuickPanel.jsx`, `EnrollChildPage.jsx` (bỏ prop `confirmedAllergies/confirmedByName` của `DeclarationSummary`); `HealthDeclarationFields.jsx`, `AllergyMenuListPage.jsx`, `menuPlanningSeed.js` (câu chữ còn nói "Hiệu trưởng xác nhận"). Lịch sử khai báo lưu thêm `allergyChange {from,to}` để hiện giá trị cũ → mới (QĐ 3). Giữ nhãn `ALLERGY_CONFIRMED` cho bản ghi cũ trong localStorage. Chưa kiểm tay AC-5..7.
- Tiếp: Phase 3 sau khi user review.
### 2026-10-14 — Phase 3 (done)
- Commit: chưa commit
- Docs: `docs/features/README.md` (2 dòng), `docs/knowledge/incidents/FE-CASE-261010-report3-child-screen-alignment.md`, `docs/knowledge/incidents/FE-CASE-261014-health-role-flow-alignment.md` (mục Cập nhật 2026-10-14); đề xuất BE ở mục trên
- Khác plan: không
- Tiếp: user xác nhận done 2026-10-14; chưa commit; BE chưa cập nhật theo đề xuất.
