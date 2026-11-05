---
title: Bán trú — đồng bộ giao diện (thiết lập dinh dưỡng, nút đầu trang, thao tác bảng, vị trí Lưu)
status: in-progress
owner: thangnd
jira: G94-272 / FE-FIX-01
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [nutrition, menu-planning, kitchen]
rules: []
risk: medium
created: 2026-11-05
updated: 2026-11-05
---

# Bán trú — đồng bộ giao diện (thiết lập dinh dưỡng, nút đầu trang, thao tác bảng, vị trí Lưu)

- Trạng thái: in-progress · Làn: L (≥2 nhóm màn, >8 file) · Nhánh: `fix/G94-272-FE-FIX-01-e2e-flow-fixes`
- Nguồn: góp ý user 05/11/2026 (4 điểm). Chế độ tự chạy: phương án do agent chọn, ghi ở mục Quyết định.

## Góp ý → việc

1. `/menu/setup`: bảng định mức trống phải; nhóm tuổi chia tab; bảng "Bữa ăn và tỷ lệ năng lượng" tách khung khỏi bảng định mức.
2. Màn vận hành bếp: nút đầu trang (Dự trù tuần sau, In biểu mẫu, Khung giờ ảnh…) nằm quá cao (bị đẩy lên hàng breadcrumb); thiếu nhập/xuất.
3. Thao tác trong bảng lúc icon lúc chữ; Lưu lúc trên lúc dưới ⇒ một quy ước.
4. Bỏ icon Xem: bấm dòng mở chi tiết; giữ icon Sửa.

## Quyết định (user soát)

- **D1 — Tab nhóm tuổi:** tab "Bữa ăn & chuẩn tạm" thay accordion bằng dải tab con theo nhóm tuổi (nhóm có lỗi hiện chấm đỏ trên tab). Nội dung một nhóm: thanh giá + phiên bản trên cùng; dưới chia 2 cột ≥1200px — trái thẻ "Định mức / trẻ / ngày", phải thẻ "Bữa ăn và tỷ lệ năng lượng từng bữa" (thẻ riêng, viền riêng). <1200px xếp dọc. Bỏ giới hạn 760px của bảng định mức (cột tự giãn trong thẻ).
- **D2 — Nút đầu trang khu bán trú:** không đẩy nút lên hàng breadcrumb nữa; nút nằm cùng hàng mô tả, căn phải, cỡ thường (`btn`). Áp bằng CSS theo `[data-area='boarding']`, không đổi các khu khác.
- **D3 — Xuất Excel:** thêm nút "Xuất Excel" (CSV UTF-8, `downloadCsv` sẵn có) ở đầu trang: Dự trù & đi chợ (phiếu đặt hàng tuần: hàng tươi + đồ khô), Lưu mẫu thức ăn (sổ duyệt). **Nhập (import):** BE chỉ có `POST /nutrition/foods/import` (FE đã có "Nhập khẩu cập nhật" ở Thực phẩm) — đổi nhãn thành "Nhập từ Excel" cho dễ hiểu. Màn bếp khác **không thêm nhập** vì BE chưa có API — cần thống nhất contract BE trước (ghi ở báo cáo).
- **D4 — Thao tác dòng bảng (cập nhật DESIGN §6.3):** bấm dòng (hoặc Enter khi focus tên) mở chi tiết; không còn icon/mục "Xem chi tiết". Cột thao tác: icon Sửa (`Pencil`, tooltip) + menu "…" cho thao tác khác (Sao chép, Ngừng dùng, Xóa). Nút nghiệp vụ chính của dòng (Duyệt…) giữ `btn--sm`. Không dùng nút chữ rời. Đợt này áp khu bán trú (Thực phẩm, Món ăn, Nhà cung cấp, Thực đơn thay thế, Tổng quan nhóm tuổi); khu khác dùng `RowActions view` sẽ chuyển ở đợt sau.
- **D5 — Vị trí Lưu (cập nhật DESIGN):** mọi màn sửa: Hủy/Lưu ở thanh `.page-actions` dính đáy (F1, đa số form đã theo). Đầu trang chỉ chứa thao tác không phải lưu (Tạo mới, Xuất Excel, In, Lịch sử). Chuyển: Thiết lập dinh dưỡng, Món ăn (đang ở EditHead), Mẫu thực đơn ngày, Kế hoạch tuần (Lưu nháp + Công bố tuần). Lưới sửa trong một thẻ của màn xem (Dự trù tuần, Khung giờ ảnh) giữ nút ở chân thẻ — vẫn là "dưới".

## Phase

1. Thiết lập dinh dưỡng (D1 + D5) — `NutritionSetupPage.jsx`, `menu-planning.css`.
2. Nút đầu trang + xuất/nhập (D2, D3) — `components.css`, `WeeklyForecastPage.jsx`, `FoodSampleQueuePage.jsx`, `FoodListPage.jsx`.
3. Thao tác dòng (D4) — `RowActions`/danh sách bán trú, DESIGN §6.3.
4. Vị trí Lưu (D5) — `DishFormPage`, `MenuTemplateEditorPage`, `WeeklyPlanPage`.
5. Verify: `node scripts/verify.mjs`, `check-ai-layer`, soát trình duyệt 1440/375 (mock 5180).

## Progress log

### 2026-11-05 — bắt đầu

- Khảo sát: nút đầu trang bị CSS chung `.breadcrumb + .page__head > :last-child` (≥1024px) đẩy lên hàng breadcrumb. BE import duy nhất: foods.

### 2026-11-05 — Phase 1–4 xong, chờ user soát

- P1: `NutritionSetupGroup` (mới) — tab nhóm tuổi, thanh giá/phiên bản, 2 thẻ Định mức | Bữa ăn (≥1200px chia đôi). Tổng quan: bấm dòng mở nhóm, icon Sửa thay nút chữ. Lưu/Hủy xuống thanh dính đáy; lưu lỗi tự nhảy tới tab nhóm có ô sai.
- P2: CSS `[data-area='boarding']` giữ nút đầu trang ở hàng mô tả. Xuất Excel (CSV): Dự trù & đi chợ, Lưu mẫu thức ăn (`utils/kitchen/kitchenExport.js`). "Nhập khẩu cập nhật" → "Nhập từ Excel".
- P3: Thực phẩm, Món ăn, Nhà cung cấp, Thực đơn thay thế — bấm dòng mở chi tiết, bỏ "Xem chi tiết"; Sửa = icon (Món ăn thêm icon Nhân bản). DESIGN §6.3 cập nhật quy ước thao tác dòng + dòng mới "Vị trí Lưu, nút đầu trang".
- P4: Món ăn (EditHead → thanh đáy), Mẫu thực đơn ngày, Kế hoạch tuần (Lưu nháp + Công bố tuần) → `.page-actions` dính đáy.
- Thay đổi hành vi cần biết: Thực phẩm với người có quyền, bấm dòng trước mở modal sửa, nay mở trang chi tiết; Món ăn bấm dòng trước mở trang sửa, nay mở chi tiết.
- Chưa soát trình duyệt: Kế hoạch tuần, Mẫu ngày, Lưu mẫu thức ăn (chỉ có ở chế độ API, máy không chạy BE) — chỉ qua build/lint.
- Ngoài phạm vi đợt này: các khu khác còn `RowActions view` (≈30 file); nhập Excel cho màn bếp cần BE thêm API.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`. Soát 1440 + 375 (mock 5180): `/menu/setup`, `/kitchen/forecast`, `/menu/dishes`; 375 không cuộn ngang.

### 2026-11-05 — user: thanh Lưu dính đáy "rất vướng" ⇒ đổi D5

- D5 mới: khu bán trú đặt Hủy / Lưu ở đầu màn, căn phải; bỏ kiểu nổi dính đáy (CSS `[data-area='boarding'] .page-actions` về hàng thường).
- Trả về đầu: Thiết lập dinh dưỡng (đầu trang), Món ăn (EditHead), Mẫu ngày (đầu khung soạn), Kế hoạch tuần (thanh trạng thái).
- Dời lên đầu form (`.page-actions--top`): Thực phẩm, Nhà cung cấp, Thực đơn thay thế, Thực đơn tuần (mock), Phiếu nhập kho (2 màn), Cân đối khẩu phần, Lập bản dự trù hàng tươi.
- Màn chi tiết giữ "Quay lại danh sách" ở cuối (không còn nổi).

### 2026-11-05 — user: xuất dữ liệu phải xem trước; màn dài chia tab

- D6 xem trước: `ExportPreview` (host ở App) + `exportWithPreview`; thay toàn bộ `downloadXlsx` xuất dữ liệu (9 file, cả ngoài bán trú) và CSV xuất ở bếp (4 file) — nay ra .xlsx thật. File mẫu nhập (thực phẩm trẻ, phiếu nhập kho) giữ tải thẳng.
- D7 chia tab: `useTabParam` + `.tab-panel`. Áp: Chi tiết thực phẩm (Thông tin & dinh dưỡng | Dùng trong món | Lịch sử), Chi tiết món (Tổng quan & dinh dưỡng | Thành phần | Dùng trong thực đơn & lịch sử), Bếp hôm nay (Món | Suất theo lớp | Thực phẩm cần), Kế hoạch tuần (`?view=`: Thực đơn tuần | Bảng kiểm dinh dưỡng).
- Không chia tab: form nhập (Thực phẩm, Món, Phiếu nhập) — dễ giấu ô lỗi; danh sách; màn đã có tab.

### 2026-11-05 — user: nhóm tuổi xếp bữa ăn trước; cột thao tác phải có chữ

- Thiết lập dinh dưỡng: trong mỗi nhóm tuổi bỏ 2 cột, thay bằng tab con "Bữa ăn và tỷ lệ năng lượng" (đầu) | "Định mức / trẻ / ngày"; tab có ô lỗi hiện chấm đỏ, lỗi chỉ ở tab kia thì tự chuyển.
- Tiêu đề cột thao tác: thay `aria-label`/`sr-only`/trống bằng chữ "Thao tác" ở 18 file (cả ngoài bán trú: điểm danh sức khỏe, chờ duyệt, cấu hình lớp năm học…); cột STT ghi "STT"; AutoChecks cột đầu ghi "Chỉ số".

### 2026-11-05 — user: bố cục nhóm tuổi "rất xấu" ⇒ thiết kế lại

- Bỏ thanh tab nhóm tuổi + thẻ đầu nhóm rời + tab con dạng viên. Thay bằng danh sách trái – chi tiết phải (dùng lại `td-tpl-split`/`td-tpl-row` của Mẫu thực đơn ngày): trái là danh sách nhóm tuổi (độ tuổi, giá, trạng thái, chấm lỗi); phải là **một thẻ**: đầu thẻ (tên, lịch sử, áp dụng) → 2 ô chính (giá suất, nhu cầu năng lượng cả ngày) → tab trong thẻ "Bữa ăn và tỷ lệ năng lượng" | "Định mức / trẻ / ngày".
- Bảng bữa ăn cùng cột với bảng định mức (Tối thiểu | Tối đa | Đơn vị); cột Thao tác chỉ khi có bữa thêm bỏ được. <1100px xếp dọc.

### 2026-11-05 — user: bỏ đoạn mô tả dài

- Bỏ `page__desc` ở 24 màn khu bán trú (breadcrumb đã là tên màn); Thống kê định lượng chuyển ngữ cảnh (mẫu/ngày) vào mục cuối breadcrumb. Thiết lập dinh dưỡng bỏ thêm câu giới thiệu bảng tổng quan, đoạn giải thích định mức và gợi ý ô nhu cầu năng lượng. Giữ lỗi, cảnh báo, ghi chú phiên bản, "Giá mới từ ngày…".

### 2026-11-05 — user: dòng thời gian bếp phải biết "bây giờ cần làm gì"

- Quy trình bếp hôm nay (`/kitchen`, cũng là trang chủ PHT/bếp): khi xem ngày hôm nay — dải đầu thẻ "Bây giờ HH:mm · Cần làm / Việc tiếp theo: <bước> (giờ) + link"; vạch đỏ "Bây giờ" chèn đúng vị trí giờ; bước nên làm tô khung + chip "Cần làm lúc này". Chọn bước: bước chưa xong (không tính bỏ qua) đầu tiên đã tới giờ dự kiến; chưa tới thì bước chưa xong kế tiếp. Chỉ nhắc, không khóa thao tác (giờ là giờ dự kiến `KITCHEN_DAY_TIMES`).
- Hook mới `useClock` (giờ trường Asia/Ho_Chi_Minh, cập nhật 30 giây).

### 2026-11-05 — user: Thực đơn bếp nhận chưa chia tab, định lượng khó nhìn

- `/kitchen/published-menu`: bỏ ô chọn "Nhóm tuổi" + các bảng xếp chồng ⇒ tab nhóm tuổi (`?group=`), một thẻ cho nhóm đang mở. Đổi ngày / kiểu xem giữ tab đang mở.
- Xem ngày: mỗi thực phẩm một dòng, cột Bữa | Món ăn | Thực phẩm | Lượng / suất | Đơn vị (trước là chuỗi "Gạo tẻ 30 kg · …"). Bỏ cột "Thực đơn" (màn chỉ hiện thực đơn thường); hướng dẫn thực đơn dưới tên bữa. Xem tuần giữ nguyên bảng.
- Lưu ý dữ liệu: số ở cột "Lượng / suất" (vd. gạo 30 kg, sữa 150 hộp) trông là tổng cả bếp chứ không phải một suất — field `qtyPerPortion`; cần đối chiếu BE/mock trước khi đổi nhãn.
- Đã kiểm và sửa (user "Kiểm luôn"): lỗi đơn vị chỉ ở mock (`getPublishedMenu`), xem `docs/knowledge/incidents/FE-BUG-261105-published-menu-portion-unit.md`. Nhà trẻ nay ra gạo 21 g, sữa 105 ml / suất.

### 2026-11-05 — user: thông tin tài khoản phải có điểm trường…
- Hộp tài khoản (sidebar): dòng phụ "Vai trò · Điểm trường" (Hiệu trưởng không gắn điểm trường ⇒ "Toàn trường"). Đầu menu tài khoản: email + Điểm trường (tên đầy đủ), Lớp chủ nhiệm (giáo viên), Nhóm tuổi phụ trách (tổ trưởng).
- Hook `useAccountScope` tra tên từ danh mục vì BE `/accounts/me` chỉ trả mã (campusId, classroomId, ageGroupId); chỉ hiển thị, không dùng phân quyền. Đề xuất BE: trả kèm tên trong `assignments` để khỏi tải danh mục.
- Khôi phục 52 file `docs/knowledge` bị Prettier định dạng lại (user cho phép); ISSUE_INDEX = bản commit + 6 dòng thêm.
- User: khối thông tin trong menu tài khoản vỡ bố cục, không cần ⇒ bỏ; menu giữ email như cũ. Chỉ còn dòng "Vai trò · Điểm trường" ở hộp tài khoản; `useAccountScope` rút còn điểm trường.

### 2026-11-05 — user: luồng nhập Excel mở modal thay panel bên phải
- `ImportDialog` mới (modal xl): hướng dẫn + tải tệp mẫu → kéo thả / tải lên (≤10MB) → tệp đã chọn + "Chọn tệp khác" + xem trước → Hủy / Xác nhận. Chuyển 3 luồng: Thực phẩm, Tài khoản nhân sự, Phòng & lớp / Giáo viên năm học. Bỏ CSS `td-import-*`; DESIGN §6.3 thêm dòng "Nhập từ Excel".
- Không đổi: Nhập trẻ (trang riêng `ImportChildrenPage`), xếp lớp, nhập dòng vào phiếu nhập kho (điền thẳng vào form).
