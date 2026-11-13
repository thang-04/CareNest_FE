---
title: Trang chủ phương án A "Nhịp một ngày"
status: in-progress
owner: thangnd
jira: G94-340 / FE-FEAT-56
branch: feature/G94-340-FE-FEAT-56-ui-layout-sync
modules: [dashboard, attendance, daily-health, assessment, kitchen]
rules: []
risk: medium
created: 2026-11-13
updated: 2026-11-13
---
# Trang chủ phương án A "Nhịp một ngày"

## Context
- User chọn phương án A ngày 12/11 (`plans/261112-1300-ui-layout-sync-round2/home-redesign-proposal.html`, ảnh `shots/home-new-a.png`, `shots/home-new-teacher.png`). Plan đồng bộ giao diện tách trang chủ ra thành plan riêng (`docs/plans/active/2026-11-12-ui-layout-sync-round2.md:35`, `:150`). PR #65 (merge dev 13/11) không có thay đổi trang chủ.
- Hiện trạng: 5 vai trò, 4 kiểu bố cục (`src/pages/HomePage.jsx:8-12`).
  - HT: lối tắt → 3 KpiCard + chờ duyệt → cần chú ý + xếp hạng lớp → cột phải (`src/pages/dashboard/PrincipalDashboard.jsx:113-262`).
  - PHT: `VicePrincipalDashboard.jsx` (309 dòng), Tổ trưởng: `TeamLeaderDashboard.jsx` (4 thẻ phẳng, không lối tắt), GV: `TeacherDashboard.jsx` → `ClassTodayPanel`, Bếp: `KitchenDashboard.jsx` dùng màn "Quy trình bếp hôm nay".
  - Suất ăn trưa đang cộng trong page (`PrincipalDashboard.jsx:87-89`) — trái invariant 2, cần chuyển về service.
- Số liệu "Hôm nay" đã gom ở `src/services/dashboard/dashboardSummaryService.js:56-188` (`buildDashboardToday`, có test). BE chưa có endpoint dashboard; ghi chú PROPOSED `GET /reports/dashboard/today` ở `dashboardSummaryService.js:8`.

## Quyết định đã chốt
1. Phương án A "Nhịp một ngày", không cài thư viện biểu đồ — user, 12/11/2026.
2. Cùng khung cho mọi vai trò: dải chào → lối tắt → "Hôm nay (phạm vi của tôi)" → "Tiến độ trong ngày" 5 bước → "Cần chú ý" + cột phải; chỉ phạm vi dữ liệu đổi — đề xuất 12/11, user chọn A.
3. Trang chủ chỉ hiện số hệ thống trả, không khối gợi ý — quyết định 20/10 (`2026-10-20-dashboard-summary-attention.md`).

## Làm rõ nghiệp vụ
- **Actor:** HT (toàn trường), PHT (điểm trường phụ trách), Tổ trưởng (nhóm tuổi), GV (lớp mình), Bếp. Scope do BE trả (AUTH-08), FE không tự lọc.
- **Outcome:** mở trang chủ 5 giây biết hôm nay ổn không, kẹt khâu nào.
- **Ảnh hưởng:** chỉ route `/`. Không đổi quyền, dữ liệu, route khác.

### Câu hỏi mở
- [x] Lối tắt: giữ hàng chip nhỏ dưới dải chào (như ảnh A) hay bỏ vì thanh bên đã có?
- [x] Nhân viên bếp: dùng khung chung hay giữ màn "Quy trình bếp hôm nay"?
- [x] Task Jira: làm dưới G94-340 hay tạo task riêng trong luồng FE-FEAT-56?
- [x] Bước 5 "Đánh giá cuối ngày": tạm gom ở FE service, đề xuất BE endpoint gộp sau?

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Lối tắt | Giữ hàng chip nhỏ | user | 2026-11-13 | plan này |
| Nhân viên bếp | Giữ màn "Quy trình bếp hôm nay" ⇒ Phase 3 bỏ phần Bếp | user | 2026-11-13 | plan này |
| Task Jira | G94-340, nhánh hiện tại | user | 2026-11-13 | plan này |
| Nguồn số bước 5 + theo điểm trường | Gom ở FE service (endpoint đang có), đề xuất BE `GET /reports/dashboard/today` sau | user | 2026-11-13 | plan này |

## Acceptance criteria
- **AC-1:** Given HT ở `/`, When tải xong, Then thấy khối "Hôm nay toàn trường": số có mặt/sĩ số, thanh chia 4 phần (có mặt, có phép, không phép, chưa điểm danh), so với cùng thứ tuần trước, và 2 thẻ điểm trường (có mặt/sĩ số, số lớp đã điểm danh); nút gạt Toàn trường/Campus lọc cả trang.
- **AC-2:** Given bất kỳ vai trò BGH/Tổ trưởng/GV, Then có khối "Tiến độ trong ngày" 5 bước (điểm danh, khám, báo ăn, bếp, đánh giá) với số/tổng + trạng thái (Xong / Đang làm / Quá giờ / Chưa tới giờ); bấm bước mở màn tương ứng.
- **AC-3:** Số trên trang chủ (kể cả suất ăn trưa) do service trả; page không `reduce` số nghiệp vụ.
- **AC-4:** Mỗi khối có loading / rỗng / lỗi riêng; một nguồn lỗi không làm hỏng khối khác.
- **AC-5:** GV: khối "Lớp X hôm nay" + "Việc của bạn hôm nay"; tiến độ 5 bước theo lớp (điểm danh → khám → báo ăn → đánh giá → trả trẻ).
- **AC-6:** Ở 390px các bước xếp dọc, thẻ điểm trường xếp dưới số chính, không cuộn ngang.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nguồn số liệu | Gom trong `dashboardSummaryService` từ endpoint đang có | Chờ BE làm `GET /reports/dashboard/today` | Không chặn FE; hàm thuần `build*` giữ shape để thay bằng response BE sau |
| Component | Thêm `DayProgress`, `TodayOverview` vào `components/dashboard/`, dùng chung 5 vai trò | Viết riêng từng page | Đang có 4 bản; mục tiêu là một khung |

## Phases
### Phase 1 — Service + khung HT
- Files: M `src/services/dashboard/dashboardSummaryService.js` (gom theo điểm trường, suất ăn trưa, tiến độ 5 bước) · C `src/components/dashboard/TodayOverview.jsx` · C `src/components/dashboard/DayProgress.jsx` · M `src/pages/dashboard/PrincipalDashboard.jsx` · M `src/styles/modules/dashboard.css` · M `tests/dashboard*.test.js`
- Tests: AC-1, AC-3 → test hàm thuần `buildDashboardToday` (theo điểm trường, suất ăn, trạng thái bước)
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`; chụp `/` HT 1440 + 390 so với `shots/home-new-a.png`. **Dừng chờ review.**

### Phase 2 — PHT, Tổ trưởng
- Files: M `VicePrincipalDashboard.jsx`, `TeamLeaderDashboard.jsx` (dùng lại khung Phase 1, phạm vi điểm trường / nhóm tuổi, cột phải theo bảng vai trò trong đề xuất)
- Exit: verify + ảnh 2 vai trò. **Dừng chờ review.**

### Phase 3 — Giáo viên (+ Bếp nếu chốt khung chung)
- Files: M `TeacherDashboard.jsx`, `components/dashboard/ClassTodayPanel.jsx`; (Bếp) M `KitchenDashboard.jsx`
- Exit: verify + ảnh so `shots/home-new-teacher.png`. **Dừng chờ review.**

## Test matrix
| AC | Test (tầng) | Phase |
| --- | --- | --- |
| AC-1, AC-3 | `tests/dashboard*.test.js` hàm thuần service | 1 |
| AC-2 | test trạng thái bước theo giờ chốt (cut-off) | 1 |
| AC-4, AC-6 | ảnh chụp 1440/390, mock lỗi một nguồn | 1–3 |
| AC-5 | test service phạm vi lớp | 3 |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Nhiều lời gọi song song ở trang chủ | Chậm tải | `Promise.all`, mỗi khối tự tải | Revert từng phase (mỗi phase 1 commit) |
| Số FE gom lệch số màn chi tiết | Sai lệch hiển thị | Dùng đúng endpoint của màn chi tiết | Như trên |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE (chỉ đề xuất endpoint gộp, ghi ở câu hỏi mở)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] ≤3 phase; Phase 1 ~6 file
- [x] Không dùng rule PENDING như đã chốt

## Progress log
### 2026-11-13 — Phase 1 (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (check-design ok, inlineStyle 37/37)
- Test mới: `tests/dashboard/home-day-rhythm.test.mjs` (8 test: theo điểm trường, bữa trưa, 5 bước, nguồn lỗi). `npm run test:dashboard` 66/66 pass.
- Ảnh: HT 1440 + 390 trên bản local mock khớp `shots/home-new-a.png` (bộ lọc điểm trường ở đầu thẻ, 2 thẻ điểm trường, 5 bước, cần chú ý + xếp hạng lớp, chờ duyệt + bữa trưa).
- Khác plan: `buildLunch` + `getDayProgressSources` đặt ở `dashboardService.js` (file đã được phép import assessment/attendance/kitchen) thay vì `dashboardSummaryService.js`, để không thêm nợ import chéo. Bỏ khối "Số liệu khác" (đếm kế hoạch/giáo án trong page) vì ảnh A không có và page đang tự tính. `Widget` thêm prop `actions` để đặt bộ lọc ở đầu thẻ.
- Tiếp: Phase 2 (PHT, Tổ trưởng).
