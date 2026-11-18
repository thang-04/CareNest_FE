---
title: Header kế hoạch giáo dục một hàng
status: done
owner: Tiền
jira: G94-288 / FE-FEAT-55
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [education-plan]
rules: [EDU-54, EDU-90, EDU-92]
risk: medium
created: 2026-11-17
updated: 2026-11-17
---

# EDU-92 — header giáo dục một hàng

Nguồn: Tiền yêu cầu ngày 17/11/2026, ảnh header năm/tổ. Làn L do shared UI và nhiều màn; phạm vi hiển thị đã được yêu cầu trực tiếp. Tác động đã trình bày trong chat trước sửa.

## Đối chiếu

EDU-54: quyền/duyệt; EDU-90: canExport; EDU-92: header không xuống hàng, thiếu chỗ gom ba gạch. Đã ghi quyết định vào bản chuẩn trước code, đồng bộ BUSINESS_RULES, flow và module card/snapshots. Không có xung đột nghiệp vụ chưa chốt; quy tắc mới thay phần responsive của cách xếp hàng nút cũ.

## Thay đổi

ResponsiveToolbar mới ở UI chung, export barrel, mẫu UI kit và catalogue. Giữ một cây control đang mount; đo intrinsic width trong layout effect, ResizeObserver và MutationObserver. Không gọi business handler khi đo; menu giữ component gốc để state/disabled/quyền/dialog không mất. Styles dùng token, chỉ opt-in component mới. 10 màn ga-year-toolbar và PageHead giáo dục dùng chung; không đổi route/API hoặc thời điểm lưu/duyệt.

## Điều chỉnh tiếp theo yêu cầu Tiền 17/11/2026

- Thay thứ tự cũ của quyết định 12/11: thanh thao tác sát header chung và trước mọi thẻ lọc/tab, Quay lại trái, hành động chi tiết/lưu/gửi phải. Đã cập nhật bản chuẩn EDU-92 + Nhật ký trước code, đồng bộ BUSINESS_RULES và flow/module card/feature/snapshots; lưu lịch sử 299dbbd, 3d22fb7.
- Phạm vi đã kiểm trước sửa: mọi ga-sticky-head trong trang giáo dục, các nơi truyền toolbar qua headOf/head, JSX điều kiện quá hạn/ngày, nhóm dạy học; PageToolbar dùng chung ở 9 route thông báo và header ẩn/PageHeader. Di chuyển nguyên cây JSX có guard trước filter/tab, không dùng CSS order, không đổi handlers, phạm vi biến, disabled hoặc quyền EDU-54/90. Trang dạy học tách Quay lại trái và Toàn màn hình phải, thông tin lớp/ngày ở dưới thanh nút.
- PageToolbar thêm prop leading; thông báo soạn/sửa, chi tiết trường, chi tiết cá nhân dùng nhóm trái cho Quay lại, nhóm phải cho hành động. Chỉ các trang opt-in bỏ padding/khung h1 ẩn, giữ h1 truy cập và breadcrumb trên header. Không đổi MainLayout/Header hoặc ResponsiveToolbar nền; không đổi API/BE code.
- Bổ sung test thứ tự DOM mọi khung có toolbar, test render form nhóm trái/phải và giữ test 9 route. Chạy phần giáo dục liên quan: header-order, year-plan-layout, year-plan-review-neutral, week-corner-enter; thông báo announcement-model. Kết quả 27/27 đạt. Không chạy test giáo dục/API/auth/menu độc lập đã đạt trước vì không đổi nghiệp vụ, state, API hoặc quyền. Không e2e theo chỉ đạo user; chưa kiểm trực quan bằng trình duyệt.
- Kiểm chứng cuối sau sửa: `npm run lint`, Prettier check trên JSX/CSS/test liên quan và `git diff --check` đều exit 0; `npm run build` exit 0, built in 2.03s (cảnh báo thư viện như trước).
- `node nghiep_vu_chuan/kiem_tra_nghiep_vu.mjs` exit 1 do **hai tài liệu ngoài phạm vi sửa**: `CareNest_FE/docs/features/year-plan-preview-edit.md` lệch 1 dòng liên kết; `CareNest_BE/AGENTS.md` lệch các đoạn quy trình/làn. Đã báo Tiền, giữ nguyên cả repo lẫn snapshot tương ứng, không tự nhận hoặc khôi phục. Kiểm riêng EDU-92 giữa canonical/BR và 3 snapshot flow/module/header-feature: khớp. Không coi kiểm tra tổng thể là đạt.

## Ngoại lệ Mở hạn và danh sách thông báo — Tiền yêu cầu tiếp 17/11/2026

- Bỏ toolbar header riêng trên OverduePlansPage; giữ nút mở hạn hàng loạt cạnh bảng với số dòng đã chọn và disabled khi chưa chọn, giữ nút từng dòng/hộp mở hạn/handlers. Đã kiểm bộ lọc, tab, selected/target, ExtendDeadlineModal và test overdue trước sửa. EDU-92 + đoạn thứ tự khung trang canonical cập nhật trước code, đồng bộ BR/flow/module/feature và 3 snapshot, lưu mốc 87f68bf.
- Thông báo của tôi: nền surface trắng thống nhất khi đã đọc/chưa đọc/hover, icon nền trong suốt trung tính, thay badge Chưa đọc bằng chấm xanh có tên truy cập. Giữ badge loại, focus, đánh dấu đã đọc, điều hướng và nút Đánh dấu tất cả đã đọc. Selector CSS chỉ dùng bởi danh sách này; không đổi chuông/header hoặc chi tiết.
- `node --import ./scripts/register-auth-test-loader.mjs --test tests/education-plan/header-order.test.mjs tests/education-plan/overdue-and-status.test.mjs tests/notifications/announcement-model.test.mjs`: 14/14 đạt. Test header cho phép ngoại lệ Mở hạn, vẫn kiểm 9 khung toolbar còn lại; SSR 9 route thông báo đạt.
- ESLint hai trang, Prettier các file JSX/CSS/test thay đổi và Vite build đạt (2.02s; cảnh báo thư viện như trước). Không e2e hoặc kiểm trực quan; test API/auth và các màn giáo dục độc lập đã đạt trước không chạy lại vì không đổi service/quyền/handlers.

## Bỏ tên tài liệu khi cuộn, nền tin chưa đọc — Tiền yêu cầu tiếp 17/11/2026

- Yêu cầu mới thay hành vi 12/11 tự hiện tên ngắn khi toolbar dính. Đã đọc EDU-92 và đoạn khung đầu trang canonical, kiểm toàn bộ callers `.ga-year-toolbar__title`, scroll-state CSS và assertion render kế hoạch tổ trước sửa. Cập nhật canonical + Nhật ký trước code, đồng bộ BR/flow/module/feature và snapshot, lưu mốc 0c261e2.
- Bỏ span tên phụ ở 7 màn năm/tổ xem-sửa, nhánh, danh sách chủ đề/ngày, chủ đề, tuần/ngày; xóa CSS container scroll-state và hiển thị tên khi dính. Giữ breadcrumb/h1, chip trạng thái, nút, quyền và sticky. Cập nhật test render cũ và kiểm mọi trang không còn tên lặp trên toolbar.
- Thông báo chưa đọc khôi phục class trạng thái + nền primary-soft cả dòng, giữ chấm xanh và không hiện badge Chưa đọc. Tin đã đọc nền surface trắng; hover không đổi nền theo trạng thái. Giữ dịch vụ/markRead/readAll, link và bàn phím.
- Chạy header-order, year-plan-layout, year-plan-review-neutral, week-corner-enter, announcement-model: **27/27 đạt**. ESLint các trang thay đổi đạt; Prettier và build đạt (1.85s, cảnh báo thư viện như trước). API/auth, mở hạn và màn độc lập đã đạt trước không chạy lại do không đổi logic/callers của chúng. Không e2e hoặc kiểm trực quan trên trình duyệt.

## Kiểm chứng

- Lượt `node --import ./scripts/register-auth-test-loader.mjs --test tests/education-plan/*.test.mjs`: 386 ca, 374 đạt và 12 lỗi do các test render cô lập xóa imports chưa khai báo ResponsiveToolbar. Bổ sung wrapper stub theo convention của test, giữ nguyên assertions nghiệp vụ. Chạy lại đúng hai file `config-view-mode.test.mjs` và `year-plan-layout.test.mjs`: 13/13 đạt (gồm 12 ca lỗi và một ca đã đạt trong file). 373 ca độc lập còn lại tái sử dụng; tổng 386 ca đã có kết quả đạt, không tuyên bố một lượt suite xanh duy nhất.
- `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/shared-field-required.test.mjs tests/hardening/modal-stack.test.mjs`: 7/7 đạt. Kiểm barrel chung và logic modal; không chứng minh layout browser thực.
- `npm run lint`, `npm run build`, Prettier check trên JSX/CSS đã sửa, `git diff --check`: đạt. Build có cảnh báo annotation thư viện bên thứ ba như trước.
- Không chạy e2e theo AGENTS.md, không kiểm browser trực quan; chưa chứng nhận kích thước/zoom bằng ảnh thật. Bộ test logic không thay phép kiểm ResponsiveToolbar ở browser. Không chạy lại BE vì chỉ đồng bộ tài liệu EDU-92; không thay backend code/API.
- DESIGN/UI_CARD/UI kit và feature doc đã cập nhật. Bản chuẩn, BUSINESS_RULES, flow/module card và bản chụp FE đã đồng bộ, lưu hai mốc lịch sử cục bộ. Không commit/push source.
