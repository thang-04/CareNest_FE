---
title: Màn trẻ, sức khỏe lấy điểm trường theo năm học đang xem
status: done         # xong 2026-11-22: Phase 1, `npm run verify` exit 0 tại 1e0b6425
owner: Giáp
jira: G94-180 / FE-FIX-14
branch: fix/G94-180-FE-FIX-14-school-year-scope   # cùng nhánh với plan 2026-11-19-intake-campus-in-year
modules: [children]
rules: [G94-180/CHD-09, G94-180/HLT-08, HLT-20, CFG-YR-01]
risk: medium         # 5 màn ở 2 nhóm (trẻ, sức khỏe); chỉ đổi tham số năm khi gọi hook của Cần; không sửa vùng dùng chung
created: 2026-11-22
updated: 2026-11-22
---
# Màn trẻ, sức khỏe lấy điểm trường theo năm học đang xem — Web

Mục 3 của bản phân tích 22/11. BE không phải đổi gì: `GET /campuses?schoolYearId=` đã có (code của Cần). Không có năm thì BE trả điểm trường của năm đang hoạt động; năm đã kết thúc thì trả bản chụp lúc đóng năm.

## Context
Các màn gọi `useMasterData()` không truyền năm, nên danh sách và tên điểm trường luôn theo năm đang hoạt động, dù header chọn năm khác:

| Màn | Dòng | Dùng `md` cho |
| --- | --- | --- |
| Danh sách trẻ | `src/pages/children/ChildrenListPage.jsx:63` | `campuses`, `campusById` (bộ lọc, tên) |
| Đợt khám, kỳ cân đo | `src/pages/children/HealthCheckListPage.jsx:35` | `campuses` (bộ lọc của HT) |
| Tổng hợp cân đo | `src/pages/children/GrowthReportPage.jsx:110` | `campuses` (bộ lọc, quyền PHT) |
| Xu hướng sức khỏe | `src/pages/children/HealthTrendPage.jsx:39` | `campuses`, `campusById` |
| Hồ sơ trẻ | `src/pages/children/ChildProfilePage.jsx:50` | `campusById`, `userById` |

Không đổi:
- `HealthCheckFormPage.jsx:71`: tạo, sửa đợt chỉ ở năm đang hoạt động.
- `HealthDeclarationPage.jsx:56`: chỉ dùng `userById`.
- `ClassPlacementPage.jsx`: luật Y-3, luôn năm đang hoạt động.

Hook `src/hooks/useMasterData.js:7` của Cần nhận `schoolYearId`. Các màn của Cần đã dùng cách này, ví dụ `CampusDetailPage.jsx:39`, `RoomListPage.jsx:46`.

## Quyết định đã chốt
1. Màn xem theo năm truyền năm ở header vào `useMasterData` — user 22/11.
2. Hồ sơ trẻ: trẻ Sắp nhập học dùng năm đăng ký (`child.plannedAdmission.schoolYearId`), trẻ khác dùng năm đang hoạt động (giữ như cũ) — đề xuất trong plan, user duyệt cùng plan.
3. Không sửa code Cần, không sửa vùng dùng chung.

### Câu hỏi mở
Không còn.

## Acceptance criteria
- **AC-1** (CHD-09, CFG-YR-01): header chọn 2025-2026 ⇒ bộ lọc điểm trường ở Danh sách trẻ, Đợt khám, Tổng hợp cân đo, Xu hướng là điểm trường của 2025-2026. Đổi năm ở header ⇒ danh sách tải lại.
- **AC-2** (CHD-11): hồ sơ trẻ Sắp nhập học ở điểm trường chỉ có trong năm sau ⇒ hiện đúng tên điểm trường.
- **AC-3**: header ở năm đang hoạt động ⇒ hành vi như cũ.

## Phases
### Phase 1 — Truyền năm vào `useMasterData` (G94-180)
- Files: M 5 màn ở bảng Context · C `tests/children/year-scoped-master-data.test.mjs`.
- Steps:
  1. Test (fail), kiểm nguồn:
     - 4 màn danh sách, báo cáo gọi `useMasterData(schoolYear)`;
     - hồ sơ gọi `useMasterData(child?.plannedAdmission?.schoolYearId ?? null)` (hoặc biến tương đương);
     - `HealthCheckFormPage` vẫn gọi không năm.
  2. Sửa 5 màn. `schoolYear` lấy từ `useSchoolYear()` đã có trong từng màn; hồ sơ thêm nếu chưa có.
- Exit: `npm run verify` exit 0 (PowerShell).
- Commit: `G94-180: Load campuses of the viewed school year on child screens`.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..3 | CHD-09, CFG-YR-01 | `tests/children/year-scoped-master-data.test.mjs` (kiểm nguồn) + kiểm tay trên BE local | 1 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Năm đã kết thúc thiếu bản chụp điểm trường | Bộ lọc rỗng | BE chụp lúc đóng năm (code Cần); kiểm tay với seed 2025-2026 | revert commit |
| Tải lại master data khi đổi năm | Thêm 3 request mỗi lần đổi năm | Chấp nhận (như màn cấu hình của Cần) | — |

## Validation log
- [x] Khẳng định về code có `file:line` (đọc trên `CareNest_FE` @6181b56e).
- [x] Không đổi contract BE.
- [x] Mỗi AC có test hoặc bước kiểm tay; phase có Exit.
- [x] 1 phase, 5 file nguồn.
- [x] Không dùng rule PENDING/OPEN như đã chốt.

## Progress log
### 2026-11-22 — plan draft
- Commit: chưa commit.
- Tiếp: user duyệt ⇒ `status: approved`, làm sau F1–F3 của plan tiếp nhận.
### 2026-11-22 — duyệt
- User duyệt plan và yêu cầu làm hết các phase liên tục (không dừng giữa phase). Nhánh tạo trong worktree riêng.
### 2026-11-22 — Phase 1 done
- Commit: `1e0b6425`.
- Verify: `tests/children/year-scoped-master-data.test.mjs` 3/3; `tests/children` 288/288.
### 2026-11-22 — verify, đóng plan
- Verify `npm run verify` (PowerShell) tại `1e0b6425`: exit 0; 1616 test pass, 0 fail; Prettier sạch; `check-design` ok; `check-api-contract` 0 lỗi, 2 cảnh báo (có sẵn); build ok.
- Chưa push. Plan chuyển sang `docs/plans/completed/`.
