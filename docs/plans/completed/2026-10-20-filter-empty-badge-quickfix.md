---
title: Sửa nhanh bộ lọc, màn rỗng khi lọc và badge trạng thái
status: done
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-20
updated: 2026-10-20
---

# Sửa nhanh bộ lọc, màn rỗng khi lọc và badge trạng thái

Làn L vì đụng >8 file ở nhiều nhóm màn. Chỉ đổi hiển thị, không đổi nghiệp vụ, quyền hay contract BE.

Nguồn: rà soát chỉ đọc ngày 2026-10-20 (2 agent: trạng thái/badge và filter/search). User duyệt "Làm đợt 1 và phần badge của đợt 2" (2026-10-20).

Liên quan:
- `2026-10-20-ui-standards-status-filter-action-errors.md`: chuẩn badge/filter (DESIGN §3.2, §6.3).
- `2026-10-20-style-sync-by-flow.md`: phần chuẩn hoá ô tìm, FilterMore, lọc nhanh theo trạng thái (đợt 3) làm theo luồng ở plan đó.

## Context
- `GoalListPage.jsx:68,130`: lọc ra 0 dòng vẫn báo "Chưa có kế hoạch năm học".
- 13 nút "Đặt lại" chưa theo nhãn chuẩn "Đặt lại bộ lọc" (DESIGN §6.3).
- 4 trang CSVC và wizard điều chuyển dùng "Campus", trái glossary `DESIGN.md:586` (dùng "điểm trường").
- Nhiều trạng thái hiện bằng chữ trơn hoặc chip viết tay thay vì badge của module (DESIGN §3.2: trạng thái chỉ qua `createStatusBadge`).

## Quyết định đã chốt
1. Làm đợt 1 (sửa nhanh) và phần badge của đợt 2 — user, 2026-10-20.
2. Không tạo component dùng chung mới trong `ui/` (chip lọc, hook URL, AiDraft chung chưa duyệt).
3. Tông badge theo DESIGN §3.2 và `StatusBadge.jsx:4-11`.

## Làm rõ nghiệp vụ
- Không đổi nghiệp vụ: chỉ đổi cách hiển thị trạng thái đã có và nhãn.
- Không tự tính lại trạng thái nghiệp vụ ở FE: badge chỉ map giá trị BE/mock trả về.

### Câu hỏi mở
Không còn câu hỏi mở cho phạm vi này. Các câu ở đợt 4 (chip lọc, URL, select trạng thái trùng, AiDraft chung) nằm ngoài plan.

## Acceptance criteria
- **AC-1**: Given danh sách đang lọc, When lọc ra 0 dòng, Then hiện "Không có kết quả phù hợp" + nút "Đặt lại bộ lọc", không báo "chưa có dữ liệu".
- **AC-2**: Nút xoá bộ lọc trên thanh lọc ghi "Đặt lại bộ lọc".
- **AC-3**: Bộ lọc/cột/nhãn điểm trường ở CSVC ghi "điểm trường".
- **AC-4**: Trạng thái trong danh sách đã rà hiện bằng badge của module, không còn chip viết tay ở các chỗ đã liệt kê.

## Phases
### Phase 1 — Sửa nhanh + badge
- Files (M): `GoalListPage`, 13 trang có nút "Đặt lại", 4 trang CSVC + `StepGeneralInfo`, file `*Badges` của children/attendance/kitchen/pickup/school-config, C `components/permissions/PermissionBadges.jsx`, các trang dùng badge.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; kiểm tay vài màn bằng built-in browser.
- **Dừng chờ user review.**

## Test matrix
| AC | Test (tầng) | Kết quả |
| --- | --- | --- |
| AC-1 | kiểm tay `/education/goals` lọc ra 0 | đạt: "Không có kế hoạch phù hợp" + "Đặt lại bộ lọc" |
| AC-2 | grep nhãn | đạt (13 trang) |
| AC-3 | grep "campus" trong 5 file | đạt |
| AC-4 | grep chip viết tay + kiểm tay | đạt ở các chỗ đã liệt kê (trừ StockCount: file đã bị xoá) |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đụng file các phiên khác đang sửa | Conflict | Chỉ sửa bằng Edit đúng dòng | Revert dòng |
| Tông badge đổi so với chip cũ | Màu đổi | Theo DESIGN §3.2 | Revert file badge |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có cách kiểm; phase có Exit
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log
### 2026-10-20 — Phase 1 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — 4 test `tests/menu` fail (dish-food, nutrition-setup, meal-price) do phiên khác đang sửa dở `menuPlanningConstants.js`, `menuCalculations.js`, `nutritionSetup.js`, `menuPlanningMockRepository.js`; không file nào thuộc plan này. Lint, prettier của file plan này đạt.
- Đã làm (đợt 1):
  - `GoalListPage`: lọc ra 0 dòng ⇒ "Không có kế hoạch phù hợp" + "Đặt lại bộ lọc" (trước báo "Chưa có kế hoạch năm học").
  - 13 nút "Đặt lại" → "Đặt lại bộ lọc".
  - "Campus" → "điểm trường" ở FacilityAsset, Issue, Proposal, Request, `StepGeneralInfo` (aria, option, cột, nhãn).
  - Nút "Đặt lại bộ lọc" ở màn rỗng ChildDevelopment, UserOverrides.
- Đã làm (badge, 3 agent song song, file tách biệt):
  - children: `AllergyStateBadge`, `DietStateBadge`, `NoteStateBadge`, `SmsStatusBadge`, `ImportRowResultBadge`, `ParentAccountBadge` thêm `NO_ACCOUNT`; dùng ở ChildQuickPanel, DeclarationSummary, ChildProfile, ChildHealthRecord, ImportChildren, ParentActivation; `ClassFillBadge` ở ClassPlacementFields.
  - attendance: `HealthObservationBadge`, `ParentNotifyBadge`/`ParentNotifyShortBadge` ở DailyHealthPanel; `AttendanceRowBadge` thêm `UNSAVED` (chỉ hiện ở dòng chưa lưu / chưa điểm danh).
  - kitchen: `FoodSampleStatusBadge`, `StockLevelBadge`; pickup: `VerificationBadge`; C `components/permissions/PermissionBadges.jsx` (`PermissionStateBadge`, REVOKE/OFF cam → đỏ); school-config: `PlacementActionBadge` (bỏ map tông cục bộ).
  - Tái dùng: `TicketBadge`, `RewardStatusBadge`, `RecordStatusBadge`, `AiDraftLabel`, `TransferStatusBadge`/`SheetStatusBadge`/`EduStatusBadge` trên dashboard; số "Chờ duyệt" trên shortcut dashboard HT/PHT (dùng số đã tải sẵn).
- Kiểm tay (built-in browser, PHT): Goal list rỗng khi lọc, DryStock, FoodSampleLog, FoodList, ParentActivation, hồ sơ trẻ `ch_007` hiện badge mới; trang phân quyền không vào được bằng PHT nên chưa xem.
- Khác plan:
  - StockCountPage đã bị xoá trong working tree ⇒ không làm `StockCountStatusBadge`.
  - Bỏ mục "lọc mặc định Proposal không hiện": đã có thẻ số liệu, select và nút đặt lại thể hiện.
  - 2 nhãn AI (HealthTrend, WeeklyMenu) dùng `StatusBadge` tím giữ chữ gốc vì `AiDraftTag`/`AiDraftLabel` ghi cứng "cần duyệt".
- Phát hiện ngoài phạm vi: `ParentActivationPage.jsx:345` trùng key `ch_037` (dữ liệu trẻ lặp trong nhóm, có từ trước); CSS thừa `.pa-status*`, `.kb-dot--danger`; chip viết tay còn ở YearPlacement (~125, ~260), PlacementClassPanel (~133, ~158, ~289), DailyHealthHistoryModal `NOTIFICATION_CHIPS`.
- Tiếp: user review.

### 2026-10-20 — User duyệt (done)
- User: "Đợt 1 và badge ổn." Plan đóng, chuyển sang `completed/`. Đợt 3 (ô tìm, FilterMore, lọc nhanh theo trạng thái) và các chip viết tay còn lại làm theo luồng ở `2026-10-20-style-sync-by-flow.md`.
