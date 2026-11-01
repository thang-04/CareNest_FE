---
title: Căn lề cột bảng — cột Thao tác vừa nút, cột số căn phải
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
# Căn lề cột bảng — cột Thao tác vừa nút, cột số căn phải

## Context
User 2026-10-20 (`/school/teachers`): cột "Thao tác" bị đẩy sang phải, bên trái thừa nhiều; chỗ căn giữa chỗ không, nhiều màn tương tự.
Rà trình duyệt (HT + PHT, 1440px, 87 route, script đo `th` / ô / nút):
- Bảng `table-layout: auto` chia phần dư cho mọi cột ⇒ cột thao tác rộng hơn nút 25–128px ở 28 bảng; `/school/teachers` cột ~260px, nút ~120px (`TeacherAssignmentPage.jsx:55,207,330,365` `className="right"`).
- Cột thao tác: căn phải ở Cấu hình trường (`CampusListPage.jsx:57`, `SchoolYearListPage.jsx:115`, `TeacherAssignmentPage`, `VicePrincipalAssignmentPage.jsx:347`, `StaffAccountsPage`, `RoomListPage`, `AgeGroupsClassesPage`, `ParentActivationPage.jsx:335`, `UserOverridesPage.jsx:157` dùng `text-right`), căn giữa ở 19 bảng khác. Không có class chung; `DESIGN.md` chưa có quy tắc.
- Cột số: 63 cột căn phải, nhưng còn căn giữa: "Số lớp", "Sĩ số", "SL …" (`AgeGroupsClassesPage.jsx:177,179`, `SchoolYearListPage.jsx:113`, `TeacherAssignmentPage.jsx:205,327`, `CampusDetailPage.jsx:178`, `CopyClassesModal.jsx:152`, `TransferAssetTable.jsx:22-25`, `StockMovementCard.jsx:106`, `StepAssignUsers.jsx:47`, `StepReview.jsx:148`, `HandoverPage.jsx:358`, `ReceivePage.jsx:220`, `CreateInspectionPage.jsx:593`, `InspectionSheetPage.jsx:286,573,574`, `CampusListPage`); `WeekBalanceTable` tiêu đề căn giữa, số căn phải.

## Quyết định đã chốt
1. Cột "Thao tác": rộng vừa nút, tiêu đề và nút **căn giữa**, áp mọi bảng — user, 2026-10-20.
2. Cột số: **căn phải cả tiêu đề và số** — user, 2026-10-20.

## Làm rõ nghiệp vụ
- Chỉ trình bày; không đổi dữ liệu, quyền, hành động trong ô.
- Liên quan plan `2026-10-20-ui-standards-status-filter-action-errors` (đã duyệt, chưa làm): `RowActions` thay **nội dung** ô thao tác; plan này chỉ đổi **độ rộng/căn** cột ⇒ `RowActions` sau này đặt trong `.cell--actions`. Ghi chú vào Progress log plan đó khi xong.

### Câu hỏi mở
(không còn)

## Acceptance criteria
- **AC-1**: Given mọi bảng có cột "Thao tác" (hoặc cột chỉ chứa nút ở cuối), Then cột rộng vừa nhóm nút (dư ≤ 2 × lề ô), tiêu đề và nút căn giữa, nút không xuống dòng.
- **AC-2**: Given cột chỉ chứa số/tiền/số lượng hiển thị, Then tiêu đề và số căn phải; ô nhập số căn theo ô nhập (tiêu đề thẳng với ô nhập).
- **AC-3**: Script đo lại các route ở Context: 0 bảng có cột thao tác dư > 2 × lề ô; 0 cột số căn giữa; `/school/teachers` khớp AC-1.
- **AC-4**: `node scripts/verify.mjs` → `VERIFY PASS full`; trang không cuộn ngang ở 1024px.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Cách thu cột | Class chung `.cell--actions` (`width: 1%; white-space: nowrap; text-align: center`) gắn ở `th` và `td` | `th:last-child` tự động bằng CSS | Không phải bảng nào cột cuối cũng là thao tác; class rõ nghĩa, dễ kiểm bằng grep |

## Phases
### Phase 1 — Class chung + cột Thao tác (AC-1)
- Files: M `src/styles/components.css` (cạnh `.table .center/.right`, trước khối "Điện thoại (≤640px)" cuối file); M ~34 file có cột Thao tác (danh sách `grep "Thao tác</th>"` + cột chỉ chứa nút); C `tests/menu/table-alignment.test.mjs`.
- Steps: 1. Test RED: mọi `<th>` "Thao tác" có `cell--actions`; ô cùng cột có `cell--actions`. 2. Thêm class CSS. 3. Thay `center`/`right`/`text-right` ở `th`/`td` thao tác bằng `cell--actions`. 4. Ô có `.row` flex bên trong ⇒ `justify-content: center`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 2 — Cột số căn phải (AC-2)
- Files: M các file ở Context mục "Cột số"; `WeekBalanceTable.jsx` (tiêu đề nhóm Đạm/Béo/Tinh bột giữ giữa vì là tiêu đề gộp 2 cột; hàng con g/% đã phải).
- Steps: test RED (header số trong danh sách không còn `center`) → đổi `center` → `right` ở `th` + `td`; ô nhập số: tiêu đề căn theo ô nhập.
- Exit: như Phase 1.

### Phase 3 — Quy tắc + đo lại (AC-3, AC-4)
- `DESIGN.md` §6.3 thêm dòng "Cột bảng": thao tác `.cell--actions` (vừa nút, căn giữa), số căn phải, chữ căn trái. `node scripts/check-ai-layer.mjs`.
- Chạy lại script đo (HT, PHT, GV) + chụp `/school/teachers`, 1 màn mỗi nhóm; 1024px.
- Exit: như Phase 1.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | `tests/menu/table-alignment.test.mjs` (rà nguồn) + đo trình duyệt | 1 | pass |
| AC-2 | — | cùng test + đo | 2 | pass |
| AC-3, AC-4 | — | script đo, verify | 3 | pass |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| `width: 1%` + `nowrap` làm bảng hẹp tràn khi nhiều nút | Cuộn ngang trong `.table-wrap` | Bảng đã bọc `.table-wrap`; kiểm 1024px | Bỏ `nowrap` |
| Session responsive đang sửa `components.css` (khối @media 640, cuối file) | Ghi đè | Chỉ thêm cạnh `.table .center/.right`, không đụng khối của họ (đã hỏi, 2026-10-20) | Revert khối |
| Plan ui-standards (RowActions) làm sau | Đổi lại ô | Class đặt ở `th`/`td`, không phụ thuộc nội dung ô | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có test/đo; mỗi phase có Exit
- [x] >8 file: thay đổi cơ học cùng một class, 3 phase độc lập ⇒ không tách plan
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-10-20 — Duyệt
- Nguồn: user "duyệt /goal" ⇒ làm liền 3 phase.
- Khác plan: không dừng review giữa phase (user yêu cầu chạy tới đích); vẫn verify + log từng phase.
- Tiếp: Phase 1.

### 2026-10-20 — Phase 1–3 (done)
- Đã làm: `components.css` thêm `.table .cell--actions` (width 1%, nowrap, căn giữa; `.row` bên trong căn giữa) cạnh `.table .center/.right`. 34 file: `th`/`td` cột "Thao tác" đổi `center`/`right`/`text-right` → `cell--actions` (73 dòng; `WeekDaysView` bỏ thêm `td-w-70`). Cột số hiển thị `center` → `right` (60 dòng ở 14 file + 3 cột "Phiếu bé ngoan"); `CampusDetailPage` `sc-center` → `sc-end`. Ô nhập số, STT, ĐVT, ảnh, tình trạng giữ căn giữa. `DESIGN.md` §6.3 thêm dòng "Cột bảng".
- **Khác plan:** thêm `GoodBehaviourTicketsPage` (đo lại thấy 3 cột số căn giữa). Tiêu đề gộp Đạm/Béo/Tinh bột của bảng Cân đối giữ căn giữa (tiêu đề nhóm 2 cột).
- Test: `tests/menu/table-alignment.test.mjs` (3 test). Test cột thao tác chạy RED trước (34 file thiếu class) → pass. Test cột số: lần chạy RED đầu sai regex (escape trong heredoc) nên báo "không thấy cột"; sửa regex sau khi đã đổi code ⇒ không có bước RED hợp lệ cho test này.
- Sự cố khi làm: lệnh xem diff lỡ `require` script đổi class nên chạy lần 2, sinh `cell--actions cell--actions`; đã gỡ trùng (grep 0).
- Đo lại (agent-browser 1440px, HT + PHT + GV, 65 route + 5 route bổ sung): cột thao tác dư ≤ 25px (= lề ô) trừ cột mà tiêu đề rộng hơn nút (icon 1 nút) hoặc bảng rỗng; 0 cột số căn giữa ngoài tiêu đề gộp bảng Cân đối. `/school/teachers` cột thao tác vừa nút; 1024px không cuộn ngang (1024/1024).
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — chỉ do prettier ở 3 file mới chưa commit của session khác (`src/components/ui/ErrorBoundary.jsx`, `src/components/ui/StatusPage.jsx`, `src/services/dashboard/dashboardSummaryService.js`), không thuộc plan này; đã báo session dashboard. Phần của plan: `npm run lint` sạch, `npm run test:menu` 71/71, `npm run build` OK.
- Commit: chưa commit.
- Tiếp: chạy lại verify khi các session kia format xong ⇒ PASS thì `status: done`, chuyển `completed/`.

### 2026-10-20 — Đóng plan
- Các session khác đã format file của họ. Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Commit: chưa commit.

### 2026-10-20 — Đổi quyết định (sau khi plan xong)
- User (phiên khác, sau plan này) chọn **số đếm/số lượng căn giữa** (`.num`), tiền căn phải (`.money`), trạng thái/ô tích/icon `.center`; xác nhận lại khi được báo xung đột với quyết định 2 ở trên. Toàn bộ `className` có `right` ở `th`/`td` đổi sang `num`/`money`; `tests/menu/table-alignment.test.mjs` kiểm `.num` thay `right`; `DESIGN.md` §6.3 "Cột bảng" cập nhật. Cột "Thao tác" giữ nguyên.
