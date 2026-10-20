---
title: Dashboard BGH — số có so sánh, "Cần chú ý hôm nay", xếp hạng chuyên cần; biểu đồ xu hướng ở trang Tổng hợp điểm danh
status: in-progress
owner: FE
jira: G94-214 / FE-FEAT-01
branch: dev   # user chọn làm thẳng trên dev (2026-10-20)
modules: [reporting, attendance, facility-issue, school-structure]
rules: [AUTH-01, AUTH-02, AUTH-07, AUTH-08, ATT-06, FAC-02]
risk: high
created: 2026-10-20
updated: 2026-10-20
---
# Dashboard BGH — số có so sánh, "Cần chú ý hôm nay", xếp hạng chuyên cần

## Context
UI cho giáo viên và cán bộ nhiều bảng, ít tổng hợp. Wireframe đầu đặt 5–6 biểu đồ lên dashboard. User nhận xét "quá nhiều biểu đồ, chọn sai loại" (2026-10-20). Hướng đã chốt: dashboard chỉ có số kèm so sánh, danh sách ngoại lệ và 1 biểu đồ xếp hạng. Biểu đồ xu hướng chuyển về trang báo cáo.

Hiện trạng:
- `src/pages/dashboard/PrincipalDashboard.jsx:177-213` — bảng "Tổng quan điểm trường", cột có mặt dùng `ProgressBar`.
- `src/pages/dashboard/VicePrincipalDashboard.jsx` — thẻ `db-kpis` "Hôm nay" / "Cần bạn xử lý" (`KpiCard`, `src/components/dashboard/DashboardWidgets.jsx:61`).
- `src/components/charts/MiniCharts.jsx` — `BarList` (độ dài = phần trên tổng), `DonutChart`. Chưa có thanh xếp hạng theo tỷ lệ.
- `src/services/dashboard/dashboardService.js` — đã gộp số ở client từ facade các module, kèm ghi chú `PROPOSED backend`. Dùng lại mẫu này.
- Trẻ cần chú ý khi khám đầu ngày đã có: `flagged` trong `src/mocks/dailyHealthSummary.js:18` theo `needsAttention` ở `src/utils/attendance/temperatureLevels.js` (mức thân nhiệt user chốt 14/10/2026).
- Giờ chốt điểm danh cấu hình theo năm học: `src/services/school-config/schoolConfigService.js:30`.
- Wireframe đã chọn: phương án **A · Ngoại lệ trong board** + màn **Báo cáo ĐD** (file wireframe trong scratchpad của phiên 2026-10-20; ảnh chụp đính kèm Progress log khi bắt đầu Phase 2).

## Quyết định đã chốt
1. Dashboard = số có so sánh + danh sách ngoại lệ + 1 biểu đồ xếp hạng lớp; không đặt biểu đồ xu hướng trên dashboard — user, 2026-10-20.
2. Bố cục dashboard theo wireframe A: giữ công thức Tổng quan DESIGN.md §8.1. Gồm dải chào, lối tắt, `db-kpis` (Hôm nay có so sánh · Cần bạn xử lý), board 2/3 ("Cần chú ý hôm nay" + xếp hạng lớp) · 1/3 ("Chờ bạn duyệt" + "Số liệu khác") — user, 2026-10-20.
3. Biểu đồ xu hướng ở trang Tổng hợp điểm danh: cột "Lượt nghỉ không phép theo tuần" (đáy 0) + thanh "Tỷ lệ có mặt theo lớp". Tỷ lệ có mặt chỉ để ở thẻ số vì dao động ít — user, 2026-10-20.
4. Số tổng hợp tạm tính ở service FE từ facade module, mỗi hàm ghi `PROPOSED backend: GET /reports/...`, không đếm từ trang danh sách đã phân trang — user, 2026-10-20.
5. Đợt 2 (bếp, dinh dưỡng, CSVC) và đợt 3 (đánh giá, sức khỏe định kỳ, kế hoạch) làm plan riêng sau plan này — đề xuất tách theo Validation log, chờ user xác nhận khi duyệt.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: Hiệu trưởng (toàn trường, AUTH-01), Phó HT (campus được phân công, AUTH-02).
  - Outcome: đầu ngày biết ngay lớp nào chưa điểm danh, trẻ nào cần chú ý sức khỏe, việc gì chờ duyệt. Cuối tuần xem xu hướng nghỉ ở trang báo cáo.
  - Rule: AUTH-08 (ACCEPTED) số chỉ trong scope người xem · AUTH-07 (ACCEPTED) ẩn UI không thay phân quyền · ATT-06 (PENDING P-03) giờ chốt để cấu hình · FAC-02 (CONFIRMED) BGH theo dõi sự cố.
  - Flow: [S] tổng hợp chỉ đọc (module reporting, `BE:docs/modules/reporting.md`) → [B] BGH bấm một dòng ngoại lệ → mở đúng màn xử lý của module.
- **Đối chiếu thiết kế ban đầu:**
  - `BE:docs/modules/reporting.md` ghi "Tổng hợp campus phải theo enrollment/campus tại ngày dữ liệu". FE không tự suy campus; service gọi facade theo `user` và scope BE/mock trả về.
  - DESIGN.md §8.1 "không số liệu bịa": mọi số lấy từ service.
- **Ảnh hưởng:**
  - FE: `/` (dashboard theo role HT, PHT), `/attendance/summary`.
  - Quyền/scope: không thêm kiểm tra quyền mới. Giữ `canViewPendingApprovals` và các guard đang có.
  - BE contract: chưa có endpoint, chỉ đề xuất (mục "Đề xuất endpoint BE").
  - APP: không dùng chung.

### Câu hỏi mở
- [x] 1. Mã Jira, mã công việc và nhánh làm việc (tạo từ `dev`, dạng `feature/<mã-jira>-FE-FEAT-xx-dashboard-summary`)?
- [x] 2. Mục "Lớp chưa điểm danh, quá giờ": mốc giờ lấy theo cut-off cấu hình của năm học (ATT-06 PENDING P-03). Đề xuất: năm học chưa có cut-off thì chỉ hiện "chưa điểm danh", không ghi "quá giờ". Đồng ý?
- [x] 3. Mục "Sự cố quá N ngày chưa xử lý": BE chưa có rule về thời hạn (FAC-04 mới PROPOSED). Đề xuất: bỏ khỏi đợt này, chỉ đếm "Sự cố đang mở". Hay dùng N cố định (vd. 7 ngày) và ghi PENDING?
- [x] 4. Thư viện biểu đồ: user đã chọn Recharts (2026-10-20, lúc dự kiến 5–6 biểu đồ). Theo hướng mới chỉ còn thanh xếp hạng (div) và 1 biểu đồ cột tuần (SVG, giống `DevelopmentCharts.jsx`), nên đề xuất **hoãn Recharts**, không đổi `package.json`. Giữ Recharts hay hoãn?
- [x] 5. Màn Tổng hợp điểm danh đang thuộc plan `2026-10-12-attendance-summary-export.md` (in-progress, nhánh `feature/G94-179-FE-FEAT-42-design-ui`). Phase 3 làm sau khi plan đó merge vào `dev`, hay gộp phần biểu đồ vào plan đó?

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| 1. Jira / nhánh | G94-214 / FE-FEAT-01; làm thẳng trên `dev`, không tạo nhánh | user | 2026-10-20 | frontmatter |
| 2. Mốc quá giờ | Cut-off cấu hình theo năm học; chưa có cut-off thì chỉ ghi "chưa điểm danh" | user | 2026-10-20 | plan này (AC-3) |
| 3. Sự cố quá hạn | Bỏ; chỉ đếm sự cố đang mở, chờ BE chốt thời hạn | user | 2026-10-20 | plan này |
| 4. Recharts | Giữ Recharts, thêm ở Phase 3 khi có biểu đồ cột đầu tiên; thanh xếp hạng vẫn dựng bằng div | user | 2026-10-20 | plan này |
| 5. Trang Tổng hợp điểm danh | Phase 3 làm sau khi plan 2026-10-12 merge vào `dev` | user | 2026-10-20 | plan này |

## Acceptance criteria
- **AC-1** (AUTH-08, AUTH-02): Given Phó HT phụ trách Campus 1. When mở trang chủ. Then thẻ "Có mặt hôm nay", "Đã khám sức khỏe đầu ngày", "Suất ăn trưa đã báo" chỉ tính trẻ/lớp Campus 1, và có dòng so sánh với cùng thứ tuần trước. Tuần trước không có ngày học đó thì không hiện dòng so sánh.
- **AC-2** (AUTH-01, AUTH-08): Given Hiệu trưởng. When mở trang chủ. Then số tính cả 2 campus; mục "Cần chú ý" ghi số theo từng campus.
- **AC-3** (ATT-06): Given lớp trong scope chưa có điểm danh hôm nay. When đã qua cut-off cấu hình. Then "Cần chú ý hôm nay" có dòng "Lớp X chưa điểm danh, đã quá <giờ>" (tông cam) mở được điểm danh của lớp. Chưa có cut-off thì theo Câu hỏi mở 2.
- **AC-4** (HLT, mức thân nhiệt user chốt 14/10/2026): Given trẻ có `flagged` khi khám đầu ngày. Then "Cần chú ý" hiện số trẻ theo lớp, **không hiện tên trẻ**, bấm mở `DailyHealthOverviewPage` đã lọc.
- **AC-5**: Given không có mục bất thường. Then khối "Cần chú ý hôm nay" hiện `EmptyState` "Hôm nay chưa có gì cần chú ý". Khi tải: khung chờ đúng hình. Khi lỗi: `ErrorState` có "Thử lại" (DESIGN.md §9).
- **AC-6**: Biểu đồ xếp hạng lớp xếp tỷ lệ có mặt tăng dần; lớp chưa điểm danh đứng đầu với chip "Chưa điểm danh". Có `aria-label` và nút "Xem dạng bảng" hiện đúng số.
- **AC-7** (AUTH-08): Trang Tổng hợp điểm danh có biểu đồ cột "Lượt nghỉ không phép theo tuần" (đáy 0, cột tuần đang chạy nhạt) và thanh "Tỷ lệ có mặt theo lớp" theo khoảng đã chọn. Số khớp bảng chi tiết và file xuất (tổng nghỉ không phép ở thẻ = tổng cột bảng).
- **AC-8** (AUTH-07): Không có nút/hành động mới. Dòng ngoại lệ chỉ là link sang màn đã có quyền riêng; 403 từ màn đích xử lý như hiện tại.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bố cục dashboard | A · Ngoại lệ trong board | B · Ngoại lệ lên đầu (bỏ dải chào) | Giữ §8.1, người dùng quen bố cục; user chọn qua wireframe |
| Lượng biểu đồ trên dashboard | 1 (xếp hạng lớp) | 5–6 biểu đồ (wireframe vòng 1) | User: quá nhiều, sai loại; biểu đồ xu hướng không dẫn tới hành động hằng ngày |
| Biểu đồ cột tuần | Recharts (`BarChart`), cấu hình theo hình: không lưới, ẩn trục Y, `isAnimationActive={false}`, số trên cột, màu từ token | SVG tự vẽ | User giữ Recharts để đợt 2–3 dùng chung (2026-10-20) |
| Thanh xếp hạng lớp | div + CSS | Recharts `BarChart` ngang | Thanh chỉ là `width`; nhẹ, khớp `BarList` hiện có |
| Nguồn số | Service FE gộp từ facade + `PROPOSED backend` | Chờ BE | Theo mẫu `dashboardService.js`; BE reporting còn "thiết kế" |

## Đề xuất endpoint BE (PROPOSED, chưa đổi contract)
Gửi team BE (module reporting), mọi endpoint áp AUTH-08 theo người gọi:
- `GET /reports/dashboard/today?date=` → `{ attendance: {present, total, sameWeekdayLastWeek}, dailyHealth: {checked, total, flagged}, mealsReported, classes: [{classId, name, campusId, present, total, taken}], attention: [{type, campusId, classId, count, since}] }`
- `GET /reports/attendance/weekly?from=&to=&classId=` → `[{week, unexcusedAbsences, excusedAbsences, presentRate}]` và `byClass: [{classId, presentRate, enrolled, excused, unexcused}]`
Đề xuất ghi vào `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` khi user cho phép sửa repo BE.

## Phases
### Phase 1 — Service tổng hợp + component dùng chung
- Files: C `src/services/dashboard/dashboardSummaryService.js` · C `src/components/charts/RankBars.jsx` · M `src/components/charts/mini-charts.css` · C `src/components/dashboard/AttentionList.jsx` · M `src/components/dashboard/DashboardWidgets.jsx` (thêm prop so sánh cho `KpiCard`) · C `tests/dashboard/dashboard-summary.test.mjs` · M `package.json` (script `test:dashboard`, nối vào `verify`; không thêm dependency)
- Steps:
  1. `getDashboardToday(user, date)` gộp số từ `attendanceService`, `dailyHealthService`, `schoolConfigService` (cut-off), `facilityService` (chỉ số sự cố đang mở), theo scope facade trả. Ghi `PROPOSED backend`.
  2. `RankBars` nhận `rows: [{key, label, meta, value, total, pending, to}]`, chỉ vẽ, không tính nghiệp vụ. Có `aria-label` và nút xem dạng bảng.
  3. `AttentionList` nhận `items` (đã tính ở service), dùng markup `db-list`. Có trạng thái rỗng, tải, lỗi.
- Tests: AC-1, AC-2, AC-3, AC-4 → `tests/dashboard/dashboard-summary.test.mjs` (scope PHT chỉ Campus 1; HT 2 campus; lớp chưa điểm danh sau cut-off; flagged đếm theo lớp, không có tên trẻ trong output).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 2 — Dashboard Hiệu trưởng và Phó HT theo wireframe A
- Files: M `src/pages/dashboard/VicePrincipalDashboard.jsx` · M `src/pages/dashboard/PrincipalDashboard.jsx` · M `src/styles/modules/dashboard.css`
- Steps:
  1. `db-kpis` "Hôm nay": Có mặt (so với cùng thứ tuần trước) · Đã khám đầu ngày · Suất ăn trưa đã báo. Giữ nguyên "Cần bạn xử lý".
  2. Board 2/3: "Cần chú ý hôm nay" (`AttentionList`) + xếp hạng lớp (`RankBars`; HT: 6 lớp thấp nhất kèm campus). Board 1/3: "Chờ bạn duyệt" (giữ `ApprovalsWidget`) + "Số liệu khác".
  3. HT: thay bảng "Tổng quan điểm trường" bằng các khối trên. Thực đơn hôm nay, kế hoạch giáo dục chuyển thành dòng trong "Số liệu khác".
  4. So ảnh 1280 và 375 cạnh wireframe A (memory: màn dựng phải khớp wireframe đã chọn).
- Tests: AC-5, AC-6, AC-8 → kiểm tay trên preview (4 trạng thái) + `npm run check`. Ghi ảnh vào Progress log.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 3 — Biểu đồ ở trang Tổng hợp điểm danh (bắt đầu sau khi plan 2026-10-12 merge vào `dev`)
- Files: M `package.json` + lockfile (thêm `recharts`, bản ổn định hợp React 18; báo kích thước bundle trước/sau) · M `src/pages/attendance/AttendanceSummaryPage.jsx` · C `src/components/charts/ColumnChart.jsx` (bọc Recharts, nhận số đã tính) · M `src/services/attendance/attendanceService.js` + repo mock (`getAttendanceWeekly`) · M `DESIGN.md` (thêm mục quy tắc chọn biểu đồ: so sánh nhóm, theo thời gian, tiến độ, màu, "Xem dạng bảng") · M `docs/features/` (ghi quyết định hiển thị theo `update-knowledge.md`)
- Steps:
  1. Thẻ số: tỷ lệ có mặt TB (so kỳ trước) · lượt nghỉ không phép · trẻ nghỉ từ 3 ngày liên tiếp.
  2. `ColumnChart` (Recharts, đáy 0, số trên cột, cột kỳ đang chạy nhạt) + `RankBars` theo lớp, đặt trên bảng hiện có.
  3. Thêm quy tắc chọn biểu đồ vào DESIGN.md; chạy `node scripts/check-ai-layer.mjs`.
- Tests: AC-7 → `tests/dashboard/attendance-weekly.test.mjs` (tổng cột = tổng bảng = thẻ).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; `node scripts/check-ai-layer.mjs` pass.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | AUTH-08, AUTH-02 | `tests/dashboard/dashboard-summary.test.mjs` (service) | 1 | pass 2026-10-20 |
| AC-2 | AUTH-01, AUTH-08 | `tests/dashboard/dashboard-summary.test.mjs` (service) | 1 | pass 2026-10-20 |
| AC-3 | ATT-06 | `tests/dashboard/dashboard-summary.test.mjs` (service) | 1 | pass 2026-10-20 |
| AC-4 | mức thân nhiệt 14/10 | `tests/dashboard/dashboard-summary.test.mjs` (service) | 1 | pass 2026-10-20 |
| AC-5 | §9 DESIGN | test rỗng (service) + `Widget` lo tải/lỗi; kiểm tay trạng thái có dữ liệu | 2 | pass 2026-10-20 (tải/lỗi chưa ép trên preview) |
| AC-6 | — | test xếp hạng (service) + kiểm tay preview PHT | 2 | pass 2026-10-20 |
| AC-7 | AUTH-08 | `tests/dashboard/attendance-weekly.test.mjs` | 3 | — |
| AC-8 | AUTH-07 | rà code: không thêm action/guard | 2 | pass 2026-10-20 |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Gộp số ở client lệch scope khi nối BE thật | HT/PHT thấy sai số (AUTH-08) | Chỉ gộp từ facade đã áp scope; đề xuất endpoint BE trả sẵn | Revert commit Phase 1–2; dashboard cũ còn nguyên trong git |
| Đụng màn AttendanceSummary của plan 2026-10-12 | Conflict merge | Phase 3 chờ Câu hỏi 5 | Bỏ Phase 3, giữ Phase 1–2 |
| Session khác đang chuẩn hóa `.table`/`.cell--actions` (2026-10-20) | Conflict ở PendingApprovals/components.css | Plan này không sửa `components.css` khối `.table`; pull trước khi bắt đầu | — |
| Thêm script test vào `package.json` | Đổi harness verify | Chỉ thêm script ở Phase 1 | Bỏ script |
| Recharts tăng bundle | Trang tải chậm hơn | Chỉ import ở trang báo cáo (lazy route sẵn có nếu có); đo `vite build` trước/sau | Gỡ dependency, thay bằng SVG |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: chỉ đề xuất 2 endpoint mới, chưa đổi contract đang có
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file (~16 file) ⇒ đã đề xuất tách: đợt 2, 3 thành plan riêng; Phase 3 có thể gộp vào plan 2026-10-12 (Câu hỏi 5)
- [x] Không dùng rule PENDING/OPEN như đã chốt: ATT-06 dùng cut-off cấu hình; thời hạn sự cố đã bỏ (Câu hỏi 3)
- [x] Tự review: không placeholder ngoài mã Jira/nhánh (Câu hỏi 1) · không mâu thuẫn · scope 3 phase · không câu mơ hồ

## Progress log
### 2026-10-20 — Draft, chờ user duyệt
- Commit: chưa commit
- Verify: chưa chạy cho code (chưa sửa code); `node scripts/check-ai-layer.mjs` chạy sau khi ghi plan
- Khác plan: —
- Câu hỏi 2–5 đã trả lời. Tiếp: user cho mã Jira + nhánh (Câu hỏi 1) rồi duyệt plan

### 2026-10-20 — User duyệt plan, bắt đầu Phase 1
- User: "Mã Jira: G94-214, mã công việc: FE-FEAT-01. Làm luôn ở dev và duyệt plan." Hết câu hỏi mở.

### 2026-10-20 — Phase 1 (chờ review)
- Commit: chưa commit
- Files: C `src/services/dashboard/dashboardSummaryService.js` · C `src/components/charts/RankBars.jsx` · C `src/components/dashboard/AttentionList.jsx` · C `tests/dashboard/dashboard-summary.test.mjs` · M `src/components/dashboard/DashboardWidgets.jsx` (`KpiCard`: `compare`, `progressLabel`) · M `src/components/charts/mini-charts.css` · M `src/styles/modules/dashboard.css` · M `src/components/ui/icons.js` (`Thermometer`) · M `package.json` (`test:dashboard`, nối vào `verify`)
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (5 bộ test: 71/41/38/13/8 pass, skip 0); `node scripts/check-ai-layer.mjs` → 0 lỗi
- Khác plan:
  - Trẻ cần lưu ý lấy `noted` của `getDailyHealthOverview` (giáo viên chọn "Có dấu hiệu"), không lấy `flagged`; cùng số với màn Sức khỏe đầu ngày và đúng ngoại lệ 14/10 "hệ thống không tự chọn Có dấu hiệu".
  - Bỏ số "sự cố đang mở" khỏi service: `ISSUE_STATUS` chỉ có SUBMITTED/APPROVED/REJECTED (`src/models/facility/facilityConstants.js:26`), không có trạng thái "đang mở". Phase 2 dùng số chờ duyệt đã có.
  - Dòng "lớp chưa điểm danh" mở `/attendance/summary` vì `/attendance` chỉ cho giáo viên (`src/routes/AppRoutes.jsx:459`).
  - Có cut-off nhưng chưa tới giờ chốt thì không báo lớp chưa điểm danh (tránh báo cả trường lúc sáng sớm).
  - CSS icon tông và dòng so sánh thêm vào `dashboard.css` ngay Phase 1 (plan ghi Phase 2).
- Tiếp: user review Phase 1, rồi Phase 2 (dashboard HT, PHT theo wireframe A).

### 2026-10-20 — Phase 2 (chờ review)
- Commit: chưa commit
- Files: M `src/pages/dashboard/VicePrincipalDashboard.jsx` · M `src/pages/dashboard/PrincipalDashboard.jsx` · C `src/components/dashboard/TodayWidgets.jsx` (`AttentionWidget`, `ClassRankWidget` dùng chung 2 màn) · M `src/hooks/dashboard/useDashboard.js` (`useDashboardToday`) · M `src/services/dashboard/dashboardSummaryService.js` (`campusId`, `attendanceCompareText`, gọn danh sách >4 lớp) · M `tests/dashboard/dashboard-summary.test.mjs` (+1 test) · M `src/components/charts/mini-charts.css` · M `src/styles/modules/dashboard.css` (`db-kpis__list--auto`)
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (71/41/38/13/9 pass, skip 0)
- Kiểm tay (preview, tài khoản demo Phó HT, Campus 1): 1280 — bố cục khớp wireframe A (Cần chú ý + xếp hạng lớp · Chờ bạn duyệt + Số liệu khác); 375 — không tràn ngang, tên lớp không bị cắt; "Xem dạng bảng" ra đúng 12 dòng; console không lỗi từ màn này.
- **Chưa kiểm bằng mắt màn Hiệu trưởng**: không đổi được tài khoản demo trong preview (đăng xuất không về trang đăng nhập). Số HT có test service AC-2; cần user mở bằng tài khoản Hiệu trưởng.
- Khác plan / wireframe:
  - PHT giữ thẻ "Bếp báo thiếu thực phẩm" và khối "Tài sản: việc cần làm" (chỉ hiện khi `FACILITY_ENABLED`) vì là việc thật của PHT, wireframe không có.
  - "Số liệu khác" của PHT là các bữa bán trú (sĩ số, chế biến) thay cho "kế hoạch chờ duyệt" (đã có trong Chờ bạn duyệt) và "sự cố" (CSVC đang tạm ẩn).
  - Session khác thêm cờ `FACILITY_ENABLED` (`src/config/app.js`, đang `false`) vào 2 dashboard cùng lúc; plan này giữ nguyên cờ đó.
  - Bỏ khỏi dashboard HT: thẻ "Trẻ đang học", "Lớp học", bảng "Tổng quan điểm trường", khối "Sự cố mới nhất" (theo wireframe A). Bỏ khỏi PHT: khối "Hồ sơ trẻ cần xử lý" (lặp với thẻ Cần bạn xử lý) và khối "Bán trú hôm nay" (gộp vào "Số liệu khác").
  - Tên lớp trong biểu đồ bỏ chữ "Lớp" đầu tên để không bị cắt ở 375.
- Tiếp: user xem màn Hiệu trưởng + review Phase 2. Phase 3 chờ plan 2026-10-12 merge vào `dev`.

### 2026-10-20 — Sửa sau góp ý "card to card nhỏ, rối" (chờ review)
- Commit: chưa commit
- Lỗi user thấy (ảnh ~2000px): hai nhóm thẻ đặt cạnh nhau 1:2, mỗi nhóm tự chia cột ⇒ thẻ to nhỏ khác nhau, thẻ lẻ rớt hàng; dòng so sánh "tuần trước 0% · +89 điểm" khi tuần trước chưa điểm danh; "Lớp Lớp Chồi 1".
- Sửa: `db-kpis--rows` — mỗi nhóm một hàng, hai hàng chung lưới 4 cột (≤1100: 2 cột, ≤560: 1 cột); tuần trước không có bản ghi điểm danh thì không so sánh; `shortClassName` bỏ chữ "Lớp" lặp. +2 test.
- Kiểm tay (PHT): 1920 — mọi thẻ 392px, cao đều theo hàng; 1280 — 232px; 375 — 1 cột 351px, không tràn ngang.
