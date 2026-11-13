---
title: Đồng bộ thiết kế, bố cục UI toàn web — đợt 2
status: in-progress
owner: thangnd
jira: none
branch: dev
modules: [layouts, children, education-plan, upload]
rules: []
risk: medium
created: 2026-11-12
updated: 2026-11-13
---

# Đồng bộ thiết kế, bố cục UI toàn web — đợt 2

Làn L (>8 file, ≥2 nhóm màn, đụng khung chung). Không đổi nghiệp vụ, route, quyền, contract BE, dependency.
Đợt 1 (`2026-10-20-style-sync-by-flow.md`) đồng bộ CSS/token; đợt này đồng bộ bố cục và cách thao tác giữa các khu.

## Context

Chuẩn `DESIGN.md` §6.3 đổi 05–06/11 (bấm dòng mở chi tiết, cột "Thao tác", xuất Excel có xem trước, `ImportDialog`) nhưng chỉ khu Bán trú áp.
Rà 12/11 trên app thật: 119 trang + 31 hộp thoại/panel, 5 vai trò. Tài liệu so sánh (ảnh nhúng, không vào bản build):

- `plans/261112-1300-ui-layout-sync-round2/ui-sync-before-after-overview.html` — tổng quan, cặp trước/sau.
- `plans/261112-1300-ui-layout-sync-round2/ui-sync-zone-comparison.html` — cắt cùng vùng của mọi màn, danh sách đầy đủ từng màn.
- `plans/261112-1300-ui-layout-sync-round2/home-redesign-proposal.html`, `topbar-redesign-proposal.html` — đề xuất trang chủ, thanh trên.
- `plans/261112-1300-ui-layout-sync-round2/catalog/manifest.json`, `forms.json` — kết quả máy tự kiểm từng màn (checklist khi làm từng khu).

## Quyết định của user (12/11/2026)

1. **Bộ lọc:** nút "Đặt lại bộ lọc" không bắt buộc; mỗi luồng giữ ô lọc riêng theo nghiệp vụ. Chỉ đồng bộ khung (thanh lọc cùng thẻ với bảng).
2. **Nhãn riêng trong bảng:** không tính là lệch; giữ, kiểu đẹp đưa vào phần chung để màn khác dùng.
3. **Vị trí nút Lưu:** theo loại màn, không mặc định đưa lên đầu; màn dài (ví dụ soạn giáo án) có nút ở cuối. Bảng phân loại (form ngắn → cuối form; nội dung dài → cả đầu và cuối; bảng nhập → đầu, bảng dài thêm cuối; nhiều bước → cuối bước) là đề xuất của agent, user mới xác nhận hướng.
4. **Hộp tải tệp:** dùng bố cục `ImportDialog` như "Nhập thực phẩm từ Excel".
5. **Trang chủ:** phương án A "Nhịp một ngày" — làm thành plan riêng (cần gom số liệu ở tầng dịch vụ, đối chiếu BE).
6. **Thanh trên:** phương án 4 — đường dẫn + tên trang lên thanh trên, bỏ "Tạo nhanh", tài khoản giữ ở đáy sidebar.

Giữ quyết định cũ: tab gạch chân `PeopleTabs`; bảng Word của Kế hoạch giáo dục; `.kb-toolbar` của bếp; `.page-actions--sticky` ở Phiếu khám (user chọn 04/11); 5 form ngắn Bán trú để nút ở đầu (05/11).

## Phases

- **Phase 0 — Lớp chung.** Đã làm phần cần cho Phase 1: `.page-actions--plain`, `.page__head > .page__actions`, bỏ rule đẩy nút lên hàng breadcrumb, `DESIGN.md` §6.3/§7.1. Còn: gom lịch sử thao tác (`dg-`/`ga-`/`permission-history-*`), `FloatingPanel` lên `ui/`, nút gạt dùng `Tabs variant="pill"`, `KpiCard` → `StatCard`, dọn rule `.breadcrumb + .page__head` trong `education-plan.css`, `school-config.css` — làm khi phase tương ứng chạm tới.
- **Phase 1 — Trẻ, sức khỏe, phụ huynh.** Đã làm (xem Progress log). Còn: tab tự dựng → `ui/Tabs` (ChildProfile, ClassPlacement, HealthCheckDetail, HealthTrend, `.pa-seg`); 4 chỗ rỗng chữ trơn; `ImportChildrenPage` (chờ user chốt giữ trang hay về `ImportDialog`); đo độ dài Khai báo sức khỏe, Cân đo để quyết định có thêm nút ở đầu.
- **Phase 2 — Cấu hình trường + Phân quyền.**
- **Phase 3 — Đánh giá.**
- **Phase 4 — Điểm danh + Đón trẻ + Trang chủ (chỉ thẻ số liệu) + Chờ duyệt.**
- **Phase 5 — Kế hoạch giáo dục** (thêm hàng nút cuối trang cho 4 màn soạn; gỡ wrapper `eduUi`).
- **Phase 6 — Bán trú (phần sót) + Tài khoản/Cài đặt** (`EditHead` đang lặp tên trang với thanh trên; ô chọn tệp trần ở Phiếu nhập kho).
- **Phase 7 — Chốt:** bỏ mặc định dính đáy của `.page-actions` và class `--plain`; hạ baseline `check:design`; rà mọi route × vai trò × 360/390/768/1440; chạy lại bộ chụp so sánh.

Mỗi phase độc lập theo thư mục module, dừng được sau bất kỳ phase nào.

## Acceptance criteria

- AC-1: trong khu đã làm — 0 icon "Xem"/nút "Xem chi tiết" ở dòng bảng; dòng mở chi tiết bấm được bằng chuột và Enter/Space; cột thao tác ghi "Thao tác".
- AC-2: 0 thanh nút nổi che nội dung; màn dài có nút Lưu ở cả đầu và cuối, cùng nhãn; form ngắn không đổi vị trí.
- AC-3: không đổi nghiệp vụ/route/quyền; `VERIFY PASS full`; `check:design` không tăng.
- AC-4: không cuộn ngang trang ở 390/1024/1440; 0 lỗi console trên route đã sửa.

## Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Đường dẫn lên thanh trên làm lệch màn có CSS bám hàng breadcrumb | Đã kiểm 20 màn × 3 cỡ; rule cũ trong module CSS dọn theo phase |
| Hai chỗ Lưu trên màn dài lệch hành vi | Cùng một biến `actions` render hai nơi |
| e2e bám bố cục cũ | Giữ tiêu đề hộp, nhãn nút, ô chọn tệp, câu báo lỗi; chạy lại khi có BE + Keycloak |

## Verification (mỗi phase)

- `node scripts/verify.mjs` → `VERIFY PASS full`; sửa docs ⇒ `node scripts/check-ai-layer.mjs`.
- Mở app (`VITE_USE_MOCK=true`), Playwright + Edge: thử thao tác thật (bấm dòng, Enter, Lưu, tải tệp), đo tràn ngang 390/1024/1440, bắt lỗi console, chụp ảnh vào `plans/261112-1300-ui-layout-sync-round2/shots/`.

## Progress log

### 2026-11-12 — Rà soát, tài liệu so sánh, chốt quyết định

- Nguồn: user yêu cầu rà luồng UI, cần ảnh thật trước/sau, liệt kê cả hộp thoại và màn trong.
- Đã làm: 4 file HTML ở `plans/261112-1300-ui-layout-sync-round2/`; 6 quyết định ở mục trên.
- Giới hạn: ~24 màn cần dữ liệu/bước trước chưa chụp được (rà bằng đọc mã); kết quả tự kiểm bằng máy.

### 2026-11-12 — Hộp tải tệp theo `ImportDialog` (done)

- `ImportDialog` thêm `options`, `onTemplate`, `templateLabel`, `hint`, `maxSize`, `uploadLabel`, `idleLabel`.
- `ImportGoalFileModal`, `ImportBranchFileModal` dùng `ImportDialog`; bảng xem trước về `table--grid`; giữ tiêu đề, nhãn nút, báo lỗi trong hộp.
- 2 test đơn vị viết lại phần bám bố cục cũ (rộng 720, hai nút cùng hàng), giữ kiểm tra logic.
- Verify: `VERIFY PASS full`. Mở app: 2 hộp không lỗi console, tệp >2 MB báo lỗi trong hộp, CSV ra bảng xem trước. Chưa chạy e2e.

### 2026-11-12 — Thanh trên phương án 4 (done)

- `HeaderSlotContext` + portal trong `ui/Breadcrumb`: đường dẫn hiển thị trên thanh trên, trang không phải sửa; màn nhúng (`.sc-setup__embed`) không ghi đè đường dẫn màn mẹ.
- `Header`: đường dẫn · tìm (gọn) · năm học · chuông; xóa `QuickCreateMenu` (mục tạo mới còn trong ô tìm qua `quickActions.js`).
- CSS: cấp cha cắt "…" trước, tên trang không co; ≤1024px chỉ còn tên trang; điện thoại năm học co lại.
- Verify: `VERIFY PASS full`. Mở app: 20 lượt (1440/1024/390, 3 vai trò) — 1 đường dẫn trên thanh, 0 tràn ngang, 0 lỗi console.
- Chưa làm: chưa chạy e2e (`edu-plan-flows.spec` đo vị trí mục cuối đường dẫn); vai Tổ trưởng, Bếp chưa xem.

### 2026-11-12 — Phase 0 (một phần) + Phase 1 khu Trẻ

- Lớp chung: `.page-actions.page-actions--plain` (hàng nút thường); `.page__head > .page__actions`; bỏ rule `@media (min-width:1024px) .breadcrumb + .page__head …` trong `components.css` (đường dẫn không còn trong trang).
- **Khác plan gốc:** không tắt dính đáy toàn cục ngay (≈45 chỗ dùng `.page-actions` ở mọi khu, màn dài khu khác sẽ mất nút luôn thấy); chuyển từng khu bằng `--plain`, Phase 7 mới đổi mặc định.
- Danh sách trẻ: bấm dòng mở hồ sơ (`clickableRowProps`), bỏ icon Xem; bấm tên vẫn mở xem nhanh.
- Đợt khám, kỳ cân đo: bấm dòng, bỏ cột chỉ có icon Xem. Chi tiết đợt khám: "Mở sổ sức khỏe" thành icon phụ `HeartPulse`.
- Xếp lớp: dòng chọn trẻ dùng được bằng bàn phím, bỏ nút trùng ở tên.
- Sửa hồ sơ trẻ (dài 1,7 màn hình): Hủy / Lưu ở đầu trang và cuối trang, cùng biến `actions`; hết thanh nổi.
- Tiếp nhận trẻ, Tạo/Sửa đợt khám, Khai báo sức khỏe, Cân đo, Nhập từ Excel, Xếp lớp: hàng nút thường cuối trang.
- Tài khoản phụ huynh: đầu trang chuẩn (hết lặp tên trang), ô tìm vào thanh lọc của thẻ; xóa `.pa-head*`.
- Sửa lỗi bố cục có sẵn: `ChildInfoFields` bật lưới ảnh + ô nhập cả khi không có ô ảnh ⇒ ô nhập rơi vào cột hẹp (Sửa hồ sơ trẻ, 1440px). Chỉ bật lưới khi có ô ảnh.
- Giữ nguyên, có lý do: `GrowthReportPage` tải Excel thẳng (file có ô gộp, kiểu; màn đã là bản xem trước đúng mẫu) và cột "TT" (theo mẫu báo cáo).
- Kiểm trên app: bấm dòng, Enter, bấm tên, icon Sửa không kích hoạt dòng; nút Lưu đầu + cuối; 0 lỗi console; 0 tràn ngang ở 1440 và 390.

### 2026-11-13 — Phase 1 (phần còn lại) + Phase 2 đợt 1

- Phase 1: tab tự dựng ở Hồ sơ trẻ, Xếp lớp, Chi tiết đợt khám, Xu hướng sức khỏe → `ui/Tabs` (thêm prop `className`); 4 chỗ rỗng chữ trơn → `EmptyState` (Hồ sơ trẻ ×2, xem nhanh trẻ, khai báo sức khỏe).
- Lớp chung: `.page` khoảng trên `--space-2` → `--space-4` — đường dẫn lên thanh trên nên nội dung nằm sát bóng của thanh (thấy ở đầu Hồ sơ trẻ).
- Phase 2 đợt 1: Điểm trường bấm dòng bằng `clickableRowProps`, bỏ icon Xem; bộ lọc vào cùng thẻ với bảng ở Điểm trường, Phòng ban, Tài khoản nhân sự (cả `StaffAccountsPage` và `StaffAccountsBeView`); bảng Phân công Phó hiệu trưởng thêm `table--grid`; Thêm/Sửa điểm trường, Tạo/Sửa năm học, Thiết lập năm học dùng hàng nút thường.
- Sửa lỗi có sẵn: cột "Đang phụ trách" ở Tài khoản nhân sự in "Tổ trưởng undefined" khi phân công tổ trưởng không gắn điểm trường.
- Kiểm trên app (Hiệu trưởng, 1440 + 390): đổi tab, bấm dòng, Enter, icon Sửa, vị trí bộ lọc, nút không nổi; 0 lỗi console; 0 tràn ngang.
- Còn của Phase 1: nút gạt điểm trường `.pa-seg` ở Tài khoản phụ huynh; `ImportChildrenPage` (chờ user); đo độ dài Khai báo sức khỏe, Cân đo.
- Còn của Phase 2: `PermissionTabs` + `.permission-page-head` + `.permission-filter-bar`; bộ lọc trong tiêu đề thẻ ở Phân công giáo viên; 6 chỗ rỗng `<td colSpan>` chữ trơn; nút chữ ở Năm học, Phân công Phó hiệu trưởng; `.sc-seg`; Cấu hình thời gian, Vai trò & quyền (vị trí nút Lưu).

### 2026-11-13 — Phase 2 đợt 2 + Phase 3 đợt 1

- Phase 2: 6 ô rỗng chữ trơn trong bảng → `EmptyState` (Cấu hình thời gian, Phân công giáo viên, sửa nhanh phòng/lớp ×2, chọn tổ trưởng, chọn giáo viên lớp); Quyền ngoại lệ: nút "Thêm ngoại lệ" về `.page__head > .page__actions`, `PermissionTabs` bỏ prop `actions`.
- Phase 2, không đổi và lý do: nút "Kích hoạt" (Năm học), "Chọn" (Phân công Phó hiệu trưởng) là nút nghiệp vụ chính của dòng (`.btn--primary.btn--sm`); bộ lọc Phân công giáo viên đã cùng thẻ với bảng; `PermissionTabs` là tab điều hướng giữa trang như `PeopleTabs`; Vai trò & quyền dài 1,2 màn hình, thanh lưu chỉ hiện khi có thay đổi.
- Phase 3: Đánh giá tháng / học kỳ / cuối năm (`EvaluationListView`), Đề xuất khen thưởng, Hồ sơ phát triển, Tổng quan đánh giá lớp — bấm dòng bằng `clickableRowProps`, bỏ icon Xem và nút "Xem chi tiết"; cột Thao tác chỉ còn nút nghiệp vụ chính, ẩn hẳn khi vai trò không có thao tác; tab trạng thái dùng `ui/Tabs`.
- Tổng quan đánh giá lớp: điểm trường tách thành cột riêng (một cột một thông tin).
- Xếp loại nhóm lớp (bảng ~3 màn hình): Lưu ở `.page__actions` đầu trang + hàng nút thường cuối trang, cùng biến `saveActions`; hết thanh nổi.
- Đánh giá cuối chủ đề: "Xuất Excel" gọi `exportWithPreview` (trước tải thẳng).
- Test: `tests/health/measurement-head-display.test.mjs` thêm bản giả `Tabs` (test dựng lại trang bằng thành phần giả).
- Kiểm trên app (Hiệu trưởng 1440 + 390, Giáo viên 1440): bấm dòng / Enter tới đúng chi tiết ở 5 danh sách; Xếp loại có nút Lưu đầu + cuối, không nổi; 0 lỗi console; 0 tràn ngang.
- Chưa kiểm được trên giao diện: hộp xem trước của "Xuất Excel" ở Đánh giá cuối chủ đề (dữ liệu mẫu của giáo viên chưa có bảng để xuất).
- Còn của Phase 3: Đánh giá hằng ngày, Đánh giá theo mục tiêu, Phiếu bé ngoan, Khen thưởng lớp, Bản nháp AI, màn xem xét đánh giá (vị trí nút Lưu, cần đo độ dài); 7 chỗ rỗng chữ trơn; nút "Xác nhận" chung chung ×2; `.dg-seg`; ô chọn điểm trường tự viết ×5; `TicketOverview` icon Xem; 12 màn thiếu hàng mô tả đầu trang.

### 2026-11-13 — Phase 3 đợt 2

- Đo trên app (`measure-assessment`): Đánh giá hằng ngày và Phiếu bé ngoan vừa một màn hình ⇒ hàng nút thường cuối trang (`--plain`); Khen thưởng lớp dài 2,1 màn hình, 36 ô tích ⇒ "Lưu nháp / Gửi danh sách" ở `.page__actions` đầu trang + hàng nút thường cuối trang (biến `editActions`).
- Trạng thái rỗng chữ trơn → `EmptyState`: `DailyDaysTable`, `DevelopmentProfileView` ×2, `EvaluationReviewView` ×2, `ClassComments`, `ClassMonthlyCommentCard`.
- Câu trên nút: "Xác nhận" → "Xác nhận nhận xét" (nhận xét chung tháng), "Xác nhận đánh giá" (đánh giá cuối chủ đề), cả nút và hộp xác nhận.
- Tổng quan phiếu bé ngoan (`TicketOverview`): bấm dòng xem từng trẻ, bỏ cột chỉ có icon Xem.
- Sửa lỗi chữ có sẵn: Khen thưởng lớp ghi "Lớp Lớp Chồi 1" ở đường dẫn và tiêu đề.
- Kiểm trên app (Giáo viên, Hiệu trưởng; 1440 + 390): vị trí nút đúng như trên, không nút nào nổi; bấm dòng / Enter ở tổng quan phiếu mở đúng lớp; 0 lỗi console; 0 tràn ngang.
- Chưa đo được (cần dữ liệu / bước trước): màn xem xét đánh giá (`EvaluationReviewView`), Bản nháp AI, Đánh giá theo mục tiêu — vẫn dùng thanh nút cũ.
- Còn của Phase 3: 3 màn trên; `.dg-seg`; ô chọn điểm trường tự viết ×5 (chờ gom `CampusFilter` ở Phase 0); dòng "Không có bản chưa lưu" trong lịch sử phiên bản; các dòng chú thích xám ở Tiến độ phát triển (7 chỗ, cần soát cái nào là trạng thái rỗng).

### 2026-11-13 — Phase 4 (Điểm danh, Đón trẻ)

- Thẻ số liệu: ô tự vẽ `.dd-stat` ở Tổng hợp điểm danh, Sổ báo ăn, Sức khỏe trong ngày → `ui/StatCard` (14 thẻ); xóa CSS `.dd-stat*`; lưới `.dd-stats` giữ, cột tối thiểu 120px → 160px. Tông giữ theo ý nghĩa (xanh lá có mặt, cam vắng / cần lưu ý, đỏ không phép / chưa điểm danh).
- Sức khỏe trong ngày: bảng "Trẻ cần chú ý" bấm dòng bằng `clickableRowProps` (trước chỉ chuột), bỏ cột chỉ có icon Xem.
- Đón trẻ: tab trạng thái dùng `ui/Tabs`.
- Không đổi, có lý do: Chờ duyệt — "Xem và duyệt" là nút nghiệp vụ chính của dòng, cột đã ghi "Thao tác"; Đón trẻ — "Trả trẻ", "Gọi phụ huynh" là nút nghiệp vụ của dòng.
- **Khác plan gốc:** bỏ việc đổi `KpiCard` → `StatCard` ở Trang chủ — trang chủ làm lại theo phương án A ở plan riêng, tránh làm hai lần.
- Kiểm trên app (Hiệu trưởng, Giáo viên; 1440 + 390): 14 thẻ hiện đúng nhãn và số, không nhãn nào bị cắt; Enter trên dòng mở hộp chi tiết sức khỏe; đổi tab Đón trẻ; 0 lỗi console; 0 tràn ngang.
- Còn của Phase 4: nút gạt `.dd-seg` ở Điểm danh; ô chọn điểm trường / lớp tự viết (`ClassDateBar`, Sức khỏe trong ngày); 2 chỗ rỗng chữ trơn trong lịch sử sức khỏe; footer riêng `dd-reception__footer` của màn Điểm danh (đo độ dài rồi quyết định).

### 2026-11-13 — Phase 5 (Kế hoạch giáo dục) + Phase 6 (phần nhỏ)

- Phase 5, đo trên app: 4 màn soạn (mục tiêu năm 1,8 màn hình; chủ đề nhánh 2,1; kế hoạch chủ đề 2,3) có `.ga-sticky-head` bám theo khi cuộn — ở cuối trang nút Lưu vẫn nằm trong khung nhìn (1440 và 390). **Khác plan:** không thêm hàng nút cuối trang, vì đã lưu được ở mọi vị trí cuộn; thêm nữa là thừa.
- Kế hoạch toàn trường: tab loại kế hoạch dùng `ui/Tabs`.
- Không đổi, có lý do: tab tuần / ngày của `WeekPlanPage` có điều hướng bằng phím mũi tên và `aria-controls` mà `ui/Tabs` chưa có; icon Xem trong bảng kế hoạch lớp (`ClassPlanPage`) nằm trong bảng phân cấp kiểu Word đã chốt không tô nền khi rê chuột (Tiền 04/11) nên chưa chuyển sang bấm dòng.
- Phase 6: cột thứ tự "#" → "STT" (Món ăn, Thêm món, Thống kê thực đơn, bữa của mẫu ngày); Tùy chỉnh giao diện (2,2 màn hình): thanh lưu ở đầu và cuối trang, cùng biến `saveBar`, hết nổi.
- Soát lại, không phải lỗi: "Hành động" ở `MenuBadges` là cột nội dung của bảng lịch sử; `<th />` ở `StockLotsTab` và `AllergyMenuDetailPage` là ô trang trí / dòng nhóm, không phải cột thao tác.
- Kiểm trên app (1440 + 390): tab Kế hoạch toàn trường, vị trí nút ở Tùy chỉnh giao diện, tiêu đề cột Món ăn; 0 lỗi console; 0 tràn ngang.
- Còn của Phase 5: bảng danh sách `ga-plan-table` → `table--grid`; gỡ wrapper `eduUi` (Modal, EmptyState, Stepper, Field); 3 modal nhập còn lại (`ImportGoalsModal`, `ImportThemesModal`, nguồn chương trình); `ga-history-*`.
- Còn của Phase 6: 13 tab tự dựng ở Bán trú; `.kb-kpi`; `.bd-toolbar`; 10 chỗ rỗng chữ trơn; `EditHead` lặp tên trang với thanh trên; ô chọn tệp trần ở Phiếu nhập kho; `account.css` ghi đè `.page-actions`.

### 2026-11-13 — Phase 6: tab tự dựng ở Bán trú

- 9 thanh tab tự dựng → `ui/Tabs` ở 7 file: `AiMenuSuggestionPage`, `MenuStatisticsPage`, `NutritionBalancePage` (tab nhóm tuổi), `WeeklyPlanPage`, `MealNutritionCard` ×2, `MealPlanEvaluations`, `TemplateDayPicker` ×2. Các thanh này vốn đã dùng class `.tabs` / `.tabs--pill` nên giao diện không đổi; chỉ bỏ mã lặp.
- Giữ nguyên: thẻ ngày `td-week-cards` ở Cân đối dinh dưỡng (là thẻ có số liệu, không phải tab thường); các trang chỉ chạy ở bản dữ liệu mẫu (`WeeklyMenuPage`, `PublishedMenuPage`, `WeeklyForecastPage`, `DryStockPage` kèm `.kb-kpi`).
- Kiểm trên app (bản dữ liệu mẫu, Hiệu trưởng, 1440 + 390): Gợi ý thực đơn bằng AI và Cân đối dinh dưỡng — bấm tab thứ hai được chọn, 0 lỗi console, 0 tràn ngang.
- **Chưa kiểm được trên giao diện:** `MenuStatisticsPage`, `WeeklyPlanPage`, `MealNutritionCard`, `MealPlanEvaluations`, `TemplateDayPicker` — bản dữ liệu mẫu chuyển hướng sang trang cũ, 5 file này chỉ hiển thị khi bật API thật. Mới qua lint, build và bộ test.
- Còn của Phase 6: `.bd-toolbar`; ~10 chỗ rỗng chữ trơn; `EditHead` lặp tên trang với thanh trên; ô chọn tệp trần ở Phiếu nhập kho; `account.css` ghi đè `.page-actions`.

### 2026-11-13 — Phase 6: trạng thái rỗng, đầu trang sửa, tràn ngang ở màn chia tab

- Trạng thái rỗng cả khối → `EmptyState`: bảng thay món của Chi tiết thực đơn thay thế, bảng thống kê khi món chưa có định lượng, danh sách trẻ theo lý do dị ứng, lịch sử thực đơn.
- Soát lại, giữ nguyên: các chữ xám "Chưa có món", "Chưa có định lượng cho nhóm này", "Chưa có thực đơn" là giá trị trống của **một ô / một dòng** trong bảng vẫn có dòng khác, không phải trạng thái rỗng của cả khối.
- `EditHead`: `h1` chỉ còn cho trình đọc màn hình (tên trang đã ở thanh trên) — Thêm/Sửa món, Thêm/Sửa thực đơn mẫu hết lặp tên trang.
- Sửa lỗi có sẵn ở lớp chung: `.tab-panel > *` thiếu `min-width: 0` ⇒ Chi tiết món tràn ngang 313px ở 390px. Kiểm lại 5 màn chia tab ở 390 và 1440: 0 tràn ngang ở mọi tab.
- Chưa kiểm trên giao diện: 4 trạng thái rỗng mới (dữ liệu mẫu không có trường hợp rỗng tương ứng) — mới qua lint, build.
- Còn của Phase 6: `.bd-toolbar`; ô chọn tệp trần ở Phiếu nhập kho; `account.css` ghi đè `.page-actions`.
- **Commit:** user yêu cầu commit 13/11; đang ở `dev`, chưa có mã Jira và nhánh ⇒ chưa commit, đã hỏi user.

### 2026-11-13 — Commit và gộp `origin/dev`

- User cho mã `G94-340`, `FE-FEAT-56`, không commit `plans/`. Nhánh `feature/G94-340-FE-FEAT-56-ui-layout-sync` tạo từ `dev` trên máy; 3 commit: hộp tải tệp, thanh trên, đồng bộ bố cục các khu.
- **Sự cố quy trình:** `dev` trên máy chậm 180 commit so với `origin/dev`; cả đợt làm trên bản cũ. 62/85 file đã sửa cũng đổi trên `origin/dev`. Gộp `origin/dev` vào nhánh: 23 file xung đột.
- Cách xử lý xung đột:
  - Lấy bản `origin/dev` ở chỗ nhóm đã làm lại theo quyết định mới hơn của user (11/11): Danh sách trẻ (bỏ xem nhanh khi bấm tên, mọi thao tác dòng vào menu "…", xóa `ChildQuickPanel`), Chi tiết và Danh sách đợt khám (bấm dòng, không cột Thao tác), `ChildInfoFields` (đã sửa lỗi bóp cột theo cách khác), `MealNutritionCard`, `TemplateDayPicker`, `MenuStatistics`.
  - Ghép hai bên: `Breadcrumb` (tên theo sidebar của `origin/dev` + đưa lên thanh trên), `EditChildPage`, `DeclarationSummary`, `ThemeEvaluationPage` (kiểm quyền mới + câu nút), `AttendanceSummaryPage`, `DishListPage` và `TemplateMealSection` ("STT"), `ImportBranchFileModal`, `MenuStatisticsPage`, `DESIGN.md`.
  - `ParentActivationPage`: theo `origin/dev` bỏ dải thông báo demo và dòng mô tả; giữ ô tìm trong thanh lọc của thẻ.
  - `ClassRatingsPage`: bỏ nút "Xuất Excel" ở đầu trang vì `origin/dev` đã có ở thanh công cụ của bảng.
  - **Không thuộc việc này:** `src/utils/exportXlsx.js`, `docs/knowledge/ISSUE_INDEX.md`, `docs/quality/VERIFICATION.md` xung đột giữa commit riêng trên máy `d13cfce` (G94-180 "Restore XLSX writer compatibility") và bản của nhóm ⇒ lấy bản `origin/dev`, cần user xác nhận.
- Theo cổng mới của `origin/dev` (không `<button>` viết tay mới): nút tệp mẫu của `ImportDialog` dùng `Button`.
- Test: thêm bản giả `Tabs` cho `tests/education-plan/review-status-label.test.mjs` (test mới của nhóm dựng `SchoolPlansPage` bằng thành phần giả).
- Kiểm trên bản đã gộp (lệnh gốc, theo AGENTS.md mới): `npm run lint` 0 lỗi; `format:check` đạt; `check:design` ok; `check:api` 0 lỗi; `build` đạt; 9 nhóm test đạt (auth 93, menu 206, kitchen 167, merge 56, hardening 102, dashboard 58, health 111, children 121, edu 349).
- Kiểm trên app sau gộp (1440 + 390): thanh trên 20/20 lượt; khu Trẻ, Cấu hình trường, Phân quyền, Đánh giá, Điểm danh, Đón trẻ — bấm dòng, vị trí nút, tab, thẻ số liệu đúng; 0 lỗi console; 0 tràn ngang.
- Ghi nhận sau gộp: đường dẫn giờ theo sidebar nên sâu hơn (tới 5 cấp), các cấp cha bị cắt "…" nhiều ở màn sâu; `/assessment/periodic` chuyển hướng về Hồ sơ phát triển (thay đổi của nhóm).

### 2026-11-13 — Sau gộp: phần lẻ trong module

- Phiếu nhập kho (`StockReceiptEditorPage`): "Nhập từ Excel" mở `ImportDialog` (tệp mẫu → chọn tệp → xem trước Hợp lệ / Lỗi + danh sách dòng lỗi → "Thêm N dòng vào phiếu"); bỏ ô chọn tệp trần và cảnh báo dòng lỗi nằm dưới bảng. Nút dùng `Button` chung.
- Lịch sử thay đổi quyền: "Bỏ lọc tài khoản" → "Đặt lại bộ lọc".
- Soát lại, giữ nguyên: `.dd-seg` (Điểm danh) và `.dg-seg` (Đánh giá ngày) là ô chọn giá trị từng dòng (vai trò radio, màu theo giá trị), không phải tab; `.permission-page-head` / `.permission-filter-bar` đã là `page__head` / `filter-bar` kèm lớp tinh chỉnh; `account.css` đưa hàng nút về chân thẻ ở form ngắn — đúng quy tắc vị trí nút Lưu; `.bd-toolbar` trùng `.kb-toolbar` nhưng gộp cần đụng CSS chung hoặc nhập CSS chéo module.
- Kiểm: kitchen 167, hardening 102 đạt; lint 0 lỗi; format, cổng thiết kế, build đạt. **Chưa kiểm trên giao diện** hộp nhập của Phiếu nhập kho: bản dữ liệu mẫu không có phiếu nháp mở được (`/new` dùng trang cũ ở bản mẫu).
- Dừng ở điểm dừng cứng 2 (vùng dùng chung, AGENTS.md): Phase 7 và các việc promote lên `components/ui` chờ user duyệt bản tác động.

### 2026-11-13 — Phase 7: bỏ thanh nổi mặc định, ô lọc điểm trường chung

- User 13/11: "xử lý cho web thôi, app sau" ⇒ làm Phase 7 theo phương án 2 (đo màn dài trước).
- Đo 3 màn dài: chi tiết đánh giá (2–3,5 màn hình) ⇒ `EvaluationReviewView` thêm nút Lưu/Xác nhận ở `.page__actions` đầu trang (cùng handler); Bản nháp AI (1,3 màn) và Đánh giá theo mục tiêu (1 màn) giữ nút cuối.
- `components.css`: `.page-actions` mặc định là hàng nút thường (bỏ `:has(.btn--primary)` dính đáy); chỉ `.page-actions--sticky` (Phiếu khám) còn nổi. Bỏ lớp tạm `.page-actions--plain` ở 17 file và rule `[data-area='boarding'] .page-actions`; `account.css` bỏ các dòng tắt thanh nổi giờ thừa. `DESIGN.md` §6.3, khung layout, §8 Tạo/sửa cập nhật.
- Đo lại 12 màn × 1440/390: 0 thanh nổi, 0 tràn ngang, 0 lỗi trang.
- 9 ô lọc điểm trường viết tay → `ui/CampusFilter` (Danh sách trẻ, Báo cáo tăng trưởng, Đợt khám, Xu hướng sức khỏe, Khen thưởng, Xếp loại lớp, Báo cáo chất lượng, Tổng quan đánh giá lớp, Sức khỏe đầu ngày). Không sửa phần chung. Hệ quả: người chỉ có 1 điểm trường không thấy ô (luật sẵn của `CampusFilter`); ô hiện tên ngắn. Còn ô có `<label>` riêng (Chờ duyệt, Tổng hợp điểm danh) và ô trong form chọn điểm trường cho bản ghi — giữ.
- Không gom `VersionHistory` (Đánh giá / KHGD gần như trùng): bản Đánh giá ghi "bản riêng theo Cần chốt 03/11" ⇒ quyết định của nhóm, chờ user.
- VERIFY PASS full (sau lần sửa cuối).
