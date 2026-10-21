---
title: Chuẩn hoá bộ lọc đợt 3 — SearchSubmit, lọc trạng thái một đường, chip bộ lọc, URL
status: approved
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: high
created: 2026-10-20
updated: 2026-10-20
---

# Chuẩn hoá bộ lọc đợt 3

Làn L: ~30 màn ở nhiều nhóm, thêm 1 component + 1 hook dùng chung. Không đổi nghiệp vụ, quyền hay contract BE.

Nguồn: rà soát chỉ đọc 2026-10-20 (agent filter/search). Đợt 1 và badge xong ở `completed/2026-10-20-filter-empty-badge-quickfix.md`. Plan `2026-10-20-ui-standards-status-filter-action-errors.md` giao phần filter còn lại cho luồng; `2026-10-20-style-sync-by-flow.md` đã xong các phase, phần này chưa phiên nào nhận.

## Context
- Chuẩn DESIGN §6.3: `.filter-bar` + `SearchSubmit` + `SearchSelect`/`<select>` + `FilterMore` + "Đặt lại bộ lọc". Chỉ 6 màn dùng `SearchSubmit`; 32 file tự viết `.search-box` lọc theo phím, không ×.
- 5 màn lọc trạng thái ở 2 nơi (thẻ số liệu + ô chọn): Children, HealthFollowUp, Issue, Transfer, Inspection.
- Chưa có chip bộ lọc đang bật; số kết quả chỉ ở chân phân trang.
- ~20 màn mất bộ lọc khi mở chi tiết rồi quay lại; cách lưu URL viết tay 3 lần (`TeacherAssignmentPage:125`, `ClassListSection:56`, `DailyHealthOverviewPage:272`).

## Quyết định đã chốt (user, 2026-10-20)
1. Ô tìm: `SearchSubmit` cho tất cả màn danh sách (bấm Tìm/Enter, có ×).
2. Màn có thẻ số liệu: bỏ ô chọn trạng thái, lọc trạng thái chỉ qua thẻ số liệu.
3. Chip bộ lọc đang bật + số kết quả: component dùng chung trong `components/ui/` (thay quyết định "không tạo component mới" của plan ui-standards cho riêng phần này).
4. Lưu bộ lọc lên URL bằng hook dùng chung cho 8 màn: Issue, Request, Proposal, Transfer, Evaluation, Children, Dish, Food.
5. Không thêm dependency.

## Làm rõ nghiệp vụ
- Không đổi nghiệp vụ: chỉ đổi cách nhập bộ lọc/hiển thị; dữ liệu lọc vẫn do service/BE trả.
- Mặc định theo vai trò (vd. Hiệu trưởng xem đề xuất "Chờ phê duyệt") giữ nguyên.

### Câu hỏi mở
Không còn.

## Acceptance criteria
- **AC-1**: Màn danh sách dùng `SearchSubmit`; gõ không lọc ngay, Enter/"Tìm" mới lọc, × xoá và áp dụng.
- **AC-2**: 5 màn có thẻ số liệu không còn ô chọn trạng thái; bấm thẻ vẫn lọc đúng.
- **AC-3**: Đang lọc ⇒ dưới thanh lọc hiện "N kết quả" + chip từng bộ lọc; bấm × trên chip bỏ đúng bộ lọc đó.
- **AC-4**: 8 màn: lọc → mở chi tiết → Back ⇒ bộ lọc còn nguyên; giá trị mặc định không ghi lên URL.
- **AC-5**: Màn ≥5 ô lọc gom bộ lọc phụ vào `FilterMore` có số; "Đặt lại bộ lọc" nằm trên thanh lọc.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Hook URL | `useFilterParams(defaults)` + helper thuần `utils/filterParams.js` | Mỗi màn tự viết | DRY; test được bằng `node --test` |
| Chip | `FilterChips` trong `components/ui/` | Class CSS | ~10 màn dùng |

## Phases
### Phase 1 — Dùng chung
- C `src/utils/filterParams.js`, `src/hooks/useFilterParams.js`, `src/components/ui/FilterChips.jsx`; M `src/styles/components.css`; C `tests/hardening/filter-params.test.mjs`.
### Phase 2 — Áp vào màn (agent song song, nhóm file tách biệt)
- Nhóm theo module: trẻ/sức khỏe; CSVC/điều chuyển/kiểm kê; đánh giá/KHGD; thực đơn/bếp/cấu hình/khác.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; kiểm tay AC-3, AC-4 ở vài màn.
- **Dừng chờ user review.**

## Test matrix
| AC | Test | Kết quả |
| --- | --- | --- |
| AC-1 | grep `.search-box` tự viết + kiểm tay | đạt: còn 10 file là hộp chọn trong modal/wizard + ô lọc lớp ParentActivation (giữ lọc theo phím); `/children` gõ không lọc, Enter mới lọc |
| AC-2 | kiểm tay Children | đạt: bấm thẻ "Chờ xếp lớp" ⇒ `?status=PENDING_PLACEMENT`, chip trạng thái |
| AC-3 | kiểm tay `/children` | đạt: "14 trẻ · Từ khóa: Nguyễn ×", bấm × bỏ đúng bộ lọc |
| AC-4 | `tests/hardening/filter-params.test.mjs` (4) + kiểm tay Back | đạt: lọc → mở sổ sức khỏe → Back giữ `?keyword=` |
| AC-5 | kiểm tay `/menu/dishes` | đạt: "Đặt lại bộ lọc" trên thanh, không trong panel |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đụng file phiên khác đang sửa | Conflict | Edit đúng dòng, agent theo nhóm file tách biệt | Revert màn |
| Mặc định theo vai trò bị ghi đè bởi URL rỗng | Lọc sai mặc định | Mặc định không ghi lên URL; URL thiếu key ⇒ dùng mặc định | Revert hook |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có cách kiểm; phase có Exit
- [x] >8 file ⇒ chia nhóm agent tách biệt
- [x] Tự review

## Progress log
### 2026-10-20 — Phase 1–2 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (hardening 20 test pass)
- Phase 1 (dùng chung): C `src/utils/filterParams.js` (readFilters/writeFilters/activeFilterKeys), `src/hooks/useFilterParams.js`, `src/components/ui/FilterChips.jsx`; CSS `.filter-summary`, `.filter-chip` trong `components.css`; test `tests/hardening/filter-params.test.mjs`; DESIGN §6.3 thêm quy tắc chip, URL, thẻ số liệu, vị trí nút đặt lại.
- Phase 2 (3 agent song song, file tách biệt) — 24 màn:
  - Trẻ/đón/điểm danh: ChildrenList (SearchSubmit, FilterMore mức theo dõi, chip, URL), HealthFollowUpList (bỏ select trạng thái, chip), ClassPlacement (đếm 2 tab), ParentActivation, PickupList, AttendancePage, ChildDevelopmentList (SearchSubmit), AttendanceDayUnlock (khoảng ngày vào FilterMore).
  - CSVC/điều chuyển/kiểm kê: Issue, Proposal, Request (bỏ select trạng thái, chip, URL; mặc định theo vai trò giữ nguyên và hiện thành chip), FacilityAsset (FilterMore, chip), Transfer (2 view; quản lý: FilterMore loại + ngày, chip, URL), InspectionList (bỏ select, chip, thêm màn rỗng khi lọc).
  - Đánh giá/KHGD/thực đơn: EvaluationListView (URL tab/lớp/kỳ, FilterMore cho lãnh đạo, chip), RewardProposalList, AssessmentDayUnlock (ngày vào FilterMore), GoalList, SchoolPlans (thêm nút đặt lại), Dish/Food (reset ra khỏi panel, chip, URL), AllergyMenuList, MenuList, UserOverrides.
  - Mình sửa thêm: `attendance.css` đặt kích thước cho `.search-submit` thay `.search-box`; gỡ rule chết `.bh-search` (facility.css), `.dg-search--narrow` (assessment.css).
- Khác plan / hệ quả:
  - Bỏ select trạng thái ⇒ trạng thái không có thẻ số liệu không lọc được nữa (vd. Transfer nháp/đã huỷ, Inspection nháp, một số trạng thái Issue/Request). Báo user.
  - Proposal/Request: "Đặt lại bộ lọc" và × chip trạng thái chuyển sang "Tất cả" (`?status=ALL`), không về mặc định của vai trò — giữ hành vi cũ.
  - Số trang không lưu URL; Back về trang 1, giữ bộ lọc.
  - Màn điểm danh, CSVC (FACILITY_ENABLED=false), phân quyền chưa kiểm tay (PHT không vào được / route tắt).
- Tiếp: user review.
